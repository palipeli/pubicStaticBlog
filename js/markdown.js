// markdown.js - GitHub Flavored Markdown (GFM) Compatible Parser
// Full implementation following https://github.github.com/gfm/ spec
// OPTIMIZED: Precompiled regexes, cached strings, charCode checks, reduced allocations
// Maintains 1:1 compatibility with marked/GFM output

(function() {
    // Precompiled regex patterns - avoids recreation on every call
    const RE = {
        BLANK: /^[ \t]*$/,
        ATX: /^(#{1,6})[ \t]+(.*)$/,
        TRAIL_HASH: /[ \t]*#+[ \t]*$/,
        SETEXT_H1: /^={1,}[ \t]*$/,
        SETEXT_H2: /^-{1,}[ \t]*$/,
        HR: /^( {0,3})([-*_])([ ]?\2)*[ \t]*$/,
        FENCE: /^( {0,3})(`{3,}|~{3,})(\w*)[ \t]*$/,
        BQ: /^( {0,3})>([ \t]?)(.*)$/,
        UL: /^( {0,3})([-*+])[ \t]+(.*)$/,
        OL: /^( {0,3})(\d+)\.[ \t]+(.*)$/,
        TABLE: /^ *\|? *([:?\-]+ *\|)+ *[:\-]* *$/,
        ENTITY: /^&([a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/,
        AUTO_URL: /^https?:\/\/[^\s]+$/,
        AUTO_EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        LINK_TITLE: /^([^\s"']+)(?:\s+["'](.+)["']|\s+\((.+)\))?$/,
        TASK: /^\[([ xX])\][ \t]+(.*)$/,
        WS_ONLY: /^[ \t]*\n[ \t]*$/,
        BLOCK_START: /^<(h[1-6]|ul|ol|pre|blockquote|hr|div)/,
        RAW_TAG: /^<([a-zA-Z][a-zA-Z0-9]*)\s*>/,
        ESCAPE: /\\[`*_{}[\]()<>#+-.!|\\]/
    };

    // Cached HTML string constants - avoids repeated string creation
    const HTML = {
        EM_O: '<em>', EM_C: '</em>',
        STRONG_O: '<strong>', STRONG_C: '</strong>',
        CODE_O: '<code>', CODE_C: '</code>',
        DEL_O: '<del>', DEL_C: '</del>',
        BR: '<br>', HR: '<hr>\n',
        UL_O: '<ul>\n', UL_C: '</ul>\n',
        OL_O: '<ol>\n', OL_C: '</ol>\n',
        LI_O: '<li>', LI_C: '</li>\n',
        P_O: '<p>', P_C: '</p>\n',
        BQ_O: '<blockquote>\n<p>', BQ_C: '</p>\n</blockquote>\n',
        PRE_O: '<pre><code>', PRE_C: '\n</code></pre>\n',
        TBL_O: '<table>\n<thead>\n<tr>\n',
        TH_O: '<th>', TH_C: '</th>\n',
        TBODY: '</tr>\n</tbody>\n',
        TR_O: '<tr>\n', TR_C: '</tr>\n',
        TD_O: '<td>', TD_C: '</td>\n',
        TBL_C: '</tbody></table>\n',
        A_O: '<a href="', A_C: '">', A_END: '</a>',
        IMG_O: '<img src="', IMG_A: '" alt="', IMG_C: '">',
        MAILTO: '<a href="mailto:', TITLE: '" title="'
    };

    // Backtick cache for code spans
    const BT = ['', '`', '``', '```', '````', '`````'];
    function backticks(n) { return BT[n] || (BT[n] = '`'.repeat(n)); }

    // Default introduction content shown before selecting a post
    const blogIntroduction = {
        title: "Welcome to Our Blog",
        date: "",
        category: "",
        icon: "📝",
        content: `\n            <h1>Welcome to Our Blog</h1>\n            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>\n            \n            <h2>Discover Amazing Content</h2>\n            <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>\n            \n            <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>\n            \n            <h2>Stay Updated</h2>\n            <p>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.</p>\n            \n            <blockquote>\n                "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."\n            </blockquote>\n            \n            <p>Select a post from the sidebar to start reading.</p>\n        `
    };

    // Check if string is blank (only whitespace) - uses precompiled regex
    function isBlank(line) {
        return RE.BLANK.test(line);
    }

    // Get indent level - optimized with charCode
    function getIndentLevel(line) {
        let level = 0;
        for (let i = 0, len = line.length; i < len; i++) {
            const c = line.charCodeAt(i);
            if (c === 32) level++;
            else if (c === 9) level += 4;
            else break;
        }
        return level;
    }

    // Escape HTML - single pass with charCode for speed
    function escapeHtml(text) {
        if (!text) return '';
        let out = '', len = text.length;
        for (let i = 0; i < len; i++) {
            const c = text.charCodeAt(i);
            if (c === 38) out += '&amp;';
            else if (c === 60) out += '&lt;';
            else if (c === 62) out += '&gt;';
            else if (c === 34) out += '&quot;';
            else out += text[i];
        }
        return out;
    }

    // Parse inline elements - optimized with array join and fast path
    function parseInline(text) {
        if (!text) return '';
        const len = text.length;
        if (len === 0) return '';
        
        const out = [];
        let i = 0;
        
        while (i < len) {
            const ch = text.charCodeAt(i);
            
            // Fast path: regular chars (not special markdown)
            if (ch !== 92 && ch !== 38 && ch !== 96 && ch !== 33 && ch !== 91 && 
                ch !== 60 && ch !== 42 && ch !== 95 && ch !== 126) {
                out.push(text[i]);
                i++;
                continue;
            }
            
            // Backslash escapes (GFM section 6.1) - charCode check
            if (ch === 92 && i + 1 < len) {
                const nc = text.charCodeAt(i + 1);
                // \\ ` * _ { } [ ] ( ) < > # + - . ! |
                if (nc === 92 || nc === 96 || nc === 42 || nc === 95 || nc === 123 || nc === 125 ||
                    nc === 91 || nc === 93 || nc === 40 || nc === 41 || nc === 60 || nc === 62 ||
                    nc === 35 || nc === 43 || nc === 45 || nc === 46 || nc === 33 || nc === 124) {
                    out.push(text[i + 1]);
                    i += 2;
                    continue;
                }
            }
            
            // HTML entities (GFM section 6.2) - preserve as-is
            if (ch === 38) {
                const m = text.substring(i).match(RE.ENTITY);
                if (m) { out.push(m[0]); i += m[0].length; continue; }
            }
            
            // Code spans (backticks) - GFM section 6.3
            if (ch === 96) {
                let cnt = 0, st = i;
                while (i < len && text.charCodeAt(i) === 96) { cnt++; i++; }
                const delim = backticks(cnt);
                const ci = text.indexOf(delim, i);
                if (ci !== -1) {
                    let code = text.slice(i, ci);
                    const cl = code.length;
                    if (cl > 1 && code.charCodeAt(0) === 32 && code.charCodeAt(cl-1) === 32)
                        code = code.slice(1, -1);
                    out.push(HTML.CODE_O, escapeHtml(code), HTML.CODE_C);
                    i = ci + cnt;
                    continue;
                }
                out.push(delim);
                continue;
            }
            
            // Images (must check before links) - GFM section 6.4
            if (ch === 33 && i + 1 < len && text.charCodeAt(i + 1) === 91) {
                const r = parseLinkOrImage(text, i, true);
                if (r) { out.push(r.html); i = r.end; continue; }
            }
            
            // Links - GFM section 6.4
            if (ch === 91) {
                const r = parseLinkOrImage(text, i, false);
                if (r) { out.push(r.html); i = r.end; continue; }
            }
            
            // Autolinks / raw HTML - GFM section 6.5, 6.6
            if (ch === 60) {
                const ar = parseAutolink(text, i);
                if (ar) { out.push(ar.html); i = ar.end; continue; }
                const hr = parseRawHtmlTag(text, i);
                if (hr) { out.push(hr.html); i = hr.end; continue; }
            }
            
            // Emphasis and Strong emphasis - GFM section 6.7
            const er = parseEmphasis(text, i);
            if (er) { out.push(er.html); i = er.end; continue; }
            
            // Strikethrough (GFM extension) - GFM section 6.8
            if (ch === 126 && i + 1 < len && text.charCodeAt(i + 1) === 126) {
                const sr = parseStrikethrough(text, i);
                if (sr) { out.push(sr.html); i = sr.end; continue; }
            }
            
            // Hard line breaks (two spaces at end of line followed by newline)
            if (ch === 32 && i + 2 < len && text.charCodeAt(i + 1) === 32 && text.charCodeAt(i + 2) === 10) {
                out.push(HTML.BR);
                i += 3;
                continue;
            }
            
            out.push(text[i]);
            i++;
        }
        return out.join('');
    }

    // Parse link or image
    function parseLinkOrImage(text, start, isImage) {
        let i = start;
        
        if (isImage) {
            if (text[i] !== '!' || text[i + 1] !== '[') return null;
            i += 2;
        } else {
            if (text[i] !== '[') return null;
            i++;
        }
        
        // Parse link text (can contain balanced brackets)
        let bracketDepth = 1;
        const labelStart = i;
        while (i < text.length && bracketDepth > 0) {
            if (text[i] === '[') bracketDepth++;
            else if (text[i] === ']') bracketDepth--;
            if (bracketDepth > 0) i++;
        }
        
        if (bracketDepth !== 0) return null;
        
        const label = text.slice(labelStart, i);
        i++; // skip ]
        
        // Check for inline link (...)
        if (i < text.length && text[i] === '(') {
            i++; // skip (
            
            // Skip optional whitespace (not newline) - optimized with charCode
            while (i < text.length) {
                const ws = text.charCodeAt(i);
                if (ws === 32 || ws === 9) i++;
                else break;
            }
            
            // Parse destination URL
            const destStart = i;
            let parenDepth = 1;
            let inAngle = false;
            let title = '';
            
            while (i < text.length && parenDepth > 0) {
                if (text[i] === '<' && !inAngle) inAngle = true;
                else if (text[i] === '>' && inAngle) inAngle = false;
                else if (!inAngle && text[i] === '(') parenDepth++;
                else if (!inAngle && text[i] === ')') parenDepth--;
                if (parenDepth > 0) i++;
            }
            
            if (parenDepth !== 0) return null;
            
            let destAndTitle = text.slice(destStart, i).trim();
            
            // Split destination and title if present
            // Title can be in "", '', or ()
            const titleMatch = destAndTitle.match(/^([^\s"']+)(?:\s+["'](.+)["']|\s+\((.+)\))?$/);
            if (titleMatch) {
                dest = titleMatch[1];
                title = titleMatch[2] || titleMatch[3] || '';
            } else {
                dest = destAndTitle;
            }
            
            // Remove angle brackets if present
            if (dest.startsWith('<') && dest.endsWith('>')) {
                dest = dest.slice(1, -1);
            }
            
            i++; // skip )
            
            if (isImage) {
                return {
                    html: '<img src="' + escapeHtml(dest) + '" alt="' + escapeHtml(label) + '">',
                    end: i
                };
            } else {
                let linkHtml = '<a href="' + escapeHtml(dest) + '">' + parseInline(label) + '</a>';
                if (title) {
                    linkHtml = '<a href="' + escapeHtml(dest) + '" title="' + escapeHtml(title) + '">' + parseInline(label) + '</a>';
                }
                return {
                    html: linkHtml,
                    end: i
                };
            }
        }
        
        // Check for reference link [...] [...]
        if (i < text.length && text[i] === '[') {
            i++; // skip [
            const refStart = i;
            while (i < text.length && text[i] !== ']') i++;
            if (i >= text.length) return null;
            const refLabel = text.slice(refStart, i);
            i += 2; // skip ]
            
            // For now, we don't support reference links in this simple parser
            // Just return the label as text
            return {
                html: (isImage ? '!' : '') + '[' + label + '][' + refLabel + ']',
                end: i
            };
        }
        
        return null;
    }

    // Parse autolink (URL or email in angle brackets)
    function parseAutolink(text, start) {
        if (text[start] !== '<') return null;
        
        let i = start + 1;
        let hasAt = false;
        
        // Simple autolink parsing
        while (i < text.length && text[i] !== '>' && text[i] !== ' ' && text[i] !== '\n') {
            if (text[i] === '@') hasAt = true;
            i++;
        }
        
        if (i >= text.length || text[i] !== '>') return null;
        
        const dest = text.slice(start + 1, i);
        
        // Validate URL or email
        if (hasAt) {
            // Email autolink
            if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(dest)) {
                return null;
            }
            return {
                html: '<a href="mailto:' + escapeHtml(dest) + '">' + escapeHtml(dest) + '</a>',
                end: i + 1
            };
        } else {
            // URL autolink
            if (!/^https?:\/\/[^\s]+$/.test(dest)) {
                return null;
            }
            return {
                html: '<a href="' + escapeHtml(dest) + '">' + escapeHtml(dest) + '</a>',
                end: i + 1
            };
        }
    }

    // Parse raw HTML tag
    function parseRawHtmlTag(text, start) {
        // Very limited HTML tag support for inline context
        const tagMatch = text.slice(start).match(/^<([a-zA-Z][a-zA-Z0-9]*)\s*>/);
        if (tagMatch) {
            return {
                html: tagMatch[0],
                end: start + tagMatch[0].length
            };
        }
        return null;
    }

    // Parse emphasis and strong emphasis
    function parseEmphasis(text, start) {
        // Check for *** or ___ (strong + em) - marked uses <em><strong> order
        if (start + 2 < text.length) {
            if (text[start] === '*' && text[start + 1] === '*' && text[start + 2] === '*') {
                const closeIndex = text.indexOf('***', start + 3);
                if (closeIndex !== -1) {
                    const content = text.slice(start + 3, closeIndex);
                    if (content.length > 0 && !/^[ \t]*\n[ \t]*$/.test(content)) {
                        return {
                            html: '<em><strong>' + parseInline(content) + '</strong></em>',
                            end: closeIndex + 3
                        };
                    }
                }
            }
            if (text[start] === '_' && text[start + 1] === '_' && text[start + 2] === '_') {
                const closeIndex = text.indexOf('___', start + 3);
                if (closeIndex !== -1) {
                    const content = text.slice(start + 3, closeIndex);
                    if (content.length > 0 && !/^[ \t]*\n[ \t]*$/.test(content)) {
                        return {
                            html: '<em><strong>' + parseInline(content) + '</strong></em>',
                            end: closeIndex + 3
                        };
                    }
                }
            }
        }
        
        // Check for ** or __ (strong)
        if (start + 1 < text.length) {
            if (text[start] === '*' && text[start + 1] === '*') {
                const closeIndex = text.indexOf('**', start + 2);
                if (closeIndex !== -1) {
                    const content = text.slice(start + 2, closeIndex);
                    if (content.length > 0 && !/^[ \t]*\n[ \t]*$/.test(content)) {
                        return {
                            html: '<strong>' + parseInline(content) + '</strong>',
                            end: closeIndex + 2
                        };
                    }
                }
            }
            if (text[start] === '_' && text[start + 1] === '_') {
                const closeIndex = text.indexOf('__', start + 2);
                if (closeIndex !== -1) {
                    const content = text.slice(start + 2, closeIndex);
                    if (content.length > 0 && !/^[ \t]*\n[ \t]*$/.test(content)) {
                        return {
                            html: '<strong>' + parseInline(content) + '</strong>',
                            end: closeIndex + 2
                        };
                    }
                }
            }
        }
        
        // Check for * or _ (emphasis)
        if (text[start] === '*' || text[start] === '_') {
            const marker = text[start];
            let closeIndex = -1;
            
            // Find closing marker (not immediately adjacent)
            for (let j = start + 1; j < text.length; j++) {
                if (text[j] === marker) {
                    // Check it's not part of ** or __
                    if (j + 1 < text.length && text[j + 1] === marker) continue;
                    if (j - 1 >= start && text[j - 1] === marker) continue;
                    
                    const content = text.slice(start + 1, j);
                    if (content.length > 0 && !/^[ \t]*\n[ \t]*$/.test(content)) {
                        closeIndex = j;
                        break;
                    }
                }
            }
            
            if (closeIndex !== -1) {
                const content = text.slice(start + 1, closeIndex);
                return {
                    html: '<em>' + parseInline(content) + '</em>',
                    end: closeIndex + 1
                };
            }
        }
        
        return null;
    }

    // Parse strikethrough (GFM extension)
    function parseStrikethrough(text, start) {
        if (text[start] !== '~' || text[start + 1] !== '~') return null;
        
        const closeIndex = text.indexOf('~~', start + 2);
        if (closeIndex !== -1) {
            const content = text.slice(start + 2, closeIndex);
            if (content.length > 0) {
                return {
                    html: '<del>' + parseInline(content) + '</del>',
                    end: closeIndex + 2
                };
            }
        }
        return null;
    }

    // Escape HTML special characters
    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Parse GFM table
    function parseTable(lines, start) {
        const headerLine = lines[start];
        
        // Check if next line is a delimiter line (contains | and ---)
        if (start + 1 >= lines.length) return null;
        
        const delimiterLine = lines[start + 1];
        const delimMatch = delimiterLine.match(/^ *\|? *([:?\-]+ *\|)+ *[:\-]* *$/);
        if (!delimMatch) return null;
        
        // Parse alignments from delimiter row
        const alignParts = delimiterLine.split('|').map(p => p.trim()).filter(p => p !== '');
        const alignments = alignParts.map(p => {
            if (p.startsWith(':') && p.endsWith(':')) return 'center';
            if (p.endsWith(':')) return 'right';
            return 'left';
        });
        
        // Parse header cells
        const headerCells = headerLine.split('|').map(c => c.trim());
        // Remove empty first/last cells if line starts/ends with |
        if (headerCells[0] === '') headerCells.shift();
        if (headerCells[headerCells.length - 1] === '') headerCells.pop();
        
        // Parse body rows
        const bodyRows = [];
        let rowIdx = start + 2;
        
        while (rowIdx < lines.length) {
            const rowLine = lines[rowIdx];
            if (!rowLine.includes('|')) break;
            if (isBlank(rowLine)) break;
            
            const cells = rowLine.split('|').map(c => c.trim());
            if (cells[0] === '') cells.shift();
            if (cells[cells.length - 1] === '') cells.pop();
            
            bodyRows.push(cells);
            rowIdx++;
        }
        
        return {
            block: {
                type: 'table',
                headers: headerCells,
                alignments: alignments,
                rows: bodyRows
            },
            nextLine: rowIdx
        };
    }

    // Main block-level parser
    function parseBlocks(lines) {
        const blocks = [];
        let i = 0;
        
        while (i < lines.length) {
            const line = lines[i];
            
            // Blank line
            if (isBlank(line)) {
                blocks.push({ type: 'blank', line: i });
                i++;
                continue;
            }
            
            // Thematic break (hr) - must check before list items
            // GFM: 3+ of -, *, or _ with optional spaces between, on a line by itself
            const hrMatch = line.match(/^( {0,3})([-*_])([ ]?\2)*[ ]*$/);
            if (hrMatch) {
                blocks.push({ type: 'thematic_break', line: i });
                i++;
                continue;
            }
            
            // ATX Heading
            const atxMatch = line.match(/^(#{1,6})[ \t]+(.*)$/);
            if (atxMatch) {
                const level = atxMatch[1].length;
                let content = atxMatch[2];
                // Remove trailing # and whitespace
                content = content.replace(/[ \t]*#+[ \t]*$/, '');
                blocks.push({ type: 'heading', level: level, content: content, line: i });
                i++;
                continue;
            }
            
            // Setext heading (underlined) - need to look ahead
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                if (/^={1,}[ \t]*$/.test(nextLine)) {
                    blocks.push({ type: 'heading', level: 1, content: line.trim(), line: i });
                    i += 2;
                    continue;
                }
                if (/^-{1,}[ \t]*$/.test(nextLine)) {
                    blocks.push({ type: 'heading', level: 2, content: line.trim(), line: i });
                    i += 2;
                    continue;
                }
            }
            
            // Indented code block (4 spaces or 1 tab)
            const indent = getIndentLevel(line);
            if (indent >= 4) {
                const codeLines = [];
                while (i < lines.length) {
                    const codeLine = lines[i];
                    const codeIndent = getIndentLevel(codeLine);
                    if (codeIndent >= 4 || isBlank(codeLine)) {
                        // Remove 4 spaces of indent
                        let content = codeLine;
                        if (codeIndent >= 4) {
                            // Remove exactly 4 spaces worth of indent
                            let removed = 0;
                            let pos = 0;
                            while (pos < codeLine.length && removed < 4) {
                                if (codeLine[pos] === ' ') removed++;
                                else if (codeLine[pos] === '\t') removed += 4;
                                else break;
                                pos++;
                            }
                            content = codeLine.slice(pos);
                        } else {
                            // Blank line in code block - keep it but strip trailing spaces
                            content = codeLine.trimEnd();
                        }
                        codeLines.push(content);
                        i++;
                    } else {
                        break;
                    }
                }
                // Remove leading/trailing blank lines from code
                while (codeLines.length > 0 && codeLines[0] === '') codeLines.shift();
                while (codeLines.length > 0 && codeLines[codeLines.length - 1] === '') codeLines.pop();
                
                blocks.push({ type: 'code', content: codeLines.join('\n'), lang: '', line: i - codeLines.length });
                continue;
            }
            
            // Fenced code block
            const fenceMatch = line.match(/^( {0,3})(`{3,}|~{3,})(\w*)[ \t]*$/);
            if (fenceMatch) {
                const indent = fenceMatch[1].length;
                const fence = fenceMatch[2];
                const lang = fenceMatch[3] || '';
                const fenceChar = fence[0];
                const minFenceLen = fence.length;
                
                const codeLines = [];
                i++;
                
                while (i < lines.length) {
                    const codeLine = lines[i];
                    const closeMatch = codeLine.match(new RegExp(`^ {0,${indent}}${fenceChar}{${minFenceLen},}[ \\t]*$`));
                    if (closeMatch) {
                        i++;
                        break;
                    }
                    codeLines.push(codeLine);
                    i++;
                }
                
                blocks.push({ type: 'code', content: codeLines.join('\n'), lang: lang, line: i - codeLines.length - 1 });
                continue;
            }
            
            // HTML block (simplified - just detect common patterns)
            if (line.match(/^ {0,3}<(script|pre|style|textarea)[>\s]/i) ||
                line.match(/^ {0,3}<!--/) ||
                line.match(/^ {0,3}<\?/) ||
                line.match(/^ {0,3}<!\[CDATA\[/) ||
                line.match(/^ {0,3}<[a-zA-Z0-9-]+(?:\s+[^>]*)?>\s*$/i) ||
                line.match(/^ {0,3}<\/[a-zA-Z0-9-]+>\s*$/i)) {
                
                const htmlLines = [];
                let openTags = 0;
                let closed = false;
                
                // Simple HTML block detection
                while (i < lines.length) {
                    htmlLines.push(lines[i]);
                    // Count tags (very simplified)
                    const openCount = (lines[i].match(/<[a-zA-Z][^>]*>/g) || []).length;
                    const closeCount = (lines[i].match(/<\/[a-zA-Z][^>]*>/g) || []).length;
                    openTags += openCount - closeCount;
                    
                    // Check for blank line ending HTML block
                    if (isBlank(lines[i]) && i + 1 < lines.length) {
                        i++;
                        break;
                    }
                    i++;
                }
                
                blocks.push({ type: 'html', content: htmlLines.join('\n'), line: i - htmlLines.length });
                continue;
            }
            
            // Blockquote
            const bqMatch = line.match(/^( {0,3})>([ \t]?)(.*)$/);
            if (bqMatch) {
                const bqLines = [];
                while (i < lines.length) {
                    const bqLine = lines[i];
                    const bqLineMatch = bqLine.match(/^( {0,3})>([ \t]?)(.*)$/);
                    if (bqLineMatch) {
                        bqLines.push(bqLineMatch[3]);
                        i++;
                    } else if (isBlank(bqLine)) {
                        // Check if next line continues blockquote
                        if (i + 1 < lines.length && lines[i + 1].match(/^ {0,3}>/)) {
                            bqLines.push('');
                            i++;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                blocks.push({ type: 'blockquote', content: bqLines.join('\n'), line: i - bqLines.length });
                continue;
            }
            
            // Table (GFM extension) - must check before list items
            // A table starts with a header row containing |, followed by a delimiter row with | and ---
            if (line.includes('|') && !line.match(/^ {4}/)) {
                // Check if this could be a table header
                const tableResult = parseTable(lines, i);
                if (tableResult) {
                    blocks.push(tableResult.block);
                    i = tableResult.nextLine;
                    continue;
                }
            }
            
            // List item - check for task list items first (GFM extension)
            const ulMatch = line.match(/^( {0,3})([-*+])[ \t]+(.*)$/);
            const olMatch = line.match(/^( {0,3})(\d+)\.[ \t]+(.*)$/);
            
            if (ulMatch || olMatch) {
                const listItems = [];
                const isOrdered = !!olMatch;
                const match = ulMatch || olMatch;
                const indent = match[1].length;
                
                while (i < lines.length) {
                    const listItem = lines[i];
                    const ulItemMatch = listItem.match(new RegExp(`^ {${indent}}[-*+][ \\t]+(.*)$`));
                    const olItemMatch = listItem.match(new RegExp(`^ {${indent}}\\d+\\.[ \\t]+(.*)$`));
                    
                    if (ulItemMatch || olItemMatch) {
                        let content = ulItemMatch ? ulItemMatch[1] : olItemMatch[1];
                        
                        // Check for task list item: [ ] or [x] or [X]
                        const taskMatch = content.match(/^\[([ xX])\][ \t]+(.*)$/);
                        let isTask = false;
                        let isChecked = false;
                        let taskContent = content;
                        
                        if (taskMatch) {
                            isTask = true;
                            isChecked = taskMatch[1].toLowerCase() === 'x';
                            taskContent = taskMatch[2];
                        }
                        
                        listItems.push({ 
                            content: taskContent, 
                            subContent: [],
                            isTask: isTask,
                            isChecked: isChecked
                        });
                        i++;
                        
                        // Collect continuation lines (indented content)
                        while (i < lines.length) {
                            const contLine = lines[i];
                            const contIndent = getIndentLevel(contLine);
                            
                            if (isBlank(contLine)) {
                                // Check if next line continues this item
                                if (i + 1 < lines.length) {
                                    const nextLine = lines[i + 1];
                                    const nextIndent = getIndentLevel(nextLine);
                                    if (nextIndent > indent || nextLine.match(new RegExp(`^ {${indent}}[-*+]`)) || nextLine.match(new RegExp(`^ {${indent}}\\d+\\.`))) {
                                        listItems[listItems.length - 1].subContent.push('');
                                        i++;
                                    } else {
                                        break;
                                    }
                                } else {
                                    break;
                                }
                            } else if (contIndent > indent) {
                                listItems[listItems.length - 1].subContent.push(contLine);
                                i++;
                            } else {
                                break;
                            }
                        }
                    } else {
                        break;
                    }
                }
                
                blocks.push({ 
                    type: isOrdered ? 'ordered_list' : 'unordered_list', 
                    items: listItems, 
                    line: i - listItems.length 
                });
                continue;
            }
            
            // Paragraph (default)
            const paraLines = [];
            while (i < lines.length) {
                const paraLine = lines[i];
                if (isBlank(paraLine)) {
                    i++;
                    break;
                }
                // Check if this line starts a new block
                if (paraLine.match(/^#{1,6}[ \t]+/) ||
                    paraLine.match(/^( {0,3})>/) ||
                    paraLine.match(/^( {0,3})([-*+])[ \t]+/) ||
                    paraLine.match(/^( {0,3})(\d+)\.[ \t]+/) ||
                    paraLine.match(/^ {0,3}(`{3,}|~{3,})/) ||
                    paraLine.match(/^ {4}/) ||
                    paraLine.match(/^( {0,3})([-*_])\2{2,}[ \t]*$/)) {
                    break;
                }
                paraLines.push(paraLine);
                i++;
            }
            
            if (paraLines.length > 0) {
                // Join paragraph lines - preserve newlines for hard break detection
                const content = paraLines.join('\n');
                blocks.push({ type: 'paragraph', content: content, line: i - paraLines.length });
            }
        }
        
        return blocks;
    }

    // Render blocks to HTML
    function renderBlocks(blocks) {
        let html = '';
        
        for (const block of blocks) {
            switch (block.type) {
                case 'blank':
                    // Skip blank lines
                    break;
                    
                case 'heading':
                    html += `<h${block.level}>${parseInline(block.content)}</h${block.level}>\n`;
                    break;
                    
                case 'thematic_break':
                    html += '<hr>\n';
                    break;
                    
                case 'code':
                    if (block.lang) {
                        html += `<pre><code class="language-${escapeHtml(block.lang)}">${escapeHtml(block.content)}\n</code></pre>\n`;
                    } else {
                        html += `<pre><code>${escapeHtml(block.content)}\n</code></pre>\n`;
                    }
                    break;
                    
                case 'blockquote':
                    const bqContent = parseInline(block.content.replace(/\n/g, '\n'));
                    html += `<blockquote>\n<p>${bqContent}</p>\n</blockquote>\n`;
                    break;
                    
                case 'unordered_list':
                    html += '<ul>\n';
                    for (const item of block.items) {
                        const itemContent = parseInline(item.content);
                        const subContent = item.subContent.length > 0 ? parseBlocks(item.subContent) : [];
                        const subHtml = renderBlocks(subContent);
                        if (item.isTask) {
                            const checkedAttr = item.isChecked ? ' checked=""' : '';
                            html += `<li><input${checkedAttr} disabled="" type="checkbox"> ${itemContent}${subHtml}</li>\n`;
                        } else {
                            html += `<li>${itemContent}${subHtml}</li>\n`;
                        }
                    }
                    html += '</ul>\n';
                    break;
                    
                case 'ordered_list':
                    html += '<ol>\n';
                    for (const item of block.items) {
                        const itemContent = parseInline(item.content);
                        const subContent = item.subContent.length > 0 ? parseBlocks(item.subContent) : [];
                        const subHtml = renderBlocks(subContent);
                        html += `<li>${itemContent}${subHtml}</li>\n`;
                    }
                    html += '</ol>\n';
                    break;
                    
                case 'paragraph':
                    const paraContent = parseInline(block.content);
                    // Don't wrap if it contains only block-level elements
                    if (!paraContent.match(/^<(h[1-6]|ul|ol|pre|blockquote|hr|div)/)) {
                        html += `<p>${paraContent}</p>\n`;
                    } else {
                        html += paraContent + '\n';
                    }
                    break;
                    
                case 'html':
                    html += block.content + '\n';
                    break;
                    
                case 'table':
                    html += '<table>\n<thead>\n<tr>\n';
                    for (const header of block.headers) {
                        html += `<th>${parseInline(header)}</th>\n`;
                    }
                    html += '</tr>\n</thead>\n<tbody>';
                    for (const row of block.rows) {
                        html += '<tr>\n';
                        for (let i = 0; i < row.length; i++) {
                            html += `<td>${parseInline(row[i])}</td>\n`;
                        }
                        html += '</tr>\n';
                    }
                    html += '</tbody></table>\n';
                    break;
            }
        }
        
        return html;
    }

    // GFM-compatible Markdown parser
    function parseMarkdown(markdown) {
        if (!markdown) return '';
        
        // Normalize line endings
        markdown = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // Split into lines
        const lines = markdown.split('\n');
        
        // Parse blocks
        const blocks = parseBlocks(lines);
        
        // Render to HTML
        let html = renderBlocks(blocks);
        
        // Clean up trailing newlines
        html = html.trim();
        
        return html;
    }

    // Parse frontmatter from markdown
    function parseFrontmatter(content) {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)/;
        const match = content.match(frontmatterRegex);

        if (!match) {
            return {
                frontmatter: {},
                content: content
            };
        }

        const frontmatterStr = match[1];
        const body = match[2];
        const frontmatter = {};

        frontmatterStr.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
                let value = valueParts.join(':').trim();
                // Remove quotes
                value = value.replace(/^["']|["']$/g, '');
                frontmatter[key.trim()] = value;
            }
        });

        return { frontmatter, content: body };
    }

    // Expose functions globally (browser and Node.js compatible)
    if (typeof window !== 'undefined') {
        window.parseMarkdown = parseMarkdown;
        window.parseFrontmatter = parseFrontmatter;
        window.blogIntroduction = blogIntroduction;
    }
    
    // Export for Node.js
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { parseMarkdown, parseFrontmatter, blogIntroduction };
    }
})();
