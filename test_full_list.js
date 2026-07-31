// Full test to render markdown and check list output
const fs = require('fs');

// Load markdown.js 
const mdjsContent = fs.readFileSync('/workspace/js/markdown.js', 'utf8');

// Create a minimal test environment with window object
const vm = require('vm');
const sandbox = {
    console: console,
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval,
    window: {}
};

vm.createContext(sandbox);
vm.runInContext(mdjsContent, sandbox);

// Get the parseMarkdown function from window
const parseMarkdown = sandbox.window.parseMarkdown;

// Test with a simple ordered list
const testMd = `1. First item
2. Second item
3. Third item
4. Fourth item`;

console.log("Test input:");
console.log(testMd);
console.log("\n---\n");

if (parseMarkdown) {
    const result = parseMarkdown(testMd);
    console.log("Rendered output:");
    console.log(result);
} else {
    console.log("parseMarkdown function not found.");
}
