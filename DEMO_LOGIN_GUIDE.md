# 🧪 Demo Login Feature Guide

## Overview

A **Demo Login** feature has been added to allow testing the application without requiring Clerk authentication. This is perfect for development and testing scenarios.

## How to Use

### 1. Access the Sign-In Page

Navigate to: http://localhost:3000/sign-in

### 2. Use Demo Login

You'll see a **"🧪 Testing / Demo Mode"** section with a **"Continue as Demo User"** button.

Click the button to:
- ✅ Bypass Clerk authentication
- ✅ Log in as a demo admin user
- ✅ Access all features with full permissions
- ✅ Test the application without setting up Clerk accounts

## Demo User Details

- **Name**: Demo User
- **Email**: demo@canopysight.com
- **Role**: Admin (full access)
- **Organization**: Demo Organization

## Demo Mode Indicators

### Yellow Banner

When demo mode is active, a yellow banner appears at the top of the page showing:
- 🧪 Demo Mode Active
- A brief explanation
- An "Exit Demo Mode" button

### Navigation Bar

The navigation bar shows:
- 🧪 Demo: Demo User (instead of Clerk's UserButton)

## Features Available in Demo Mode

- ✅ Full access to all pages
- ✅ All API endpoints work
- ✅ Admin privileges
- ✅ All CRUD operations
- ✅ Real-time features (when implemented)

## Exiting Demo Mode

### Method 1: Banner Button

Click the **"Exit Demo Mode"** button in the yellow banner at the top.

### Method 2: Manual Clear

Clear your browser's session storage:
```javascript
// In browser console
sessionStorage.clear();
// Then refresh the page
```

### Method 3: Sign Out

The demo mode will automatically clear when you:
- Close the browser tab
- Clear browser data
- Manually clear session storage

## Technical Details

### How It Works

1. **Frontend**: Sets demo mode in sessionStorage and cookies
2. **Middleware**: Checks for demo mode cookie and bypasses Clerk auth
3. **API**: Reads demo headers and creates demo context
4. **tRPC**: Automatically includes demo headers in all requests

### Security

- ⚠️ **Demo mode only works in development** (`NODE_ENV !== "production"`)
- ⚠️ **Not available in production builds**
- ⚠️ **Should not be used for real data**

### Headers Sent

When in demo mode, the following headers are sent with API requests:
```
x-demo-mode: true
x-demo-user-id: demo-user-123
x-demo-organization-id: demo-org-123
x-demo-user-role: admin
```

## Troubleshooting

### Demo Login Not Working

1. **Check Browser Console**: Look for JavaScript errors
2. **Verify Session Storage**: 
   ```javascript
   console.log(sessionStorage.getItem('demo_mode')); // Should be "true"
   ```
3. **Check Cookies**: Ensure cookies are enabled
4. **Clear Cache**: Try clearing browser cache and retrying

### API Not Responding

1. **Check API Server**: Ensure API is running on port 3001
2. **Verify Headers**: Check Network tab to see if demo headers are sent
3. **Check API Logs**: Review API server logs for errors
4. **Environment**: Ensure `NODE_ENV` is not set to "production"

### Demo Mode Persisting

If demo mode won't clear:
1. Clear session storage: `sessionStorage.clear()`
2. Clear cookies: Delete `demo_mode` cookie
3. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

## Best Practices

1. **Use for Testing**: Perfect for testing features without authentication setup
2. **Development Only**: Never enable in production
3. **Clear After Testing**: Exit demo mode when done testing
4. **Test Real Auth Too**: Also test with real Clerk authentication

## Code Locations

- **Sign-In Page**: `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`
- **Demo Auth Utils**: `apps/web/src/lib/demo-auth.ts`
- **Demo Banner**: `apps/web/src/components/demo-banner.tsx`
- **API Context**: `apps/api/src/trpc/context.ts`
- **Middleware**: `apps/web/src/middleware.ts`

## Future Enhancements

Potential improvements:
- Multiple demo user roles (admin, supervisor, viewer)
- Demo data seeding
- Demo mode toggle in settings
- Demo mode analytics

---

**Note**: This feature is designed for development and testing only. It should never be enabled in production environments.
