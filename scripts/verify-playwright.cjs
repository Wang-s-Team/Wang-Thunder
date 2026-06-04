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

async function capture(name, viewport, button = "#start-btn", expectedText = "玩家一号 VS AI") {
  console.log(`verify: ${name} start`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize(viewport);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForFunction(() => !document.querySelector("#boot")?.classList.contains("boot--active"), { timeout: 10000 });
    await page.locator("#menu.screen--active #start-btn").waitFor({ state: "visible", timeout: 9000 });
    await page.waitForTimeout(250);

    await startGame(page, button);
    await page.waitForFunction(
      (text) => document.querySelector("#mission-phase")?.textContent?.includes(text),
      expectedText,
      { timeout: 5000 },
    );
    await page.waitForTimeout(900);
    const game = await pixelStats(page);
    const phase = await page.locator("#mission-phase").textContent();
    const system = await page.locator("#system-state").textContent();
    const firstPerson = await page.locator("#hud").evaluate((node) => node.classList.contains("hud--first-person"));
    const legacyFreecam = await page.locator("#hud").evaluate((node) => node.classList.contains("hud--freecam"));
    const reticle = await page.locator("#reticle").evaluate((node) => {
      const style = window.getComputedStyle(node);
      return { left: style.left, top: style.top };
    });

    if (game.lit < 500 || game.buckets < 8) {
      throw new Error(`${name} game canvas looks blank: ${JSON.stringify(game)}`);
    }
    if (!phase.includes(expectedText)) {
      throw new Error(`${name} started wrong mode: ${phase}`);
    }
    if (!firstPerson || legacyFreecam) {
      throw new Error(`${name} should use first-person HUD: ${JSON.stringify({ firstPerson, legacyFreecam })}`);
    }
    console.log(`verify: ${name} ok`);
    return { game, phase, system, firstPerson, legacyFreecam, reticle };
  } finally {
    await browser.close();
  }
}

async function startGame(page, button) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.evaluate((selector) => {
      const target = document.querySelector(selector);
      target?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      target?.click();
    }, button);
    for (let poll = 0; poll < 16; poll += 1) {
      const active = await page.evaluate(() => document.querySelector("#hud")?.classList.contains("hud--active"));
      if (active) return;
      await page.waitForTimeout(100);
    }
  }

  const state = await page.evaluate(() => ({
    menu: [...(document.querySelector("#menu")?.classList ?? [])],
    hud: [...(document.querySelector("#hud")?.classList ?? [])],
    phase: document.querySelector("#mission-phase")?.textContent,
  }));
  throw new Error(`game did not start: ${JSON.stringify(state)}`);
}

(async () => {
  const desktop = await capture("wang-desktop-pve", { width: 1280, height: 720 }, "#start-btn", "玩家一号 VS AI");
  if (!desktop.system.includes("点击画面") && !desktop.system.includes("鼠标锁定")) {
    throw new Error(`desktop should show first-person pointer lock status: ${JSON.stringify(desktop)}`);
  }
  const mobile = await capture("wang-mobile-pve", { width: 390, height: 844 }, "#start-btn", "玩家一号 VS AI");
  console.log(JSON.stringify({ desktop, mobile }, null, 2));
})();
