const fs = require('fs');

const markdown = fs.readFileSync('./blog/michelle-dns-for-ios-sideloading.md', 'utf8');
const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)/;
const match = markdown.match(frontmatterRegex);
const content = match ? match[2] : markdown;

let html = markdown;

// Escape HTML
html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Code blocks
html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>');

// Inline code with triple backticks
html = html.replace(/```([^`\n]+)```/g, '<code>$1</code>');

// Headers
html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

// Paragraphs
html = html.replace(/\n\n/g, '</p>\n<p>');
html = '<p>' + html + '</p>';

console.log("=== AFTER PARAGRAPH WRAPPING ===");
const preStart = html.indexOf('<pre>');
const preEnd = html.indexOf('</pre>') + 7;
console.log("Code block section:");
console.log(JSON.stringify(html.substring(preStart - 50, preEnd + 50)));
console.log("\n\nLooking for the pattern that breaks it:");
console.log("Pattern: </pre><");
const brokenIdx = html.indexOf('</pre><');
if (brokenIdx !== -1) {
    console.log("Found at index:", brokenIdx);
    console.log("Context:", JSON.stringify(html.substring(brokenIdx - 10, brokenIdx + 30)));
}

// The issue is the paragraph cleanup regex is matching </pre></p> and replacing it incorrectly
// Let's check what the second cleanup regex does
console.log("\n\n=== TESTING SECOND CLEANUP REGEX ===");
const testStr = "</pre></p>";
const regex = /<(\/h[1-6]|\/ul|\/ol|\/li|\/pre|\/blockquote)>\s*<\/p>/g;
console.log("Input:", JSON.stringify(testStr));
console.log("Match:", testStr.match(regex));
console.log("Replace result:", testStr.replace(regex, '</$1>'));
