import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";

const source = path.resolve(import.meta.dirname, "../build-shell/index.html");
const destination = path.resolve(
  import.meta.dirname,
  "../../src/peakrdl_html_single/template.html",
);
const html = await readFile(source, "utf8");

if (html.split('{"marker":"__PEAKRDL_HTML_SINGLE_DOCUMENT__"}').length !== 2) {
  throw new Error("Built shell does not contain the document marker");
}
if (/<(?:script|link)\b[^>]+(?:src|href)=["'](?!data:)/i.test(html)) {
  throw new Error("Built shell contains an external script or stylesheet");
}

await copyFile(source, destination);
console.log(`Packaged single-file shell (${Buffer.byteLength(html)} bytes)`);
