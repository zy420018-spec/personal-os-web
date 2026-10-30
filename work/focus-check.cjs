const { chromium } = require(
  "C:/Users/ZY/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("http://127.0.0.1:4173/#/focus", { waitUntil: "networkidle" });
  await page.locator(".focus-task-options button").first().click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "暂停" }).click();
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("personal-os-data-v1"));
    return {
      session: data.focusSessions.find(
        (item) => item.status === "active" || item.status === "paused",
      ),
      text: document.querySelector(".focus-page")?.innerText,
    };
  });
  await page.reload({ waitUntil: "networkidle" });
  const after = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("personal-os-data-v1"));
    return {
      session: data.focusSessions.find(
        (item) => item.status === "active" || item.status === "paused",
      ),
      text: document.querySelector(".focus-page")?.innerText,
    };
  });
  await page.screenshot({
    path: "C:/Users/ZY/Documents/Codex/2026-10-30/new-chat/work/screens/focus-paused.png",
    fullPage: true,
  });
  console.log(JSON.stringify({ before, after }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
