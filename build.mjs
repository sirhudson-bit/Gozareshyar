import { readFileSync, writeFileSync, readdirSync, renameSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const fontPath = join(root, "src", "Vazirmatn.woff2");
const src = join(root, "src");

let css = readFileSync(join(src, "app.css"), "utf8");
const fontBase64 = readFileSync(fontPath).toString("base64");
css = css.replace("__VAZIRMATN_BASE64__", fontBase64);

const jsDir = join(src, "js");
const jsFiles = readdirSync(jsDir).filter((f) => f.endsWith(".js")).sort();
const js = jsFiles
  .map((f) => `\n/* ---- ${f} ---- */\n` + readFileSync(join(jsDir, f), "utf8"))
  .join("\n");

let html = readFileSync(join(src, "index.template.html"), "utf8");
if (!html.includes("__APP_CSS__") || !html.includes("__APP_JS__")) {
  throw new Error("placeholders missing");
}
html = html.replace("__APP_CSS__", () => css);
html = html.replace("__APP_JS__", () => `(function () {\n"use strict";\n${js}\n})();`);

writeFileSync(join(root, "index.html"), html, "utf8");

if (existsSync(fontPath)) {
  renameSync(fontPath, join(src, "Vazirmatn.woff2"));
}
console.log("built index.html:", Buffer.byteLength(html), "bytes;", jsFiles.length, "js files");
