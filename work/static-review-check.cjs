const { chromium } = require(
  "C:/Users/ZY/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4174/review/", {
    waitUntil: "networkidle",
  });
  const result = await page.evaluate(() => ({
    title: document.title,
    heading: document.querySelector("h1")?.textContent,
    sections: document.querySelectorAll(".page-section").length,
    images: document.images.length,
    loadedImages: [...document.images].filter((image) => image.complete && image.naturalWidth > 0).length,
    textLength: document.body.innerText.length,
  }));
  await page.screenshot({
    path: "C:/Users/ZY/Documents/Codex/2026-10-30/new-chat/work/screens/static-review-page.png",
    fullPage: false,
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
