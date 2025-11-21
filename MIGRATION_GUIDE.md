# Database Migration Guide

This guide explains how to set up your Rōmy database schema in Supabase.

## Important Note About Subscriptions

**Autumn subscriptions DO NOT require any database tables!**

All subscription data (plans, customers, payments, usage) is managed by Autumn via their API and Stripe. The migration file only creates the core Rōmy tables for chats, messages, users, etc.

## Prerequisites

- Supabase project created
- `.env.local` file configured with Supabase credentials
- Basic familiarity with SQL (for manual method)

## Method 1: Automated Migration (Recommended)

This method uses a bash script to automatically run the migration.

### Step 1: Ensure Environment Variables

Make sure your `.env.local` has:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE=your_service_role_key
```

### Step 2: Run Migration Command

```bash
npm run migrate
```

The script will:
1. Validate your Supabase credentials
2. Ask for confirmation
3. Execute the migration
4. Show you next steps

### Example Output

```
========================================
  Rōmy Database Migration
========================================

Project: abcdefghijk
URL: https://abcdefghijk.supabase.co

Running migration: migrations/001_initial_schema.sql

This will create/update tables in your Supabase database. Continue? [y/N]: y

Executing migration...
✓ Migration completed successfully!

Next steps:
  1. Create storage buckets in Supabase Dashboard:
     - chat-attachments (for file uploads)
     - avatars (for user profile images)

  2. Enable authentication providers:
     - Google OAuth (for social login)
     - Anonymous sign-ins (for guest users)

  3. If using subscriptions, configure Autumn products:
     - Visit: https://app.useautumn.com/sandbox
     - Create products: basic, premium, pro
     - See: SUBSCRIPTION_SETUP.md for details
```

## Method 2: Manual Migration via Supabase Dashboard

If the automated script doesn't work, you can run the migration manually.

### Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** in the sidebar
4. Click **New Query**

### Step 2: Copy Migration File

1. Open `migrations/001_initial_schema.sql` in your code editor
2. Copy the entire contents (Ctrl/Cmd + A, then Ctrl/Cmd + C)

### Step 3: Paste and Execute

1. Paste the SQL into the Supabase SQL Editor
2. Click **Run** (or press Ctrl/Cmd + Enter)
3. Wait for execution to complete

### Step 4: Verify Success

You should see a success message like:

```
Success. No rows returned.
NOTICE: Migration complete! Created 8 tables.
NOTICE: Remember to:
NOTICE: 1. Create storage buckets: chat-attachments, avatars
NOTICE: 2. Enable Google OAuth in Supabase Auth settings
NOTICE: 3. Enable anonymous sign-ins in Supabase Auth settings
NOTICE: 4. Configure Autumn products if using subscriptions
```

## Quick Command Reference

```bash
# Run automated migration
npm run migrate

# Get manual migration instructions
npm run migrate:manual

# This will output:
# Copy migrations/001_initial_schema.sql and paste into
# Supabase SQL Editor at: https://supabase.com/dashboard/project/_/sql/new
```

## What Gets Created

The migration creates the following tables:

### Core Tables
- **users** - User profiles and settings
- **projects** - Organization structure for chats
- **chats** - Individual conversations
- **messages** - Chat messages with attachments
- **chat_attachments** - File upload metadata
- **feedback** - User feedback and bug reports

### Feature Tables
- **user_keys** - Encrypted API keys (BYOK feature)
- **user_preferences** - UI/UX settings per user

### Security
- **Row Level Security (RLS)** - Enabled on all tables
- **Policies** - Users can only access their own data
- **Triggers** - Auto-update timestamps

### Indexes
All tables have appropriate indexes for optimal query performance.

## Post-Migration Steps

After running the migration, you need to complete these manual steps in your Supabase dashboard:

### 1. Create Storage Buckets

Navigate to **Storage** in Supabase dashboard:

#### Create `chat-attachments` bucket:
1. Click **New bucket**
2. Name: `chat-attachments`
3. Public: **Yes** (or configure custom policies)
4. Click **Create bucket**

#### Create `avatars` bucket:
1. Click **New bucket**
2. Name: `avatars`
3. Public: **Yes** (or configure custom policies)
4. Click **Create bucket**

### 2. Configure Authentication

Navigate to **Authentication > Providers**:

#### Enable Google OAuth:
1. Toggle **Google** provider ON
2. Click **Configure**
3. Follow the setup wizard (see INSTALL.md for detailed steps)
4. Add your Google Client ID and Secret
5. Save configuration

#### Enable Anonymous Sign-ins:
1. Scroll to **Anonymous sign-ins**
2. Toggle **ON**
3. This allows guest users to try Rōmy before signing up

### 3. Set Up Subscriptions (Optional)

If you want to enable paid subscriptions:

1. **Get Autumn API key** from https://app.useautumn.com/sandbox/dev
2. **Add to environment**:
   ```bash
   AUTUMN_SECRET_KEY=am_sk_test_your_key_here
   ```
3. **Create products in Autumn dashboard**:
   - Basic ($29/month) - 100 messages
   - Premium ($89/month) - Unlimited messages
   - Pro ($200/month) - Unlimited + consultation

See **SUBSCRIPTION_SETUP.md** for complete instructions.

## Troubleshooting

### "Migration failed with HTTP code: 401"

**Solution**: Check that `SUPABASE_SERVICE_ROLE` in your `.env.local` is correct. This should be the **service role key**, not the anon key.

### "Permission denied for table users"

**Solution**: Make sure you're using the service role key, which has admin privileges.

### "Relation already exists"

**Solution**: The migration uses `CREATE TABLE IF NOT EXISTS`, so this is safe. The migration is idempotent and can be run multiple times.

### "Function exec_sql does not exist"

**Solution**: Use the manual migration method instead. Some Supabase projects don't have the `exec_sql` function enabled.

### Tables created but RLS policies not working

**Solution**:
1. Go to **Authentication > Policies** in Supabase
2. Verify policies are listed for each table
3. If missing, re-run the migration

## Verifying the Migration

After migration, verify everything is set up correctly:

### Check Tables

In Supabase SQL Editor, run:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see all 8 tables listed.

### Check RLS

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

All tables should have `rowsecurity = true`.

### Check Policies

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

You should see multiple policies per table.

### Check Storage Buckets

Navigate to **Storage** in Supabase dashboard and verify:
- ✓ `chat-attachments` bucket exists
- ✓ `avatars` bucket exists

### Test Authentication

1. Start your dev server: `npm run dev`
2. Go to http://localhost:3000
3. Try signing in with Google (if configured)
4. Check that guest/anonymous access works

## Rollback (If Needed)

If you need to rollback the migration:

```sql
-- Drop all tables (WARNING: This deletes all data!)
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS user_keys CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS chat_attachments CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_user_preferences_updated_at CASCADE;
DROP FUNCTION IF EXISTS update_chats_updated_at CASCADE;
```

Then re-run the migration to start fresh.

## Production Deployment

When deploying to production:

1. **Run migration** on production Supabase project
2. **Verify** all post-migration steps are completed
3. **Update environment variables** with production keys
4. **Test thoroughly** before going live
5. **Enable Supabase backups** (recommended)

## Getting Help

If you encounter issues:

1. Check this guide and INSTALL.md
2. Review Supabase logs in your dashboard
3. Consult Supabase documentation
4. Open an issue on GitHub

## Summary

**Quick Start:**
```bash
# 1. Ensure .env.local has Supabase credentials
# 2. Run migration
npm run migrate

# 3. Create storage buckets in Supabase dashboard
# 4. Enable Google OAuth + Anonymous auth
# 5. (Optional) Set up Autumn subscriptions
```

That's it! Your database is ready to use. 🚀
