-- ============================================================================
-- 008: COLLABORATIVE CHAT ATOMIC FIXES
-- ============================================================================
-- This migration adds atomic functions to prevent race conditions in:
-- 1. Join flow (participant count check + insert)
-- 2. Invite use count increment
-- 3. Ownership transfer
-- ============================================================================

-- ============================================================================
-- 1. ATOMIC JOIN FUNCTION
-- Prevents race condition where multiple users join simultaneously
-- ============================================================================

CREATE OR REPLACE FUNCTION join_collaborative_chat(
  p_chat_id UUID,
  p_user_id UUID,
  p_invite_code TEXT,
  p_invited_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_invite RECORD;
  v_chat RECORD;
  v_existing_collab RECORD;
  v_current_count INT;
  v_max_participants INT;
  v_color_index INT;
  v_result JSONB;
BEGIN
  -- Lock the chat row to prevent concurrent joins
  SELECT id, title, max_participants, user_id, is_collaborative
  INTO v_chat
  FROM chats
  WHERE id = p_chat_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chat not found');
  END IF;

  IF NOT v_chat.is_collaborative THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chat is not collaborative');
  END IF;

  -- Validate invite (with lock)
  SELECT * INTO v_invite
  FROM chat_invites
  WHERE chat_id = p_chat_id
    AND invite_code = p_invite_code
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite code');
  END IF;

  -- Check invite expiry
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite has expired');
  END IF;

  -- Check invite max uses
  IF v_invite.max_uses IS NOT NULL AND COALESCE(v_invite.use_count, 0) >= v_invite.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite has reached maximum uses');
  END IF;

  -- Check if user is already a collaborator
  SELECT * INTO v_existing_collab
  FROM chat_collaborators
  WHERE chat_id = p_chat_id AND user_id = p_user_id;

  IF FOUND THEN
    IF v_existing_collab.status = 'accepted' THEN
      RETURN jsonb_build_object('success', false, 'error', 'You are already a member of this chat');
    END IF;
    -- Re-join: update status
    UPDATE chat_collaborators
    SET status = 'accepted', joined_at = NOW()
    WHERE id = v_existing_collab.id;

    -- Increment invite use count atomically
    UPDATE chat_invites
    SET use_count = COALESCE(use_count, 0) + 1,
        is_active = CASE
          WHEN max_uses IS NOT NULL AND COALESCE(use_count, 0) + 1 >= max_uses THEN false
          ELSE is_active
        END
    WHERE id = v_invite.id;

    RETURN jsonb_build_object(
      'success', true,
      'chat_id', v_chat.id,
      'chat_title', v_chat.title,
      'rejoined', true
    );
  END IF;

  -- Count current participants (with lock already held on chat)
  SELECT COUNT(*) INTO v_current_count
  FROM chat_collaborators
  WHERE chat_id = p_chat_id AND status = 'accepted';

  v_max_participants := COALESCE(v_chat.max_participants, 3);

  IF v_current_count >= v_max_participants THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chat is at maximum capacity');
  END IF;

  -- Assign color index (1 or 2, since 0 is for owner)
  SELECT COALESCE(MAX(color_index), 0) + 1 INTO v_color_index
  FROM chat_collaborators
  WHERE chat_id = p_chat_id AND status = 'accepted';

  -- Cap at 2 (colors are 0, 1, 2)
  IF v_color_index > 2 THEN
    v_color_index := 1;
  END IF;

  -- Insert new collaborator
  INSERT INTO chat_collaborators (
    chat_id, user_id, role, status, color_index, invited_by, joined_at
  ) VALUES (
    p_chat_id, p_user_id, 'participant', 'accepted', v_color_index,
    COALESCE(p_invited_by, v_invite.created_by), NOW()
  );

  -- Increment invite use count atomically and deactivate if needed
  UPDATE chat_invites
  SET use_count = COALESCE(use_count, 0) + 1,
      is_active = CASE
        WHEN max_uses IS NOT NULL AND COALESCE(use_count, 0) + 1 >= max_uses THEN false
        ELSE is_active
      END
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'chat_id', v_chat.id,
    'chat_title', v_chat.title,
    'color_index', v_color_index,
    'rejoined', false
  );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 2. ATOMIC OWNERSHIP TRANSFER FUNCTION
-- Prevents partial updates if any step fails
-- ============================================================================

CREATE OR REPLACE FUNCTION transfer_chat_ownership(
  p_chat_id UUID,
  p_current_owner_id UUID,
  p_new_owner_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_chat RECORD;
  v_new_owner_collab RECORD;
  v_current_owner_collab RECORD;
  v_new_owner_old_color INT;
BEGIN
  -- Lock the chat row
  SELECT id, user_id INTO v_chat
  FROM chats
  WHERE id = p_chat_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chat not found');
  END IF;

  IF v_chat.user_id != p_current_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the owner can transfer ownership');
  END IF;

  -- Get new owner's collaborator record (with lock)
  SELECT * INTO v_new_owner_collab
  FROM chat_collaborators
  WHERE chat_id = p_chat_id
    AND user_id = p_new_owner_id
    AND status = 'accepted'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'New owner must be an existing participant');
  END IF;

  -- Get current owner's collaborator record (with lock)
  SELECT * INTO v_current_owner_collab
  FROM chat_collaborators
  WHERE chat_id = p_chat_id
    AND user_id = p_current_owner_id
  FOR UPDATE;

  -- Store new owner's old color for swap
  v_new_owner_old_color := COALESCE(v_new_owner_collab.color_index, 1);

  -- Update chat owner
  UPDATE chats
  SET user_id = p_new_owner_id
  WHERE id = p_chat_id;

  -- Update new owner to role=owner, color=0
  UPDATE chat_collaborators
  SET role = 'owner', color_index = 0
  WHERE id = v_new_owner_collab.id;

  -- Update old owner to role=participant, inherit new owner's old color
  IF v_current_owner_collab.id IS NOT NULL THEN
    UPDATE chat_collaborators
    SET role = 'participant', color_index = v_new_owner_old_color
    WHERE id = v_current_owner_collab.id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 3. ATOMIC INVITE INCREMENT (standalone for other use cases)
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_invite_use(p_invite_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_invite RECORD;
BEGIN
  SELECT * INTO v_invite
  FROM chat_invites
  WHERE id = p_invite_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite not found');
  END IF;

  UPDATE chat_invites
  SET use_count = COALESCE(use_count, 0) + 1,
      is_active = CASE
        WHEN max_uses IS NOT NULL AND COALESCE(use_count, 0) + 1 >= max_uses THEN false
        ELSE is_active
      END
  WHERE id = p_invite_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_count', COALESCE(v_invite.use_count, 0) + 1,
    'is_active', CASE
      WHEN v_invite.max_uses IS NOT NULL AND COALESCE(v_invite.use_count, 0) + 1 >= v_invite.max_uses THEN false
      ELSE v_invite.is_active
    END
  );
END;
$$ LANGUAGE plpgsql;
