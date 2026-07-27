const fs = require('fs');

// Read the actual file
const markdown = fs.readFileSync('./blog/michelle-dns-for-ios-sideloading.md', 'utf8');

// Remove frontmatter first
const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)/;
const match = markdown.match(frontmatterRegex);
const content = match ? match[2] : markdown;

function parseMarkdown(markdown) {
    if (!markdown) return '';
    
    let html = markdown;
    
    // Escape HTML
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Code blocks (must be before other replacements)
    // Handle code blocks with optional language specifier - must have newline after opening ```
    html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>');
    
    // Inline code with triple backticks (must be before single backtick inline code)
    html = html.replace(/```([^`\n]+)```/g, '<code>$1</code>');
    
    // Inline code with single backticks
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Headers
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    
    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    
    // Unordered lists
    html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^(<li>.+<\/li>\n?)+/gm, '<ul>$&</ul>');
    
    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    
    // Paragraphs (simple approach - wrap remaining text blocks)
    html = html.replace(/\n\n/g, '</p>\n<p>');
    html = '<p>' + html + '</p>';
    
    // Clean up empty paragraphs and fix paragraph wrapping around block elements
    html = html.replace(/<p>\s*<(h[1-6]|ul|ol|li|pre|blockquote)/g, '<$1');
    html = html.replace(/<(\/h[1-6]|\/ul|\/ol|\/li|\/pre|\/blockquote)>\s*<\/p>/g, '<$1>');
    html = html.replace(/<p><\/p>/g, '');
    
    return html;
}

const html = parseMarkdown(content);

console.log("=== CODE BLOCK SECTION ===");
const preMatch = html.match(/<pre><code>[\s\S]*?<\/code><\/pre>/);
if (preMatch) {
    console.log(preMatch[0]);
} else {
    console.log("No code block found!");
}

console.log("\n=== PPQCHECK INLINE CODE SECTIONS ===");
const inlineMatches = html.match(/<code>PPQCheck<\/code>/g);
console.log(`Found ${inlineMatches ? inlineMatches.length : 0} occurrences of <code>PPQCheck</code>`);

console.log("\n=== VALIDATION ===");
const preCount = (html.match(/<pre>/g) || []).length;
const preCloseCount = (html.match(/<\/pre>/g) || []).length;
const codeCount = (html.match(/<code>/g) || []).length;
const codeCloseCount = (html.match(/<\/code>/g) || []).length;
const remainingBackticks = (html.match(/```/g) || []).length;
const brokenTags = (html.match(/<\/\/\w+>/g) || []).length;

console.log(`<pre> tags: ${preCount} open, ${preCloseCount} close`);
console.log(`<code> tags: ${codeCount} open, ${codeCloseCount} close`);
console.log(`Remaining triple backticks: ${remainingBackticks}`);
console.log(`Broken tags (<//...>): ${brokenTags}`);

if (preCount !== preCloseCount || codeCount !== codeCloseCount || remainingBackticks > 0 || brokenTags > 0) {
    console.log("⚠️  WARNING: There may be rendering issues!");
    process.exit(1);
} else {
    console.log("✅ All tags are properly balanced and no broken tags found!");
    process.exit(0);
}
