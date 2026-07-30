---
title: "The Complete Markdown Feature Showcase"
date: "2026-07-30"
description: "A comprehensive blog post demonstrating every markdown feature available in GFM"
tags: ["markdown", "tutorial", "guide"]
---

# The Ultimate Markdown Guide

Welcome to this comprehensive guide that demonstrates **every single markdown feature** you can use in your writing. Whether you're a beginner or looking to master advanced formatting, this post has it all.

## ATX Headings (H1 through H6)

We've already seen the H1 above. Let's explore the rest of the ATX heading styles:

### This is an H3 Heading

#### This is an H4 Heading

##### This is an H5 Heading

###### This is an H6 Heading - The Smallest Standard Heading

## Setext Style Headings

Setext headings use underlines instead of hash symbols. Here's how they look:

This is a Setext H1
===================

This is a Setext H2
-------------------

Note: Setext headings only support H1 and H2 levels.

---

## Thematic Breaks (Horizontal Rules)

You can create horizontal rules using three or more dashes, asterisks, or underscores:

***

___

These breaks help visually separate sections of your content.

## Code Blocks

Markdown supports multiple ways to display code.

### Indented Code Blocks

Indent code by 4 spaces to create a code block:

    function greet(name) {
        console.log("Hello, " + name + "!");
        return true;
    }

### Fenced Code Blocks

Use triple backticks to create fenced code blocks:

```
This is a generic code block without language specification.
It preserves whitespace and formatting exactly as written.
```

### Code with Language Specification

Specify a language for syntax highlighting:

```js
const greeting = (name) => {
    return `Hello, ${name}!`;
};

greeting("World");
```

```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(factorial(5))
```

Inline code is also available using single backticks: `const x = 42` or `pip install package`.

## Blockquotes

Blockquotes are created using the `>` symbol:

> This is a simple blockquote. It's useful for highlighting important information or quoting external sources.

> You can nest blockquotes too:
>
>> This is a nested blockquote level 1
>>
>>> And this is level 2
>>>
>>>> Level 3 goes even deeper!

> **Pro tip:** You can include **bold**, *italic*, and `code` inside blockquotes!

## Lists

Markdown supports various list types.

### Unordered Lists with Dashes

- First item
- Second item
- Third item
- Fourth item

### Unordered Lists with Asterisks

* Item one
* Item two
* Item three
* Item four

### Ordered Lists

1. First step
2. Second step
3. Third step
4. Fourth step

### Nested Lists

Here's where things get interesting with nested structures:

- Main item 1
  - Sub-item 1.1
  - Sub-item 1.2
    - Deeply nested item
      - Even deeper!
  - Sub-item 1.3
- Main item 2
  1. Numbered sub-item
  2. Another numbered sub-item
- Main item 3
  - [ ] Task within a list
  - [x] Completed task within a list

## Inline Formatting

Let's explore all the inline text formatting options:

**Bold text using double asterisks** makes text stand out.

__Bold text using double underscores__ works the same way.

*Italic text using asterisks* adds emphasis.

_Italic text using underscores_ is equally valid.

***Strong emphasis combines bold and italic*** for maximum impact.

~~Strikethrough text~~ shows deleted or outdated content.

You can mix formats: **bold and *italic* together** or ~~strikethrough with `code`~~.

## Links and Images

### Inline Links

[Visit Google](https://www.google.com) is a basic inline link.

### Links with Titles

[MDN Web Docs](https://developer.mozilla.org "Mozilla Developer Network - The ultimate web development resource") includes a title tooltip.

### Images

![Markdown Logo](https://markdown-here.com/images/Logo.png "Markdown Logo with Title")

Images follow the same syntax as links but with an exclamation mark prefix.

### Autolinks

URLs automatically become links: https://github.com

Email addresses also autolink: <support@example.com>

## Raw HTML

Sometimes you need direct HTML control:

<div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px;">
  <strong>This is raw HTML</strong> embedded in your markdown.
  <p>You can use any HTML tags here!</p>
  <span style="color: blue;">Styled text using inline CSS.</span>
</div>

<br>

The `<br>` tag creates line breaks when needed.

## Line Breaks and Paragraphs

This is a paragraph.  
Notice the two spaces at the end of the previous line? That creates a hard line break within the same paragraph.

This is a new paragraph separated by blank lines.

Paragraphs are simply blocks of text separated by one or more blank lines. They form the basic building blocks of your content structure.

## HTML Entities

Special characters can be escaped using HTML entities:

- Ampersand: &amp;
- Less than: &lt;
- Greater than: &gt;
- Copyright: &copy;
- Registered trademark: &reg;

Using &amp;&amp; in code examples requires proper escaping.

## Character Escaping

To display literal markdown characters, use backslash escaping:

\*This won't be italic\* because the asterisks are escaped.

\# This won't be a heading

\[Not a link\]\(url\)

Use \\ to display a literal backslash.

## Tables (GFM Extension)

GitHub Flavored Markdown adds table support:

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data A1  | Data A2  | Data A3  |
| Data B1  | Data B2  | Data B3  |
| Data C1  | Data C2  | Data C3  |

### Table Alignment

| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Item 1       | Item 1         | Item 1        |
| Item 2       | Item 2         | Item 2        |
| Long Text    | Medium         | Short         |

Colons in the separator row control alignment:
- `:---` = Left align
- `:---:` = Center align
- `---:` = Right align

## Task Lists (GFM Extension)

Task lists help track progress and todos:

### Project Checklist

- [ ] Setup project repository
- [ ] Configure build tools
- [x] Write documentation
- [x] Create initial commit
- [ ] Implement core features
  - [ ] Feature A
  - [x] Feature B
  - [ ] Feature C
- [ ] Write tests
- [ ] Deploy to production

### Daily Tasks

- [x] Morning standup meeting
- [x] Review pull requests
- [ ] Complete feature implementation
- [ ] Update project board
- [ ] Send status report

---

## Putting It All Together

Here's a complex example combining multiple features:

> **Important Notice:** Starting ~~next week~~ *tomorrow*, we'll be migrating to a new system.
>
> 1. Backup your data using:
>    ```bash
>    ./backup.sh --all --compress
>    ```
> 2. Visit [the migration guide](https://example.com/migration "Migration Documentation")
> 3. Complete these tasks:
>    - [ ] Export existing data
>    - [ ] Verify backup integrity
>    - [x] Notify team members
>
> Contact <admin@example.com> for questions.

<table>
<tr><td>HTML tables still work too!</td></tr>
</table>

## Conclusion

This guide has demonstrated **all major markdown features** including:

- Multiple heading styles (ATX & Setext)
- Various code block formats
- Rich text formatting
- Links, images, and autolinks
- Lists (ordered, unordered, nested)
- Tables with alignment
- Task lists for tracking
- HTML entity handling
- Character escaping
- Raw HTML embedding

Master these features and you'll be able to create beautiful, well-structured documents anywhere markdown is supported!

***

*Happy writing!* ✨
