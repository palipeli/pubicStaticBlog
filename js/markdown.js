(function() {
    const htmlEntities = {
        '&nbsp;': '\u00A0', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
        '&#39;': "'", '&apos;': "'", '&copy;': '\u00A9', '&reg;': '\u00AE', '&trade;': '\u2122',
        '&mdash;': '\u2014', '&ndash;': '\u2013', '&hellip;': '\u2026', '&lsquo;': '\u2018', '&rsquo;': '\u2019',
        '&ldquo;': '\u201C', '&rdquo;': '\u201D', '&bull;': '\u2022', '&middot;': '\u00B7', '&larr;': '\u2190',
        '&uarr;': '\u2191', '&rarr;': '\u2192', '&darr;': '\u2193', '&harr;': '\u2194', '&hearts;': '\u2665',
        '&diams;': '\u2666', '&clubs;': '\u2663', '&spades;': '\u2660', '&euro;': '\u20AC', '&pound;': '\u00A3',
        '&yen;': '\u00A5', '&cent;': '\u00A2'
    };
    function isWhitespace(ch) {
        return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
    }
    function isBlank(line) {
        return /^[ \t]*$/.test(line);
    }
    function getIndentLevel(line) {
        let level = 0;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === ' ') level++;
            else if (line[i] === '\t') level += 4;
            else break;
        }
        return level;
    }
    function parseInline(text, options = {}) {
        if (!text) return '';
        let result = '';
        let i = 0;
        while (i < text.length) {
            if (text[i] === '\\' && i + 1 < text.length) {
                const nextChar = text[i + 1];
                if ('\\`*_{}[]()<>#+-.!|'.includes(nextChar)) {
                    result += nextChar;
                    i += 2;
                    continue;
                }
            }
            if (text[i] === '&') {
                const entityMatch = text.slice(i).match(/^&([a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/);
                if (entityMatch) {
                    const entity = entityMatch[0];
                    if (htmlEntities[entity]) {
                        result += htmlEntities[entity];
                    } else {
                        result += entity;
                    }
                    i += entityMatch[0].length;
                    continue;
                }
            }
            if (text[i] === '`') {
                let backtickCount = 0;
                const start = i;
                while (i < text.length && text[i] === '`') {
                    backtickCount++;
                    i++;
                }
                const delimiter = '`'.repeat(backtickCount);
                const closeIndex = text.indexOf(delimiter, i);
                if (closeIndex !== -1) {
                    const codeContent = text.slice(i, closeIndex);
                    let trimmedCode = codeContent;
                    if (trimmedCode.startsWith(' ') && trimmedCode.endsWith(' ') && trimmedCode.length > 1) {
                        trimmedCode = trimmedCode.slice(1, -1);
                    }
                    result += '<code>' + escapeHtml(trimmedCode) + '</code>';
                    i = closeIndex + backtickCount;
                    continue;
                } else {
                    result += delimiter;
                }
                continue;
            }
            if (text[i] === '!' && i + 1 < text.length && text[i + 1] === '[') {
                const imgResult = parseLinkOrImage(text, i, true);
                if (imgResult) {
                    result += imgResult.html;
                    i = imgResult.end;
                    continue;
                }
            }
            if (text[i] === '[') {
                const linkResult = parseLinkOrImage(text, i, false);
                if (linkResult) {
                    result += linkResult.html;
                    i = linkResult.end;
                    continue;
                }
            }
            if (text[i] === '<') {
                const autoLinkResult = parseAutolink(text, i);
                if (autoLinkResult) {
                    result += autoLinkResult.html;
                    i = autoLinkResult.end;
                    continue;
                }
            }
            if (text[i] === '<') {
                const htmlTagResult = parseRawHtmlTag(text, i);
                if (htmlTagResult) {
                    result += htmlTagResult.html;
                    i = htmlTagResult.end;
                    continue;
                }
            }
            if (text[i] === 'h' && text.slice(i, i + 8) === 'https://' || text.slice(i, i + 7) === 'http://') {
                const urlResult = parseExtendedAutolink(text, i);
                if (urlResult) {
                    result += urlResult.html;
                    i = urlResult.end;
                    continue;
                }
            }
            const emphasisResult = parseEmphasis(text, i);
            if (emphasisResult) {
                result += emphasisResult.html;
                i = emphasisResult.end;
                continue;
            }
            if (text[i] === '~' && i + 1 < text.length && text[i + 1] === '~') {
                const strikeResult = parseStrikethrough(text, i);
                if (strikeResult) {
                    result += strikeResult.html;
                    i = strikeResult.end;
                    continue;
                }
            }
            if (text[i] === ' ' && i + 1 < text.length && text[i + 1] === ' ' && i + 2 < text.length && text[i + 2] === '\n') {
                result += '<br>';
                i += 3;
                continue;
            }
            result += text[i];
            i++;
        }
        return result;
    }
    function parseLinkOrImage(text, start, isImage) {
        let i = start;
        if (isImage) {
            if (text[i] !== '!' || text[i + 1] !== '[') return null;
            i += 2;
        } else {
            if (text[i] !== '[') return null;
            i++;
        }
        let bracketDepth = 1;
        const labelStart = i;
        while (i < text.length && bracketDepth > 0) {
            if (text[i] === '[') bracketDepth++;
            else if (text[i] === ']') bracketDepth--;
            if (bracketDepth > 0) i++;
        }
        if (bracketDepth !== 0) return null;
        const label = text.slice(labelStart, i);
        i++;
        if (i < text.length && text[i] === '(') {
            i++;
            while (i < text.length && isWhitespace(text[i]) && text[i] !== '\n') i++;
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
            const titleMatch = destAndTitle.match(/^([^\s"']+)(?:\s+["'](.+)["']|\s+\((.+)\))?$/);
            if (titleMatch) {
                dest = titleMatch[1];
                title = titleMatch[2] || titleMatch[3] || '';
            } else {
                dest = destAndTitle;
            }
            if (dest.startsWith('<') && dest.endsWith('>')) {
                dest = dest.slice(1, -1);
            }
            i++;
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
        if (i < text.length && text[i] === '[') {
            i++;
            const refStart = i;
            while (i < text.length && text[i] !== ']') i++;
            if (i >= text.length) return null;
            const refLabel = text.slice(refStart, i);
            i += 2;
            return {
                html: (isImage ? '!' : '') + '[' + label + '][' + refLabel + ']',
                end: i
            };
        }
        return null;
    }
    function parseAutolink(text, start) {
        if (text[start] !== '<') return null;
        let i = start + 1;
        let hasAt = false;
        while (i < text.length && text[i] !== '>' && text[i] !== ' ' && text[i] !== '\n') {
            if (text[i] === '@') hasAt = true;
            i++;
        }
        if (i >= text.length || text[i] !== '>') return null;
        const dest = text.slice(start + 1, i);
        if (hasAt) {
            if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(dest)) {
                return null;
            }
            return {
                html: '<a href="mailto:' + escapeHtml(dest) + '">' + escapeHtml(dest) + '</a>',
                end: i + 1
            };
        } else {
            if (!/^https?:\/\/[^\s]+$/.test(dest)) {
                return null;
            }
            return {
                html: '<a href="' + escapeHtml(dest) + '">' + escapeHtml(dest) + '</a>',
                end: i + 1
            };
        }
    }
    function parseRawHtmlTag(text, start) {
        const tagMatch = text.slice(start).match(/^<([a-zA-Z][a-zA-Z0-9]*)\s*>/);
        if (tagMatch) {
            return {
                html: tagMatch[0],
                end: start + tagMatch[0].length
            };
        }
        return null;
    }
    function parseExtendedAutolink(text, start) {
        let isHttps = false;
        if (text.slice(start, start + 8) === 'https://') {
            isHttps = true;
        } else if (text.slice(start, start + 7) !== 'http://') {
            return null;
        }
        let i = start + (isHttps ? 8 : 7);
        while (i < text.length) {
            const ch = text[i];
            if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') break;
            if (ch === '"' || ch === "'" || ch === ')' || ch === ']' || ch === '}' || ch === '>') break;
            if (ch === '&') break;
            i++;
        }
        if (i <= start + (isHttps ? 8 : 7)) return null;
        const url = text.slice(start, i);
        if (!/^https?:\/\/.+$/.test(url)) return null;
        return {
            html: '<a href="' + escapeHtml(url) + '">' + escapeHtml(url) + '</a>',
            end: i
        };
    }
    function parseEmphasis(text, start) {
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
        if (text[start] === '*' || text[start] === '_') {
            const marker = text[start];
            if (marker === '_') {
                const prevChar = start > 0 ? text[start - 1] : '';
                const nextChar = start + 1 < text.length ? text[start + 1] : '';
                const isPrevAlphaNum = /[a-zA-Z0-9]/.test(prevChar);
                const isNextAlphaNum = /[a-zA-Z0-9]/.test(nextChar);
                if (isPrevAlphaNum && isNextAlphaNum) {
                    return null;
                }
            }
            let closeIndex = -1;
            for (let j = start + 1; j < text.length; j++) {
                if (text[j] === marker) {
                    if (j + 1 < text.length && text[j + 1] === marker) continue;
                    if (j - 1 >= start && text[j - 1] === marker) continue;
                    if (marker === '_') {
                        const prevCloseChar = j > 0 ? text[j - 1] : '';
                        const nextCloseChar = j + 1 < text.length ? text[j + 1] : '';
                        const isPrevCloseAlphaNum = /[a-zA-Z0-9]/.test(prevCloseChar);
                        const isNextCloseAlphaNum = /[a-zA-Z0-9]/.test(nextCloseChar);
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
    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    function parseTable(lines, start) {
        const headerLine = lines[start];
        if (start + 1 >= lines.length) return null;
        const delimiterLine = lines[start + 1];
        const delimMatch = delimiterLine.match(/^\|? *(:?-+:?)( *\| *:?-+:?)* *\|? *$/);
        if (!delimMatch) return null;
        const alignParts = delimiterLine.split('|').map(p => p.trim()).filter(p => p !== '');
        const alignments = alignParts.map(p => {
            if (p.startsWith(':') && p.endsWith(':')) return 'center';
            if (p.endsWith(':')) return 'right';
            return 'left';
        });
        const headerCells = headerLine.split('|').map(c => c.trim());
        if (headerCells[0] === '') headerCells.shift();
        if (headerCells[headerCells.length - 1] === '') headerCells.pop();
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
    function parseBlocks(lines) {
        const blocks = [];
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            if (isBlank(line)) {
                blocks.push({type: 'blank', line: i});
                i++;
                continue;
            }
            const hrMatch = line.match(/^( {0,3})([-*_])([ ]?\2){2,}[ ]*$/);
            if (hrMatch) {
                blocks.push({type: 'thematic_break', line: i});
                i++;
                continue;
            }
            const atxMatch = line.match(/^(#{1,6})[ \t]+(.*)$/);
            if (atxMatch) {
                const level = atxMatch[1].length;
                let content = atxMatch[2];
                content = content.replace(/[ \t]*#+[ \t]*$/, '');
                blocks.push({type: 'heading', level: level, content: content, line: i});
                i++;
                continue;
            }
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                if (/^={1,}[ \t]*$/.test(nextLine)) {
                    blocks.push({type: 'heading', level: 1, content: line.trim(), line: i});
                    i += 2;
                    continue;
                }
                if (/^-{1,}[ \t]*$/.test(nextLine)) {
                    blocks.push({type: 'heading', level: 2, content: line.trim(), line: i});
                    i += 2;
                    continue;
                }
            }
            const indent = getIndentLevel(line);
            if (indent >= 4) {
                const codeLines = [];
                while (i < lines.length) {
                    const codeLine = lines[i];
                    const codeIndent = getIndentLevel(codeLine);
                    if (codeIndent >= 4 || isBlank(codeLine)) {
                        let content = codeLine;
                        if (codeIndent >= 4) {
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
                            content = codeLine.trimEnd();
                        }
                        codeLines.push(content);
                        i++;
                    } else {
                        break;
                    }
                }
                while (codeLines.length > 0 && codeLines[0] === '') codeLines.shift();
                while (codeLines.length > 0 && codeLines[codeLines.length - 1] === '') codeLines.pop();
                blocks.push({type: 'code', content: codeLines.join('\n'), lang: '', line: i - codeLines.length});
                continue;
            }
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
                blocks.push({type: 'code', content: codeLines.join('\n'), lang: lang, line: i - codeLines.length - 1});
                continue;
            }
            if (line.match(/^ {0,3}<(script|pre|style|textarea)[>\s]/i) ||
                line.match(/^ {0,3}<!--/) ||
                line.match(/^ {0,3}<\?/) ||
                line.match(/^ {0,3}<!\[CDATA\[/) ||
                line.match(/^ {0,3}<[a-zA-Z0-9-]+(?:\s+[^>]*)?>\s*$/i) ||
                line.match(/^ {0,3}<\/[a-zA-Z0-9-]+>\s*$/i)) {
                const htmlLines = [];
                let openTags = 0;
                let closed = false;
                while (i < lines.length) {
                    htmlLines.push(lines[i]);
                    const openCount = (lines[i].match(/<[a-zA-Z][^>]*>/g) || []).length;
                    const closeCount = (lines[i].match(/<\/[a-zA-Z][^>]*>/g) || []).length;
                    openTags += openCount - closeCount;
                    if (isBlank(lines[i]) && i + 1 < lines.length) {
                        i++;
                        break;
                    }
                    i++;
                }
                blocks.push({type: 'html', content: htmlLines.join('\n'), line: i - htmlLines.length});
                continue;
            }
            const bqMatch = line.match(/^( {0,3})>([ \t]?)(.*)$/);
            if (bqMatch) {
                const bqLines = [];
                while (i < lines.length) {
                    const bqLine = lines[i];
                    const bqLineMatch = bqLine.match(/^( {0,3})(>+)([ \t]?)(.*)$/);
                    if (bqLineMatch) {
                        const markers = bqLineMatch[2];
                        const content = bqLineMatch[4];
                        bqLines.push({markers: markers.length, content: content});
                        i++;
                    } else if (isBlank(bqLine)) {
                        if (i + 1 < lines.length && lines[i + 1].match(/^ {0,3}>/)) {
                            bqLines.push({markers: 1, content: ''});
                            i++;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                blocks.push({type: 'blockquote', content: bqLines, line: i - bqLines.length});
                continue;
            }
            if (line.includes('|') && !line.match(/^ {4}/)) {
                const tableResult = parseTable(lines, i);
                if (tableResult) {
                    blocks.push(tableResult.block);
                    i = tableResult.nextLine;
                    continue;
                }
            }
            const ulMatch = line.match(/^( {0,3})([-*+])[ \t]+(.*)$/);
            const olMatch = line.match(/^( {0,3})(\d+)\.[ \t]+(.*)$/);
            if (ulMatch || olMatch) {
                const listItems = [];
                const isOrdered = !!olMatch;
                const match = ulMatch || olMatch;
                const baseIndent = match[1].length;
                while (i < lines.length) {
                    const listItem = lines[i];
                    const ulItemMatch = listItem.match(new RegExp(`^ {${baseIndent}}[-*+][ \\t]+(.*)$`));
                    const olItemMatch = listItem.match(new RegExp(`^ {${baseIndent}}\\d+\\.[ \\t]+(.*)$`));
                    if (ulItemMatch || olItemMatch) {
                        let content = ulItemMatch ? ulItemMatch[1] : olItemMatch[1];
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
                        while (i < lines.length) {
                            const contLine = lines[i];
                            const contIndent = getIndentLevel(contLine);
                            if (isBlank(contLine)) {
                                if (i + 1 < lines.length) {
                                    const nextLine = lines[i + 1];
                                    const nextIndent = getIndentLevel(nextLine);
                                    const nextIsUl = nextLine.match(new RegExp(`^ {${baseIndent}}[-*+][ \\t]+`));
                                    const nextIsOl = nextLine.match(new RegExp(`^ {${baseIndent}}\\d+\\.[ \\t]+`));
                                    const nextIsSameTypeList = nextIndent === baseIndent &&
                                        (isOrdered ? nextIsOl : nextIsUl);
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
                                const nestedUlMatch = contLine.match(/^ +([-*+])[ \t]+(.*)$/);
                                const nestedOlMatch = contLine.match(/^ +(\d+)\.[ \t]+(.*)$/);
                                if (nestedUlMatch || nestedOlMatch) {
                                    const nestedLines = [];
                                    const nestedBaseIndent = nestedUlMatch ? nestedUlMatch[1].length : nestedOlMatch[1].length;
                                    while (i < lines.length) {
                                        const nestedLine = lines[i];
                                        const nestedIndent = getIndentLevel(nestedLine);
                                        if (nestedIndent <= baseIndent && !isBlank(nestedLine)) {
                                            break;
                                        }
                                        const anyUlMatch = nestedLine.match(/^( +)([-*+])[ \t]+/);
                                        const anyOlMatch = nestedLine.match(/^( +)(\d+)\.[ \t]+/);
                                        if (anyUlMatch || anyOlMatch) {
                                            const itemIndent = anyUlMatch ? anyUlMatch[1].length : anyOlMatch[1].length;
                                            const normalizedIndent = Math.max(0, itemIndent - nestedBaseIndent);
                                            const normalizedLine = ' '.repeat(normalizedIndent) + nestedLine.trimStart();
                                            nestedLines.push(normalizedLine);
                                            i++;
                                        } else if (nestedIndent > nestedBaseIndent || isBlank(nestedLine)) {
                                            const normalizedIndent = Math.max(0, nestedIndent - nestedBaseIndent);
                                            const normalizedLine = ' '.repeat(normalizedIndent) + nestedLine.trimStart();
                                            nestedLines.push(normalizedLine);
                                            i++;
                                        } else {
                                            break;
                                        }
                                    }
                                    const nestedBlocks = parseBlocks(nestedLines);
                                    const nestedHtml = renderBlocks(nestedBlocks);
                                    listItems[listItems.length - 1].subContent.push('__NESTED_LIST__:' + nestedHtml);
                                } else {
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
            const paraLines = [];
            while (i < lines.length) {
                const paraLine = lines[i];
                if (isBlank(paraLine)) {
                    i++;
                    break;
                }
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
                const content = paraLines.join('\n');
                blocks.push({type: 'paragraph', content: content, line: i - paraLines.length});
            }
        }
        return blocks;
    }
    function renderNestedBlockquotes(bqLines) {
        if (!bqLines || bqLines.length === 0) return '';
        let html = '';
        let i = 0;
        while (i < bqLines.length) {
            const line = bqLines[i];
            const level = line.markers;
            let openTags = '';
            for (let l = 0; l < level; l++) {
                openTags += '<blockquote>\n';
            }
            let contentLines = [];
            let j = i;
            while (j < bqLines.length) {
                const currentLine = bqLines[j];
                if (currentLine.markers >= level) {
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
            const contentText = contentLines.join('\n');
            if (contentText.includes('\n>') || contentText.startsWith('>')) {
                const nestedLines = contentText.split('\n');
                const nestedBlocks = parseBlocks(nestedLines);
                const nestedHtml = renderBlocks(nestedBlocks);
                html += openTags + nestedHtml;
            } else {
                const parsedContent = parseInline(contentText);
                html += openTags + '<p>' + parsedContent + '</p>\n';
            }
            for (let l = 0; l < level; l++) {
                html += '</blockquote>\n';
            }
            i = j;
        }
        return html;
    }
    function renderBlocks(blocks) {
        let html = '';
        for (const block of blocks) {
            switch (block.type) {
                case 'blank':
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
                    html += renderNestedBlockquotes(block.content);
                    break;
                case 'unordered_list':
                    html += '<ul>\n';
                    for (const item of block.items) {
                        const itemContent = parseInline(item.content);
                        let subHtml = '';
                        if (item.subContent.length > 0) {
                            for (const sub of item.subContent) {
                                if (typeof sub === 'string' && sub.startsWith('__NESTED_LIST__:')) {
                                    subHtml += sub.substring('__NESTED_LIST__:'.length);
                                } else {
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
                            for (const sub of item.subContent) {
                                if (typeof sub === 'string' && sub.startsWith('__NESTED_LIST__:')) {
                                    subHtml += sub.substring('__NESTED_LIST__:'.length);
                                } else {
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
    function parseMarkdown(markdown) {
        if (!markdown) return '';
        markdown = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = markdown.split('\n');
        const blocks = parseBlocks(lines);
        let html = renderBlocks(blocks);
        html = html.trim();
        html = sanitizeHtml(html);
        return html;
    }
    function sanitizeHtml(html) {
        const allowedTags = new Set([
            'p', 'b', 'i', 'em', 'strong', 'a', 'code', 'pre', 'blockquote',
            'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'br', 'hr',
            'del', 'input', 'span', 'div'
        ]);
        const allowedAttributes = new Map([
            ['a', new Set(['href', 'title'])],
            ['img', new Set(['src', 'alt', 'class', 'data-src'])],
            ['code', new Set(['class'])],
            ['th', new Set(['align'])],
            ['td', new Set(['align'])],
            ['input', new Set(['type', 'disabled', 'checked'])]
        ]);
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const elements = doc.body.querySelectorAll('*');
            for (const el of elements) {
                const tagName = el.tagName.toLowerCase();
                if (!allowedTags.has(tagName)) {
                    const parent = el.parentNode;
                    while (el.firstChild) {
                        parent.insertBefore(el.firstChild, el);
                    }
                    parent.removeChild(el);
                    continue;
                }
                const allowedAttrs = allowedAttributes.get(tagName) || new Set();
                const attrsToRemove = [];
                for (const attr of el.attributes) {
                    if (!allowedAttrs.has(attr.name.toLowerCase())) {
                        attrsToRemove.push(attr.name);
                    }
                }
                attrsToRemove.forEach(attrName => el.removeAttribute(attrName));
                if (tagName === 'a' && el.hasAttribute('href')) {
                    const href = el.getAttribute('href');
                    if (href.startsWith('javascript:') || href.startsWith('data:')) {
                        el.removeAttribute('href');
                    }
                }
                if (tagName === 'img' && el.hasAttribute('src')) {
                    const src = el.getAttribute('src');
                    if (src.startsWith('javascript:') || src.startsWith('data:')) {
                        el.removeAttribute('src');
                    }
                }
                if (tagName === 'input' && el.hasAttribute('type')) {
                    const type = el.getAttribute('type');
                    if (type !== 'checkbox') {
                        el.setAttribute('type', 'checkbox');
                    }
                }
            }
            return doc.body.innerHTML;
        } catch (err) {
            console.warn('HTML sanitization failed, stripping tags:', err);
            return html.replace(/<[^>]*>/g, '');
        }
    }
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
                value = value.replace(/^["']|["']$/g, '');
                frontmatter[key.trim()] = value;
            }
        });
        return {frontmatter, content: body};
    }
    if (typeof window !== 'undefined') {
        window.parseMarkdown = parseMarkdown;
        window.parseFrontmatter = parseFrontmatter;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {parseMarkdown, parseFrontmatter};
    }
})();
