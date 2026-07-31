// Test to verify list rendering issue
const fs = require('fs');

// Read the markdown file
const mdContent = fs.readFileSync('/workspace/blog/markdown-disaster-fixed.md', 'utf8');

// Find the numbered list section
const listMatch = mdContent.match(/(1\. \*\*.*\n(?:\n)?2\. \*\*.*\n(?:\n)?3\. \*\*.*\n(?:\n)?4\. \*\*.*)/);
if (listMatch) {
    console.log("Found numbered list in markdown:");
    console.log(listMatch[0]);
    console.log("\n---\n");
}

// Check if markdown.js is being used correctly
console.log("Checking if markdown.js exists...");
try {
    const mdjs = fs.readFileSync('/workspace/js/markdown.js', 'utf8');
    console.log("markdown.js exists, length:", mdjs.length);
    
    // Check for ordered list rendering
    if (mdjs.includes('<ol>\\n')) {
        console.log("Found <ol> rendering in markdown.js");
    }
    if (mdjs.includes('<ul>\\n')) {
        console.log("Found <ul> rendering in markdown.js");
    }
} catch(e) {
    console.log("Error:", e.message);
}
