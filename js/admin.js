(function() {
    'use strict';

    const PUBLISH_URL = '/api/publish';
    const UPLOAD_URL = '/api/upload';
    const TOKEN_KEY = 'adminToken';
    const DRAFT_KEY = 'adminDraft';
    const THEME_ORDER = ['light', 'dark', 'auto'];

    let editor = null;
    let publishBtn = null;
    let statusEl = null;
    let outputEl = null;
    let countEl = null;
    let imageInput = null;
    let saveTimer = null;
    let postListData = null;
    let editingId = null;
    let editingOriginalDate = null;

    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function getToken() { return sessionStorage.getItem(TOKEN_KEY) || ''; }
    function setToken(token) { sessionStorage.setItem(TOKEN_KEY, token); }
    function clearToken() { sessionStorage.removeItem(TOKEN_KEY); }

    function findClosest(node, selector) {
        let el = node && node.nodeType === 1 ? node : (node && node.parentNode);
        while (el && el !== editor) {
            if (el.nodeType === 1 && el.matches(selector)) return el;
            el = el.parentNode;
        }
        return null;
    }

    function getSavedTheme() {
        const match = document.cookie.match(/theme_preference=([^;]+)/);
        return match ? match[1] : 'auto';
    }

    function setThemeCookie(theme) {
        const d = new Date();
        d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
        document.cookie = 'theme_preference=' + theme + ';expires=' + d.toUTCString() + ';path=/';
    }

    function resolveTheme(theme) {
        if (theme === 'auto') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return theme;
    }

    function cycleTheme() {
        const next = THEME_ORDER[(THEME_ORDER.indexOf(getSavedTheme()) + 1) % THEME_ORDER.length];
        document.documentElement.setAttribute('data-theme', resolveTheme(next));
        setThemeCookie(next);
        updateThemeBtn();
    }

    function updateThemeBtn() {
        const btn = $('admin-theme-btn');
        const icons = {light: 'fa-sun', dark: 'fa-moon', auto: 'fa-circle-half-stroke'};
        const theme = getSavedTheme();
        btn.innerHTML = '<i class="fa-solid ' + (icons[theme] || icons.auto) + '"></i>';
        btn.title = 'Theme: ' + theme + ' (click to cycle)';
    }

    function setStatus(message, kind) {
        statusEl.innerHTML = message;
        statusEl.className = 'admin-status' + (kind ? ' ' + kind : '');
    }

    function updateCount() {
        if (!editor || !countEl) return;
        const text = (editor.innerText || '').replace(/\s+/g, ' ').trim();
        const words = text ? text.split(/\s+/).length : 0;
        countEl.textContent = words + ' words';
    }

    function exec(cmd, value) {
        editor.focus();
        document.execCommand(cmd, false, value);
    }

    function wrapSelectionInline(tag) {
        editor.focus();
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        const el = document.createElement(tag);
        if (range.collapsed) {
            el.textContent = '\u200B';
            range.insertNode(el);
            const r = document.createRange();
            r.setStart(el.firstChild, 1);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
        } else {
            const frag = range.extractContents();
            el.appendChild(frag);
            range.insertNode(el);
        }
    }

    function cleanLinkTarget(url) {
        const value = String(url || '').trim();
        if (!value) return '';
        if (!/^(https?:\/\/|mailto:|\/)/i.test(value)) return '';
        return /\s/.test(value) ? '<' + value + '>' : value;
    }

    function insertLink() {
        const sel = window.getSelection();
        const url = window.prompt('Link URL (https://, mailto:, or /path):', 'https://');
        if (!url) return;
        const href = cleanLinkTarget(url);
        if (!href) {
            setStatus('Only https://, mailto: and root-relative links are allowed', 'error');
            return;
        }
        let text = sel && !sel.isCollapsed ? sel.toString() : '';
        if (!text) text = window.prompt('Link text:', href) || href;
        editor.focus();
        document.execCommand('insertHTML', false, '<a href="' + escapeHtml(href) + '">' + escapeHtml(text) + '</a>');
    }

    function insertCodeBlock() {
        const lang = window.prompt('Code language (optional, e.g. js, css):', '');
        editor.focus();
        const cleanLang = String(lang || '').trim().replace(/[^\w-]/g, '').slice(0, 30);
        const html = '<pre><code' + (cleanLang ? ' class="language-' + cleanLang + '"' : '') + '>\n\n</code></pre>';
        const before = editor.querySelectorAll('pre').length;
        document.execCommand('insertHTML', false, html);
        const pres = editor.querySelectorAll('pre');
        if (pres.length > before) {
            const codeEl = pres[before].querySelector('code');
            if (codeEl && codeEl.firstChild) {
                const range = document.createRange();
                range.setStart(codeEl.firstChild, 0);
                range.collapse(true);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    }

    function insertTaskList() {
        editor.focus();
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const li = findClosest(sel.getRangeAt(0).commonAncestorContainer, 'li');
        if (li) {
            const checkbox = li.querySelector('input[type=checkbox]');
            if (checkbox) {
                checkbox.remove();
            } else {
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                li.insertBefore(cb, li.firstChild);
                li.insertBefore(document.createTextNode(' '), cb.nextSibling);
            }
            return;
        }
        document.execCommand('insertHTML', false, '<ul class="task-list-item"><li><input type="checkbox"> </li></ul>');
    }

    function insertTable() {
        const cols = parseInt(window.prompt('Columns:', '3'), 10);
        if (!cols || cols < 1 || cols > 10) return;
        const rows = parseInt(window.prompt('Rows (including header):', '3'), 10);
        if (!rows || rows < 2 || rows > 30) return;
        let html = '<table>\n<thead>\n<tr>\n';
        for (let c = 0; c < cols; c++) html += '<th>Header</th>\n';
        html += '</tr>\n</thead>\n<tbody>\n';
        for (let r = 1; r < rows; r++) {
            html += '<tr>\n';
            for (let c = 0; c < cols; c++) html += '<td></td>\n';
            html += '</tr>\n';
        }
        html += '</tbody></table>\n<p><br></p>';
        editor.focus();
        document.execCommand('insertHTML', false, html);
    }

    function openImagePicker() {
        imageInput.click();
    }

    async function uploadImage(file) {
        if (!file) return;
        if (!/^image\/(webp|png|jpeg|gif)$/i.test(file.type)) {
            setStatus('Only webp, png, jpg and gif images are allowed', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setStatus('Image too large (max 5MB)', 'error');
            return;
        }
        const token = getToken();
        if (!token) {
            setStatus('Enter your admin token first', 'error');
            return;
        }
        setStatus('Uploading image…', '');
        try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            let binary = '';
            const chunkSize = 0x8000;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
            }
            const dataUrl = 'data:' + file.type + ';base64,' + btoa(binary);
            const res = await fetch(UPLOAD_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token},
                body: JSON.stringify({name: file.name, data: dataUrl})
            });
            const result = await res.json();
            if (!res.ok || !result.ok) {
                setStatus(result.error || 'Upload failed (' + res.status + ')', 'error');
                return;
            }
            editor.focus();
            document.execCommand('insertHTML', false, '<img class="lazy-image" src="' + escapeHtml(result.url) + '" data-src="' + escapeHtml(result.url) + '" alt="">');
            setStatus('Image uploaded: ' + result.url, 'success');
        } catch (err) {
            setStatus('Upload error: ' + err.message, 'error');
        }
    }

    function normalizeText(str) {
        return String(str).replace(/\u200B/g, '').replace(/\s+/g, ' ').trim();
    }

    const INLINE_ESCAPE_RE = /([\\`*_\[\]<>])/g;

    function escapeInlineText(text) {
        return String(text).replace(INLINE_ESCAPE_RE, '\\$1').replace(/!\[/g, '\\!\\[');
    }

    function escapeLineStart(line) {
        let out = line;
        if (/^[#>+|]/.test(out)) {
            out = '\\' + out;
        } else if (/^\d+\./.test(out)) {
            out = out.replace(/^(\d+)\./, '$1\\.');
        } else if (/^[-=]+$/.test(out)) {
            out = '\\' + out;
        } else if (/^[-*+]\s/.test(out)) {
            out = '\\' + out;
        }
        return out;
    }

    function inlineToMarkdown(el, opts) {
        opts = opts || {};
        let out = '';
        for (let i = 0; i < el.childNodes.length; i++) {
            const node = el.childNodes[i];
            if (node.nodeType === 3) {
                out += escapeInlineText(normalizeText(node.textContent));
                continue;
            }
            if (node.nodeType !== 1) continue;
            const tag = node.tagName.toLowerCase();
            if (tag === 'ul' || tag === 'ol' || tag === 'blockquote' || tag === 'table' || tag === 'pre' || tag === 'hr' || tag === 'li') {
                continue;
            }
            if (tag === 'br') {
                out += '  \n';
            } else if (tag === 'strong' || tag === 'b') {
                out += '**' + inlineToMarkdown(node) + '**';
            } else if (tag === 'em' || tag === 'i') {
                out += '*' + inlineToMarkdown(node) + '*';
            } else if (tag === 'del' || tag === 's' || tag === 'strike') {
                out += '~~' + inlineToMarkdown(node) + '~~';
            } else if (tag === 'code') {
                const codeText = normalizeText(node.textContent);
                const maxRun = (codeText.match(/`+/g) || ['']).reduce(function(a, b) { return Math.max(a, b.length); }, 0);
                const delim = '`'.repeat(maxRun + 1);
                out += delim + codeText + delim;
            } else if (tag === 'a') {
                const href = node.getAttribute('href') || '';
                const text = inlineToMarkdown(node) || href;
                out += '[' + text + '](' + cleanLinkTarget(href) + ')';
            } else if (tag === 'img') {
                const src = node.getAttribute('data-src') || node.getAttribute('src') || '';
                const alt = String(node.getAttribute('alt') || '').replace(/[\[\]]/g, '');
                out += '![' + alt + '](' + cleanLinkTarget(src) + ')';
            } else if (tag === 'input') {
                if (opts.skipFirstInput) {
                    opts.skipFirstInput = false;
                } else {
                    out += node.checked ? '[x]' : '[ ]';
                }
            } else {
                out += inlineToMarkdown(node, opts);
            }
        }
        return out;
    }

    function blockToLines(el, depth) {
        const indent = '  '.repeat(depth);
        const lines = [];
        if (el.nodeType === 3) {
            const text = normalizeText(el.textContent);
            if (text) lines.push(indent + escapeLineStart(escapeInlineText(text)));
            return lines;
        }
        if (el.nodeType !== 1) return lines;
        const tag = el.tagName.toLowerCase();
        if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
            const text = inlineToMarkdown(el);
            lines.push(indent + '#'.repeat(parseInt(tag[1], 10)) + ' ' + escapeLineStart(text));
            return lines;
        }
        if (tag === 'p' || tag === 'div') {
            const text = inlineToMarkdown(el);
            if (!text.trim()) return lines;
            text.split('\n').forEach(function(line) {
                lines.push(indent + escapeLineStart(line));
            });
            return lines;
        }
        if (tag === 'pre') {
            const codeEl = el.querySelector('code');
            const codeContent = (codeEl ? codeEl.textContent : el.textContent).replace(/\s+$/, '');
            const langMatch = codeEl ? (codeEl.getAttribute('class') || '').match(/language-([\w-]+)/) : null;
            lines.push(indent + '```' + (langMatch ? langMatch[1] : ''));
            codeContent.split('\n').forEach(function(line) {
                lines.push(line);
            });
            lines.push(indent + '```');
            return lines;
        }
        if (tag === 'ul' || tag === 'ol') {
            const ordered = tag === 'ol';
            let counter = 1;
            for (let i = 0; i < el.children.length; i++) {
                const li = el.children[i];
                if (li.tagName.toLowerCase() !== 'li') continue;
                const checkbox = li.querySelector('input[type=checkbox]');
                let prefix;
                if (ordered) {
                    prefix = counter++ + '.';
                } else if (checkbox) {
                    prefix = checkbox.checked ? '- [x]' : '- [ ]';
                } else {
                    prefix = '-';
                }
                const itemText = inlineToMarkdown(li, {skipFirstInput: true});
                lines.push(indent + prefix + ' ' + escapeLineStart(itemText));
                for (let j = 0; j < li.children.length; j++) {
                    const childTag = li.children[j].tagName.toLowerCase();
                    if (childTag === 'ul' || childTag === 'ol') {
                        lines.push.apply(lines, blockToLines(li.children[j], depth + 1));
                    }
                }
            }
            return lines;
        }
        if (tag === 'blockquote') {
            const innerParts = [];
            for (let i = 0; i < el.childNodes.length; i++) {
                const innerLines = blockToLines(el.childNodes[i], 0);
                if (innerLines.length) innerParts.push(innerLines.join('\n'));
            }
            const joined = innerParts.join('\n\n');
            joined.split('\n').forEach(function(line) {
                lines.push(indent + '> ' + line);
            });
            return lines;
        }
        if (tag === 'hr') {
            lines.push(indent + '---');
            return lines;
        }
        if (tag === 'table') {
            const rows = Array.from(el.querySelectorAll('tr'));
            if (!rows.length) return lines;
            const rowCells = function(row) {
                return Array.from(row.querySelectorAll('th,td')).map(function(cell) {
                    return inlineToMarkdown(cell).replace(/\|/g, '¦').replace(/\n/g, ' ');
                });
            };
            const header = rowCells(rows[0]);
            lines.push(indent + '| ' + header.join(' | ') + ' |');
            lines.push(indent + '| ' + header.map(function() { return '---'; }).join(' | ') + ' |');
            for (let i = 1; i < rows.length; i++) {
                lines.push(indent + '| ' + rowCells(rows[i]).join(' | ') + ' |');
            }
            return lines;
        }
        const text = inlineToMarkdown(el);
        if (text.trim()) lines.push(indent + escapeLineStart(text));
        return lines;
    }

    function serializeEditor() {
        const parts = [];
        for (let i = 0; i < editor.childNodes.length; i++) {
            const lines = blockToLines(editor.childNodes[i], 0);
            if (lines.length) parts.push(lines.join('\n'));
        }
        return parts.join('\n\n') + '\n';
    }

    function canonicalHtml(node) {
        if (!node) return '';
        if (node.nodeType === 3) {
            return String(node.textContent).replace(/\s+/g, ' ');
        }
        if (node.nodeType !== 1) return '';
        const tag = node.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style') return '';
        if (tag === 'br') return '<br>';
        if (tag === 'hr') return '<hr>';
        if (tag === 'img') {
            const src = node.getAttribute('data-src') || node.getAttribute('src') || '';
            return '<img data-src="' + src + '" alt="' + (node.getAttribute('alt') || '') + '">';
        }
        if (tag === 'a') {
            return '<a href="' + (node.getAttribute('href') || '') + '">' + canonicalInner(node) + '</a>';
        }
        if (tag === 'code') {
            const cls = (node.getAttribute('class') || '').trim();
            return '<code' + (cls ? ' class="' + cls + '"' : '') + '>' + (node.textContent.trim() || ' ') + '</code>';
        }
        if (tag === 'input') {
            return node.checked ? '<input checked type="checkbox">' : '<input type="checkbox">';
        }
        if (tag === 'th' || tag === 'td') {
            const align = node.getAttribute('align') || '';
            return '<' + tag + (align ? ' align="' + align + '"' : '') + '>' + canonicalInner(node) + '</' + tag + '>';
        }
        if (tag === 'pre') {
            return '<pre>' + (node.textContent.trim() || ' ') + '</pre>';
        }
        const inner = canonicalInner(node);
        if ((tag === 'p' || tag === 'li') && !inner.trim()) return '';
        const tagMap = {b: 'strong', i: 'em', s: 'del', strike: 'del', div: 'p'};
        const outTag = tagMap[tag] || tag;
        return '<' + outTag + '>' + inner + '</' + outTag + '>';
    }

    function canonicalInner(node) {
        let out = '';
        for (let i = 0; i < node.childNodes.length; i++) {
            out += canonicalHtml(node.childNodes[i]);
        }
        return out;
    }

    function canonicalizeDocument(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return canonicalInner(doc.body).replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
    }

    const SAFE_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'A', 'IMG', 'STRONG', 'B', 'EM', 'I', 'S', 'DEL', 'STRIKE', 'BR', 'HR', 'SPAN', 'DIV']);
    const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'VIDEO', 'AUDIO', 'SOURCE', 'SVG', 'MATH', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE']);

    function sanitizePastedHtml(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const queue = [doc.body];
        while (queue.length) {
            const parent = queue.pop();
            const children = Array.from(parent.children);
            for (let i = 0; i < children.length; i++) {
                const el = children[i];
                const tag = el.tagName.toUpperCase();
                if (DROP_TAGS.has(tag)) {
                    el.remove();
                    continue;
                }
                if (!SAFE_TAGS.has(tag)) {
                    const fragment = document.createDocumentFragment();
                    while (el.firstChild) fragment.appendChild(el.firstChild);
                    el.replaceWith(fragment);
                    continue;
                }
                Array.from(el.attributes).forEach(function(attr) {
                    const name = attr.name.toLowerCase();
                    const value = attr.value;
                    if (name.startsWith('on')) {
                        el.removeAttribute(attr.name);
                    } else if (name === 'href' || name === 'src') {
                        if (!/^(https?:|mailto:|\/)/i.test(value.trim())) el.removeAttribute(attr.name);
                    } else if (name !== 'class' && name !== 'alt' && name !== 'title' && name !== 'align') {
                        el.removeAttribute(attr.name);
                    }
                });
                queue.push(el);
            }
        }
        return doc.body.innerHTML;
    }

    function handlePaste(e) {
        e.preventDefault();
        const clipboard = e.clipboardData || window.clipboardData;
        if (!clipboard) return;
        const html = clipboard.getData('text/html');
        if (html) {
            document.execCommand('insertHTML', false, sanitizePastedHtml(html));
        } else {
            const text = clipboard.getData('text/plain');
            if (text != null) {
                const escaped = text.split(/\r?\n/).map(function(line) { return escapeHtml(line); }).join('<br>');
                document.execCommand('insertHTML', false, escaped);
            }
        }
        scheduleDraftSave();
    }

    function handleDrop(e) {
        e.preventDefault();
        const files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length) {
            uploadImage(files[0]);
            return;
        }
        const html = e.dataTransfer && e.dataTransfer.getData('text/html');
        if (html) {
            document.execCommand('insertHTML', false, sanitizePastedHtml(html));
            scheduleDraftSave();
        }
    }

    function loadPostList() {
        const container = $('admin-posts-list');
        fetch('/api/posts')
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (!data.posts) {
                    throw new Error(data.error || 'Failed to load posts');
                }
                postListData = data;
                renderPostList(data);
                const count = data.posts.length;
                const orphanNote = data.orphans && data.orphans.length ? ' · ' + data.orphans.length + ' unlisted' : '';
                $('admin-sidebar-status').textContent = count + ' post' + (count === 1 ? '' : 's') + orphanNote;
            })
            .catch(function(err) {
                container.innerHTML = '<div class="admin-posts-empty">Could not load posts: ' + escapeHtml(err.message) + '</div>';
            });
    }

    function renderPostList(data) {
        const container = $('admin-posts-list');
        container.innerHTML = '';
        const sorted = (data.posts || []).slice().sort(function(a, b) {
            return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.date) - new Date(a.date);
        });
        sorted.forEach(function(post) {
            container.appendChild(buildPostItem(post, false));
        });
        if (data.orphans && data.orphans.length) {
            const heading = document.createElement('div');
            heading.className = 'admin-posts-group';
            heading.textContent = 'Unlisted (in repo only)';
            container.appendChild(heading);
            data.orphans.forEach(function(id) {
                container.appendChild(buildPostItem({
                    id: id, title: id, date: '', category: '', icon: '📄', pinned: false, onGithub: true
                }, true));
            });
        }
        if (!sorted.length && (!data.orphans || !data.orphans.length)) {
            container.innerHTML = '<div class="admin-posts-empty">No posts yet. Write something!</div>';
        }
    }

    function buildPostItem(post, orphan) {
        const item = document.createElement('div');
        item.className = 'admin-post-item' + (orphan ? ' is-orphan' : '');
        const statusClass = orphan ? 'orphan' : (post.onGithub ? 'ok' : 'missing');
        const statusLabel = orphan ? 'In repo, unlisted' : (post.onGithub ? 'Published on GitHub' : 'Not on GitHub');
        const status = document.createElement('div');
        status.className = 'admin-post-status';
        status.title = statusLabel;
        status.innerHTML = '<span class="admin-status-dot ' + statusClass + '"></span>' + statusLabel;
        item.appendChild(status);
        const head = document.createElement('div');
        head.className = 'admin-post-head';
        head.innerHTML =
            '<span class="admin-post-icon">' + escapeHtml(post.icon || '📄') + '</span>' +
            '<div class="admin-post-meta">' +
                '<div class="admin-post-title">' + escapeHtml(post.title || post.id) + '</div>' +
                '<div class="admin-post-date">' + escapeHtml(post.date || '') + '</div>' +
            '</div>';
        item.appendChild(head);
        const actions = document.createElement('div');
        actions.className = 'admin-post-actions';
        if (orphan) {
            actions.appendChild(actionBtn('Copy', 'copy', post.id));
            actions.appendChild(actionBtn('Open', 'open', post.id));
        } else {
            actions.appendChild(actionBtn('Edit', 'edit', post.id));
            actions.appendChild(actionBtn(post.pinned ? 'Unpin' : 'Pin', 'pin', post.id, post.pinned));
            actions.appendChild(actionBtn('Copy', 'copy', post.id));
            actions.appendChild(actionBtn('Open', 'open', post.id));
            actions.appendChild(actionBtn('Delete', 'delete', post.id));
        }
        item.appendChild(actions);
        return item;
    }

    function actionBtn(label, action, id, active) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'admin-post-action admin-post-action-' + action + (active ? ' active' : '');
        btn.textContent = label;
        btn.dataset.action = action;
        btn.dataset.id = id;
        return btn;
    }

    function handlePostListClick(e) {
        const btn = e.target.closest ? e.target.closest('.admin-post-action') : null;
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (action === 'edit') startEdit(id);
        else if (action === 'pin') togglePin(id);
        else if (action === 'delete') deletePost(id);
        else if (action === 'copy') copyPostLink(id);
        else if (action === 'open') openPost(id);
    }

    function startEdit(id) {
        const post = postListData && postListData.posts.find(function(p) { return p.id === id; });
        setStatus('Loading post…', '');
        fetch('/blog/' + id + '.md?ts=' + Date.now())
            .then(function(res) {
                if (!res.ok) throw new Error('Failed to fetch post (' + res.status + ')');
                return res.text();
            })
            .then(function(md) {
                const parsed = window.parseFrontmatter(md);
                const fm = parsed.frontmatter;
                $('post-title').value = fm.title || (post ? post.title : '') || '';
                $('post-category').value = fm.category || 'Blog';
                $('post-icon').value = fm.icon || '📄';
                const fmDate = fm.date || (post ? post.date : '') || '';
                if (/^\d{4}-\d{2}-\d{2}$/.test(fmDate)) {
                    $('post-date').value = fmDate;
                    editingOriginalDate = null;
                } else {
                    $('post-date').value = '';
                    editingOriginalDate = fmDate || null;
                }
                editor.innerHTML = typeof window.parseMarkdown === 'function' ? window.parseMarkdown(parsed.content) : parsed.content;
                editingId = id;
                $('admin-edit-title').textContent = fm.title || (post ? post.title : id) || id;
                $('admin-edit-banner').hidden = false;
                publishBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Update Post';
                outputEl.hidden = true;
                $('admin-preview-btn').textContent = 'View markdown';
                setStatus('Editing "' + escapeHtml(fm.title || id) + '" — Publish updates the existing post', 'success');
                updateCount();
                scheduleDraftSave();
            })
            .catch(function(err) {
                setStatus('Edit error: ' + err.message, 'error');
            });
    }

    function resetEditor() {
        editingId = null;
        editingOriginalDate = null;
        $('admin-edit-banner').hidden = true;
        $('admin-edit-title').textContent = '';
        publishBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publish';
        $('post-title').value = '';
        $('post-category').value = '';
        $('post-icon').value = '📝';
        $('post-date').value = new Date().toISOString().slice(0, 10);
        editor.innerHTML = '';
        outputEl.hidden = true;
        $('admin-preview-btn').textContent = 'View markdown';
        updateCount();
        editor.focus();
    }

    function togglePin(id) {
        const token = getToken();
        if (!token) {
            setStatus('Enter your admin token first', 'error');
            return;
        }
        const post = postListData && postListData.posts.find(function(p) { return p.id === id; });
        const pinned = post ? !post.pinned : true;
        fetch('/api/posts', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token},
            body: JSON.stringify({action: 'pin', id: id, pinned: pinned})
        })
            .then(function(res) { return res.json(); })
            .then(function(result) {
                if (!result.ok) {
                    throw new Error(result.error || 'Pin failed');
                }
                setStatus((pinned ? 'Pinned "' : 'Unpinned "') + escapeHtml(post ? post.title : id) + '"', 'success');
                loadPostList();
            })
            .catch(function(err) {
                setStatus('Pin error: ' + err.message, 'error');
            });
    }

    function deletePost(id) {
        const token = getToken();
        if (!token) {
            setStatus('Enter your admin token first', 'error');
            return;
        }
        if (!window.confirm('Delete "' + id + '" from GitHub and the post list? Git history keeps the file, but the published post is removed.')) {
            return;
        }
        fetch('/api/posts', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token},
            body: JSON.stringify({action: 'delete', id: id})
        })
            .then(function(res) { return res.json(); })
            .then(function(result) {
                if (!result.ok) {
                    throw new Error(result.error || 'Delete failed');
                }
                setStatus('Deleted "' + id + '"', 'success');
                if (editingId === id) {
                    resetEditor();
                }
                loadPostList();
            })
            .catch(function(err) {
                setStatus('Delete error: ' + err.message, 'error');
            });
    }

    function copyPostLink(id) {
        const url = window.location.origin + '/#blog-' + id;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function() {
                setStatus('Link copied: ' + url, 'success');
            }, function() {
                setStatus('Link: ' + url, '');
            });
        } else {
            setStatus('Link: ' + url, '');
        }
    }

    function openPost(id) {
        window.open('/#blog-' + id, '_blank');
    }

    function setupSidebar() {
        $('admin-posts-refresh').addEventListener('click', loadPostList);
        $('admin-posts-new').addEventListener('click', function() {
            resetEditor();
            setStatus('New post', '');
        });
        $('admin-edit-cancel').addEventListener('click', function() {
            resetEditor();
            setStatus('Edit cancelled', '');
        });
        $('admin-sidebar-toggle').addEventListener('click', function() {
            $('admin-sidebar').classList.toggle('open');
        });
        $('admin-posts-list').addEventListener('click', handlePostListClick);
    }

    function roundTripWarning(markdown) {
        if (typeof window.parseMarkdown !== 'function') return '';
        try {
            const editorHtml = canonicalizeDocument(editor.innerHTML);
            const renderedHtml = canonicalizeDocument(window.parseMarkdown(markdown));
            return editorHtml === renderedHtml ? '' : 'Note: rendered output may differ slightly from the editor.';
        } catch (err) {
            return '';
        }
    }

    async function publish() {
        const title = $('post-title').value.trim();
        const category = $('post-category').value.trim() || 'Blog';
        const icon = $('post-icon').value.trim() || '📄';
        let date = $('post-date').value;
        if (!date && editingOriginalDate) {
            date = editingOriginalDate;
        }
        const content = serializeEditor().trim();
        const token = getToken();

        if (!title) {
            setStatus('Title is required', 'error');
            $('post-title').focus();
            return;
        }
        if (!content) {
            setStatus('Post body is empty', 'error');
            editor.focus();
            return;
        }
        if (!token) {
            setStatus('Enter your admin token first', 'error');
            $('admin-token-input').focus();
            return;
        }

        const warning = roundTripWarning(content);
        publishBtn.disabled = true;
        setStatus('Publishing…', '');
        try {
            const payload = {title: title, category: category, icon: icon, date: date, content: content};
            if (editingId) {
                payload.id = editingId;
            }
            const res = await fetch(PUBLISH_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token},
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (!res.ok || !result.ok) {
                setStatus(result.error || 'Publish failed (' + res.status + ')', 'error');
                return;
            }
            localStorage.removeItem(DRAFT_KEY);
            $('admin-discard-btn').hidden = true;
            outputEl.hidden = true;
            $('admin-preview-btn').textContent = 'View markdown';
            const verb = result.updated ? 'Updated' : 'Published';
            setStatus(verb + ' "' + escapeHtml(result.title) + '" — Cloudflare Pages is rebuilding. It will appear at <a href="/#blog-' + result.id + '">/#blog-' + result.id + '</a>.' + (warning ? ' ' + warning : ''), 'success');
            if (result.updated) {
                $('admin-edit-title').textContent = result.title;
            } else {
                resetEditor();
            }
            loadPostList();
        } catch (err) {
            setStatus('Publish error: ' + err.message, 'error');
        } finally {
            publishBtn.disabled = false;
        }
    }

    function togglePreview() {
        if (outputEl.hidden) {
            outputEl.textContent = serializeEditor();
            outputEl.hidden = false;
            $('admin-preview-btn').textContent = 'Hide markdown';
        } else {
            outputEl.hidden = true;
            $('admin-preview-btn').textContent = 'View markdown';
        }
    }

    function scheduleDraftSave() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(saveDraft, 800);
    }

    function saveDraft() {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify({
                title: $('post-title').value,
                category: $('post-category').value,
                icon: $('post-icon').value,
                date: $('post-date').value,
                html: editor.innerHTML,
                ts: Date.now()
            }));
        } catch (err) {
            // storage full or unavailable; drafts are best-effort
        }
    }

    function restoreDraft() {
        let raw = null;
        try {
            raw = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        } catch (err) {
            raw = null;
        }
        if (!raw || !raw.html) return false;
        $('post-title').value = raw.title || '';
        $('post-category').value = raw.category || '';
        $('post-icon').value = raw.icon || '📝';
        $('post-date').value = raw.date || '';
        editor.innerHTML = raw.html;
        $('admin-discard-btn').hidden = false;
        return true;
    }

    function discardDraft() {
        localStorage.removeItem(DRAFT_KEY);
        $('post-title').value = '';
        $('post-category').value = '';
        $('post-icon').value = '📝';
        $('post-date').value = new Date().toISOString().slice(0, 10);
        editor.innerHTML = '';
        $('admin-discard-btn').hidden = true;
        setStatus('Draft discarded', '');
        updateCount();
        editor.focus();
    }

    function runCommand(cmd) {
        if (cmd === 'p') exec('formatBlock', '<p>');
        else if (cmd === 'h1') exec('formatBlock', '<h1>');
        else if (cmd === 'h2') exec('formatBlock', '<h2>');
        else if (cmd === 'h3') exec('formatBlock', '<h3>');
        else if (cmd === 'bold') exec('bold');
        else if (cmd === 'italic') exec('italic');
        else if (cmd === 'strike') exec('strikeThrough');
        else if (cmd === 'code') wrapSelectionInline('code');
        else if (cmd === 'link') insertLink();
        else if (cmd === 'image') openImagePicker();
        else if (cmd === 'ul') exec('insertUnorderedList');
        else if (cmd === 'ol') exec('insertOrderedList');
        else if (cmd === 'task') insertTaskList();
        else if (cmd === 'quote') exec('formatBlock', '<blockquote>');
        else if (cmd === 'codeblock') insertCodeBlock();
        else if (cmd === 'table') insertTable();
        else if (cmd === 'hr') exec('insertHorizontalRule');
        else if (cmd === 'undo') exec('undo');
        else if (cmd === 'redo') exec('redo');
        else return;
        scheduleDraftSave();
        updateCount();
    }

    function updateToolbarState() {
        const toolbar = $('admin-toolbar');
        if (!toolbar) return;
        let states = {};
        try {
            states = {
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                strike: document.queryCommandState('strikeThrough'),
                ul: document.queryCommandState('insertUnorderedList'),
                ol: document.queryCommandState('insertOrderedList')
            };
        } catch (err) {
            return;
        }
        let block = '';
        try {
            block = String(document.queryCommandValue('formatBlock') || '').replace(/[<>]/g, '').toLowerCase();
        } catch (err) {
            block = '';
        }
        toolbar.querySelectorAll('.admin-tool[data-cmd]').forEach(function(btn) {
            const cmd = btn.getAttribute('data-cmd');
            let active = false;
            if (cmd === 'bold') active = !!states.bold;
            else if (cmd === 'italic') active = !!states.italic;
            else if (cmd === 'strike') active = !!states.strike;
            else if (cmd === 'ul') active = !!states.ul;
            else if (cmd === 'ol') active = !!states.ol;
            else if (cmd === 'p') active = block === 'p';
            else if (cmd === 'h1') active = block === 'h1';
            else if (cmd === 'h2') active = block === 'h2';
            else if (cmd === 'h3') active = block === 'h3';
            else if (cmd === 'quote') active = block === 'blockquote';
            btn.classList.toggle('active', active);
        });
    }

    function handleToolbarClick(e) {
        const btn = e.target.closest ? e.target.closest('.admin-tool') : null;
        if (!btn) return;
        const cmd = btn.getAttribute('data-cmd');
        if (cmd) runCommand(cmd);
    }

    function handleKeydown(e) {
        const mod = e.metaKey || e.ctrlKey;
        const key = e.key.toLowerCase();
        if (mod && key === 's') {
            e.preventDefault();
            publish();
            return;
        }
        if (mod && key === 'k') {
            e.preventDefault();
            insertLink();
            return;
        }
        if (mod && !e.shiftKey && key === 'e') {
            e.preventDefault();
            runCommand('code');
            return;
        }
        if (mod && e.shiftKey && key === 'e') {
            e.preventDefault();
            runCommand('codeblock');
            return;
        }
        if (mod && e.shiftKey && key === 'x') {
            e.preventDefault();
            runCommand('strike');
            return;
        }
        if (mod && e.shiftKey && key === '7') {
            e.preventDefault();
            runCommand('ul');
            return;
        }
        if (mod && e.shiftKey && key === '8') {
            e.preventDefault();
            runCommand('ol');
            return;
        }
        if (e.altKey && ['0', '1', '2', '3'].indexOf(key) !== -1) {
            e.preventDefault();
            runCommand(key === '0' ? 'p' : 'h' + key);
            return;
        }
        if (e.key === 'Tab') {
            const li = findClosest(e.target, 'li');
            if (li) {
                e.preventDefault();
                exec(e.shiftKey ? 'outdent' : 'indent');
            }
        }
    }

    function setupTokenUI() {
        const hasToken = !!getToken();
        $('admin-token-input').hidden = hasToken;
        $('admin-token-save').hidden = hasToken;
        $('admin-token-clear').hidden = !hasToken;
        if (!hasToken) {
            $('admin-token-input').focus();
        }
        $('admin-token-save').addEventListener('click', function() {
            const value = $('admin-token-input').value.trim();
            if (!value) return;
            setToken(value);
            $('admin-token-input').value = '';
            setupTokenUI();
            setStatus('Token saved for this session', 'success');
        });
        $('admin-token-clear').addEventListener('click', function() {
            clearToken();
            setupTokenUI();
            setStatus('Token cleared', '');
        });
    }

    function init() {
        editor = $('post-editor');
        publishBtn = $('admin-publish-btn');
        statusEl = $('admin-status');
        outputEl = $('admin-output');
        countEl = $('admin-count');
        imageInput = $('admin-image-input');

        try {
            document.execCommand('defaultParagraphSeparator', false, 'p');
        } catch (err) {
            // older browsers keep div paragraphs; the serializer handles both
        }

        document.documentElement.setAttribute('data-theme', resolveTheme(getSavedTheme()));
        updateThemeBtn();
        $('admin-theme-btn').addEventListener('click', cycleTheme);
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
            if (getSavedTheme() === 'auto') {
                document.documentElement.setAttribute('data-theme', resolveTheme('auto'));
            }
        });

        if (!$('post-date').value) {
            $('post-date').value = new Date().toISOString().slice(0, 10);
        }

        setupTokenUI();
        setupSidebar();
        $('admin-toolbar').addEventListener('click', handleToolbarClick);
        $('admin-publish-btn').addEventListener('click', publish);
        $('admin-preview-btn').addEventListener('click', togglePreview);
        $('admin-discard-btn').addEventListener('click', discardDraft);
        $('admin-image-input').addEventListener('change', function() {
            uploadImage(imageInput.files[0]);
            imageInput.value = '';
        });

        editor.addEventListener('keydown', handleKeydown);
        editor.addEventListener('input', function() {
            updateCount();
            scheduleDraftSave();
        });
        editor.addEventListener('paste', handlePaste);
        editor.addEventListener('drop', handleDrop);
        document.addEventListener('selectionchange', updateToolbarState);

        ['post-title', 'post-category', 'post-icon', 'post-date'].forEach(function(id) {
            $(id).addEventListener('input', scheduleDraftSave);
        });
        window.addEventListener('beforeunload', saveDraft);

        const restored = restoreDraft();
        updateCount();
        if (restored) {
            setStatus('Draft restored', 'success');
        }
        editor.focus();
        loadPostList();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
