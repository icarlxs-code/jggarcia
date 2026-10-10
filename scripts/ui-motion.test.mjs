import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";

// Run against the dev server: JG_UI_TEST_URL=http://127.0.0.1:8080 node --test scripts/ui-motion.test.mjs
test("real counters and row feedback respect updates and motion preferences", { skip: !process.env.JG_UI_TEST_URL }, async () => {
  const browser = await chromium.launch(process.platform === "win32" ? { channel: "msedge" } : {});
  try {
    const page = await browser.newPage();
    await page.goto(process.env.JG_UI_TEST_URL);
    await page.evaluate(async () => { window.probe = (await import("/scripts/fixtures/motion-probe.tsx")).mountProbe(); window.probe.render(1200); });
    const value = () => page.locator('#motion-probe > span [aria-hidden="true"]').first().innerText();
    await page.waitForTimeout(50);
    assert.equal(await value(), "1.200");
    await page.evaluate(() => window.probe.render(1310));
    await page.waitForTimeout(150);
    const intermediate = Number((await value()).replaceAll(".", ""));
    assert(intermediate > 1200 && intermediate < 1310);
    await page.evaluate(() => window.probe.render(1100));
    await page.waitForTimeout(50);
    const interrupted = Number((await value()).replaceAll(".", ""));
    assert(interrupted > 1100 && interrupted <= intermediate + 2);
    await page.waitForTimeout(520);
    assert.equal(await value(), "1.100");
    await page.evaluate(() => window.probe.render(1234.56, 2));
    await page.waitForTimeout(520);
    assert.equal(await value(), "1.234,56");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => window.probe.render(999.5, 2));
    await page.waitForTimeout(50);
    assert.equal(await value(), "999,50");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.evaluate(() => { document.documentElement.classList.add("is-lite"); window.probe.render(2); });
    await page.waitForTimeout(50);
    assert.equal(await value(), "2");
    await page.evaluate(() => { document.documentElement.classList.remove("is-lite"); window.probe.render(3, 0, [{ id: "a", quantity: 2 }, { id: "b", quantity: 1 }]); });
    await page.waitForTimeout(100);
    assert.equal(await page.locator("#row-change").innerText(), "a,b");
    await page.waitForTimeout(1000);
    assert.equal(await page.locator("#row-change").innerText(), "");
    await page.evaluate(() => { window.probe.render(500); window.probe.unmount(); });
    await page.waitForTimeout(600);
    assert.equal(await page.locator("#motion-probe").count(), 0);
  } finally {
    await browser.close();
  }
});
