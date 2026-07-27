const fs = require('fs');

// Test markdown content - simulating the michelle-dns-for-ios-sideloading.md content after frontmatter removal
const markdown = `## Bypassing iOS certificate checking mechanism
When iOS apps are installed through official Apple developer provisioned certificates, certain domains are contacted by iOS to do verification of apps as follows:

\`\`\`
appattest.apple.com
certs.apple.com
crl.apple.com
ocsp.apple.com
ocsp2.apple.com
valid.apple.com
vpp.itunes.apple.com
\`\`\`

(courtesy to Khoindvn.io Discord server and r/sideloaded)

These domains are used to verify the legitimacy of the certificates being used to sign these apps. This means that simply blocking them would allow the usage of leaked enterprise certificates that is not bound with \`\`\`PPQCheck\`\`\` and we will get back to that because it is important.
`;

console.log("=== INPUT MARKDOWN ===");
console.log(markdown);
console.log("\n=== TESTING DIFFERENT REGEX PATTERNS ===\n");

// Current pattern in app.js
let html1 = markdown;
html1 = html1.replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>');
console.log("Pattern 1 (current - requires newline before closing):");
console.log(html1);
console.log("\n---\n");

// Standard markdown pattern - closing ``` can be on its own line
let html2 = markdown;
html2 = html2.replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>');
console.log("Pattern 2 (standard - closes at newline+backticks):");
console.log(html2);
console.log("\n---\n");

// More permissive pattern
let html3 = markdown;
html3 = html3.replace(/```(\w*)\n([\s\S]*?)(?=\n```)/g, '<pre><code>$2</code></pre>');
console.log("Pattern 3 (lookahead for closing):");
console.log(html3);
console.log("\n---\n");

// Let's also test what happens with inline triple backticks
const inlineTest = "bound with ```PPQCheck``` and we will";
let html4 = inlineTest;
html4 = html4.replace(/```([^`\n]+)```/g, '<code>$1</code>');
console.log("Inline triple backtick test:");
console.log("Input:", inlineTest);
console.log("Output:", html4);
