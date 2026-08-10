---
title: "Rewriting The Shitty Markdown Renderer Slop"
date: "Jul 28 2026"
category: "Blog"
icon: "📄"
---

**Hi everyone**, it's me again. So, you know how I was trying to be all smart and technical with the website? Yeah, well... I kind of made a huge mess. Like, a *really* big mess. 

## The "Wait, Why is Everything Code?" Disaster

So, I was editing that post about DNS for iOS sideloading (the one with all those Apple server things like `appattest.apple.com` and stuff). I just wanted to put those server names in a nice little code box, you know? To make them look neat.

I typed this:

```
appattest.apple.com
certs.apple.com
crl.apple.com
ocsp.apple.com
ocsp2.apple.com
valid.apple.com
vpp.itunes.apple.com
```

Simple, right? Just some triple backticks, the text, and close it up. Easy peasy.

But when I looked at the page... OH MY GOD. 😱

Everything after that code block turned into code too! Like, *everything*. The rest of my article, the footer, probably even my secret thoughts (okay maybe not that last part, but it felt like it!). It was like I opened a code block portal and forgot to close it, and the whole page just fell in.

I was panicking! I thought, "Did I delete half my file? Did I accidentally speak in binary?" I checked the markdown file a hundred times. It looked fine! The backticks were there, closing properly. Or so I thought.

## My Clumsy Investigation

Turns out, the problem wasn't my typing (for once! high five!). The problem was how our little website *reads* the markdown. 

See, I (being the genius I am) had written some custom code in `app.js` to handle markdown rendering because I thought, "Hey, why use a library when I can write my own buggy version?" Classic me.

The old code was kinda dumb. It was looking for triple backticks (\`\`\`) to start a code block, but it wasn't very strict about where they could be. If there was no clear "newline" after the opening \`\`\`, or if it got confused about where the closing \`\`\` was, it would just say "Eh, close enough!" and treat the rest of the page as code. 

It was like telling someone, "Stop talking when I say 'banana'," but then they never hear "banana" so they just talk forever. Forever! In code font!

## The Fix (After Many Tears)

Okay, so after crying a little bit (okay, maybe a lot) and drinking like three bubble teas, I finally figured it out. 

Markdown has rules! Actual, proper rules! And one of them is that code blocks need to be on their own lines. You can't just slap \`\`\` in the middle of a sentence and expect magic.

So I rewrote the renderer in `app.js` to actually follow the real markdown standard. Here's what I changed (try to stay awake):

1. **Strict Newline Checking**: Now, the code *demands* that there's a newline character right after the opening \`\`\`. No more "oh, I guess this counts." If it's not on its own line, it's not a code block. Period.
2. **Proper Closing**: Same thing for the closing \`\`\`. It has to be on its own line too. No cheating!
3. **No More Greedy Matching**: The old code was super greedy. It would grab everything from the first \`\`\` to the end of the universe if it could. Now it stops at the *first* valid closing \`\`\` it finds. Like a good little parser should.
4. **Inline Code Too**: I also fixed inline code (the single backtick stuff like `this`). Turns out, I was messing that up too. Whoops.

## Testing Until My Eyes Crossed

I didn't just fix it and hope for the best (even though that's usually my strategy). I actually tested it! Like, a lot.

I made test files with:

- Normal code blocks (the ones that work)
- Broken code blocks (the ones that broke everything before)
- Inline code mixed with blocks
- Headers, bold, italic, links, images (you name it)
- Even some weird edge cases like code blocks at the very start or end of a file

And you know what? It all works now! 🎉 

The code blocks actually close properly. The rest of the text stays normal. The world hasn't ended. I can sleep at night again.

## What This Means for You

If you're reading this, you probably won't notice anything different except that the code boxes actually work now. But for me, it's a huge relief. No more accidental infinite code blocks. No more panic attacks when I see my entire blog post in monospace font.

Also, I learned something important: maybe next time I should just use a proper markdown library instead of trying to be a hero. But where's the fun in that? And how else would I learn to cry over regex patterns?

## Sorry for the Confusion!

If you visited the site while I was debugging this, sorry if you saw a bunch of weird code-formatted text. I promise it's fixed now. And I promise to be more careful next time (though let's be real, I'll probably break something else soon).

Thanks for bearing with my clumsiness! 💕

Until next time (when I inevitably break something else), A very embarrassed but slightly wiser developer

P.S. If you see any other weird formatting issues, please tell me! But gently, okay? I'm still recovering from this trauma. 😅
