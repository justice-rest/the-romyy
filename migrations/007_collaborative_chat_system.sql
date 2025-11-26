-- Rōmy Database Migration v7
-- Collaborative Multi-User Chat System
--
-- This migration adds support for collaborative chats where 2-3 users
-- can chat with AI together in real-time.
--
-- Features:
-- - Chat collaborators (who has access to which chat)
-- - Shareable invite links
-- - Chat locks (prevent simultaneous prompts)
-- - Sender info in messages for iMessage-style display

-- ============================================================================
-- CHAT COLLABORATORS TABLE
-- ============================================================================
-- Tracks who has access to collaborative chats

CREATE TABLE IF NOT EXISTS chat_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('owner', 'participant')),
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'declined', 'removed')),
  color_index INTEGER DEFAULT 1, -- For iMessage-style colors (0=owner, 1-2=participants)
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES users(id),

  -- Unique constraint: one user per chat
  UNIQUE(chat_id, user_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_collaborators_chat_id ON chat_collaborators(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_collaborators_user_id ON chat_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_collaborators_status ON chat_collaborators(status);

-- ============================================================================
-- CHAT INVITES TABLE
-- ============================================================================
-- Shareable invite links for collaborative chats

CREATE TABLE IF NOT EXISTS chat_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  max_uses INTEGER DEFAULT 2, -- Max 2 more users (3 total with owner)
  use_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_invites_code ON chat_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_chat_invites_chat_id ON chat_invites(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_invites_active ON chat_invites(is_active) WHERE is_active = true;

-- ============================================================================
-- CHAT LOCKS TABLE
-- ============================================================================
-- Tracks who is currently prompting (prevents simultaneous prompts)

CREATE TABLE IF NOT EXISTS chat_locks (
  chat_id UUID PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
  locked_by UUID REFERENCES users(id),
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  -- Auto-expire locks after 5 minutes (safety measure)
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_locks_locked_by ON chat_locks(locked_by);
CREATE INDEX IF NOT EXISTS idx_chat_locks_expires_at ON chat_locks(expires_at);

-- ============================================================================
-- MODIFY EXISTING CHATS TABLE
-- ============================================================================

ALTER TABLE chats ADD COLUMN IF NOT EXISTS is_collaborative BOOLEAN DEFAULT false;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 3;

-- Index for collaborative chats
CREATE INDEX IF NOT EXISTS idx_chats_is_collaborative ON chats(is_collaborative) WHERE is_collaborative = true;

-- ============================================================================
-- MODIFY EXISTING MESSAGES TABLE
-- ============================================================================
-- Add sender info for display in collaborative chats

ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_display_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_profile_image TEXT;

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- Function to acquire a chat lock (atomic operation)
CREATE OR REPLACE FUNCTION acquire_chat_lock(p_chat_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_lock_acquired BOOLEAN := FALSE;
BEGIN
  -- Clean up expired locks first
  DELETE FROM chat_locks WHERE expires_at < NOW();

  -- Try to insert a new lock, or update if we already hold it
  INSERT INTO chat_locks (chat_id, locked_by, locked_at, expires_at)
  VALUES (p_chat_id, p_user_id, NOW(), NOW() + INTERVAL '5 minutes')
  ON CONFLICT (chat_id) DO UPDATE
  SET
    locked_by = p_user_id,
    locked_at = NOW(),
    expires_at = NOW() + INTERVAL '5 minutes'
  WHERE
    chat_locks.expires_at < NOW() OR
    chat_locks.locked_by = p_user_id;

  -- Check if we got the lock
  SELECT locked_by = p_user_id INTO v_lock_acquired
  FROM chat_locks
  WHERE chat_id = p_chat_id;

  RETURN COALESCE(v_lock_acquired, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to release a chat lock
CREATE OR REPLACE FUNCTION release_chat_lock(p_chat_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM chat_locks
  WHERE chat_id = p_chat_id
  AND locked_by = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can prompt (is collaborator + chat not locked by someone else)
CREATE OR REPLACE FUNCTION can_user_prompt(p_chat_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_lock RECORD;
  v_is_collaborator BOOLEAN;
  v_locker_name TEXT;
BEGIN
  -- Check if user is a collaborator
  SELECT EXISTS (
    SELECT 1 FROM chat_collaborators
    WHERE chat_id = p_chat_id
    AND user_id = p_user_id
    AND status = 'accepted'
  ) INTO v_is_collaborator;

  -- Also check if user is the chat owner (for non-collaborative chats)
  IF NOT v_is_collaborator THEN
    SELECT EXISTS (
      SELECT 1 FROM chats
      WHERE id = p_chat_id
      AND user_id = p_user_id
    ) INTO v_is_collaborator;
  END IF;

  IF NOT v_is_collaborator THEN
    RETURN jsonb_build_object('can_prompt', false, 'reason', 'not_collaborator');
  END IF;

  -- Clean up expired locks
  DELETE FROM chat_locks WHERE expires_at < NOW();

  -- Check for existing lock
  SELECT * INTO v_lock
  FROM chat_locks
  WHERE chat_id = p_chat_id;

  IF v_lock IS NOT NULL AND v_lock.locked_by != p_user_id THEN
    -- Get locker's display name
    SELECT display_name INTO v_locker_name
    FROM users
    WHERE id = v_lock.locked_by;

    RETURN jsonb_build_object(
      'can_prompt', false,
      'reason', 'locked',
      'locked_by', v_lock.locked_by,
      'locked_by_name', COALESCE(v_locker_name, 'Another user'),
      'locked_at', v_lock.locked_at
    );
  END IF;

  RETURN jsonb_build_object('can_prompt', true);
END;
$$ LANGUAGE plpgsql;

-- Function to get participant count for a chat
CREATE OR REPLACE FUNCTION get_chat_participant_count(p_chat_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM chat_collaborators
    WHERE chat_id = p_chat_id
    AND status = 'accepted'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to assign color index to new collaborator
CREATE OR REPLACE FUNCTION assign_collaborator_color(p_chat_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_used_colors INTEGER[];
  v_new_color INTEGER;
BEGIN
  -- Get used color indices
  SELECT ARRAY_AGG(color_index) INTO v_used_colors
  FROM chat_collaborators
  WHERE chat_id = p_chat_id
  AND status = 'accepted';

  -- Find first available color (1 or 2, 0 is reserved for owner)
  IF v_used_colors IS NULL OR NOT (1 = ANY(v_used_colors)) THEN
    RETURN 1;
  ELSIF NOT (2 = ANY(v_used_colors)) THEN
    RETURN 2;
  ELSE
    RETURN 1; -- Fallback
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE chat_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_locks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CHAT_COLLABORATORS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view collaborators in their chats" ON chat_collaborators;
DROP POLICY IF EXISTS "Chat owners can manage collaborators" ON chat_collaborators;
DROP POLICY IF EXISTS "Users can update their own collaboration status" ON chat_collaborators;
DROP POLICY IF EXISTS "Chat owners can remove collaborators" ON chat_collaborators;

-- View: Users can see collaborators in chats they're part of
CREATE POLICY "Users can view collaborators in their chats"
  ON chat_collaborators FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chat_collaborators cc
      WHERE cc.chat_id = chat_collaborators.chat_id
      AND cc.user_id = auth.uid()
      AND cc.status = 'accepted'
    ) OR
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_collaborators.chat_id
      AND chats.user_id = auth.uid()
    )
  );

-- Insert: Chat owners can add collaborators
CREATE POLICY "Chat owners can manage collaborators"
  ON chat_collaborators FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_collaborators.chat_id
      AND chats.user_id = auth.uid()
    )
  );

-- Update: Users can update their own status (accept/decline), owners can update anyone
CREATE POLICY "Users can update their own collaboration status"
  ON chat_collaborators FOR UPDATE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_collaborators.chat_id
      AND chats.user_id = auth.uid()
    )
  );

-- Delete: Chat owners can remove collaborators, users can remove themselves
CREATE POLICY "Chat owners can remove collaborators"
  ON chat_collaborators FOR DELETE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_collaborators.chat_id
      AND chats.user_id = auth.uid()
    )
  );

-- ============================================================================
-- CHAT_INVITES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view active invite by code" ON chat_invites;
DROP POLICY IF EXISTS "Chat owners can manage invites" ON chat_invites;

-- View: Anyone with the code can view active invites (for join flow)
CREATE POLICY "Anyone can view active invite by code"
  ON chat_invites FOR SELECT
  USING (is_active = true);

-- All operations: Chat owners only
CREATE POLICY "Chat owners can manage invites"
  ON chat_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_invites.chat_id
      AND chats.user_id = auth.uid()
    )
  );

-- ============================================================================
-- CHAT_LOCKS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Collaborators can view locks" ON chat_locks;
DROP POLICY IF EXISTS "Collaborators can manage locks" ON chat_locks;

-- View: Collaborators can see lock status
CREATE POLICY "Collaborators can view locks"
  ON chat_locks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_collaborators
      WHERE chat_collaborators.chat_id = chat_locks.chat_id
      AND chat_collaborators.user_id = auth.uid()
      AND chat_collaborators.status = 'accepted'
    ) OR
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_locks.chat_id
      AND chats.user_id = auth.uid()
    )
  );

-- All operations: Collaborators can create/update/delete locks
CREATE POLICY "Collaborators can manage locks"
  ON chat_locks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chat_collaborators
      WHERE chat_collaborators.chat_id = chat_locks.chat_id
      AND chat_collaborators.user_id = auth.uid()
      AND chat_collaborators.status = 'accepted'
    ) OR
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_locks.chat_id
      AND chats.user_id = auth.uid()
    )
  );

-- ============================================================================
-- UPDATE EXISTING CHATS POLICIES FOR COLLABORATIVE ACCESS
-- ============================================================================

-- Drop and recreate the view policy to include collaborators
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
DROP POLICY IF EXISTS "Collaborators can view collaborative chats" ON chats;

CREATE POLICY "Users can view their own chats"
  ON chats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Collaborators can view collaborative chats"
  ON chats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_collaborators
      WHERE chat_collaborators.chat_id = chats.id
      AND chat_collaborators.user_id = auth.uid()
      AND chat_collaborators.status = 'accepted'
    )
  );

-- ============================================================================
-- UPDATE EXISTING MESSAGES POLICIES FOR COLLABORATIVE ACCESS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can create messages in their chats" ON messages;
DROP POLICY IF EXISTS "Collaborators can view collaborative messages" ON messages;
DROP POLICY IF EXISTS "Collaborators can create collaborative messages" ON messages;

-- View own chat messages
CREATE POLICY "Users can view messages in their chats"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND chats.user_id = auth.uid()
    )
  );

-- View collaborative chat messages
CREATE POLICY "Collaborators can view collaborative messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_collaborators cc
      WHERE cc.chat_id = messages.chat_id
      AND cc.user_id = auth.uid()
      AND cc.status = 'accepted'
    )
  );

-- Create messages in own chats
CREATE POLICY "Users can create messages in their chats"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND chats.user_id = auth.uid()
    )
  );

-- Create messages in collaborative chats
CREATE POLICY "Collaborators can create collaborative messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_collaborators cc
      WHERE cc.chat_id = messages.chat_id
      AND cc.user_id = auth.uid()
      AND cc.status = 'accepted'
    )
  );

-- ============================================================================
-- ENABLE REALTIME FOR COLLABORATIVE TABLES
-- ============================================================================
-- Note: You may need to enable realtime for these tables in the Supabase dashboard
-- or via the CLI. This is done in the Supabase project settings.

-- To enable via SQL (requires superuser):
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_collaborators;
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_invites;
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_locks;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('chat_collaborators', 'chat_invites', 'chat_locks');

  RAISE NOTICE 'Collaborative chat migration complete! Created % new tables.', table_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Remember to:';
  RAISE NOTICE '1. Enable Realtime for chat_collaborators, chat_invites, chat_locks, messages tables';
  RAISE NOTICE '2. Run: ALTER PUBLICATION supabase_realtime ADD TABLE chat_collaborators;';
  RAISE NOTICE '3. Run: ALTER PUBLICATION supabase_realtime ADD TABLE chat_locks;';
  RAISE NOTICE '4. Run: ALTER PUBLICATION supabase_realtime ADD TABLE messages;';
  RAISE NOTICE '5. Update TypeScript types by regenerating database.types.ts';
END $$;
