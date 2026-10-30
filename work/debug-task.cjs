const { chromium } = require(
  "C:/Users/ZY/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("http://127.0.0.1:4173/#/dashboard", {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "新任务", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("任务名称").fill("调试可见任务");
  await dialog.getByLabel("任务描述").fill("测试创建后立即显示。");
  await dialog.getByRole("button", { name: "创建任务" }).click();
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("personal-os-data-v1"));
    return {
      matchingTask: data.tasks.find((task) => task.title === "调试可见任务"),
      dashboardTasks: [...document.querySelectorAll(".dashboard-task")].map(
        (element) => element.innerText,
      ),
      pageText: document.querySelector(".dashboard-page")?.innerText,
    };
  });
  console.log(JSON.stringify(result, null, 2));
  await page.screenshot({
    path: "C:/Users/ZY/Documents/Codex/2026-10-30/new-chat/work/screens/debug-task.png",
    fullPage: true,
  });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
