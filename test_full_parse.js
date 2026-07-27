const fs = require('fs');

// Full markdown content from the file (after frontmatter)
const markdown = `## Signing iOS apps legally
It has been known that installing apps from outside the Apple's Appstore ecosystem is iffy but it might be circumvented. The current "official" supported method to install apps through Altstore and Sidestore requires the need to use containerisation to keep more than 3 apps installed at once. Not to forget that these solution will be broken each time an iOS update is performed. There is one method through DNS. 

## Bypassing iOS certificate checking mechanism
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

These domains are used to verify the legitimacy of the certificates being used to sign these apps. This means that simply blocking them would allow the usage of leaked enterprise certificates that is not bound with \`\`\`PPQCheck\`\`\` and we will get back to that because it is important. With this mechanism bypassed, you can benefit on leaked enterprise certificates to install apps outside Appstore like this:
`;

function parseMarkdown(markdown) {
    if (!markdown) return '';
    
    let html = markdown;
    
    // Escape HTML
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    console.log("=== After HTML escape ===");
    console.log(html.substring(0, 500));
    console.log("\n---\n");
    
    // Code blocks (must be before other replacements)
    // Handle code blocks with optional language specifier - must have newline after opening ```
    html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>');
    
    console.log("=== After code block processing ===");
    console.log(html.substring(0, 800));
    console.log("\n---\n");
    
    // Inline code with triple backticks (must be before single backtick inline code)
    html = html.replace(/```([^`\n]+)```/g, '<code>$1</code>');
    
    console.log("=== After inline triple backtick processing ===");
    console.log(html);
    console.log("\n---\n");
    
    return html;
}

parseMarkdown(markdown);
