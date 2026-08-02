# Prompt: Fix All Codebase Issues (Except Flashing Lights Warning Feature)

## Context
This prompt addresses all issues identified in the codebase evaluation **except Issue #11** (Flashing Lights Warning), which is intentionally kept as a feature.

## Issues to Fix

### P0 - Critical (Fix Immediately)

#### Issue 1: Syntax Error in style.css - Duplicate Property Names
**File:** `style.css`
**Problem:** `--bg-image-dark` and `--bg-image-light` declared in `:root` and re-declared identically in `[data-theme="dark"]` and `[data-theme="light"]`.
**Fix:** Remove duplicate declarations from theme-specific blocks. Keep only in `:root`.

#### Issue 2: HTML Entity Decoding Bug in markdown.js
**File:** `js/markdown.js` (lines 60-68)
**Problem:** HTML entities (`&`, `<`, etc.) are preserved as literal text instead of being decoded.
**Fix:** In `parseInline()`, decode known HTML entities to their Unicode characters. Use the existing `htmlEntities` map (lines 7-15) to convert entities.

#### Issue 3: Inconsistent Theme Variable Management
**Files:** `js/ui.js` (lines 398-441), `style.css`
**Problem:** `ui.js` applies themes by setting inline styles on `document.documentElement`, overriding CSS custom properties defined in `style.css` `[data-theme]` selectors.
**Fix:** 
- Remove all `root.style.setProperty()` calls in `applyTheme()` 
- Only toggle `data-theme` attribute on `<html>` element
- Move all theme color values to CSS custom properties in `style.css`
- Remove inline `document.body.style.background` assignments

#### Issue 4: Service Worker Precaching References Non-Existent File
**File:** `sw.js` (line 26)
**Problem:** `'/liquid-glass.css'` in `PRECACHE_ASSETS` array doesn't exist.
**Fix:** Remove `/liquid-glass.css` from `PRECACHE_ASSETS`.

#### Issue 5: Race Condition in Mobile Tray Initialization
**File:** `js/mobile-tray.js` (lines 346-354)
**Problem:** Uses `setInterval` polling (5s timeout) to wait for `window.blogPostMetadata`.
**Fix:** Replace with event-driven approach:
- Dispatch custom event `blog:metadata-loaded` from `blog.js` after metadata loads
- Listen for this event in `mobile-tray.js` to render post list

---

### P1 - High Priority (Next Sprint)

#### Issue 6: Massive CSS File (2571 lines)
**File:** `style.css`
**Problem:** Single monolithic file with significant duplication.
**Fix:** Split into modular CSS files:
```
css/
├── variables.css      (CSS custom properties)
├── reset.css          (normalize/reset)
├── layout.css         (header, main-container, sidebar)
├── components.css     (buttons, cards, forms)
├── blog.css           (blog-specific styles)
├── home.css           (home page styles)
├── about.css          (about page styles)
├── mobile.css         (mobile tray, responsive)
└── themes.css         (theme-specific overrides)
```
Update `index.html` to load all CSS files (or use `@import` in main `style.css`).

#### Issue 7: Markdown Parser Complexity - Add Tests
**File:** `js/markdown.js`
**Problem:** 1193-line custom GFM parser with no test coverage.
**Fix:** 
- Add Vitest/Jest configuration
- Create test suite for `parseMarkdown()` and `parseFrontmatter()`
- Test all GFM features demonstrated in `markdown-feature-showcase.md`
- Add edge case tests (empty input, malformed markdown, XSS attempts)

#### Issue 8: Tight Coupling via Global `window` Exports
**Files:** All JS modules
**Problem:** All modules expose functions on `window`, creating implicit dependencies.
**Fix:** 
- Convert to ES Modules (`type="module"` in script tags)
- Use `export`/`import` for inter-module dependencies
- Keep only essential entry points on `window` (e.g., `openBlogPostLazy` for inline onclick handlers)
- Create a central `app.js` that imports and initializes all modules

#### Issue 9: Inconsistent State Persistence
**File:** `js/state.js` (lines 195-210)
**Problem:** `handleInteraction` saves state on ANY click matching broad selectors (100ms delay), causing excessive localStorage writes.
**Fix:**
- Debounce saves with 500ms minimum interval
- Only save on actual navigation/state changes (not every click)
- Use `requestIdleCallback` for non-blocking saves
- Remove `beforeunload` handler (redundant with click-based saves)

#### Issue 10: Hardcoded Values Scattered
**Files:** Multiple
**Problem:** Magic numbers and strings duplicated across files.
**Fix:** Create `js/config.js` with shared constants:
```javascript
export const CONFIG = {
  MOBILE_BREAKPOINT: 768,
  STATE_SAVE_DELAY: 500,
  STATE_AUTO_SAVE_INTERVAL: 30000,
  PRELOAD_DEBOUNCE_MS: 150,
  THEME_TRANSITION_DURATION: 400,
  // Theme colors (reference only - actual values in CSS)
};
```
Import in all modules.

#### Issue 12: Sidebar Toggle UX on Mobile
**Files:** `style.css` (lines 446-457, 506-511), `js/ui.js` (lines 538-557)
**Problem:** CSS hides sidebar on mobile by default; toggle button becomes invisible when collapsed.
**Fix:**
- Remove mobile-specific sidebar collapsing from CSS
- Let `ui.js` manage sidebar state consistently across breakpoints
- Always show toggle button; use mobile tray for navigation on mobile
- Add `aria-expanded` attribute to toggle button for accessibility

#### Issue 13: No Error Boundary for Markdown Rendering
**File:** `js/blog.js` (line 311)
**Problem:** If `parseMarkdown()` throws, post view shows raw error or blank.
**Fix:** Wrap `loadBlogPostContent()` call in try-catch:
```javascript
try {
  const post = await loadBlogPostContent(id);
  // render...
} catch (err) {
  article.innerHTML = `
    <div class="error-message">
      <h2>Error Loading Post</h2>
      <p>${err.message}</p>
      <button onclick="window.openBlogPostLazy('${id}')">Retry</button>
    </div>
  `;
}
```

#### Issue 14: Image Lazy Loading Only on Hover/Intersection
**File:** `js/lazyload.js`
**Problem:** Mobile hover doesn't exist; `IntersectionObserver` with `rootMargin: '50px'` may miss edge images.
**Fix:**
- Add `touchstart` listener for mobile
- Reduce `rootMargin` to `'0px'` or `'10px'`
- Add `loading="lazy"` attribute to `<img>` tags as native fallback
- Preload images when post content loads (not just on hover)

#### Issue 15: Devotional Animation Blocks UI
**File:** `js/devotional.js` (lines 49-106)
**Problem:** `requestAnimationFrame` loops run sequentially with no cancellation on navigation.
**Fix:**
- Track animation frame IDs and cancel on cleanup
- Add `stopAnimations()` function called on page navigation
- Use `AbortController` pattern for animation cancellation
- Limit max concurrent animations to 1

#### Issue 16: Missing Error Handling in Critical Paths
**Files:** `js/blog.js` (lines 16, 57)
**Problem:** `fetchBlogPostMetadata()` returns `[]` on error; `loadBlogPostContent()` caches error states.
**Fix:**
- Add retry logic with exponential backoff (max 3 retries)
- Don't cache error responses; allow retry on next click
- Show user-friendly error with retry button
- Add network status detection (`navigator.onLine`)

#### Issue 17: Memory Leaks Potential
**Files:** `js/blog.js` (line 13), `js/mobile-tray.js` (line 673), `sw.js` (line 13)
**Problem:** Untracked timeouts, undisconnected observers, unbounded `pendingFetches` Set.
**Fix:**
- `blog.js`: Track all timeouts in a Set, clear on page unload
- `mobile-tray.js`: Disconnect `MutationObserver` in cleanup function
- `sw.js`: Add max size limit to `pendingFetches`, clean up on fetch failure

---

### P2 - Refactor (Technical Debt)

#### Issue 18: Inconsistent Naming Conventions
**Files:** Multiple
**Problem:** Minor violations of naming conventions.
**Fix:** Run Prettier/ESLint with configured rules; fix all violations.

#### Issue 19: No TypeScript / Type Safety
**Files:** All JS files
**Problem:** Untyped JavaScript.
**Fix:**
- Add TypeScript configuration (`tsconfig.json`)
- Rename `.js` to `.ts` incrementally
- Add JSDoc types for immediate benefit
- Configure `npm run typecheck` script

#### Issue 20: Duplicate Footer HTML
**Files:** `index.html` (3 locations), `js/blog.js` (lines 199-206), `js/home.js` (lines 6-13)
**Problem:** Same footer HTML duplicated in 5 places.
**Fix:** 
- Create `footer.html` partial or `js/footer.js` module
- Single source of truth for footer content
- Render via JS module or SSI

#### Issue 21: Font Loading Blocking Render
**File:** `index.html` (lines 8, 10-12)
**Problem:** Google Fonts and FontAwesome CSS load synchronously in `<head>`.
**Fix:**
- Add `rel="preload" as="style"` for FontAwesome
- Add `media="print" onload="this.media='all'"` for Google Fonts
- Use `font-display: swap` in `@font-face` (if self-hosting)
- Consider self-hosting `VT323` font

#### Issue 22: Service Worker Caches Everything Aggressively
**File:** `sw.js` (lines 22-33)
**Problem:** Precaches all assets including large background images user may never need.
**Fix:**
- Only precache critical assets (HTML, CSS, JS, manifest)
- Lazy-cache images on first request
- Add `precache-all` message for manual full precaching

#### Issue 23: No Code Splitting / Lazy Module Loading
**File:** `index.html` (lines 189-202)
**Problem:** All modules load via `<script defer>` even if not needed.
**Fix:**
- Convert to ES Modules with dynamic `import()`
- Load `devotional.js` only when on home page
- Load `mobile-tray.js` only on mobile (`matchMedia`)
- Load `blog.js` only when navigating to blogs page

#### Issue 24: XSS Risk in Markdown Parser
**File:** `js/markdown.js` (lines 694-723, 132-139)
**Problem:** Raw HTML blocks and inline HTML allowed with minimal sanitization.
**Fix:**
- Add DOMPurify or custom sanitizer for HTML output
- Allowlist safe tags: `p, b, i, em, strong, a, code, pre, blockquote, ul, ol, li, h1-h6, table, thead, tbody, tr, th, td, img, br, hr`
- Strip `on*` attributes, `javascript:` URLs, `<script>`, `<iframe>`, `<style>`
- Sanitize after `renderBlocks()`, before returning HTML

#### Issue 25: localStorage Used Without Quota Handling
**File:** `js/state.js` (line 80)
**Problem:** `localStorage.setItem()` can throw `QuotaExceededError`.
**Fix:**
```javascript
try {
  localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(currentState));
} catch (err) {
  if (err.name === 'QuotaExceededError') {
    // Clear old state and retry
    localStorage.removeItem(STATE_STORAGE_KEY);
    try {
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(currentState));
    } catch (e) {
      console.warn('State save failed: storage full');
    }
  } else {
    console.warn('Failed to save app state:', err);
  }
}
```

---

## Implementation Order

1. **P0 Fixes** (Issues 1-5) - Can be done in parallel
2. **P1 Fixes** (Issues 6-17) - Sequential, starting with config extraction (Issue 10)
3. **P2 Fixes** (Issues 18-25) - Ongoing refactoring

## Testing Checklist

After each fix:
- [ ] Run `node -c js/*.js warning.js` for syntax validation
- [ ] Test in Chrome, Firefox, Safari
- [ ] Test mobile viewport (≤768px)
- [ ] Test theme switching (auto/light/dark)
- [ ] Test offline mode (Service Worker)
- [ ] Test state persistence across refresh
- [ ] Verify no console errors

## Files to Modify

### Core Fixes
- `style.css` - Issues 1, 3, 6, 12
- `js/markdown.js` - Issues 2, 7, 24
- `js/ui.js` - Issues 3, 9, 12
- `js/blog.js` - Issues 5, 13, 16, 17
- `js/state.js` - Issues 9, 17, 25
- `js/mobile-tray.js` - Issues 5, 17
- `js/lazyload.js` - Issue 14
- `js/devotional.js` - Issues 15, 17
- `sw.js` - Issues 4, 17, 22
- `index.html` - Issues 10, 20, 21, 23

### New Files
- `js/config.js` - Issue 10
- `css/*.css` - Issue 6
- `tsconfig.json` - Issue 19
- `package.json` (add devDependencies) - Issues 7, 19

---

## Notes

- **Do NOT modify** `warning.js` flashing lights logic (Issue 11 - kept as feature)
- **Do NOT modify** `LICENSE` or `blog/posts.json` schema (AGENTS.md guardrails)
- Preserve all DOM element IDs listed in AGENTS.md "DOM Component Contracts"
- Maintain lazy loading mechanisms (`openBlogPostLazy`, `preloadBlogPostContent`)
- Keep module load order per AGENTS.md specifications