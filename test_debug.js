const fs = require('fs');

const markdown = fs.readFileSync('./blog/michelle-dns-for-ios-sideloading.md', 'utf8');
const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)/;
const match = markdown.match(frontmatterRegex);
const content = match ? match[2] : markdown;

function parseMarkdownDebug(markdown) {
    if (!markdown) return '';
    
    let html = markdown;
    let step = 0;
    
    function showState(label) {
        step++;
        const preMatch = html.match(/<pre>.*?<\/pre>/s);
        if (preMatch) {
            console.log(`Step ${step} (${label}): <pre> block = ${JSON.stringify(preMatch[0])}`);
        }
    }
    
    // Escape HTML
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    showState("After HTML escape");
    
    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>');
    showState("After code block");
    
    // Inline code with triple backticks
    html = html.replace(/```([^`\n]+)```/g, '<code>$1</code>');
    showState("After inline triple backtick");
    
    // Headers
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    showState("After headers");
    
    // Paragraphs
    html = html.replace(/\n\n/g, '</p>\n<p>');
    html = '<p>' + html + '</p>';
    showState("After paragraph wrapping");
    
    // Clean up - THIS IS WHERE THE BUG IS
    console.log("\nBefore cleanup regex:");
    console.log(html.substring(html.indexOf('<pre>'), html.indexOf('</pre>') + 7));
    
    html = html.replace(/<p>\s*<(h[1-6]|ul|ol|li|pre|blockquote)/g, '<$1');
    console.log("\nAfter first cleanup regex:");
    console.log(html.substring(html.indexOf('<pre>') || 0, (html.indexOf('</pre>') || 0) + 7));
    
    html = html.replace(/<(\/h[1-6]|\/ul|\/ol|\/li|\/pre|\/blockquote)>\s*<\/p>/g, '</$1>');
    console.log("\nAfter second cleanup regex:");
    console.log(html.substring(html.indexOf('<pre>') || 0, (html.indexOf('</pre>') || 0) + 7));
    
    return html;
}

parseMarkdownDebug(content);
