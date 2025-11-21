# Subscription Setup Guide

This guide explains how to set up and configure Autumn subscriptions for Rōmy.

## Overview

Rōmy now supports subscriptions via [Autumn](https://useautumn.com), a billing layer over Stripe that handles:
- Subscription management
- Feature access control
- Usage tracking and limits
- Checkout flows
- Billing portal

## Quick Start

### 1. Prerequisites

- Supabase account and configuration (for user authentication)
- Autumn account (get started at https://app.useautumn.com)
- Stripe account (will be connected via Autumn)

### 2. Get Autumn API Key

1. Go to [Autumn Sandbox Dashboard](https://app.useautumn.com/sandbox/dev)
2. Create a new API key
3. Copy the **Secret Key** (starts with `am_sk_...`)

### 3. Configure Environment

Add the Autumn secret key to your `.env.local` file:

```bash
# For testing (Sandbox)
AUTUMN_SECRET_KEY=am_sk_test_your_key_here

# For production (Live)
AUTUMN_SECRET_KEY=am_sk_live_your_key_here
```

### 4. Create Products in Autumn Dashboard

Go to your Autumn dashboard and create the following products:

#### Basic Plan ($29/month)
- **Product ID**: `basic`
- **Name**: Basic
- **Features**:
  - `messages` - 100 messages per month (metered, resets monthly)

#### Premium Plan ($89/month)
- **Product ID**: `premium`
- **Name**: Premium
- **Features**:
  - `messages` - Unlimited (or set to 999999)

#### Pro Plan ($200/month)
- **Product ID**: `pro`
- **Name**: Pro
- **Features**:
  - `messages` - Unlimited (or set to 999999)
  - Additional consultation services (managed externally)

### 5. Connect Stripe

In your Autumn dashboard:
1. Go to Settings → Integrations
2. Connect your Stripe account
3. Use **Test Mode** for development
4. Switch to **Live Mode** for production

## Architecture

### File Structure

```
/app
  /api
    /autumn
      /[...all]
        route.ts          # Autumn API handler (identifies users)
  /subscription
    page.tsx              # Subscription pricing page

/components
  /subscription
    pricing-cards.tsx     # Pricing display with checkout
    subscription-section.tsx  # Settings UI for subscription management

/lib
  /subscription
    autumn-client.ts      # Server-side Autumn client utilities
    autumn-wrapper.tsx    # Client-side Autumn provider wrapper
```

### Integration Points

1. **API Handler** (`/app/api/autumn/[...all]/route.ts`)
   - Identifies users via Supabase auth
   - Passes customer data to Autumn
   - Handles all Autumn API calls from frontend

2. **Provider Wrapper** (`/lib/subscription/autumn-wrapper.tsx`)
   - Wraps app with `AutumnProvider`
   - Enables `useCustomer()` hook throughout the app

3. **Chat API Integration** (`/app/api/chat/api.ts`)
   - Checks message limits via `checkMessageAccess()`
   - Tracks usage via `trackMessageUsage()`
   - Fails gracefully if Autumn is not configured

4. **Subscription UI**
   - Pricing page: `/subscription`
   - Settings section: Shows current plan, usage, and billing options

## Usage Tracking Flow

1. **User sends a message**
2. `validateAndTrackUsage()` checks Autumn access
   - Calls `checkMessageAccess(userId)`
   - If not allowed, throws error with upgrade prompt
3. **Message is processed**
4. `incrementMessageCount()` tracks the usage
   - Calls `trackMessageUsage(userId)`
   - Updates Autumn's usage counter

## Checkout Flow

1. **User clicks "Subscribe" on pricing page**
2. `checkout()` is called with product ID
3. **If no payment method exists:**
   - Redirects to Stripe checkout page
   - After payment, returns to app
   - Subscription is activated
4. **If payment method exists:**
   - Shows `CheckoutDialog` with pricing preview
   - Confirms upgrade/downgrade
   - Processes immediately

## Billing Portal

Users can manage their subscription via Stripe's billing portal:

- Update payment method
- View invoices
- Cancel subscription
- Download receipts

Access from Settings → Subscription → "Manage Billing"

## Testing

### Test with Stripe Test Cards

Use these test cards in Stripe checkout:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- Any future expiry date and any CVC

### Testing Flow

1. Create a test user in Rōmy (authenticated)
2. Go to `/subscription`
3. Click "Subscribe" on a plan
4. Use Stripe test card
5. Verify subscription appears in settings
6. Send messages to test usage tracking
7. Check Autumn dashboard for usage data

## Fallback Behavior

If Autumn is not configured (no API key):
- Subscription features are **disabled**
- Existing rate limits still apply (via Supabase)
- No subscription UI appears in settings
- App continues to work normally

This ensures zero breaking changes for existing deployments.

## Production Checklist

- [ ] Switch Autumn to Live Mode
- [ ] Update `AUTUMN_SECRET_KEY` to live key
- [ ] Configure live Stripe prices in Autumn
- [ ] Test checkout flow with real card
- [ ] Verify webhooks are working
- [ ] Test billing portal access
- [ ] Monitor Autumn dashboard for events

## Monitoring

Check these regularly:
- **Autumn Dashboard**: Active subscriptions, usage metrics, failed payments
- **Stripe Dashboard**: Payment status, invoices, disputes
- **Application Logs**: Autumn API errors, checkout failures

## Troubleshooting

### "Autumn subscriptions unavailable" in logs
- Verify `AUTUMN_SECRET_KEY` is set in environment
- Check Supabase is enabled and working

### Checkout redirects but subscription not active
- Check Autumn webhook configuration
- Verify Stripe connection in Autumn dashboard
- Check browser console for errors

### Usage not tracking
- Verify `trackMessageUsage()` is being called
- Check Autumn dashboard event logs
- Ensure feature ID matches: `messages`

### Past due subscriptions
- User needs to update payment method via billing portal
- Subscription status will show "past_due"
- Access is blocked until payment succeeds

## Support

- Autumn Documentation: https://docs.useautumn.com
- Autumn Discord: https://discord.gg/autumn
- Stripe Support: https://support.stripe.com
