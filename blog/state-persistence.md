# State Persistence Feature

## Overview

This feature allows the website to maintain its state across page refreshes. Since all resources are served via JavaScript and the URL always returns to the home page, this solution uses **localStorage** to persist the application state.

## What Gets Saved

The following state information is automatically saved:

1. **Current Page** - Which page tab is active (Home, Blogs, About)
2. **Active Blog Post** - If viewing a specific blog post, it will be restored
3. **Sidebar State** - Whether the sidebar is collapsed or expanded
4. **Theme Preference** - Auto/Light/Dark theme selection

## How It Works

### Storage Mechanism
- Uses browser's `localStorage` API (not cookies)
- Data persists even after closing the browser
- No server-side changes required
- Works entirely client-side with JavaScript

### Auto-Save Triggers
State is automatically saved when:
- User clicks navigation items (Home, Blogs, About)
- User selects a blog post from the sidebar
- User clicks "Back to Blog Home" button
- User changes theme preference
- User toggles sidebar collapse
- Before page unload (refresh/close)
- Every 30 seconds as a backup

### State Restoration
On page load:
1. Application checks localStorage for saved state
2. If found, restores theme, sidebar, page, and blog post
3. Blog content is lazy-loaded as before
4. User sees exactly where they left off

## Technical Implementation

### Key Functions Added to `app.js`:

```javascript
// Save state
saveAppState()

// Load state  
loadAppState()

// Restore state on page load
restoreAppState()

// Setup auto-save listeners
setupStatePersistence()
```

### Storage Key
All state is stored under: `blogPlatformState`

### Data Structure
```json
{
  "currentPage": "blogs",
  "activeBlogPost": "michelle-dns-for-ios-sideloading",
  "sidebarCollapsed": false,
  "theme": "dark",
  "timestamp": 1234567890
}
```

## Browser Compatibility

- ✅ Chrome/Edge (all versions)
- ✅ Firefox (all versions)
- ✅ Safari (all versions)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Privacy & Security

- Data stored locally on user's device only
- No data sent to servers
- Users can clear via browser settings
- No tracking or analytics involved

## Clearing Saved State

Users can clear the saved state by:
1. Opening browser DevTools → Application → Local Storage
2. Deleting the `blogPlatformState` key
3. Or clearing all site data in browser settings

## Testing

To test the feature:

1. Open the website
2. Navigate to any page (e.g., Blogs)
3. Select a blog post to read
4. Change theme or collapse sidebar (optional)
5. Refresh the page (F5 or Ctrl+R)
6. The page should restore to the exact same state

## Future Enhancements

Possible improvements:
- Add URL hash-based state (for sharing links)
- Session-only mode (clear on browser close)
- Export/import state functionality
- Scroll position restoration within blog posts
