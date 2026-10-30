const { chromium } = require(
  "C:/Users/ZY/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const fs = require("fs");
const path = require("path");

const base = "http://127.0.0.1:4173";
const out = path.join(process.cwd(), "work", "screens");
fs.mkdirSync(out, { recursive: true });

const pages = [
  "dashboard",
  "schedule",
  "goals",
  "inbox",
  "knowledge",
  "growth",
  "assistant",
  "focus",
  "review",
  "notifications",
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await desktop.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

  const results = [];
  for (const route of pages) {
    await page.goto(`${base}/#/${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(180);
    const metrics = await page.evaluate(() => ({
      title: document.querySelector("h1")?.textContent?.trim() || "",
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      bodyText: document.body.innerText.length,
      modal: Boolean(document.querySelector('[role="dialog"]')),
    }));
    await page.screenshot({
      path: path.join(out, `desktop-${route}.png`),
      fullPage: true,
    });
    results.push({
      route,
      ...metrics,
      overflow: metrics.width > metrics.viewport + 1,
    });
  }

  await page.goto(`${base}/#/dashboard`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "快速收集" }).click();
  const note = `验收记录 ${Date.now()}`;
  await page.locator(".quick-capture-input").fill(note);
  await page.getByRole("dialog").getByRole("button", { name: "保存" }).click();
  await page.waitForTimeout(200);
  await page.reload({ waitUntil: "networkidle" });
  await page.goto(`${base}/#/inbox`, { waitUntil: "networkidle" });
  const persisted = await page.getByText(note, { exact: true }).count();

  await page.goto(`${base}/#/focus`, { waitUntil: "networkidle" });
  const focusButton = page.locator(".focus-task-options button").first();
  if (await focusButton.count()) {
    await focusButton.click();
    await page.waitForTimeout(2200);
    const timer = await page.locator(".focus-ring span").first().innerText();
    await page.getByRole("button", { name: "暂停" }).click();
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: "networkidle" });
    const pausedPersisted = await page.getByText("已暂停", { exact: true }).count();
    results.push({ route: "focus-timer", timer, pausedPersisted });
  }

  await page.goto(`${base}/#/assistant`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "规划今天", exact: true }).click();
  await page.waitForTimeout(900);
  const simulatedReplies = await page.locator(".message-row.assistant").count();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const mobilePage = await mobile.newPage();
  mobilePage.on("pageerror", (error) =>
    errors.push(`mobile pageerror: ${error.message}`),
  );
  const mobileResults = [];
  for (const route of pages) {
    await mobilePage.goto(`${base}/#/${route}`, { waitUntil: "networkidle" });
    await mobilePage.waitForTimeout(120);
    const metrics = await mobilePage.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      title: document.querySelector("h1")?.textContent?.trim() || "",
    }));
    if (["dashboard", "schedule", "goals", "assistant", "focus"].includes(route)) {
      await mobilePage.screenshot({
        path: path.join(out, `mobile-${route}.png`),
        fullPage: true,
      });
    }
    mobileResults.push({
      route,
      ...metrics,
      overflow: metrics.width > metrics.viewport + 1,
    });
  }

  console.log(
    JSON.stringify(
      {
        desktop: results,
        mobile: mobileResults,
        persisted,
        simulatedReplies,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
