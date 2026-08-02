# Task: Cleanup unused functions after Back/Next button changes

## Analysis
After removing the blog-intro back button and making Back/Next navigate only within posts, there are unused remnants:
- `navigationHistory` array - declared but only pushed to, never read
- `navigationHistory.push()` calls in `goToNextPost()` and `openBlogPostLazy()` - no longer needed

## Implementation Plan
- [x] Remove `navigationHistory` array
- [x] Remove `navigationHistory.push()` calls in `goToNextPost()`
- [x] Remove `navigationHistory.push()` calls in `openBlogPostLazy()`
- [x] Test syntax with `node -c js/*.js warning.js`