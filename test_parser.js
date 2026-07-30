// Test script to verify markdown parser compatibility with marked
const fs = require('fs');

// Load marked library using ESM version
const { marked } = require('./node_modules/marked/lib/marked.esm.js');

console.log("Marked loaded:", typeof marked, typeof marked.parse);

// Load custom parser
const customParserCode = fs.readFileSync('/workspace/js/markdown.js', 'utf8');

function createCustomParser() {
    const vm = require('vm');
    const sandbox = { window: {}, document: {} };
    vm.createContext(sandbox);
    vm.runInContext(customParserCode, sandbox);
    return sandbox.window.parseMarkdown || sandbox.parseMarkdown;
}

// Test cases based on GFM spec
const testCases = [
    {
        name: "Hard Line Breaks",
        input: "Line 1  \nLine 2  \nLine 3",
        description: "Two spaces at end of line should create <br>"
    },
    {
        name: "Blockquote Multi-line",
        input: "> This is a quote\n> with multiple lines",
        description: "Multi-line blockquote should preserve line breaks"
    },
    {
        name: "Table Basic",
        input: "| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |",
        description: "Basic GFM table"
    },
    {
        name: "Table With Alignment",
        input: "| Left | Center | Right |\n|:-----|:------:|------:|\n| A    | B      | C     |",
        description: "Table with alignment specifiers"
    }
];

console.log("\nTesting markdown parsers...\n");

try {
    const customParse = createCustomParser();
    console.log("Custom parser loaded:", typeof customParse);
    
    testCases.forEach(test => {
        console.log(`\n=== ${test.name} ===`);
        console.log(`Input: ${JSON.stringify(test.input)}`);
        console.log(`Description: ${test.description}`);
        
        let markedOutput, customOutput;
        
        try {
            markedOutput = marked.parse(test.input);
        } catch (e) {
            markedOutput = "ERROR: " + e.message;
        }
        
        try {
            customOutput = customParse ? customParse(test.input) : "PARSER NOT AVAILABLE";
        } catch (e) {
            customOutput = "ERROR: " + e.message;
        }
        
        console.log("\nMarked output:");
        console.log(markedOutput.trim());
        
        console.log("\nCustom output:");
        console.log(customOutput.trim());
        
        console.log("\nMatch:", markedOutput.trim() === customOutput.trim() ? "✅ PASS" : "❌ FAIL");
    });
} catch (e) {
    console.error("Error running tests:", e.message);
    console.error(e.stack);
}
