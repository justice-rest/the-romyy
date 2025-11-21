# Database Migrations

This directory contains SQL migration files for Rōmy's database schema.

## Available Migrations

- **001_initial_schema.sql** - Initial database schema including all core tables, RLS policies, indexes, and triggers
- **002_add_onboarding_to_user_preferences.sql** - (DEPRECATED - use 003 instead) Adds onboarding JSONB to user_preferences
- **003_add_onboarding_table.sql** - Creates onboarding_data table and adds completion tracking to users table

## Running Migrations

### Quick Start

```bash
npm run migrate
```

This will automatically run the migration against your Supabase database using credentials from `.env.local`.

### Manual Method

If the automated script doesn't work:

1. Copy the contents of each migration file in order (001, 002, etc.)
2. Go to your Supabase SQL Editor
3. Paste and run each SQL migration sequentially

See **MIGRATION_GUIDE.md** in the root directory for detailed instructions.

## What's Included

The migrations create:
- ✓ 9 core tables (users, chats, messages, onboarding_data, etc.)
- ✓ Row Level Security (RLS) policies
- ✓ Database indexes for performance
- ✓ Auto-update triggers
- ✓ Foreign key constraints
- ✓ Onboarding completion tracking

## Important Notes

### Subscriptions
**No subscription-specific tables are needed!** Autumn manages all subscription data via its API and Stripe. The migration only creates Rōmy's core tables.

### Idempotent
All migrations use `IF NOT EXISTS` clauses and can be safely run multiple times without errors.

### Post-Migration
After running migrations, you must manually:
1. Create storage buckets (`chat-attachments`, `avatars`)
2. Enable Google OAuth in Supabase Auth
3. Enable anonymous sign-ins
4. (Optional) Configure Autumn products

## Need Help?

See **MIGRATION_GUIDE.md** for complete documentation and troubleshooting.
