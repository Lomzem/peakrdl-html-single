import { expect, test } from "bun:test";

import { renderMarkdown } from "../src/lib/markdown";

test("renders Markdown without raw HTML, unsafe links, or remote images", () => {
  const rendered = renderMarkdown(
    "**Safe** <script>alert(1)</script> [bad](javascript:alert(1)) ![tracking](https://example.invalid/pixel.png)",
  );

  expect(rendered).toContain("<strong>Safe</strong>");
  expect(rendered).toContain("&lt;script&gt;");
  expect(rendered).not.toContain('href="javascript:');
  expect(rendered).not.toContain("<img");
});
