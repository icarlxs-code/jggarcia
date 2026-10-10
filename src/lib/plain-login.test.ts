import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("acesso por senha", () => {
  it("o navegador não carrega a senha", () => {
    const src = readFileSync(new URL("./plain-login.ts", import.meta.url), "utf8");
    const root = readFileSync(new URL("../routes/__root.tsx", import.meta.url), "utf8");
    assert.equal(src.includes("12345678"), false);
    assert.equal(root.includes("12345678"), false);
  });
});
