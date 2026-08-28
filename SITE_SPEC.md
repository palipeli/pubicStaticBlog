# Site Specification — Michelle's DNS and Blog (pubicStaticBlog)

> **Purpose of this document:** A complete, self-contained specification of the `pubicStaticBlog`
> project. Feed this file (in full) to an AI coding agent to reproduce the site from scratch, audit
> it, or extend it without access to the original repository. It encodes the architecture, DOM
> contracts, state model, caching rules, content pipeline, admin tooling, and security posture in
> sufficient detail to reconstruct behavior 1:1.
>
> **Live site:** https://kamikami.eu — **Repo:** `palipeli/pubicStaticBlog` (GitHub) — **License:** GPL-3.0

---

## 1. Site Brief

| Field | Value |
|---|---|
| Site name | Michelle's DNS and Blog (`kamikami.eu`) |
| Site type | Single-page-application (SPA) personal blog + DNS-sideloading landing page |
| Primary goal | Share posts about "shitty and janky technology" (audio, networking, Linux), distribute a privacy-preserving iOS sideloading DNS profile (`.mobileconfig`), and funnel visitors to the DNS, blog, monitoring, and cat-pictures CTAs |
| Audience | Tech hobbyists, iOS sideloaders (WSFteam.xyz ecosystem), self-hosters, Linux/audio enthusiasts; the author's personal circle |
| Tone | Deliberately informal, self-deprecating, chaotic-friendly ("super-cute-but-shitty"), with playful curse words and memes; content is sincere and technically competent underneath the jokes |
| Brand keywords | retro terminal, VT323 monospace, neon pink (#ff45fc), translucent surface, dark/light theme, particle background, flashing-light warning, cat pictures, "kamikami.eu" |

### 1.1 Essential constraints (non-negotiable)

1. **Browser-only vanilla stack.** Zero runtime dependencies, zero build step. Pure HTML, CSS, and
   ES6+ JavaScript. No `package.json`, bundler, transpiler, linter, test runner, or generated `dist/`.
2. **Static hosting.** Serve the repository root as static files. All asset URLs are root-relative
   (`/style.css`, `/media/logo.webp`) because the site deploys at `/` on Cloudflare Pages and the
   service worker is root-scoped.
3. **SPA pages are DOM sections**, not server routes. Exactly three pages: `home`, `blogs`, `about`.
4. **Every JS file is an IIFE** that communicates through `window.*` globals. No ES modules, no
   imports, no framework state, no second global namespace.
5. **Informal copy is intentional.** Do not "fix" the language of the UI copy unless the task
   explicitly asks for editorial changes.
6. **Do not alter `LICENSE`** or remove existing posts/assets without explicit instruction.
7. All features preserve these invariants: lazy image loading, post-fetch navigation-token race
   protection, per-page scroll restoration, consent gating of the flashing-light warning, and
   `prefers-reduced-motion` handling.

---

## 2. Deployment Environment

- **Host:** Cloudflare Pages, root of `main` branch (GitHub repo `palipeli/pubicStaticBlog`).
  Pages auto-rebuilds on every commit.
- **Domain:** `kamikami.eu` (also `cloud.kamikami.eu` for file drops, `stats.kamikami.eu` for
  Uptime Kuma monitoring, `graph.kamikami.workers.dev` for the DNS-graph data proxy).
- **Edge function directory:** `functions/api/` (Cloudflare Pages Functions; no `_worker.js`).
- **Custom headers:** `_headers` file at repo root (see §14 Security).
- **No server-side rendering, no database.** `blog/posts.json` is the discovery index; Markdown
  posts are fetched and parsed client-side.
- **Environment secrets (Cloudflare Pages):**
  - `ADMIN_TOKEN` — bearer token sent by the admin page. Must be ≥ 32 characters; shorter values
    fail closed (503). Comma-separated list allowed during rotation.
  - `GITHUB_TOKEN` — fine-grained PAT with Contents read/write on this repo.
  - `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH` — optional; defaults `palipeli` / `pubicStaticBlog` / `main`.

---

## 3. Information Architecture

### 3.1 Pages, hashes, and URL rules

| Page | DOM section `id` | URL hash | Notes |
|---|---|---|---|
| Home | `#home` (`.page-section`) | `#home` | Default page; default hash injected via `history.replaceState` on load when path is `/` or `/index.html` and no hash exists |
| Blogs | `#blogs` (`.page-section`) | `#blogs` | Intro view (`#blog-intro-view`) and post view (`#blog-post-view`) |
| About | `#about` (`.page-section`) | `#about` | Profile card |
| Blog post | rendered inside `#blog-post-view` | `#blog-<post-id>` | E.g. `#blog-cat-1` |

- Only one `.page-section` has `.active` at a time; CSS shows that section. Nav `.nav-item` with
  matching `data-page` gets `.active`.
- `js/ui.js` owns `history.pushState`/`replaceState` and hash interpretation.
- `goBack()` means "previous post, else blog intro" — it is **not** browser history.
- `data-page`, `data-theme`, and `data-post-id` attribute values must remain stable.

### 3.2 Site chrome (present on all pages)

1. **`#particles`** — full-page fixed canvas with drifting floating shapes (see §6.6).
2. **Fixed header** (`.header`, 40px tall, z-index 1000) — left: `.blue-button` brand button
   ("kamikami.eu", `onclick="handleClickMe()"` navigates home with a pulse animation); right:
   `.nav-item` links Home / Blogs / About with `data-page` attributes.
3. **`.main-container`** — `height: 100vh`, `margin-right: var(--sidebar-width)` (280px) on
   desktop; class `.sidebar-collapsed` removes the margin. Contains `.content-area` + `.sidebar`.
4. **`.content-area`** — the only scrollable column on desktop; gets the custom scrollbar
   (see §6.7). `padding: calc(var(--header-height) + 15px) 15px 15px`.
5. **`.sidebar`** — fixed, `right: 0`, `width: 280px`, translucent surface panel, z-index 999, with a
   half-pill `.sidebar-toggle` button centered vertically on its left edge. Sections:
   - **Theme chooser** (always visible): three `.theme-btn[data-theme]` buttons
     (`auto` / `light` / `dark`) with Font Awesome icons (desktop / sun / moon).
   - **"All Posts"** (`#blog-sidebar-section`, hidden until metadata loads): `#post-selector-list`
     of `.post-selector-item` links, one per post.
   - Sidebar has **no visible scrollbar** (intentional).
6. **Footer** (page-level `<footer>`): informal lines + address "Idjen Boulevard No.48, Kota
   Malang 65112, Indonesia", email `sel@kamikami.eu`, "Copyright © Michelle, 2026". A duplicate
   footer is appended inside the home hero by `js/home.js` (class `.home-page-footer`).
7. **`#consent-overlay`** (from `warning.js`) — bottom-sheet consent dialog that must be accepted
   before the flashing-light warning is armed.

### 3.3 Home page (`#home`)

`.home-hero` (`#home-hero-content`) contains, top to bottom:

1. `.home-lead` paragraph — the big "WELCOME TO MY SUPER-CUTE-BUT-SHITTY WEBSITE!" line; its text
   is **replaced by a typewriter devotional** once consent is granted (see §8.8).
2. `media/logo.webp` logo image (70% width, max 560px, centered).
3. `#blog-buttons-container` — rendered by `js/home.js`; the "blog buttons" row (see §6.8).
4. `.home-content` — 3 paragraphs (tech-blog pitch, DNS profile description, cat-pictures call).
5. `.dns-graph-card` — "DNS Requests" line chart, canvas `#dns-graph` (see §6.10).
6. `.github-graphs-heading` + `.github-graphs-container` — two contribution charts
   (`#github-graph-mikaaeru`, `#github-graph-palipeli`) with range buttons
   `.github-graph-ranges` (1d / 10d / 30d / 6m / 1y).
7. `.home-page-footer` (appended dynamically).

### 3.4 Blogs page (`#blogs`)

`.blog-layout-container` → `.blog-main-content` (`#blog-main-content`), two views toggled via
`style.display`:

- **`#blog-intro-view`** — `.blog-article` with `<h1>All Blog Posts</h1>`, `.blog-meta` hint
  ("Select a post to read"), and `#blog-post-selector-grid` (auto-filled grid of `.blog-card`
  entries by `js/blog.js`).
- **`#blog-post-view`** (hidden by default) — `.blog-post-nav` with `.back-to-intro-btn`
  (`onclick="goBack()"`, hover-prefetches previous post) and `#next-post-btn`
  (`onclick="goToNextPost()"`, hover-prefetches next post; hidden when no next post), then
  `article.blog-article#blog-article-content` filled with `<h1>icon title</h1>`, `.blog-meta`
  (`.blog-date` + category), and `.blog-post-content` (sanitized rendered Markdown).

### 3.5 About page (`#about`)

`.about-layout-container` → `.about-hero`: `.profile-img` (favicon-circle.webp), `.social-links`
(three `.blog-btn` pills: Discord, GitHub, YouTube), `<h1>My name is Michelle</h1>`, `.subtitle`
paragraph, a floating 💖 emoji, and the home-page footer block.

---

## 4. Script Loading Order (CRITICAL)

`index.html` loads these in this exact order. **Do not reorder or convert to ES modules.**
All JS/CSS files have been stripped of inline comments and unnecessary vertical whitespace; authoritative behavioral documentation lives in `AGENTS.md` and this file, not inline.

```text
Early in <head> (preload, must load before any app code): js/cp.js (anti-devtools gate)

Non-deferred, in <head> right after the theme-color meta (pre-paint): inline theme bootstrap snippet —
                        reads the theme_preference cookie with the same regex as ui.js getCookie();
                        anything but light/dark resolves via matchMedia('(prefers-color-scheme: dark)');
                        sets html[data-theme] and syncs the theme-color meta to #121212/#f6f5f4 so the
                        first paint already matches the saved/system theme (mirrors admin.html's
                        bootstrap; keep resolution identical to ui.js applyTheme()).

Non-deferred, first thing in <body>: inline SW-registration snippet (registers /sw.js, posts precache-bg
                                     for the active-theme background image based on theme_preference
                                     cookie + system pref)

Deferred, at end of <body> (exact order, with CDN shims):
  js/config.js → js/markdown.js → js/lazyload.js → js/state.js → js/devotional.js →
  js/ui.js → js/blog.js → js/home.js → https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js →
  js/github-graph.js → js/dns-graph.js → js/mobile-tray.js → js/scrollbar.js → js/app.js
+ non-deferred after the deferred list: js/warning.js, js/chat-cloud.js (both self-init on DOM-ready)

Rationale: modules communicate through `window`, so earlier modules must exist before later ones
read them. `js/cp.js` must verify before any app code runs. `app.js` is the final coordinator.
Do not convert scripts to ES modules or introduce imports.
```

### 4.1 Startup sequence (`js/app.js` on `DOMContentLoaded`)

```text
createParticles()
→ setupNavigation() + setupScrollPositionTracking() + setupHashRouting()
→ setupTemplates() + setupSystemThemeListener() + setupThemePrefetch()
→ setupSidebarToggle() + setupCustomScrollbars() + setupStatePersistence()
→ monitorWarningAndStartDevotional() + restoreAppState()
→ fetchBlogPostMetadata().then(...)
    → renderPostSelector(posts)
    → renderBlogButtonsLazy(posts)
    → renderBlogPostSelectorGrid(posts)
    → show #blog-sidebar-section
    → processPendingBlogPostRestore()
→ console.log('Blog platform initialized successfully')
```

`warning.js` and `js/mobile-tray.js` self-init on DOM-ready (they do not wait for `app.js`).
`js/lazyload.js`, `js/github-graph.js`, `js/dns-graph.js` also self-init on `DOMContentLoaded`.

### 4.2 The IIFE + window contract pattern

```js
(function() {
    'use strict';
    window.publicFunction = publicFunction;
})();
```

Code style: 4-space JavaScript indentation, `camelCase` functions/variables, `UPPER_SNAKE_CASE`
constants, kebab-case DOM IDs/classes, and template literals for generated markup. Files are
intentionally stripped of inline comments and unnecessary vertical whitespace; do not reintroduce
per-file header comments or blank-line padding — update `AGENTS.md`/`SITE_SPEC.md` instead.

---

## 5. Visual Design System

### 5.1 Theme source of truth

- `html[data-theme]` is the single source of truth. Valid explicit values: `light`, `dark`.
  The user-facing choice `auto` is stored separately (cookie) and **resolved** by
  `matchMedia('(prefers-color-scheme: dark)')` in `js/ui.js` into an explicit `data-theme`.
- A synchronous inline bootstrap in `<head>` (`index.html`, right after the theme-color meta) runs the
  same resolution **before first paint** so dark-theme users never flash light: it reads the cookie,
  resolves `auto`/missing/junk values via the system preference, and sets both `html[data-theme]` and
  the `theme-color` meta. `setupTemplates()` re-applies the identical result at `DOMContentLoaded`
  (visual no-op). Keep the snippet in sync with `ui.js`.
- Theme preference persists in cookie `theme_preference` = `auto` | `light` | `dark`,
  365-day expiry, `path=/` (`SameSite=Lax; Secure` in the admin page variant).
- Theme changes animate via `--theme-transition-duration: 0.4s`.
- A `MutationObserver` on `document.documentElement` attribute `data-theme` re-themes both charts.

### 5.2 CSS custom properties (tokens) — `:root` (light baseline)

```css
--bg-dark: #f6f5f4;                    /* page background color */
--bg-panel: rgba(255,255,255,0.72);
--bg-header: rgba(246,245,244,0.85);
--accent-pink: #ff45fc;                 /* primary accent */
--accent-pink-hover: #e031e0;
--text-primary: #2e3436;
--text-secondary: #5e5e5e;
--border-color: rgba(0,0,0,0.08);
--header-height: 40px;
--sidebar-width: 280px;
--sidebar-collapse-transition: 0.3s cubic-bezier(0.4,0,0.2,1);  /* shared by sidebar + content */
--font-main: 'MesloLGS NF','Fira Code',Consolas,Monaco,'Andale Mono','Ubuntu Mono',monospace;
--blur-overlay-brightness: 1.0;
--dark-overlay-color: rgba(255,255,255,0.92);
--theme-transition-duration: 0.4s;
--btn-bg / --btn-text / --btn-border / --btn-hover-bg;
--theme-selector-bg / --theme-selector-text / --theme-selector-hover-bg;
--surface-bg: rgba(255,255,255,0.65);
--surface-border: rgba(255,255,255,0.4);
--surface-shadow: 0 8px 32px rgba(0,0,0,0.12);
--surface-blur: 0px;                      /* blur is intentionally 0 for perf; kept as a knob */
--surface-saturate: 1.4;
--surface-brightness: 1.05;
--surface-radius: 16px;
--surface-pulse-shadow: 0 4px 16px rgba(0,0,0,0.08);
--bg-image-dark: url('/media/bg-dark.webp');
--bg-image-light: url('/media/bg-light.webp');
```

### 5.3 Dark theme overrides (`[data-theme="dark"]`)

```css
--bg-dark: #121212; --bg-panel: rgba(26,26,26,0.75); --bg-header: rgba(18,18,18,0.85);
--accent-pink: #ff45fc;  /* unchanged */
--text-primary: #ffffff; --text-secondary: #9a9a9a;
--border-color: rgba(255,255,255,0.12);
--blur-overlay-brightness: 0.3; --dark-overlay-color: rgba(0,0,0,0.92);
--btn-bg: rgba(26,26,26,0.6); --btn-text: #fff; --btn-border: rgba(255,255,255,0.2);
--btn-hover-bg: rgba(10,10,10,0.7);
--theme-selector-bg: rgba(26,26,26,0.6); --theme-selector-text: #fff;
--theme-selector-hover-bg: rgba(10,10,10,0.7);
--surface-bg: rgba(26,26,26,0.70); --surface-border: rgba(255,255,255,0.12);
--surface-shadow: 0 8px 32px rgba(0,0,0,0.4); --surface-brightness: 0.92;
--surface-pulse-shadow: 0 4px 16px rgba(0,0,0,0.3);
```

`[data-theme="light"]` re-declares only the values that differ from `:root` (mostly no-ops kept
for clarity). Rule: **never hardcode parallel theme values in components** — consume the tokens.

### 5.4 Page background

- `body` background is the flat `--bg-dark` color plus a `body::before` fixed full-viewport
  layer showing a background image: `--bg-image-light` in light theme, `--bg-image-dark` in dark.
  `background-size: cover`, centered.
- `html { height: 100%; overflow: hidden; }` and `body { overflow-y: auto; }`.

### 5.5 Typography

| Role | Font | Notes |
|---|---|---|
| Body / UI | `var(--font-main)` = `'MesloLGS NF','Fira Code',Consolas,Monaco,'Andale Mono','Ubuntu Mono',monospace` | Terminal monospace stack; no Google Fonts import for this stack |
| Display / brand | `'VT323'` | Local TTF at `/media/vt323.ttf`, declared via `@font-face` with `font-display: swap`; used by the header brand (`kamikami.eu`, italic, lowercase, 1.4rem) and the consent overlay |
| Icons | Font Awesome 6.5.1 (cdnjs) | Loaded with `rel=preload as=style` + onload swap, `crossorigin="anonymous"`, `referrerpolicy="no-referrer"`; `noscript` fallback link |

- Base body font-size ~13px; `.home-content p` is 12px with `line-height: 1.8`; the consent box
  text is larger VT323. Keep small-but-readable retro sizing.

### 5.6 Motion

- Header: `slideDown 0.5s ease-out` on load.
- Sidebar: `slideLeft 0.5s ease-out` on load; collapse is a compositor-only
  `transform: translateX(100%)` (no width animation), matched exactly by `.main-container`'s
  `margin-right` transition (same duration/easing var) so content stays glued to the sidebar.
- Home hero and about hero re-trigger `.home-animate` / `.about-animate` entrance animations on
  every navigation to those pages (with a forced reflow reset). **Skip when
  `prefers-reduced-motion: reduce`.**
- Floating particles and shapes: `floatShape1..4` / `float` keyframes; particles are skipped
  entirely under reduced motion.
- Theme buttons and `.blue-button` have hover lift (`translateY(-2px)`) and pulse animations.

---

## 6. Component Library & Layout Details

### 6.1 `.nav-item`

`<a href="#" class="nav-item [active]" data-page="home|blogs|about">`. Desktop styling:
secondary-text color, 13px, `padding: 8px 16px`, radius 3px; hover → primary text + subtle
background; `.active` → `color: var(--accent-pink)` + `background: rgba(255,69,252,0.25)`.
Clicking is intercepted (`preventDefault`), drives section switching, blog-session restoration
logic, hash update, and state save.

### 6.2 `.blue-button` (header brand)

Pink gradient pill (`linear-gradient(135deg,#ff1493,#ff69b4)`), white text, 10px uppercase label
with a VT323 italic lowercase span inside, `border-radius: 4px`, glow shadow
`0 2px 8px rgba(255,20,147,0.4)`. Hover reverses the gradient and lifts 2px. `onclick` =
`handleClickMe()` (pulse + navigate home).

### 6.3 `.theme-btn` / `.mobile-theme-btn`

Full-width stacked buttons in the sidebar (or tray). Token-driven
(`--theme-selector-bg/-text`), 13px semibold, radius 6px, `padding: 12px 15px`, Font Awesome
icon + label. The `.active` one highlights with the pink accent.

### 6.4 `.sidebar-toggle`

28×56px rounded-left pill that hangs off the sidebar's left edge, vertically centered below the
header (`top: calc(50% + var(--header-height)/2)`), with an SVG chevron. `aria-label`/`title`
switch between "Collapse Sidebar" / "Expand Sidebar". Clicking toggles `.collapsed` on the
sidebar + `.sidebar-collapsed` on `.main-container`; auto-hides for narrow windows (restores when
space returns) and is disabled on mobile where the tray replaces it.

### 6.5 `.post-selector-item` (sidebar "All Posts")

Rendered by `renderPostSelector(posts)` in `js/blog.js` into `#post-selector-list`. Each item is
a `div[data-post-id]` with escaped title/icon; hover prefetches the post content; click calls
`window.openBlogPostLazy(id)`; `.active` styling tracks the currently open post.

### 6.6 Particles (`#particles`, `js/ui.js createParticles`)

Full-viewport fixed canvas with dozens of small floating shapes (squares/diamonds/circles)
drifting on randomized trajectories (CSS transform keyframes `floatShape1..4`, staggered
durations/delays; some rotated 45°). **Skipped under `prefers-reduced-motion: reduce`.**
Particles render behind content (content uses translucent surface panels with opaque-ish backgrounds).

### 6.7 Custom scrollbar (`js/scrollbar.js`)

- A `.custom-scrollbar` (track + `.custom-scrollbar-thumb`) is injected into `.main-container`
  and bound to `.content-area`. Rendered *inside* the container so it sits below the fixed header
  and never overlaps it.
- Thumb height = `max(24px, (clientHeight/scrollHeight) * trackHeight)`; positioning uses
  `transform: translate3d(0, y, 0)` (kept off the layout path). `.is-idle` hides the bar when
  nothing scrolls; `.is-dragging` while dragging.
- Pointer events: drag thumb (with `setPointerCapture`), click track to jump (thumb-centered).
- Refresh triggers: scroller `scroll`, window `resize`, capture-phase `load` (lazy images),
  `document.fonts.ready`, a `MutationObserver` on the scroller subtree, and `.main-container`
  `transitionend` (sidebar collapse reflow).
- The **sidebar intentionally has no scrollbar**; only `.content-area` gets one.

### 6.8 Blog buttons (`js/home.js renderBlogButtonsLazy`)

Rendered into `#blog-buttons-container` as `.blog-btn` anchors:
`<i class="fa-solid fa-book"></i> <span>title</span>` for two pinned-featured posts
(`michelle-dns-for-ios-sideloading`, `privacy-policy`); `category-<slugified-category>` class
added. Plus three static CTAs:
- `.category-fun` — "Send me cat pictures and files!" → `https://cloud.kamikami.eu/s/send-me-cat-pics` (new tab, noopener).
- `.category-blog-home` — "My Blog" → navigates to the blogs page via the nav item click.
- `.category-monitoring` — "Monitoring" → `https://stats.kamikami.eu/status/one` (new tab).

Hover on any post button prefetches (`preloadBlogPostContent`); click uses
`openBlogPostFromHomeLazy` (navigates to Blogs page first, then opens the post after 100ms,
deduplicated via a pending timer).

### 6.9 `.blog-card` grid (`renderBlogPostSelectorGrid`)

`#blog-post-selector-grid` is auto-filled with `.blog-card` tiles (icon + title + meta). Cards
are translucent surface panels (`--surface-*`), radius `--surface-radius`, hover lifts/slides and prefetches the
post; `.pinned` posts sort first. The grid renders again on `showBlogIntroView()`.

### 6.10 Charts (Chart.js 4.4.1 via cdnjs, `defer`, crossorigin)

- **DNS graph** (`js/dns-graph.js`): fetches `https://graph.kamikami.workers.dev/` (a Cloudflare
  GraphQL proxy); maps `resolverDecision` codes — 5/6 = allowed (green `#50D096`), 9/10 = blocked
  (magenta `#EA38EC`); stacked/overlaid line chart on `#dns-graph`; y ticks compressed to K/M;
  x labels as `MM/DD`.
- **GitHub contribution graphs** (`js/github-graph.js`): two accounts `mikaaeru`, `palipeli` from
  `https://github-contributions-api.jogruber.de/v4/<user>`; line charts `#github-graph-<user>`
  with neon-green series, range buttons `1d|10d|30d|6m|1y` filtering client-side.
- Both: theme-aware color objects (dark/light), re-themed by a `MutationObserver` on
  `data-theme`, resized via `ResizeObserver` on their canvas wraps plus the `.github-graphs-container` / `.dns-graph-card` and `.main-container` (sidebar collapse reflow), with a `window resize` fallback when `ResizeObserver` is unavailable, and replaced by an error `<p>` when the API fails. Chart.js is configured `responsive: true` (`maintainAspectRatio: true, aspectRatio: 16/9` for GitHub, `maintainAspectRatio: false, height 300px` for DNS).

### 6.11 Mobile tray (`js/mobile-tray.js`, deferred)

Activated when `window.innerWidth <= 1024` (breakpoint constant `MOBILE_BREAKPOINT = 1024`, must stay in sync with `js/ui.js` `SIDEBAR_COLLAPSE_BREAKPOINT` and the sidebar/burger `@media` queries).

- A `#mobile-nav-tray-toggle` toggle button always stays in the DOM (hidden by CSS on desktop) so
  its width/opacity transitions smoothly across the breakpoint; on mobile it sits in the header
  and slides the desktop `.nav-item` links out of the way.
- Opening creates/uses `#mobile-nav-tray` (slide-in panel) + `#mobile-tray-overlay`
  (dimmer); `body.mobile-tray-open` locks the page. Both elements are removed entirely when
  resizing back to desktop.
- Tray content: `#mobile-blog-posts-section` with `#mobile-post-list` of `.mobile-post-item`
  entries (`title` + `icon date • category`, `.pinned` posts get a 📌 badge), plus a
  `#mobile-theme-chooser` with `.mobile-theme-btn` buttons mirroring the sidebar behavior.
- Post items prefetch on `touchstart`/`mouseenter` and open via `openBlogPostLazy` on click
  (then close the tray). Tray theme clicks call `applyTheme` + `saveThemePreference` and sync the
  sidebar buttons (and vice versa).
- The blog section visibility in the tray updates on `blog:metadata-loaded` and nav clicks.

### 6.12 Consent overlay (`warning.js`, non-deferred, inlined styles)

- On first visit, a bottom-sheet `#consent-overlay` (fixed, `z-index: 2147483646`, 8px backdrop
  blur) shows `#consent-box` (VT323, dark `#3a3a3a` panel, 4px black border): a flashing-light /
  seizure warning heading (pink, uppercase), an explanation paragraph, `#loading-status`
  ("Loading assets…" → "Assets Loaded."), and **ACCEPT** / **DECLINE** `.mc-btn` buttons.
  Buttons stay disabled until `window.load` fires.
- **ACCEPT** → `localStorage['system_warning_consent'] = 'true'`, fade out overlay, dispatch
  `warning:cleared`.
- **DECLINE** → removes the consent key, then triggers the warning repeatedly for 3 seconds and
  reloads the page.
- After consent, **any** stray `keydown`, `mousedown`, or small-movement `touchstart/touchend`
  interaction triggers a brief full-screen white flash overlay (`#warning-flash`) with a random
  phrase ("STOP", "PLS", "STOPPPPPP!", "STAHPPP", "ARE YOU INSANE?"). Interactions with site UI
  (nav, theme buttons, tray, post items, graph range buttons, etc.) are exempted via a
  `bypassWarning` flag.
- A `beforeunload` dialog is armed whenever the user has not recently interacted with an exempt
  control (leaving the page prompts "are you sure?").
- The `#consent-overlay` element must remain in the DOM (used by `js/devotional.js` to gate the
  typewriter verse) — `monitorWarningAndStartDevotional` waits for consent + overlay hidden.

### 6.13 Post article rendering (`blog-article` / `.blog-post-content`)

Post view markup inserted into `#blog-article-content`:

```html
<h1>{icon} {escaped title}</h1>
<div class="blog-meta" style="margin-bottom:20px;">
    <span class="blog-date">{escaped date}</span>
    <span style="margin-left:15px;">{escaped category}</span>
</div>
<div class="blog-post-content">{sanitized rendered markdown}</div>
{blogPostFooter}
```

`blogPostFooter` = `#blog-post-nav` controls. After render: `initializeLazyLoading()`,
next/back button visibility per neighbors, hash update (replaceState), `restoreScrollPosition()`,
and state save. The intro view's grid is likewise refreshed. Content is escaped for title/date/
category and **never** inserted unescaped; the body goes through `sanitizeHtml`.

### 6.14 `.blog-btn` variants used across the site

Category-colored pill buttons reused for home CTAs, about social links (`category-discord`,
`category-github`, `category-youtube`), and post actions. Rounded, bordered, uppercase labels,
pink accents for interactive ones (`--accent-pink` border/color, hover darkens to
`--accent-pink-hover`).

---

## 7. Content Model

### 7.1 Manifest — `blog/posts.json`

Ordered array; every entry must have a unique `id` and an existing root-relative `slug`.

```json
{
  "id": "kebab-case-id",
  "slug": "/blog/kebab-case-id.md",
  "title": "Visible title",
  "date": "Jul 30 2026",
  "category": "Tutorial",
  "icon": "📝",
  "pinned": true          // optional; pinned posts sort above the rest
}
```

- The loader (`fetchBlogPostMetadata`) normalizes entries (defaults: `Untitled`, empty date,
  `Uncategorized`, `📄`), sorts **pinned first, then newest-first by `new Date(date)`**, stores to
  `window.blogPostMetadata`, and dispatches `blog:metadata-loaded`.
- Add a post atomically: (1) create `blog/<id>.md`, (2) add a manifest object with matching
  `id`/`slug`, (3) ensure JSON parses, (4) verify frontmatter doesn't contradict the index
  (frontmatter overrides manifest for `title`/`date`/`category`/`icon`).

### 7.2 Markdown post format — `blog/<id>.md`

```md
---
title: "Title"
date: "2026-07-30"
category: "Tutorial"
icon: "📝"
---

# Body
```

Frontmatter rules (deliberately minimal, `parseFrontmatter`):
- Opening delimiter is the **first line** `---`; closing delimiter is its own `---` line.
- Values split on the **first** key/value colon; quotes are stripped (double or single);
  unquoted values keep trailing text after re-joining remaining colons.
- Arrays/nested YAML are **not** parsed. Unknown keys (`description`, `tags`, `heroImage`,
  `author`, …) are ignored by rendering — use the manifest for card/sidebar/home fields.
- If no frontmatter exists, the whole file is treated as the body.

### 7.3 Supported Markdown syntax (custom parser `js/markdown.js`)

- **Headings:** ATX `#`…`######` and setext (`===` H1, `---` H2).
- **Thematic breaks:** `***`, `---`, `___`.
- **Code:** fenced ``` blocks with optional language label → `<code class="language-<label>">`
  (no highlighter installed; label sanitized to word chars); indented (4-space) code blocks;
  inline backticks with variable delimiter lengths.
- **Inline formatting:** emphasis `*`, strong `**`, combined `***`; same with `_`/`__`/`___`;
  strikethrough `~~`; hard line breaks (two trailing spaces or `\`); backslash escaping for
  `` \`*_{}[]()<>#+-.!| ``.
- **Links:** `[label](url "title")`, angle-bracket destinations, reference-style `[x][y]`
  (kept as literal text), autolinks `<https://…>` and `<mail@example.com>`, and bare
  `http(s)://` extended autolinks.
- **Images:** `![alt](url)` → `<img class="lazy-image" data-src="url" alt="alt">` (never a real
  `src`, so lazyloading handles it).
- **Blockquotes:** `>` with nesting (marker-count based), blank-line continuation, inline markup.
- **Lists:** unordered `- * +`, ordered `1.`, nested sub-items (deep nesting and ordered-within-
  unordered), task lists `- [ ]` / `- [x]` → `<input type="checkbox" disabled>`.
- **Tables (GFM):** pipe tables with `:---`, `:---:`, `---:` alignment → `align` attributes on
  `th`/`td`.
- **Raw HTML blocks:** open-tag-counted multi-line blocks passed through (then sanitized);
  inline HTML tags, entities (curated entity table incl. nbsp/amp/lt/gt/quot/#39/apos/copy/reg/
  trade/dash/arrow/suit/currency), `<br>`.
- **Paragraphs:** blank-line separated; paragraphs starting with `h1-6|ul|ol|pre|blockquote|hr|div`
  are not double-wrapped.

### 7.4 Sanitizer (`sanitizeHtml`, part of `parseMarkdown`)

- Parses output via `DOMParser`, keeps an **allowlist** of tags: `p b i em strong a code pre
  blockquote ul ol li h1-h6 table thead tbody tr th td img br hr span div input`.
- Removes disallowed attributes per tag; strips `href`/`src`/`data-src` that fail `isSafeUrl`
  (only `http`, `https`, `mailto`, or scheme-less/relative URLs allowed); forces `input[type]`
  to `checkbox`; unwraps disallowed elements (children preserved); on parser failure, strips all
  tags.
- Security rules for any content/UI change:
  - No executable HTML, event-handler attributes, `javascript:` URLs, or data URLs.
  - Keep escaping/sanitization at the parser boundary; never bypass it for post bodies.
  - Treat manifest metadata and remote content as untrusted with `innerHTML`; prefer
    `textContent`/DOM APIs or escape values.
  - The SW must never fetch arbitrary origins or add unrestricted message URLs.

### 7.5 Verses data — `blog/nt_verses_compact.json`

Compact array of tuples `[book, chapter, verse, text]` (NRSVUE) containing only "short" verses
(text < 150 chars). Fetched lazily only when the devotional starts; the short pool is filtered once
at load.

### 7.6 Media assets — `media/`

- Images: `favicon-circle.webp`, `logo.webp`, `bg-light.webp`, `bg-dark.webp`, `dns.webp`,
  `signing.webp`, `il-feel.webp`, `post-editor.webp`, `big-kitty.webp`, `car-dumdum.webp`,
  `kittler.webp`.
- Font: `vt323.ttf`.
- Downloads: `Michelle's DNS v2.mobileconfig` (iOS sideloading DNS profile — preserve URL-safe
  references and quote paths containing `'`).

---

## 8. Behavior Specification

### 8.1 App state persistence (`js/state.js`)

- **Storage key:** `localStorage['blogPlatformState']`.
- **Shape:**
```json
{
  "currentPage": "home|blogs|about",
  "activeBlogPost": "post-id|null",
  "sidebarCollapsed": true,
  "theme": "auto|light|dark",
  "timestamp": 0
}
```
- Saved by `saveAppState()`: on interaction (500ms debounce, `CONFIG.STATE_SAVE_DELAY`) and
  `beforeunload`; also scheduled 100ms after navigation and post opens. Handles
  `QuotaExceededError` by clearing the key once and retrying.
- Restored by `restoreAppState()`: applies saved theme (clicks the matching `.theme-btn`),
  sidebar collapsed state, and — if a post was open — sets `window.pendingBlogPostRestore` so the
  post re-opens once metadata loads (`processPendingBlogPostRestore`).
- New UI code must **not** write state directly; use `saveAppState()`/existing delegation.

### 8.2 Per-page scroll position (`js/state.js`)

- **Storage key:** `localStorage['blogPlatformScrollPositions']`; keys are `home`, `blogs`,
  `about`, and `blog-<post-id>`; each value stores scroll X/Y of `.content-area` plus window Y.
- `history.scrollRestoration = 'manual'`. Saves on window scroll (debounced), on navigation
  clicks, on `popstate`, `beforeunload`, `pagehide`, and `visibilitychange(hidden)`.
- Restores via `window.restoreScrollPosition()` after content renders (rAF + 60ms re-apply to
  catch late-settling content); refuses to clobber a user scroll that happened since restore;
  re-applies once more on `load` and on `blog:metadata-loaded` (for the blogs page).
- **Any new navigation code must call `window.restoreScrollPosition()` after its content renders
  and must not fight it with a later `scrollTo(0,0)`.**

### 8.3 Hash routing (`js/ui.js setupHashRouting`)

- Interprets `#home` / `#blogs` / `#about` / `#blog-<id>` on load and on `hashchange`/
  `popstate`; `updateHash(page, postId, addToHistory)` drives `history.pushState`/`replaceState`.
- `getBlogPostIdFromHash('blog-x')` → `'x'`; `generateBlogPostHash(id)` → `'blog-' + id`.
- Opening a hashed post waits for `blogPostMetadata` (up to `METADATA_WAIT_TIMEOUT_MS = 5000`).

### 8.4 Blog navigation model (`js/blog.js`)

- `window.blogPostMetadata` — sorted array (pinned first, then newest-first).
- `openBlogPostLazy(id)`: shows `#blog-post-view`, hides `#blog-intro-view`, sets loading state
  (`.loading` / spinner on the card), fetches via `loadBlogPostContentInternal` with up to 3
  retries and a 10s timeout (`AbortController`), caches content in a `Map`, renders the article,
  restores scroll, saves state. **Navigation-token guard:** a monotonically increasing token
  invalidates stale fetches so an older slow response can never overwrite a newer post.
- `preloadBlogPostContent(id)`: background-fetch + cache (deduplicated via inflight map), used by
  hover handlers (`.post-selector-item`, `.blog-card`, `.blog-btn`, `.mobile-post-item`, and the
  Back/Next buttons) and `waitForBlogMetadata`.
- `goBack()`: previous post if one exists (by manifest order), else `showBlogIntro()`.
- `goToNextPost()` / `preloadNextPostOnHover()` / `preloadPreviousPageOnHover()`: Next/Back.
- `showBlogIntro()`: hides post view, re-renders grid, `updateHash('blogs', null, false)`,
  restores scroll, saves state.
- **Post opening must always go through `window.openBlogPostLazy(id)`; home/hover/next-post
  paths must retain prefetch.**

### 8.5 Navigation UX (`js/ui.js setupNavigation`)

- Clicking "Blogs" while on home/about with a saved open post restores that post session exactly
  once (then intro on subsequent clicks); clicking "Blogs" while reading a post returns to the
  intro; clicking Home/About while reading remembers `wasReadingBlogPost` for the next Blogs
  click. Home/about triggers re-animation of their hero.
- The blog sidebar section shows on `blogs`, `home`, and `about` pages once metadata is loaded.

### 8.6 Theme behavior (`js/ui.js`)

- `getSavedTheme()`: `auto` for first-time visitors (no cookie), else the cookie value.
- `applyTheme(name)`: sets `html[data-theme]`; `auto` immediately resolves to dark/light via
  `matchMedia`. `setupSystemThemeListener` re-resolves `auto` on system changes.
- Theme buttons (sidebar + tray) toggle `.active`, call `applyTheme` + `saveThemePreference`
  (cookie, 365 days) and schedule a state save.
- `setupThemePrefetch`: on first mousemove near the theme chooser (100px proximity) or touch of
  the tray, posts `prefetch-bg` to the SW for the *alternate* background image so theme switches
  are instant. The inline head script already posted `precache-bg` for the current theme at
  SW-ready.

### 8.7 Lazy image loading (`js/lazyload.js`)

- Targets `img.lazy-image[data-src]` (exactly what the Markdown renderer emits). Sets
  `loading="lazy"`, marks `data-lazy-initialized`, and loads via: hover (`mouseenter`),
  touch (`touchstart`), and `IntersectionObserver` (`rootMargin: '10px 0px'`, unobserve after
  load). Loads through a preloaded `Image` first, then swaps `src` and sets `.loaded`; failures
  set `.error` but still assign `src`. Called after any post render that injects images and on
  `DOMContentLoaded`.

### 8.8 Devotional typewriter (`js/devotional.js`)

- Runs only when consent is granted and the overlay is gone: fetches
  `/blog/nt_verses_compact.json`, picks a random short verse, deletes the `.home-lead` text
  character-by-character (15ms interval) then types the verse (20ms interval):
  `"{text} — {book} {chapter}:{verse} NRSVUE"`. `requestAnimationFrame`-driven, cancellable,
  guarded against double-running. Gated via `monitorWarningAndStartDevotional`, which polls (up
  to 10×500ms) plus listens for `warning:cleared`.

### 8.9 Sidebar collapse (`js/ui.js setupSidebarToggle`)

- Toggles `.collapsed` on `#sidebar` and `.sidebar-collapsed` on `.main-container`; updates
  `aria-label`/`title`; auto-collapses when the window is too narrow (`hiddenForSpace` logic),
  restoring the previous state when space returns. On mobile the sidebar is hidden by CSS and the
  tray takes over.

### 8.10 Blog post sharing/deep links

Post URLs are `/ #blog-<id>` (hash link). The admin editor copies/opens these
(`/ #blog-<id>`), and the sidebar items, cards, and tray all honor the same id contract.

---

## 9. Service Worker (`sw.js`, root-scoped)

### 9.1 Caches

```text
pubic-static-blog-v2   # compatibility/cleanup namespace
static-assets-v17     # HTML/CSS/JS/JSON/etc.
images-v15            # webp/png/jpg/etc.
blog-content-v2     # Markdown and /blog/ content
```

### 9.2 Strategies (`getCacheStrategy`)

- `/`, `/index.html`, any `.html`: **network-first** (fallback: cached copy, else offline shell
  HTML with "Try Again" button for HTML navigations).
- `/blog/posts.json`: **network-first**.
- `/api/*`: **network-only** (never intercepted; non-GET requests are passed through untouched).
- static extensions (html/css/js/json/…), images, fonts, Markdown and `/blog/*`: **cache-first**.
- Cross-origin: **network-only / untouched** (Google Fonts/cdnjs left to the browser).
- `responseMatchesCache` validates content-type against the target cache to prevent pollution.

### 9.3 Precaching and messages

- `PRECACHE_ASSETS` (install-time): `/`, `/index.html`, `/style.css`, every `js/*.js` module,
  `/warning.js`, `/blog/posts.json`, `/media/favicon-circle.webp`, `/media/logo.webp`,
  `/media/bg-light.webp`, `/media/bg-dark.webp`, `/media/vt323.ttf`. Install also runs
  `skipWaiting`; activate deletes stale caches under the known prefixes and `clients.claim()`.
- Supported client → SW messages:
  - `precache-bg {url}` / `prefetch-bg {urls[]}` → image cache.
  - `prefetch-posts {urls[]}` → content cache.
  - `precache-all` → precache everything incl. `mediaFiles` list, all `blog/*.md` slugs from
    `posts.json`, and `/blog/nt_verses_compact.json`.
  - `skip-waiting`, `clear-cache` (replies on `event.ports[0]`).
- All prefetch URLs must pass `isCacheableMessageUrl()` (same-origin; `/`, `/index.html`,
  `/style.css`, `/warning.js`, `/js/*`, `/media/*`, `/blog/*`); `pendingFetches` dedupes
  concurrent identical fetches.
- `periodicsync` with tag `precache-assets` re-runs `precacheAllAssets()`.

### 9.4 Coherence rules for new assets

1. Add to `PRECACHE_ASSETS` if needed for first-load/offline shell.
2. Add to the explicit list in `precacheAllAssets()` (it duplicates JS/media coverage).
3. Ensure the URL passes `isCacheableMessageUrl()` before relying on prefetch.
4. Bump the relevant cache-version constant when old clients must be invalidated.
5. Keep `PRECACHE_ASSETS`, `precacheAllAssets()`, and version bumps coherent in one change.

---

## 10. Admin Editor (`admin.html` + `js/admin.js` + `admin.css`)

A standalone page (not part of the SPA; no service-worker shell dependency). Loads
`style.css` + Font Awesome + `admin.css` + `js/markdown.js` + `js/admin.js`. An inline script
resolves the theme cookie to `data-theme` immediately (CSP hash covers it — see §14).

### 10.1 Layout

- `.admin-header`: brand link ("kamikami.eu **post editor**"), `#admin-status` (role=status),
  token input (`#admin-token-input`, type=password, + Save/Clear buttons, persisted in
  `sessionStorage`-backed memory), theme cycle button (`#admin-theme-btn`).
- `.admin-shell`: metadata fields (Title, Category, Icon, Date `input[type=date]`), `.admin-toolbar`
  (formatting commands), `.admin-edit-banner` (label + View markdown / Publish / Cancel),
  `.admin-editor-wrap` > `.blog-article` > `#post-editor` (`contenteditable=true`,
  `data-placeholder="Start writing…"`, rendered through the SPA's post CSS), a floating
  `.admin-image-bar` (Replace / Move up / Move down / Copy URL / Delete for the selected image),
  a raw-Markdown `<textarea #admin-output>` editor (Esc or Ctrl/Cmd+Enter closes; edits apply
  back to the WYSIWYG), and a footer with `#admin-count` (word count) + `#admin-discard-btn`.
- `.admin-sidebar`: posts list (`#admin-posts-list`) with refresh + new-post buttons, edit/pin/
  delete/copy-link/open actions per row, and `#admin-sidebar-status`. On mobile the list collapses
  behind `#admin-sidebar-toggle`.
- Hidden `<input type=file #admin-image-input>` accepting `image/webp,image/png,image/jpeg,image/gif`.

### 10.2 Editor behaviors

- Toolbar commands: paragraph + H1–H5 (`execCommand('formatBlock')` with fallback wrapping),
  bold/italic/strikethrough, inline code, link (prompts; only `https://`, `mailto:`, root-relative
  allowed), code block (language prompt, `<pre><code class="language-x">`), image (file picker),
  blockquote, lists, horizontal rule, undo/redo. Keyboard shortcuts: Ctrl/Cmd+B/I/K/U/Z/Y,
  Ctrl+Alt+0..5 headings, Ctrl+Shift+X strikethrough, Ctrl+K link, Ctrl+Alt+K code block.
- **Paste sanitizer** (`sanitizePastedHtml`): allowlist `SAFE_TAGS`, drop-list `DROP_TAGS`
  (script/style/iframe/object/embed/form/input/button/textarea/select/video/audio/source/svg/
  math/link/meta/noscript/template), strips `on*` attributes and non-http(s)/mailto// hrefs/srcs;
  plain-text pastes are escaped line-by-line with `<br>`.
- **Markdown round-trip:** `serializeEditor()` walks the DOM to canonical Markdown — escaped
  inline chars, `escapeLineStart` for heading/list/digit-line collisions, images → `![alt](src)`,
  pending uploads → `![alt](/__upload__/<token>)`; a raw-Markdown editor allows direct editing
  (push/pull loop with the WYSIWYG, debounced) and preview is rendered via
  `window.parseMarkdown` with a canonical-HTML round-trip warning when the serializer might lose
  content.
- **Deferred image uploads:** dropped/picked files are queued (`pendingUploads` Map, max size
  5MB each, image types only), shown as `<img data-upload-token>` placeholders; on publish they're
  base64-sent and then swapped to real `/media/...` URLs. Replace/delete/reorder via image bar.
- **Draft autosave:** `localStorage['adminDraft']` (title/category/icon/date/content), restored
  on load, discarded via the discard button; saved before unload.
- **Publish** (`POST /api/publish`, `Authorization: Bearer <token>`): validates title/body/token,
  builds `{title, category, icon, date, content, images?[{token,name,data}], id?(edit)}`,
  disables the button while in flight, renders status (success link to `/ #blog-<id>`), reloads the
  post list, and clears drafts.
- Post list (`#admin-posts-list`) loads from `GET /api/posts` and supports **edit** (fetch md →
  `parseFrontmatter` → `parseMarkdown` into editor), **pin/unpin**, **delete** (confirm dialog;
  also garbage-collects media still referenced only by that post), **copy link**, **open**.

---

## 11. Cloudflare Pages Functions API

### 11.1 `POST /api/publish` (`functions/api/publish.js`)

- **Auth:** `Authorization: Bearer <ADMIN_TOKEN>`; constant-time compare (`secureCompare`) against
  a comma-separated token list; misconfigured (empty or any token < 32 chars) → **503**.
  With `RATE_LIMIT_KV`: ≥10 auth failures per IP per 15-min bucket → 429 lockout.
- **Limits:** request ≤ 45MB total; ≤ 20 images/post; ≤ 5MB per image; ≤ 30MB total image bytes;
  images must be webp/png/jpeg/gif. With `QUOTA_KV`: daily publish quota enforced.
- **Flow:** parse JSON → slugify title to `id` (unique-suffixed `-2`, `-3`, … on collision) →
  resolve media names → rewrite `/__upload__/<token>` placeholders to `/media/<name>` in the
  Markdown → build frontmatter (title/date/category/icon) + content → **one atomic Git Data API
  commit** containing all new `media/*` blobs, `blog/<id>.md`, and the updated `blog/posts.json`
  (message `chore(blog): add post <id> [with N media files]` / `chore(blog): update post <id>`).
- **Response:** `{ok, id, slug, title, date, updated, images:[{token,name,url}], commit}`.
- Editing an existing post is supported by sending `id`; the manifest entry is updated in place.
- GitHub defaults: `palipeli` / `pubicStaticBlog`; `GITHUB_BRANCH` default `main`.

### 11.2 `GET`/`POST /api/posts` (`functions/api/posts.js`)

- Same auth + rate limiting as publish. `GET` is **admin-only** (performs GitHub tree reads; must
  never be served to unauthenticated clients; the SW routes `/api/` network-only).
- `GET /api/posts` → `{posts:[...], orphanMedia:[...]}` (posts + media files unreferenced by any
  post Markdown).
- `POST /api/posts` with `{action, id}` (id must match `/^[a-z0-9-]{1,80}$/`):
  - `delete` — deletes `blog/<id>.md` (and media no longer referenced elsewhere) + manifest entry
    in separate commits.
  - `pin` / `unpin` — toggles the optional `pinned` flag in `blog/posts.json`.
  - Unknown action → 400; unknown id → 404; invalid body/JSON → 400/415/413.

---

## 12. Security Specification

### 12.1 Content security

- All post-body HTML passes the parser-level sanitizer (allowlist tags/attrs, safe URLs only).
- Titles/dates/categories/icons from the manifest are HTML-escaped before insertion everywhere.
- `_headers` hardening (Cloudflare Pages):

```text
/admin.html
  Content-Security-Policy: default-src 'none'; script-src 'self' 'sha256-gRCGCLoH2gKPoJOpaXFCYNW4vYpiLASue5ZFyTxWiYY='; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: blob:; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Cache-Control: no-store

/js/admin.js        → X-Content-Type-Options: nosniff; Cache-Control: no-cache
/admin.css          → X-Content-Type-Options: nosniff; Cache-Control: no-cache
```

The CSP `script-src` hash covers the inline theme script in `admin.html`; **keep in sync if the
script changes**.

### 12.2 API security

- Bearer-token auth with constant-time comparison; tokens ≥ 32 chars (short → fail-closed 503).
- Per-IP KV rate limiting (auth failures, GET throttling) and daily publish quotas when bindings
  are configured; graceful degradation without them.
- Request size caps; image type allowlist; media filenames resolved server-side (slugified,
  collision-safe), never trusting client filenames verbatim.
- GitHub token only ever leaves the edge function via the Git Data API; the worker routes
  `/api/*` network-only and never caches API responses.
- No `javascript:`/data: URLs; external links get `rel="noopener noreferrer"`.

### 12.3 Privacy

- No analytics SDK. Third-party calls: Google Fonts / cdnjs (Font Awesome, Chart.js), the two
  graph data APIs, and the GitHub API — all read-only, no identifiers sent.
- `Referrer-Policy: no-referrer` on the admin surface; `privacy-policy` blog post documents
  site practices. Consent is required before the flashing-light behavior arms.

---

## 13. SEO, Meta, and Performance

### 13.1 Head meta

- `title`: "Michelle's DNS and Blog". `lang="en"`.
- Open Graph: `og:type=website`, `og:url=https://kamikami.eu/`,
  `og:title`, `og:description` (the "SUPER-CUTE-BUT-SHITTY" line + tech-blog blurb),
  `og:image=https://kamikami.eu/media/logo.webp` with 1200×630.
- Twitter: `summary_large_image`, `twitter:title/description/image`, `twitter:site=@kamikamieu`.
- Favicon: `media/favicon-circle.webp`.

### 13.2 Performance techniques (keep these)

- **Zero-dependency, zero-build** payload; every module is hand-tuned IIFE.
- **Hover-based prefetching** of post Markdown (sidebar, cards, buttons, tray, Back/Next) with
  deduplication maps and abort timeouts (10s) + retries (3×).
- **Background theme prefetch** (`precache-bg`/`prefetch-bg`) so theme switches never wait on the
  network.
- **Lazy images** with `IntersectionObserver` + hover/touch triggers; the renderer emits
  `data-src`, never a real `src`.
- **Service-worker caching** tiers (network-first HTML/manifest, cache-first static/images/
  markdown) + install/precache-all/periodic-sync.
- **Compositor-only sidebar collapse** (`transform` + `margin-right` matching transitions) and
  transform-based scrollbar thumb positioning keep animation off the layout path.
- `document.fonts.ready` and capture-phase `load` listeners refresh the custom scrollbar when
  late-loading content changes scroll height.
- Chart canvases only render when `window.Chart` exists and the section is on the home page;
  errors degrade to a message.

### 13.3 Accessibility & UX invariants

- `prefers-reduced-motion: reduce` disables particle creation and page-entrance re-animations;
  do not make the flash warning more intense without updating the consent copy.
- Sidebar and mobile toggles keep `aria-label`/`title` synced with state.
- Admin status uses `role="status"`; toolbar has `aria-label`; icon-only buttons carry `title`.
- The consent overlay must remain keyboard-usable and its buttons disabled until assets load.
- `spellcheck` is on for the post editor; the raw Markdown textarea disables it.
- Everything is mouse + touch friendly (hover *and* touch prefetch paths; pointer events for the
  scrollbar).

---

## 14. File-by-File Reference & Public APIs

| Path | Responsibility | Public contract |
|---|---|---|
| `index.html` | SPA shell, sections, fixed header/sidebar, script order, SW registration | IDs/classes consumed by every UI module |
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
| `js/warning.js` | flashing-light consent and interaction warning | `system_warning_consent`; `warning:cleared` event |
| `js/chat-cloud.js` | speech-bubble that follows cursor on flash/denied | listens `warning:flash` / `denied:flash`; no public API |
| `js/cp.js` | anti-devtools gate + redirect | `window.CP`, `window.__CP_GATE`, `window.__CP_VERIFIED` |
| `js/github-graph.js` | GitHub contribution charts (Chart.js) + range filter + ResizeObserver | self-init on `DOMContentLoaded` |
| `js/dns-graph.js` | DNS request chart (Chart.js) | self-init on `DOMContentLoaded` |
| `js/app.js` | startup coordinator (see §4.1) | runs on `DOMContentLoaded`; no public API |
| `sw.js` | install/activate, cache strategies, offline shell, prefetch messages | cache names and message types (see §9) |
| `admin.html` | standalone WYSIWYG post editor | `#post-editor`, `.admin-toolbar`, `/api/publish` |
| `js/admin.js` | editor logic: commands, shortcuts, paste sanitizer, Markdown serializer, deferred uploads, publish, drafts | reads `window.parseMarkdown` |
| `admin.css` | chrome-only admin styles; editor content renders via `style.css` post styles | reuses CSS variables |
| `functions/api/publish.js` | Pages Function: auth + slugify + atomic Git commit | `POST /api/publish`; env secrets |
| `functions/api/posts.js` | Pages Function: admin post list + delete/pin | `GET`/`POST /api/posts` |
| `_headers` | Cloudflare Pages headers for admin surface | CSP hash must match `admin.html` |
| `blog/posts.json` | ordered post manifest | schema in §7.1 |
| `blog/*.md` | post source | optional frontmatter + Markdown body |
| `blog/nt_verses_compact.json` | devotional tuples `[book, chapter, verse, text]` | loaded lazily |

### 14.1 DOM contracts — do not rename/remove

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

### 14.2 Key `window.*` cross-module APIs

- `CONFIG`, `parseMarkdown`, `parseFrontmatter`, `initializeLazyLoading`
- `saveAppState`, `loadAppState`, `restoreAppState`, `setupStatePersistence`, `getCurrentPage`,
  `processPendingBlogPostRestore`, `setupScrollPositionTracking`, `saveScrollPosition`,
  `restoreScrollPosition`
- `monitorWarningAndStartDevotional`, `runDevotional`
- `createParticles`, `setupNavigation`, `setupTemplates`, `setupSystemThemeListener`,
  `setupThemePrefetch`, `setupSidebarToggle`, `setupHashRouting`, `updateHash`, `handleClickMe`,
  `applyTheme`, `saveThemePreference`, `getSavedTheme`, `wrapHomeContentInRectangle`,
  `navigateToBlogsPageWithoutPrefetch`
- `fetchBlogPostMetadata`, `preloadBlogPostContent`, `isBlogPostLoading`, `renderPostSelector`,
  `renderBlogPostSelectorGrid`, `openBlogPostLazy`, `showBlogIntro`, `goBack`,
  `waitForBlogMetadata`, `goToNextPost`, `preloadNextPostOnHover`, `preloadPreviousPageOnHover`,
  `blogPostMetadata`
- `renderBlogButtonsLazy`, `openBlogPostFromHomeLazy`
- `setupCustomScrollbars`

### 14.3 Storage/cookie keys

- `localStorage['blogPlatformState']` — app state (§8.1).
- `localStorage['blogPlatformScrollPositions']` — scroll positions (§8.2).
- `localStorage['system_warning_consent'] === 'true'` — consent (§6.12).
- `localStorage['adminDraft']` — admin draft autosave.
- Cookie `theme_preference` = `auto|light|dark`, one-year expiry (§5.1).

---

## 15. Reproduction Checklist (for an AI agent given this spec)

Build order for a byte-accurate rebuild from scratch:

1. **Shell:** `index.html` with the head (meta/OG/TW, favicon, FA preload, SW registration
   snippet), the three `.page-section`s (home with hero/CTAs/graphs, blogs with intro+post views,
   about), header, sidebar (theme chooser + All Posts), footer, and the exact script order from §4.
2. **Styles:** `style.css` with the token sets (§5.2–5.4), layout (§3, §6), mobile rules at
    `max-width: 768px` (content) / `1024px` (sidebar/tray), post/article styles, particles, charts, custom scrollbar, tray, and
    consent-adjacent chrome. `admin.css` for the editor chrome. All CSS files are stripped of comments and unnecessary vertical whitespace; docs live here.
3. **Foundation modules:** `js/config.js`, `js/markdown.js` (frontmatter + parser + sanitizer per
   §7), `js/lazyload.js`.
4. **State & scroll:** `js/state.js` per §8.1–8.2.
5. **Warning + devotional:** `warning.js` (§6.12) and `js/devotional.js` (§8.8).
6. **UI:** `js/ui.js` (particles, nav, hash routing, theme, sidebar, prefetch) per §8.3–8.9.
7. **Blog engine:** `js/blog.js` (manifest → cache → render → navigate) and `js/home.js` per
   §8.4 and §6.8.
8. **Charts:** `js/github-graph.js`, `js/dns-graph.js` (§6.10).
9. **Mobile:** `js/mobile-tray.js` (§6.11) and `js/scrollbar.js` (§6.7).
10. **Coordinator:** `js/app.js` (§4.1).
11. **Service worker:** `sw.js` per §9.
12. **Content seed:** `blog/posts.json` + sample `blog/*.md` posts + `nt_verses_compact.json`.
13. **Media:** the assets listed in §7.6.
14. **Admin:** `admin.html`, `js/admin.js`, `admin.css`, `_headers`, and the two Pages
    Functions (`functions/api/publish.js`, `functions/api/posts.js`) per §10–§12; set the
    Cloudflare secrets per §2.
15. **Validation:** serve at `/`, check hash routing, theme switch + background swap, consent →
     devotional, blog open/prefetch/next/back, scroll restore, mobile tray + sidebar collapse at `≤1024px` (graphs resize via `ResizeObserver`), custom
     scrollbar, offline reload (SW), and the admin publish round-trip.
