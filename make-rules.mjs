import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const core = readFileSync(join(root, "src", "js", "00-core.js"), "utf8");
const start = core.indexOf("const DEFAULT_RULES =");
const end = core.indexOf("\n\nconst SAMPLE_TASKS", start);
if (start < 0 || end < 0) throw new Error("DEFAULT_RULES not found");
const literal = core.slice(start, end).replace("const DEFAULT_RULES =", "");
const rules = eval(literal);
const payload = {
  app: "gozaresh-yar",
  kind: "rules",
  version: 1,
  exportedAt: new Date().toISOString(),
  rules
};
writeFileSync(join(root, "قوانین-پیش‌فرض.json"), JSON.stringify(payload, null, 2));
console.log("rules:", rules.length);
