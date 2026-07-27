const fs = require('fs');

// Read the actual file
const markdown = fs.readFileSync('./blog/michelle-dns-for-ios-sideloading.md', 'utf8');

// Remove frontmatter first
const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)/;
const match = markdown.match(frontmatterRegex);
const content = match ? match[2] : markdown;

console.log("=== CONTENT AFTER FRONTMATTER REMOVAL (first 1500 chars) ===");
console.log(content.substring(0, 1500));
console.log("\n=== END FIRST PART ===\n");

function parseMarkdown(markdown) {
    if (!markdown) return '';
    
    let html = markdown;
    
    // Escape HTML
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Code blocks (must be before other replacements)
    // Handle code blocks with optional language specifier - must have newline after opening ```
    html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>');
    
    console.log("=== AFTER CODE BLOCK PROCESSING (relevant section) ===");
    const codeBlockIdx = html.indexOf('<pre><code>');
    if (codeBlockIdx !== -1) {
        console.log(html.substring(codeBlockIdx - 100, codeBlockIdx + 300));
    }
    console.log("\n=== END CODE BLOCK SECTION ===\n");
    
    // Inline code with triple backticks (must be before single backtick inline code)
    html = html.replace(/```([^`\n]+)```/g, '<code>$1</code>');
    
    console.log("=== AFTER INLINE TRIPLE BACKTICK (PPQCheck section) ===");
    const ppqIdx = html.indexOf('PPQCheck');
    if (ppqIdx !== -1) {
        console.log(html.substring(ppqIdx - 100, ppqIdx + 200));
    }
    console.log("\n=== END PPQCHECK SECTION ===\n");
    
    return html;
}

const html = parseMarkdown(content);

// Check if there's any remaining unprocessed triple backticks
const remainingBackticks = html.match(/```/g);
if (remainingBackticks) {
    console.log("WARNING: Found", remainingBackticks.length, "remaining triple backticks in output!");
    console.log("This indicates incomplete processing.");
} else {
    console.log("SUCCESS: All triple backticks were processed correctly.");
}

// Show a larger portion to verify nothing is incorrectly wrapped
console.log("\n=== FULL OUTPUT SECTION AROUND CODE BLOCK ===");
const preIdx = html.indexOf('<pre><code>');
if (preIdx !== -1) {
    const endPreIdx = html.indexOf('</code></pre>', preIdx);
    if (endPreIdx !== -1) {
        console.log("Before code block:");
        console.log(html.substring(preIdx - 200, preIdx));
        console.log("\nCode block content:");
        console.log(html.substring(preIdx, endPreIdx + 13));
        console.log("\nAfter code block:");
        console.log(html.substring(endPreIdx + 13, endPreIdx + 400));
    }
}
