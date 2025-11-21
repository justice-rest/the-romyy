# PostHog Analytics Integration

This directory contains the complete PostHog analytics integration for Rōmy, following PostHog's official best practices for Next.js 15 app router.

## 📁 Files

- **`provider.tsx`** - PostHog provider and pageview tracking components
- **`events.ts`** - Centralized event tracking functions
- **`hooks.ts`** - React hooks for accessing PostHog in components
- **`index.ts`** - Public API exports

## 🚀 Setup

### 1. Get Your PostHog API Key

1. Sign up at [posthog.com](https://posthog.com)
2. Create a new project or select an existing one
3. Copy your Project API Key from Project Settings

### 2. Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Required
NEXT_PUBLIC_POSTHOG_KEY=phc_your_api_key_here

# Optional - defaults to US cloud (https://us.i.posthog.com)
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Optional - enable session recordings (default: false)
NEXT_PUBLIC_POSTHOG_ENABLE_RECORDINGS=false
```

**Important:** Environment variables must be prefixed with `NEXT_PUBLIC_` to be accessible on the client-side.

### 3. That's It!

The integration is already wired up in the app. PostHog will:
- ✅ Initialize automatically when the API key is present
- ✅ Track pageviews on route changes
- ✅ Capture button clicks and form submissions
- ✅ Track page leave events
- ✅ Only create user profiles for identified users (logged in)

## 📊 Usage

### Automatic Tracking

These events are tracked automatically:

- **Pageviews** - Every route change
- **Clicks** - Button and link clicks
- **Form Submissions** - Form submit events
- **Page Leaves** - When users navigate away

### Manual Event Tracking

#### Option 1: Using Event Functions (Recommended)

Import pre-built event tracking functions:

```typescript
import {
  trackChatCreated,
  trackMessageSent,
  trackModelSelected
} from '@/lib/posthog'

// Track chat creation
trackChatCreated(chatId, model)

// Track message sent
trackMessageSent({
  chatId,
  model,
  hasAttachments: true,
  attachmentCount: 2,
  hasSearch: false
})

// Track model selection
trackModelSelected('gpt-4')
```

#### Option 2: Using the Hook

Use the `useAnalytics()` hook in React components:

```typescript
'use client'

import { useAnalytics } from '@/lib/posthog'

export function MyComponent() {
  const { track, identify, isAvailable } = useAnalytics()

  const handleAction = () => {
    if (isAvailable) {
      track('custom_event', {
        property: 'value'
      })
    }
  }

  return <button onClick={handleAction}>Click me</button>
}
```

#### Option 3: Direct Import

For use outside React components:

```typescript
import { trackEvent, identifyUser } from '@/lib/posthog'

// Track custom event
trackEvent('button_clicked', {
  button_name: 'submit',
  page: '/chat'
})

// Identify user
identifyUser(userId, {
  email: user.email,
  plan: 'pro'
})
```

## 📋 Available Event Tracking Functions

### Chat Events
- `trackChatCreated(chatId, model)`
- `trackMessageSent({ chatId, model, hasAttachments, attachmentCount, hasSearch })`
- `trackMessageReceived({ chatId, model, responseTime, hasToolInvocations, hasSources })`
- `trackChatDeleted(chatId)`
- `trackChatPinned(chatId, pinned)`
- `trackShareChat(chatId)`

### Model Events
- `trackModelSelected(model)`
- `trackModelSwitched({ chatId, fromModel, toModel })`

### Settings Events
- `trackApiKeyAdded(provider)`
- `trackApiKeyRemoved(provider)`
- `trackSettingsChanged(setting, value)`

### File Upload Events
- `trackFileUploaded({ chatId, fileType, fileSize })`
- `trackFileUploadFailed({ chatId, error })`

### Search Events
- `trackSearchToggled(enabled)`
- `trackSearchUsed({ chatId, model, resultCount })`

### Authentication Events
- `trackUserSignedIn(method)`
- `trackUserSignedOut()`

### Subscription Events
- `trackSubscriptionStarted(plan)`
- `trackSubscriptionCancelled(plan)`
- `trackSubscriptionUpgraded({ fromPlan, toPlan })`

### Error Events
- `trackError({ error, errorType, context })`

### Feature Usage
- `trackFeatureUsed(featureName, properties?)`
- `trackProjectCreated(projectId)`

## 🎯 User Identification

PostHog is configured with `person_profiles: 'identified_only'`, which means:
- Anonymous users are tracked but don't create full user profiles
- User profiles are only created when you explicitly identify them
- This reduces costs and improves performance

### Identify Users on Login

When a user logs in, identify them:

```typescript
import { identifyUser } from '@/lib/posthog'

// After successful login
identifyUser(user.id, {
  email: user.email,
  name: user.name,
  plan: user.subscription_plan,
  created_at: user.created_at
})
```

### Reset on Logout

When a user logs out, reset their session:

```typescript
import { resetUser } from '@/lib/posthog'

// On logout
resetUser()
```

## 🎬 Session Recordings

Session recordings are **disabled by default**. To enable:

1. Set `NEXT_PUBLIC_POSTHOG_ENABLE_RECORDINGS=true` in your environment
2. Configure recording settings in PostHog dashboard
3. Ensure you comply with privacy regulations (GDPR, CCPA, etc.)

**Privacy Note:** Always inform users about session recordings in your privacy policy.

## 🚩 Feature Flags

PostHog supports feature flags for A/B testing and gradual rollouts:

```typescript
'use client'

import { useFeatureFlag, useIsFeatureEnabled } from '@/lib/posthog'

export function MyComponent() {
  // Get flag value (string, boolean, etc.)
  const flagValue = useFeatureFlag('new_feature')

  // Check if enabled (boolean)
  const isEnabled = useIsFeatureEnabled('new_feature')

  if (isEnabled) {
    return <NewFeature />
  }

  return <OldFeature />
}
```

## 🔍 Debug Mode

PostHog automatically enables debug mode in development:
- Open browser console to see PostHog events
- Verify events are firing correctly
- Debug mode is disabled in production

## 📈 Best Practices

### 1. Privacy First
- Only track necessary events
- Don't track sensitive data (passwords, credit cards, etc.)
- Respect user privacy settings
- Include analytics disclosure in privacy policy

### 2. Event Naming
- Use `snake_case` for event names
- Be descriptive but concise
- Group related events with prefixes (e.g., `chat_*`, `model_*`)

### 3. Properties
- Keep properties consistent across similar events
- Use meaningful property names
- Don't over-track - focus on actionable metrics

### 4. Performance
- Events are queued and batched automatically
- PostHog won't block your app
- Check `isPostHogAvailable()` to gracefully handle missing configuration

### 5. Testing
```typescript
// Always check if PostHog is available
if (isPostHogAvailable()) {
  trackEvent('my_event')
}

// Or use the built-in checks in tracking functions
trackChatCreated(chatId, model) // Safely handles missing PostHog
```

## 🛠️ Configuration

The PostHog provider (`lib/posthog/provider.tsx`) is configured with:

```typescript
{
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  person_profiles: 'identified_only',  // Only create profiles for logged-in users
  capture_pageview: false,             // Manual pageview tracking
  capture_pageleave: true,             // Track page exits
  disable_session_recording: true,     // Disabled by default (enable with env var)
  autocapture: {
    dom_event_allowlist: ['click', 'submit'],  // Only clicks and submits
    element_allowlist: ['button', 'a'],        // Only buttons and links
  }
}
```

## 🔗 Resources

- [PostHog Documentation](https://posthog.com/docs)
- [Next.js Integration Guide](https://posthog.com/docs/libraries/next-js)
- [React Integration](https://posthog.com/docs/libraries/react)
- [Event Tracking Best Practices](https://posthog.com/docs/data/events)

## 🐛 Troubleshooting

### Events Not Showing Up

1. **Check API Key**: Ensure `NEXT_PUBLIC_POSTHOG_KEY` is set
2. **Check Browser Console**: Look for PostHog debug messages (dev mode)
3. **Verify Environment**: Variables must start with `NEXT_PUBLIC_`
4. **Clear Cache**: Try clearing browser cache and cookies

### TypeScript Errors

If you see PostHog type errors:
```bash
npm install --save-dev @types/posthog-js
```

### Session Recording Not Working

1. Verify `NEXT_PUBLIC_POSTHOG_ENABLE_RECORDINGS=true`
2. Check PostHog dashboard settings
3. Ensure you're not blocking PostHog with ad blockers

## 📝 License

This integration follows PostHog's MIT license and Rōmy's project license.
