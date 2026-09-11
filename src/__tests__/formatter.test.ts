import { describe, it, expect } from "vitest";
import { markdownToTelegramHtml, stripHtml, splitMessage } from "../channels/telegram/formatter.js";

describe("telegram formatter", () => {
  it("converts headings to bold", () => {
    const input = "### Heading 3\n## Heading 2\n# Heading 1";
    const out = markdownToTelegramHtml(input);
    expect(out).toContain("<b>Heading 3</b>");
    expect(out).toContain("<b>Heading 2</b>");
    expect(out).toContain("<b>Heading 1</b>");
  });

  it("converts bold and italic text", () => {
    const input = "This is **bold** and *italic* and _also italic_.";
    const out = markdownToTelegramHtml(input);
    expect(out).toContain("<b>bold</b>");
    expect(out).toContain("<i>italic</i>");
    expect(out).toContain("<i>also italic</i>");
  });

  it("converts blockquotes to <blockquote>", () => {
    const input = "> line 1\n> line 2";
    const out = markdownToTelegramHtml(input);
    expect(out).toContain("<blockquote>line 1\nline 2</blockquote>");
  });

  it("converts code blocks and escapes html", () => {
    const input = "```typescript\nconst a = 1 < 2 && 3 > 0;\n```";
    const out = markdownToTelegramHtml(input);
    expect(out).toContain('<pre><code class="language-typescript">const a = 1 &lt; 2 &amp;&amp; 3 &gt; 0;</code></pre>');
  });

  it("converts inline code and escapes html", () => {
    const input = "Use `foo <bar>` now";
    const out = markdownToTelegramHtml(input);
    expect(out).toContain("<code>foo &lt;bar&gt;</code>");
  });

  it("converts bullet lists and horizontal rules", () => {
    const input = "* item 1\n- item 2\n---\n* item 3";
    const out = markdownToTelegramHtml(input);
    expect(out).toContain("• item 1");
    expect(out).toContain("• item 2");
    expect(out).toContain("———————");
    expect(out).toContain("• item 3");
  });

  it("converts markdown links to html links", () => {
    const input = "Check [Google](https://google.com) out.";
    const out = markdownToTelegramHtml(input);
    expect(out).toContain('<a href="https://google.com">Google</a>');
  });

  it("stripHtml cleanly removes tags and restores entities", () => {
    const input = "<b>Bold</b> &lt;tag&gt; <i>Italic</i>";
    expect(stripHtml(input)).toBe("Bold <tag> Italic");
  });
});
