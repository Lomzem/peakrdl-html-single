import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: false,
});

markdown.renderer.rules.image = (tokens, index) =>
  markdown.utils.escapeHtml(tokens[index]?.content || "");

export function renderMarkdown(source: string): string {
  return markdown.render(source);
}
