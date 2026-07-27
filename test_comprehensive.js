const fs = require('fs');

// Test cases for markdown code block parsing
const testCases = [
    {
        name: "Standard fenced code block",
        input: "Some text\n\n```\ncode line 1\ncode line 2\n```\n\nMore text",
        expectedCodeBlock: true,
        expectedContent: "code line 1\ncode line 2"
    },
    {
        name: "Code block with language specifier",
        input: "Text\n\n```javascript\nconst x = 1;\n```\n\nMore",
        expectedCodeBlock: true,
        expectedContent: "const x = 1;"
    },
    {
        name: "Inline triple backticks",
        input: "Text with ```inline code``` here",
        expectedInlineCode: true,
        expectedContent: "inline code"
    },
    {
        name: "Multiple inline triple backticks",
        input: "First ```code1``` and second ```code2``` end",
        expectedMultipleInline: true
    },
    {
        name: "Mixed code block and inline",
        input: "Intro\n\n```\nblock code\n```\n\nThen ```inline``` code",
        expectedBoth: true
    },
    {
        name: "Michelle DNS case",
        input: "as follows:\n\n```\nappattest.apple.com\ncerts.apple.com\n```\n\n(courtesy...) bound with ```PPQCheck``` and",
        expectedMichelleCase: true
    }
];

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
    
    return html;
}

console.log("=== COMPREHENSIVE MARKDOWN CODE BLOCK TESTS ===\n");

let passed = 0;
let failed = 0;

testCases.forEach((test, idx) => {
    console.log(`Test ${idx + 1}: ${test.name}`);
    console.log("Input:", JSON.stringify(test.input));
    
    const output = parseMarkdown(test.input);
    console.log("Output:", JSON.stringify(output));
    
    let testPassed = true;
    
    if (test.expectedCodeBlock) {
        if (!output.includes('<pre><code>')) {
            console.log("❌ FAIL: Expected <pre><code> tag");
            testPassed = false;
        }
        if (test.expectedContent && !output.includes(test.expectedContent)) {
            console.log(`❌ FAIL: Expected content "${test.expectedContent}"`);
            testPassed = false;
        }
    }
    
    if (test.expectedInlineCode) {
        if (!output.includes('<code>')) {
            console.log("❌ FAIL: Expected <code> tag");
            testPassed = false;
        }
        if (test.expectedContent && !output.includes(test.expectedContent)) {
            console.log(`❌ FAIL: Expected content "${test.expectedContent}"`);
            testPassed = false;
        }
    }
    
    if (test.expectedMultipleInline) {
        const codeTags = (output.match(/<code>/g) || []).length;
        if (codeTags !== 2) {
            console.log(`❌ FAIL: Expected 2 <code> tags, got ${codeTags}`);
            testPassed = false;
        }
    }
    
    if (test.expectedBoth) {
        if (!output.includes('<pre><code>')) {
            console.log("❌ FAIL: Expected <pre><code> for block");
            testPassed = false;
        }
        // Count code tags - should have 1 in pre and 1 inline = 2 total
        const codeTags = (output.match(/<code>/g) || []).length;
        if (codeTags !== 2) {
            console.log(`❌ FAIL: Expected 2 <code> tags (1 block + 1 inline), got ${codeTags}`);
            testPassed = false;
        }
    }
    
    if (test.expectedMichelleCase) {
        // Check that the code block only contains the domains
        const preMatch = output.match(/<pre><code>(.*?)<\/code><\/pre>/s);
        if (!preMatch) {
            console.log("❌ FAIL: No code block found");
            testPassed = false;
        } else {
            const blockContent = preMatch[1];
            if (blockContent.includes('courtesy') || blockContent.includes('PPQCheck')) {
                console.log("❌ FAIL: Code block contains content it shouldn't");
                testPassed = false;
            }
            if (!blockContent.includes('appattest.apple.com')) {
                console.log("❌ FAIL: Code block missing expected domain");
                testPassed = false;
            }
        }
        // Check inline code for PPQCheck
        if (!output.includes('<code>PPQCheck</code>')) {
            console.log("❌ FAIL: PPQCheck not properly wrapped in inline code");
            testPassed = false;
        }
        // Make sure no triple backticks remain
        if (output.includes('```')) {
            console.log("❌ FAIL: Triple backticks remain in output");
            testPassed = false;
        }
    }
    
    if (testPassed) {
        console.log("✅ PASS\n");
        passed++;
    } else {
        console.log("❌ FAIL\n");
        failed++;
    }
});

console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
