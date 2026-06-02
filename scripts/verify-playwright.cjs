const { chromium } = require("playwright");

const url = "http://127.0.0.1:4173/";

async function pixelStats(page) {
  return page.evaluate(() => {
    const source = document.querySelector("#game");
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 54;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let lit = 0;
    const buckets = new Set();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = r + g + b;
      if (luma > 24) lit += 1;
      buckets.add(`${r >> 4}-${g >> 4}-${b >> 4}`);
    }
    return { lit, buckets: buckets.size };
  });
}

async function capture(page, name, viewport, button = "#start-btn", expectedText = "玩家一号 VS AI") {
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.querySelector("#boot")?.classList.contains("boot--active"), { timeout: 9000 });
  await page.locator("#menu.screen--active #start-btn").waitFor({ state: "visible", timeout: 9000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/tmp/${name}-menu.png`, timeout: 60000 });

  await page.locator(button).click();
  await page.locator("#hud.hud--active").waitFor({ state: "visible", timeout: 5000 });
  await page.waitForFunction(
    (text) => document.querySelector("#mission-phase")?.textContent?.includes(text),
    expectedText,
    { timeout: 5000 },
  );
  await page.waitForTimeout(1700);
  await page.screenshot({ path: `/tmp/${name}-game.png`, timeout: 60000 });
  const game = await pixelStats(page);
  const phase = await page.locator("#mission-phase").textContent();
  const system = await page.locator("#system-state").textContent();
  const freecam = await page.locator("#hud").evaluate((node) => node.classList.contains("hud--freecam"));

  if (game.lit < 500 || game.buckets < 8) {
    throw new Error(`${name} game canvas looks blank: ${JSON.stringify(game)}`);
  }
  if (!phase.includes(expectedText)) {
    throw new Error(`${name} started wrong mode: ${phase}`);
  }
  return { game, phase, system, freecam };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pve = await capture(page, "wang-desktop-pve", { width: 1280, height: 720 }, "#start-btn", "玩家一号 VS AI");
  if (!pve.freecam || !pve.system.includes("Freecam")) {
    throw new Error(`pve should start with base freecam online: ${JSON.stringify(pve)}`);
  }
  const pvp = await capture(page, "wang-desktop-pvp", { width: 1280, height: 720 }, "#duel-btn", "本地双人对战");
  const aivai = await capture(page, "wang-desktop-aivai", { width: 1280, height: 720 }, "#ai-btn", "AI 裁判观战");
  const mobile = await capture(page, "wang-mobile-pve", { width: 390, height: 844 }, "#start-btn", "玩家一号 VS AI");
  await browser.close();
  console.log(JSON.stringify({ pve, pvp, aivai, mobile }, null, 2));
})();
