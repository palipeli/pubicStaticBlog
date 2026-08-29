# AGENTS.md — `pubicStaticBlog`

## Repository contract

- **Runtime:** browser-only, zero-dependency vanilla HTML/CSS/ES6+ JavaScript SPA.
- **No build:** no `package.json`, bundler, transpiler, linter, test runner, or generated `dist/`.
- **Hosting:** serve the repository root as static files; root-relative URLs assume deployment at `/`.
- **Entry:** `index.html`; app initialization is `js/app.js` on `DOMContentLoaded`.
- **License:** GPL-3.0; do not alter `LICENSE`.
- **Style:** preserve the intentionally informal site copy unless the task explicitly requests editorial changes.

## Files and responsibilities

| Path | Responsibility | Public contract |
|---|---|---|
| `index.html` | SPA shell, sections, fixed header/sidebar, script order, SW registration, pre-paint theme bootstrap | IDs/classes consumed by every UI module |
| `style.css` | global reset, theme tokens, layout, responsive/mobile styles | CSS variables, `data-theme`, `768px` (mobile) / `1024px` (sidebar/tray) breakpoints |
| `js/config.js` | shared constants | `window.CONFIG` |
| `js/markdown.js` | custom Markdown/frontmatter parser + sanitizer | `window.parseMarkdown`, `window.parseFrontmatter` |
| `js/lazyload.js` | `img.lazy-image[data-src]` loading | `window.initializeLazyLoading` |
| `js/state.js` | DOM-derived state persistence + per-page scroll position record/restore | `blogPlatformState`/`blogPlatformScrollPositions` in `localStorage`; `window.*` state/scroll API |
| `js/devotional.js` | consent-gated verse fetch/type animation | `window.monitorWarningAndStartDevotional` |
| `js/ui.js` | navigation, hash routing, theme, particles, sidebar | `window.*` navigation/theme API |
| `js/blog.js` | manifest fetch, post cache, prefetch, render, navigation | `window.blogPostMetadata`; `window.openBlogPostLazy` |
| `js/home.js` | home CTA rendering and delayed post opening | `window.renderBlogButtonsLazy` |
| `js/mobile-tray.js` | dynamic mobile menu/tray at `window.innerWidth <= 1024` | `#mobile-nav-tray`, overlay, toggle |
| `js/scrollbar.js` | custom scrollbar for `.content-area`, drawn below the fixed header so it never overlaps it; the sidebar intentionally has no visible scrollbar | `window.setupCustomScrollbars` |
| `js/jellyfin.js` | floating Jellyfin music player via `/api/jellyfin` proxy; collapsed spinning-disc button, click expands panel; self-inits, hides itself when the proxy is unconfigured | `window.jellyfinPlayer`; `#jf-player`, `.jf-*` |
| `js/warning.js` | flashing-light consent; post-consent misclicks flash silently, sound only on DECLINE; `#jf-player` exempt | `system_warning_consent`; `warning:cleared` event |
| `js/chat-cloud.js` | speech-bubble that follows cursor on flash/denied | listens `warning:flash` / `denied:flash`; no public API |
| `js/cp.js` | anti-devtools gate + redirect | `window.CP`, `window.__CP_GATE`, `window.__CP_VERIFIED` |
| `js/github-graph.js` | GitHub contribution charts (Chart.js) + range filter + ResizeObserver | self-init on `DOMContentLoaded` |
| `js/dns-graph.js` | DNS request chart (Chart.js) | self-init on `DOMContentLoaded` |
| `admin.html` | standalone WYSIWYG post editor (not part of the SPA) | `#post-editor` contenteditable, `.admin-toolbar`, `/api/publish` |
| `js/admin.js` | editor logic: formatting commands, shortcuts, paste sanitizer, Markdown serializer, deferred image uploads, publish, draft autosave | reads `js/markdown.js` via `window.parseMarkdown` |
| `admin.css` | chrome-only styles for the admin page; editor content renders through `style.css` `.blog-article`/`.blog-post-content` | reuses existing CSS variables |
| `js/app.js` | startup coordinator (see Startup sequence) | runs on `DOMContentLoaded`; no public API |
| `functions/api/publish.js` | Pages Function: auth + slugify + single Git Data API commit of new `media/` files, `blog/<id>.md`, and `blog/posts.json` | `POST /api/publish`; env secrets below |
| `functions/api/posts.js` | Pages Function: admin post list + pin/delete + orphan media | `GET`/`POST /api/posts`; same auth as publish |
| `functions/api/jellyfin/[[path]].js` | Pages Function: read-only Jellyfin proxy (token server-side, path allowlist, KV rate limit) | `GET /api/jellyfin/*`; `JELLYFIN_URL`/`JELLYFIN_TOKEN` env |
| `sw.js` | install/activate, cache strategies, offline shell, prefetch messages | cache names and message types |
| `blog/posts.json` | ordered post manifest | metadata schema below |
| `blog/*.md` | post source | optional `---` frontmatter + Markdown body |
| `blog/nt_verses_compact.json` | compact devotional data | tuple `[book, chapter, verse, text]` |
| `media/` | image and downloadable static assets | preserve URL-safe references; quote paths containing `'` |

## Runtime and dependency graph

`index.html` deferred scripts at end of `<body>` (exact order, with CDN Chart.js shims):

```text
js/config.js → js/markdown.js → js/lazyload.js → js/state.js → js/devotional.js →
js/ui.js → js/blog.js → js/home.js → https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js →
js/github-graph.js → js/dns-graph.js → js/mobile-tray.js → js/scrollbar.js → js/jellyfin.js → js/app.js
+ non-deferred after the deferred list: js/warning.js, js/chat-cloud.js (both self-init on DOM-ready)
+ early head preload: js/cp.js (anti-devtools gate, must load before any app code)
+ inline head theme bootstrap right after the theme-color meta (pre-paint): resolves the
  theme_preference cookie / system preference into html[data-theme] + theme-color meta;
  keep resolution identical to ui.js applyTheme()
```

All JS/CSS files have been stripped of inline comments and unnecessary vertical whitespace; authoritative behavioral documentation lives here and in `SITE_SPEC.md`, not inline. Do not reintroduce per-file header comments or blank-line padding — update the markdown specs instead. `app.js` is the final coordinator. Do not convert scripts to ES modules or reorder them casually: modules communicate through `window`, not imports.

Startup sequence in `js/app.js`:

```text
createParticles
→ setupNavigation + setupScrollPositionTracking + setupHashRouting
→ setupTemplates + setupSystemThemeListener + setupThemePrefetch
→ setupSidebarToggle + setupCustomScrollbars + setupStatePersistence
→ monitorWarningAndStartDevotional + restoreAppState
→ fetchBlogPostMetadata
→ renderPostSelector + renderBlogButtonsLazy + renderBlogPostSelectorGrid
```

Each JavaScript file is an IIFE. Follow this shape and export only intentional cross-module APIs:

```js
(function() {
    'use strict';

    // private implementation
    window.publicFunction = publicFunction;
})();
```

Do not introduce module syntax, package imports, framework state, or a second global namespace.
Existing code uses 4-space JavaScript indentation, `camelCase` functions/variables, `UPPER_SNAKE_CASE`
constants, kebab-case DOM IDs/classes, and template literals for generated markup.

## DOM contracts — do not rename/remove

These selectors are cross-module interfaces, not incidental markup:

```text
#home, #blogs, #about
#home-hero-content, #particles
#blog-intro-view, #blog-post-view, #blog-article-content
#blog-post-selector-grid, #post-selector-list, #blog-buttons-container
#blog-sidebar-section, #sidebar, #sidebar-toggle
#next-post-btn
#consent-overlay
#mobile-nav-tray, #mobile-tray-overlay, #mobile-tray-toggle
.page-section, .nav-item, .post-selector-item, .theme-btn
.back-to-intro-btn, .blog-card, .lazy-image[data-src]
.custom-scrollbar, .custom-scrollbar-track, .custom-scrollbar-thumb
```

When adding UI, prefer existing selectors and event functions. If a new selector is required, update
all producers/consumers in the same change. Keep `data-page`, `data-theme`, and `data-post-id` values
stable. Preserve `aria-label`/`title` updates on sidebar and mobile toggles.

## Navigation, hash, and state invariants

- Pages are DOM sections, not server routes: `home`, `blogs`, `about`.
- URL hashes are `#home`, `#blogs`, `#about`, or `#blog-<post-id>`.
- `js/ui.js` owns `history.pushState`/`replaceState` and hash interpretation.
- `js/blog.js` owns post view transitions and increments a navigation token to discard stale fetches.
- Post opening must use `window.openBlogPostLazy(id)`; home/hover/next-post paths must retain prefetch.
- `goBack()` means previous post when one exists, otherwise the blog intro; it is not browser history.
- `window.blogPostMetadata` is sorted newest-first by `new Date(date)` after manifest fetch.
- `js/state.js` saves after interaction (500 ms configured delay) and before unload:

```json
{
  "currentPage": "home|blogs|about",
  "activeBlogPost": "post-id|null",
  "sidebarCollapsed": true,
  "theme": "auto|light|dark",
  "timestamp": 0
}
```

- State storage key: `localStorage['blogPlatformState']`.
- Scroll positions per page live in `localStorage['blogPlatformScrollPositions']`; keys are `home`,
  `blogs`, `about`, and `blog-<post-id>`. `js/state.js` saves on scroll (debounced), on
  navigation clicks, and before unload; it restores via `window.restoreScrollPosition()` after
  navigation. New navigation code must call `window.restoreScrollPosition()` after its content
  renders and must not fight it with a later `scrollTo(0, 0)`.
- Theme cookie key: `theme_preference`, one of `auto`, `light`, `dark`, one-year expiry. An inline
  pre-paint `<head>` snippet in `index.html` resolves it into `html[data-theme]` and the
  `theme-color` meta with the same logic as `ui.js`; runtime theme changes stay owned by `ui.js`.
- Consent key: `localStorage['system_warning_consent'] === 'true'`.
- Do not write state directly from new UI code; use `saveAppState()`/existing interaction delegation.

## Blog content contract

`blog/posts.json` is the discovery index. Every entry must have a unique `id` and an existing root-
relative `slug`; the renderer expects this shape:

```json
{
  "id": "kebab-case-id",
  "slug": "/blog/kebab-case-id.md",
  "title": "Visible title",
  "date": "Jul 30 2026",
  "category": "Tutorial",
  "icon": "📝"
}
```

Add a post atomically:

1. Create `blog/<id>.md`.
2. Add one manifest object with matching `id` and `slug`.
3. Ensure JSON parses and the manifest slug points to the new file.
4. If title/date/category/icon are in Markdown frontmatter, verify they intentionally match the index.

Alternatively, `admin.html` does all four steps automatically: it serializes the WYSIWYG editor to Markdown,
and `functions/api/publish.js` commits new media files, the post file, and the manifest entry to `main` in a single commit (Pages auto-rebuilds). Manual
edits and admin publishes both work; the repo stays the single source of truth. The functions need Cloudflare
Pages secrets: `ADMIN_TOKEN` (bearer token sent by the admin page; must be at least 32 chars — shorter values
fail closed with 503; rotation is supported by setting a comma-separated list during transition) and
`GITHUB_TOKEN` (fine-grained PAT with Contents read/write on this repo); optional `GITHUB_OWNER`/`GITHUB_REPO`/
`GITHUB_BRANCH` (defaults `palipeli`/`pubicStaticBlog`/`main`). Optional KV bindings `RATE_LIMIT_KV` and
`QUOTA_KV` enable per-IP auth-failure lockouts, per-IP GET throttling, and daily publish quotas; all
endpoints degrade gracefully when the bindings are absent. Both `GET` and `POST /api/posts` require the same
bearer token; `GET /api/posts` is admin-only and performs GitHub tree reads, so it must never be served to
unauthenticated clients (the service worker routes `/api/` as network-only). Service worker routing already
passes non-GET requests through, so the publish POSTs are never intercepted.

The loader fetches `meta.slug`, parses the body, and lets frontmatter override manifest values for
`title`, `date`, `category`, and `icon`. The parser is deliberately minimal:

```md
---
title: "Title"
date: "2026-07-30"
category: "Tutorial"
icon: "📝"
---

# Body
```

Requirements: opening delimiter is the first line `---`; closing delimiter is its own `---` line;
values are split on the first key/value colon by the current implementation; quotes are stripped;
arrays/nested YAML are not parsed. Unknown keys (`description`, `tags`, `heroImage`, `author`, etc.)
are currently ignored by rendering. Use the manifest for fields needed by cards/sidebar/home.

Supported custom Markdown includes ATX/setext headings, thematic breaks, fenced/indented code,
inline code, emphasis/strong/combined emphasis, strikethrough, links, images, autolinks,
blockquotes/nesting, ordered/unordered/task lists, tables, raw HTML blocks, and hard line breaks.
Language labels become `code.language-<label>`; no syntax highlighter is installed. Markdown output
passes `sanitizeHtml()` before insertion. Preserve `data-src` image output so `lazyload.js` can load it.

Security rules for content/UI changes:

- Do not add executable HTML, event-handler attributes, `javascript:` URLs, or data URLs.
- Keep escaping/sanitization at the parser boundary; do not bypass it for post body content.
- Treat manifest metadata and future remote content as untrusted when inserting with `innerHTML`;
  prefer `textContent`/DOM APIs or escape values.
- Do not fetch arbitrary origins from the service worker or add unrestricted message URLs.

## Service-worker invariants

`sw.js` is root-scoped and only handles same-origin `GET` requests. External Google Fonts and
cdnjs requests are left to the browser. Current caches:

```text
pubic-static-blog-v2  # compatibility/cleanup namespace
static-assets-v17     # HTML/CSS/JS/JSON/etc.
images-v15           # webp/png/jpg/etc.
blog-content-v2     # Markdown and /blog/ content
```

Strategies:

- `/`, HTML, `/blog/posts.json`: network-first, cached fallback.
- static extensions, images, fonts, Markdown, `/blog/*`: cache-first.
- cross-origin: network-only/untouched.
- failed HTML navigation: cached `/index.html` or generated offline response.

When adding or renaming runtime assets:

1. Update `PRECACHE_ASSETS` if the asset is required for first-load/offline shell.
2. Update the explicit asset list in `precacheAllAssets()`; it duplicates JS/media coverage.
3. Ensure the URL passes `isCacheableMessageUrl()` before relying on prefetch.
4. Bump relevant cache version constants when cache contents/strategy must invalidate old clients.
5. Keep `PRECACHE_ASSETS`, `precacheAllAssets()`, and cache version changes coherent.

Supported client → SW messages: `precache-bg {url}`, `prefetch-bg {urls[]}`,
`prefetch-posts {urls[]}`, `precache-all`, `skip-waiting`, and `clear-cache`.
Keep `pendingFetches` deduplication and same-origin validation intact.

## CSS and responsive rules

- Theme source of truth is `html[data-theme]`; valid explicit values are `light`/`dark`, with `auto`
  resolved by `matchMedia('(prefers-color-scheme: dark)')` in `ui.js`.
- Reuse existing CSS custom properties (`--bg-*`, `--text-*`, `--accent-pink`, `--surface-*`) rather
  than hardcoding parallel theme values.
- Desktop reserves a fixed 280px sidebar; `.main-container.sidebar-collapsed` removes that margin.
- Mobile breakpoint is `max-width: 768px`; the dynamic tray/sidebar collapse is `max-width: 1024px` and the burger appears whenever the sidebar is collapsed (auto or manual) so it can be reopened.
- Respect `prefers-reduced-motion`; particle creation already opts out. Do not make flashing behavior
  more intense without updating the consent warning.
- Keep asset URLs root-relative to match CSS and SW behavior.


Do not add browser, server, or build-tool verification instructions unless the project architecture
explicitly changes to require them.

## Agent guardrails

- Inspect existing code and preserve behavior before editing; do not “modernize” to a framework.
- Make the smallest coherent change; JS/CSS files are intentionally stripped of inline comments and
  unnecessary vertical whitespace — do not reintroduce per-file header comments or blank-line padding;
  update `AGENTS.md`/`SITE_SPEC.md` instead.
- Never modify `LICENSE` or remove existing posts/assets without explicit instruction.
- Do not add dependencies, build artifacts, lockfiles, or generated files.
- Keep manifest, Markdown path, and service-worker asset coverage consistent in the same change.
- Preserve lazy loading, navigation-token race protection, state restoration, consent gating, and
  reduced-motion handling unless the task explicitly changes those requirements.
- Validate paths case-sensitively; deployment hosts may be case-sensitive even on macOS.