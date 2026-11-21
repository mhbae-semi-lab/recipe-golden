import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { S } from "../src/i18n.js";

test("한국어 · 영어 문자열 키가 같고, 화면에서 쓰는 키가 모두 있다", () => {
  assert.deepEqual(Object.keys(S.en).sort(), Object.keys(S.ko).sort());
  const src = readFileSync(new URL("../src/app.js", import.meta.url), "utf8") + readFileSync(new URL("../src/i18n.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const used = new Set([...src.matchAll(/\bt\("([a-zA-Z]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/data-i18n(?:-html)?="([a-zA-Z]+)"/g)) used.add(m[1]);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) for (const p of m[1].split(";")) used.add(p.split(":")[1]);
  const missing = [...used].filter((k) => !(k in S.ko));
  assert.deepEqual(missing, []);
  for (const pre of ["st_", "cls_", "g_", "kind_", "ev_", "perr_"]) assert.ok(Object.keys(S.ko).some((k) => k.startsWith(pre)), pre);
});
