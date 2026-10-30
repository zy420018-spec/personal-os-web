const { chromium } = require(
  "C:/Users/ZY/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(
    "https://zy420018-spec.github.io/personal-os-web/#/dashboard",
    { waitUntil: "networkidle", timeout: 30000 },
  );
  const dashboard = await page.evaluate(() => ({
    title: document.querySelector("h1")?.textContent?.trim(),
    bodyLength: document.body.innerText.length,
    styleSheets: document.styleSheets.length,
    scriptCount: document.scripts.length,
  }));
  await page.goto(
    "https://zy420018-spec.github.io/personal-os-web/#/knowledge",
    { waitUntil: "networkidle", timeout: 30000 },
  );
  const knowledge = await page.evaluate(() => ({
    title: document.querySelector("h1")?.textContent?.trim(),
    cards: document.querySelectorAll(".knowledge-card").length,
  }));
  await page.goto(
    "https://zy420018-spec.github.io/personal-os-web/#/dashboard",
    { waitUntil: "networkidle", timeout: 30000 },
  );
  await page.screenshot({
    path: "C:/Users/ZY/Documents/Codex/2026-10-30/new-chat/work/screens/public-deployment.png",
    fullPage: true,
  });
  console.log(JSON.stringify({ dashboard, knowledge, errors }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
