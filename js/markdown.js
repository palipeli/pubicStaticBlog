// markdown.js - GitHub Flavored Markdown (GFM) Compatible Parser
// Full implementation following https://github.github.com/gfm/ spec
// Uses a proper block-level and inline-level parsing approach

(function() {
    // Default introduction content shown before selecting a post
    const blogIntroduction = {
        title: "Welcome to Our Blog",
        date: "",
        category: "",
        icon: "📝",
        content: `
            <h1>Welcome to Our Blog</h1>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
            
            <h2>Discover Amazing Content</h2>
            <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
            
            <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
            
            <h2>Stay Updated</h2>
            <p>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.</p>
            
            <blockquote>
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            </blockquote>
            
            <p>Select a post from the sidebar to start reading.</p>
        `
    };

    // HTML entity map for common entities - we preserve these, not decode
    const htmlEntities = {
        '&nbsp;': '\u00A0', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
        '&#39;': "'", '&apos;': "'", '&copy;': '\u00A9', '&reg;': '\u00AE', '&trade;': '\u2122',
        '&mdash;': '\u2014', '&ndash;': '\u2013', '&hellip;': '\u2026', '&lsquo;': '\u2018', '&rsquo;': '\u2019',
        '&ldquo;': '\u201C', '&rdquo;': '\u201D', '&bull;': '\u2022', '&middot;': '\u00B7', '&larr;': '\u2190',
        '&uarr;': '\u2191', '&rarr;': '\u2192', '&darr;': '\u2193', '&harr;': '\u2194', '&hearts;': '\u2665',
        '&diams;': '\u2666', '&clubs;': '\u2663', '&spades;': '\u2660', '&euro;': '\u20AC', '&pound;': '\u00A3',
        '&yen;': '\u00A5', '&cent;': '\u00A2'
    };

    // Decode HTML entities (for internal processing only, output preserves original)
    function decodeHtmlEntities(text) {
        return text.replace(/&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/g, function(match) {
            if (htmlEntities[match]) return htmlEntities[match];
            // Handle numeric entities
            if (match.startsWith('&#')) {
                const code = match.startsWith('&#x') ? parseInt(match.slice(3, -1), 16) : parseInt(match.slice(2, -1));
                if (!isNaN(code)) return String.fromCharCode(code);
            }
            return match;
        });
    }

    // Check if character is a whitespace character (space, tab, newline, etc.)
    function isWhitespace(ch) {
        return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
    }

    // Check if string is blank (only whitespace)
    function isBlank(line) {
        return /^[ \t]*$/.test(line);
    }

    // Get indent level (number of spaces, treating tabs as 4 spaces)
    function getIndentLevel(line) {
        let level = 0;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === ' ') level++;
            else if (line[i] === '\t') level += 4;
            else break;
        }
        return level;
    }

    // Remove leading indentation (spaces/tabs)
    function removeLeadingIndent(line, count) {
        let removed = 0;
        let result = line;
        for (let i = 0; i < line.length && removed < count; i++) {
            if (line[i] === ' ') { removed++; }
            else if (line[i] === '\t') { removed += 4; }
            else { break; }
        }
        return line.substring(Math.min(result.indexOf(result.trimStart()), line.length));
    }

    // Parse inline elements (bold, italic, links, images, code spans, etc.)
    function parseInline(text, options = {}) {
        if (!text) return '';
        
        let result = '';
        let i = 0;
        
        while (i < text.length) {
            // Try to match various inline patterns
            
            // Backslash escapes (GFM section 6.1)
            if (text[i] === '\\' && i + 1 < text.length) {
                const nextChar = text[i + 1];
                if ('\\`*_{}[]()<>#+-.!|'.includes(nextChar)) {
                    result += nextChar;
                    i += 2;
                    continue;
                }
            }
            
            // HTML entities (GFM section 6.2) - preserve them, don't decode
            if (text[i] === '&') {
                const entityMatch = text.slice(i).match(/^&([a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/);
                if (entityMatch) {
                    result += entityMatch[0];  // Preserve entity as-is
                    i += entityMatch[0].length;
                    continue;
                }
            }
            
            // Code spans (backticks) - GFM section 6.3
            if (text[i] === '`') {
                // Count backticks
                let backtickCount = 0;
                const start = i;
                while (i < text.length && text[i] === '`') {
                    backtickCount++;
                    i++;
                }
                
                // Find closing backticks of same count
                const delimiter = '`'.repeat(backtickCount);
                const closeIndex = text.indexOf(delimiter, i);
                
                if (closeIndex !== -1) {
                    const codeContent = text.slice(i, closeIndex);
                    // Remove one leading/trailing space if present
                    let trimmedCode = codeContent;
                    if (trimmedCode.startsWith(' ') && trimmedCode.endsWith(' ') && trimmedCode.length > 1) {
                        trimmedCode = trimmedCode.slice(1, -1);
                    }
                    result += '<code>' + escapeHtml(trimmedCode) + '</code>';
                    i = closeIndex + backtickCount;
                    continue;
                } else {
                    // No closing backticks, treat as literal
                    result += delimiter;
                }
                continue;
            }
            
            // Images (must check before links) - GFM section 6.4
            if (text[i] === '!' && i + 1 < text.length && text[i + 1] === '[') {
                const imgResult = parseLinkOrImage(text, i, true);
                if (imgResult) {
                    result += imgResult.html;
                    i = imgResult.end;
                    continue;
                }
            }
            
            // Links - GFM section 6.4
            if (text[i] === '[') {
                const linkResult = parseLinkOrImage(text, i, false);
                if (linkResult) {
                    result += linkResult.html;
                    i = linkResult.end;
                    continue;
                }
            }
            
            // Autolinks (URLs and emails in angle brackets) - GFM section 6.5
            if (text[i] === '<') {
                const autoLinkResult = parseAutolink(text, i);
                if (autoLinkResult) {
                    result += autoLinkResult.html;
                    i = autoLinkResult.end;
                    continue;
                }
            }
            
            // Raw HTML tags - GFM section 6.6 (limited in text)
            if (text[i] === '<') {
                const htmlTagResult = parseRawHtmlTag(text, i);
                if (htmlTagResult) {
                    result += htmlTagResult.html;
                    i = htmlTagResult.end;
                    continue;
                }
            }
            
            // Extended autolinks - bare URLs (GFM extension)
            // Check for URLs starting with https:// or http:// that are not inside angle brackets
            if (text[i] === 'h' && text.slice(i, i + 8) === 'https://' || text.slice(i, i + 7) === 'http://') {
                const urlResult = parseExtendedAutolink(text, i);
                if (urlResult) {
                    result += urlResult.html;
                    i = urlResult.end;
                    continue;
                }
            }
            
            // Emphasis and Strong emphasis - GFM section 6.7
            const emphasisResult = parseEmphasis(text, i);
            if (emphasisResult) {
                result += emphasisResult.html;
                i = emphasisResult.end;
                continue;
            }
            
            // Strikethrough (GFM extension) - GFM section 6.8
            if (text[i] === '~' && i + 1 < text.length && text[i + 1] === '~') {
                const strikeResult = parseStrikethrough(text, i);
                if (strikeResult) {
                    result += strikeResult.html;
                    i = strikeResult.end;
                    continue;
                }
            }
            
            // Hard line breaks (two spaces at end of line followed by newline)
            if (text[i] === ' ' && i + 1 < text.length && text[i + 1] === ' ' && i + 2 < text.length && text[i + 2] === '\n') {
                result += '<br>';
                i += 3;
                continue;
            }
            
            // Default: just add the character
            result += text[i];
            i++;
        }
        
        return result;
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
            
            // Skip optional whitespace
            while (i < text.length && isWhitespace(text[i]) && text[i] !== '\n') i++;
            
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
                    html: '<img class="lazy-image" data-src="' + escapeHtml(dest) + '" alt="' + escapeHtml(label) + '">',
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

    // Parse extended autolink (bare URLs - GFM extension)
    function parseExtendedAutolink(text, start) {
        // Check for http:// or https://
        let isHttps = false;
        if (text.slice(start, start + 8) === 'https://') {
            isHttps = true;
        } else if (text.slice(start, start + 7) !== 'http://') {
            return null;
        }
        
        // Find the end of the URL - stop at whitespace, certain punctuation, or HTML entities
        let i = start + (isHttps ? 8 : 7);
        while (i < text.length) {
            const ch = text[i];
            // Stop at whitespace
            if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') break;
            // Stop at certain punctuation that typically ends a URL in prose
            if (ch === '"' || ch === "'" || ch === ')' || ch === ']' || ch === '}' || ch === '>') break;
            // Stop at HTML entity start
            if (ch === '&') break;
            i++;
        }
        
        // Make sure we have at least some URL content
        if (i <= start + (isHttps ? 8 : 7)) return null;
        
        const url = text.slice(start, i);
        
        // Basic URL validation - must have at least one character after protocol
        if (!/^https?:\/\/.+$/.test(url)) return null;
        
        return {
            html: '<a href="' + escapeHtml(url) + '">' + escapeHtml(url) + '</a>',
            end: i
        };
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
            
            // For underscore: check left and right flanking conditions per GFM
            // Underscore only works as delimiter if not surrounded by alphanumeric on both sides
            if (marker === '_') {
                const prevChar = start > 0 ? text[start - 1] : '';
                const nextChar = start + 1 < text.length ? text[start + 1] : '';
                const isPrevAlphaNum = /[a-zA-Z0-9]/.test(prevChar);
                const isNextAlphaNum = /[a-zA-Z0-9]/.test(nextChar);
                
                // If underscore is between alphanumerics, it's not a valid delimiter
                if (isPrevAlphaNum && isNextAlphaNum) {
                    return null;
                }
            }
            
            let closeIndex = -1;
            
            // Find closing marker (not immediately adjacent)
            for (let j = start + 1; j < text.length; j++) {
                if (text[j] === marker) {
                    // Check it's not part of ** or __
                    if (j + 1 < text.length && text[j + 1] === marker) continue;
                    if (j - 1 >= start && text[j - 1] === marker) continue;
                    
                    // For underscore closing: check flanking conditions
                    if (marker === '_') {
                        const prevCloseChar = j > 0 ? text[j - 1] : '';
                        const nextCloseChar = j + 1 < text.length ? text[j + 1] : '';
                        const isPrevCloseAlphaNum = /[a-zA-Z0-9]/.test(prevCloseChar);
                        const isNextCloseAlphaNum = /[a-zA-Z0-9]/.test(nextCloseChar);
                        
                        // Closing underscore must not be followed by alphanumeric if preceded by non-alphanumeric
                        // Or must be preceded by alphanumeric if followed by non-alphanumeric
                        if (!isPrevCloseAlphaNum && isNextCloseAlphaNum) {
                            continue;
                        }
                    }
                    
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
        const delimMatch = delimiterLine.match(/^\|? *(:?-+:?)( *\| *:?-+:?)* *\|? *$/);
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
            const hrMatch = line.match(/^( {0,3})([-*_])([ ]?\2){2,}[ ]*$/);
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
            
            // Blockquote (with nested support)
            const bqMatch = line.match(/^( {0,3})>([ \t]?)(.*)$/);
            if (bqMatch) {
                const bqLines = [];
                while (i < lines.length) {
                    const bqLine = lines[i];
                    // Match any level of blockquote (>, >>, >>>, etc.)
                    const bqLineMatch = bqLine.match(/^( {0,3})(>+)([ \t]?)(.*)$/);
                    if (bqLineMatch) {
                        // Preserve the > markers for nested blockquote processing
                        const markers = bqLineMatch[2];
                        const content = bqLineMatch[4];
                        // Store with marker info for later processing
                        bqLines.push({ markers: markers.length, content: content });
                        i++;
                    } else if (isBlank(bqLine)) {
                        // Check if next line continues blockquote
                        if (i + 1 < lines.length && lines[i + 1].match(/^ {0,3}>/)) {
                            bqLines.push({ markers: 1, content: '' });
                            i++;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                blocks.push({ type: 'blockquote', content: bqLines, line: i - bqLines.length });
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
                const baseIndent = match[1].length;
                
                // Parse list items with support for nested lists at deeper indent levels
                while (i < lines.length) {
                    const listItem = lines[i];
                    
                    // Check for items at the current indent level
                    const ulItemMatch = listItem.match(new RegExp(`^ {${baseIndent}}[-*+][ \\t]+(.*)$`));
                    const olItemMatch = listItem.match(new RegExp(`^ {${baseIndent}}\\d+\\.[ \\t]+(.*)$`));
                    
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
                        
                        // Collect continuation lines and nested lists (indented content)
                        while (i < lines.length) {
                            const contLine = lines[i];
                            const contIndent = getIndentLevel(contLine);
                            
                            if (isBlank(contLine)) {
                                // Check if next line continues this item, has a nested list, or is another list item at same level
                                if (i + 1 < lines.length) {
                                    const nextLine = lines[i + 1];
                                    const nextIndent = getIndentLevel(nextLine);
                                    // Check if next line is a list item at the same base indent level
                                    const nextIsUl = nextLine.match(new RegExp(`^ {${baseIndent}}[-*+][ \\t]+`));
                                    const nextIsOl = nextLine.match(new RegExp(`^ {${baseIndent}}\\d+\\.[ \\t]+`));
                                    // Only continue the current list if the next item is the same type (ul vs ol)
                                    const nextIsSameTypeList = nextIndent === baseIndent && 
                                        (isOrdered ? nextIsOl : nextIsUl);
                                    // Continue if next line is indented more OR is a list item at deeper level OR is same type list item at same level
                                    if (nextIndent > baseIndent || nextIsSameTypeList) {
                                        listItems[listItems.length - 1].subContent.push('');
                                        i++;
                                    } else {
                                        break;
                                    }
                                } else {
                                    break;
                                }
                            } else if (contIndent > baseIndent) {
                                // Check if this is a nested list item (at a deeper indent level)
                                const nestedUlMatch = contLine.match(/^ +([-*+])[ \t]+(.*)$/);
                                const nestedOlMatch = contLine.match(/^ +(\d+)\.[ \t]+(.*)$/);
                                
                                // If it's a nested list item, we need to handle it specially
                                // by recursively parsing the nested portion
                                if (nestedUlMatch || nestedOlMatch) {
                                    // This is a nested list - collect all nested list lines
                                    const nestedLines = [];
                                    const nestedBaseIndent = nestedUlMatch ? nestedUlMatch[1].length : nestedOlMatch[1].length;
                                    
                                    while (i < lines.length) {
                                        const nestedLine = lines[i];
                                        const nestedIndent = getIndentLevel(nestedLine);
                                        
                                        // Stop if we hit a line at or below our base indent (the parent list's indent)
                                        if (nestedIndent <= baseIndent && !isBlank(nestedLine)) {
                                            break;
                                        }
                                        
                                        // Check for any list item marker at this line
                                        const anyUlMatch = nestedLine.match(/^( +)([-*+])[ \t]+/);
                                        const anyOlMatch = nestedLine.match(/^( +)(\d+)\.[ \t]+/);
                                        
                                        if (anyUlMatch || anyOlMatch) {
                                            // This is a list item at some nesting level
                                            // Normalize indentation: subtract nestedBaseIndent so parseBlocks sees it as 0-3 spaces
                                            const itemIndent = anyUlMatch ? anyUlMatch[1].length : anyOlMatch[1].length;
                                            const normalizedIndent = Math.max(0, itemIndent - nestedBaseIndent);
                                            const normalizedLine = ' '.repeat(normalizedIndent) + nestedLine.trimStart();
                                            
                                            // Include it - parseBlocks will handle the nested structure
                                            nestedLines.push(normalizedLine);
                                            i++;
                                        } else if (nestedIndent > nestedBaseIndent || isBlank(nestedLine)) {
                                            // Content indented more than the nested list base, or blank line
                                            // Normalize: subtract nestedBaseIndent
                                            const normalizedIndent = Math.max(0, nestedIndent - nestedBaseIndent);
                                            const normalizedLine = ' '.repeat(normalizedIndent) + nestedLine.trimStart();
                                            nestedLines.push(normalizedLine);
                                            i++;
                                        } else {
                                            // Line at different level that's not a list item - stop
                                            break;
                                        }
                                    }
                                    
                                    // Recursively parse the nested list
                                    const nestedBlocks = parseBlocks(nestedLines);
                                    const nestedHtml = renderBlocks(nestedBlocks);
                                    listItems[listItems.length - 1].subContent.push('__NESTED_LIST__:' + nestedHtml);
                                } else {
                                    // Regular continuation line
                                    listItems[listItems.length - 1].subContent.push(contLine);
                                    i++;
                                }
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

    // Render nested blockquotes
    function renderNestedBlockquotes(bqLines) {
        if (!bqLines || bqLines.length === 0) return '';
        
        // Group consecutive lines by their marker count (nesting level)
        let html = '';
        let i = 0;
        
        while (i < bqLines.length) {
            const line = bqLines[i];
            const level = line.markers;
            
            // Open blockquotes for this level
            let openTags = '';
            for (let l = 0; l < level; l++) {
                openTags += '<blockquote>\n';
            }
            
            // Collect all consecutive lines at this or deeper nesting
            let contentLines = [];
            let j = i;
            while (j < bqLines.length) {
                const currentLine = bqLines[j];
                if (currentLine.markers >= level) {
                    // Add content, stripping extra > markers for display
                    const innerMarkers = currentLine.markers - level;
                    let prefix = '';
                    for (let m = 0; m < innerMarkers; m++) {
                        prefix += '>';
                    }
                    if (prefix && currentLine.content) {
                        contentLines.push(prefix + ' ' + currentLine.content);
                    } else if (currentLine.content) {
                        contentLines.push(currentLine.content);
                    } else {
                        contentLines.push('');
                    }
                    j++;
                } else {
                    break;
                }
            }
            
            // Process content and handle nested blockquotes recursively
            const contentText = contentLines.join('\n');
            
            // Check if there are nested blockquote markers in the content
            if (contentText.includes('\n>') || contentText.startsWith('>')) {
                // Parse nested content as separate blocks
                const nestedLines = contentText.split('\n');
                const nestedBlocks = parseBlocks(nestedLines);
                const nestedHtml = renderBlocks(nestedBlocks);
                html += openTags + nestedHtml;
            } else {
                // Simple content - wrap in paragraph
                const parsedContent = parseInline(contentText);
                html += openTags + '<p>' + parsedContent + '</p>\n';
            }
            
            // Close blockquotes
            for (let l = 0; l < level; l++) {
                html += '</blockquote>\n';
            }
            
            i = j;
        }
        
        return html;
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
                    // Handle nested blockquotes - block.content is now an array of {markers, content} objects
                    html += renderNestedBlockquotes(block.content);
                    break;
                    
                case 'unordered_list':
                    html += '<ul>\n';
                    for (const item of block.items) {
                        const itemContent = parseInline(item.content);
                        let subHtml = '';
                        if (item.subContent.length > 0) {
                            // Process subContent, handling __NESTED_LIST__: markers
                            for (const sub of item.subContent) {
                                if (typeof sub === 'string' && sub.startsWith('__NESTED_LIST__:')) {
                                    // Directly append the nested list HTML
                                    subHtml += sub.substring('__NESTED_LIST__:'.length);
                                } else {
                                    // Parse as regular blocks
                                    const subBlocks = Array.isArray(sub) ? parseBlocks(sub) : parseBlocks([sub]);
                                    subHtml += renderBlocks(subBlocks);
                                }
                            }
                        }
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
                        let subHtml = '';
                        if (item.subContent.length > 0) {
                            // Process subContent, handling __NESTED_LIST__: markers
                            for (const sub of item.subContent) {
                                if (typeof sub === 'string' && sub.startsWith('__NESTED_LIST__:')) {
                                    // Directly append the nested list HTML
                                    subHtml += sub.substring('__NESTED_LIST__:'.length);
                                } else {
                                    // Parse as regular blocks
                                    const subBlocks = Array.isArray(sub) ? parseBlocks(sub) : parseBlocks([sub]);
                                    subHtml += renderBlocks(subBlocks);
                                }
                            }
                        }
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
                    for (let i = 0; i < block.headers.length; i++) {
                        const header = block.headers[i];
                        const align = block.alignments && block.alignments[i] ? ` align="${block.alignments[i]}"` : '';
                        html += `<th${align}>${parseInline(header)}</th>\n`;
                    }
                    html += '</tr>\n</thead>\n<tbody>';
                    for (const row of block.rows) {
                        html += '<tr>\n';
                        for (let i = 0; i < row.length; i++) {
                            const align = block.alignments && block.alignments[i] ? ` align="${block.alignments[i]}"` : '';
                            html += `<td${align}>${parseInline(row[i])}</td>\n`;
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
