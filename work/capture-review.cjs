const { chromium } = require(
  "C:/Users/ZY/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const fs = require("fs");
const path = require("path");

const base = "http://127.0.0.1:4173";
const output = path.join(process.cwd(), "public", "review");
const routes = [
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

fs.mkdirSync(output, { recursive: true });

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
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  for (const route of routes) {
    await page.goto(`${base}/#/${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(180);
    await page.screenshot({
      path: path.join(output, `desktop-${route}.png`),
      fullPage: true,
    });
  }

  await page.goto(`${base}/#/schedule`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建日程" }).click();
  await page.screenshot({
    path: path.join(output, "state-schedule-editor.png"),
    fullPage: false,
  });
  await page.getByRole("dialog").getByRole("button", { name: "关闭" }).click();

  await page.goto(`${base}/#/inbox`, { waitUntil: "networkidle" });
  await page.locator(".inbox-item").first().getByRole("button", { name: /整理/ }).click();
  await page.screenshot({
    path: path.join(output, "state-inbox-conversion.png"),
    fullPage: false,
  });
  await page.getByRole("dialog").getByRole("button", { name: "取消" }).click();

  await page.goto(`${base}/#/assistant`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "规划今天", exact: true }).click();
  await page.waitForTimeout(900);
  await page.screenshot({
    path: path.join(output, "state-assistant-reply.png"),
    fullPage: false,
  });

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const mobilePage = await mobile.newPage();
  for (const route of routes) {
    await mobilePage.goto(`${base}/#/${route}`, {
      waitUntil: "networkidle",
    });
    await mobilePage.waitForTimeout(140);
    await mobilePage.screenshot({
      path: path.join(output, `mobile-${route}.png`),
      fullPage: false,
    });
  }

  console.log(
    JSON.stringify(
      {
        screenshots: routes.length * 2 + 3,
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
