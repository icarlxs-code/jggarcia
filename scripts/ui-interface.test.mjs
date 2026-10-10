import { chromium } from "playwright";
import assert from "node:assert/strict";
import { test } from "node:test";

test("grouped actions keep keyboard focus and transitions respect Lite and reduced motion", { skip: !process.env.JG_UI_TEST_URL }, async () => {
  const browser = await chromium.launch(process.platform === "win32" ? { channel: "msedge" } : {});
  try {
    const page = await browser.newPage();
    await page.goto(process.env.JG_UI_TEST_URL);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(async () => { window.interfaceProbe = (await import("/scripts/fixtures/interface-probe.tsx")).mountInterfaceProbe(); });
    const group = page.getByTestId("stage-group");
    await group.waitFor();
    assert.equal(await group.evaluate((node) => getComputedStyle(node).opacity), "1");
    const trigger = page.locator("#interface-probe").getByRole("button", { name: "Mais ações" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Executar ação" }).waitFor();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement === document.querySelector("#interface-probe button"));
    assert(await trigger.evaluate((node) => document.activeElement === node));
    await trigger.click();
    await page.getByRole("menuitem", { name: "Executar ação" }).click();
    assert.equal(await page.getByLabel("Ações executadas").innerText(), "1");
    const theme = page.locator("#interface-probe").getByRole("button", { name: "Ativar modo noturno" });
    await theme.click();
    await page.locator("#interface-probe").getByRole("button", { name: "Ativar modo claro" }).waitFor();
    assert(await page.evaluate(() => document.documentElement.classList.contains("dark")));
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim()), "#3d9a68");
    await page.waitForTimeout(400);
    await page.locator("#interface-probe").getByRole("button", { name: "Ativar modo claro" }).click();
    await theme.waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), false);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForTimeout(600);
    assert.equal(await group.evaluate((node) => getComputedStyle(node).opacity), "1");
    assert.equal(await group.evaluate((node) => node.style.transform), "");
    await page.evaluate(() => document.documentElement.classList.add("is-lite"));
    await page.waitForTimeout(100);
    assert.equal(await group.evaluate((node) => node.style.opacity), "");
    await page.evaluate(() => window.interfaceProbe.unmount());
    assert.equal(await page.locator("#interface-probe").count(), 0);
  } finally {
    await browser.close();
  }
});
