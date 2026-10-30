const { chromium } = require(
  "C:/Users/ZY/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

const base = "http://127.0.0.1:4173";
const stamp = Date.now().toString().slice(-6);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  const checks = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const check = (name, value) => checks.push({ name, pass: Boolean(value) });

  await page.goto(`${base}/#/dashboard`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新任务", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("任务名称").fill(`验收任务 ${stamp}`);
  await dialog.getByLabel("任务描述").fill("这是一条可验证的创建任务记录。");
  await dialog.getByRole("button", { name: "创建任务" }).click();
  check(
    "task-create",
    await page.evaluate(
      (title) =>
        JSON.parse(localStorage.getItem("personal-os-data-v1")).tasks.some(
          (item) => item.title === title,
        ),
      `验收任务 ${stamp}`,
    ),
  );
  await page.getByText(`验收任务 ${stamp}`, { exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("任务名称").fill(`验收任务已改 ${stamp}`);
  await dialog.getByRole("button", { name: "保存修改" }).click();
  await page.waitForTimeout(120);
  check(
    "task-edit",
    await page.evaluate(
      (title) =>
        JSON.parse(localStorage.getItem("personal-os-data-v1")).tasks.some(
          (item) => item.title === title,
        ),
      `验收任务已改 ${stamp}`,
    ),
  );
  await page.getByText(`验收任务已改 ${stamp}`, { exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "删除" }).click();
  await page
    .getByRole("dialog", { name: "确认删除？" })
    .getByRole("button", { name: "删除" })
    .click();
  await page.waitForTimeout(120);
  check(
    "task-delete",
    await page.evaluate(
      (title) =>
        !JSON.parse(localStorage.getItem("personal-os-data-v1")).tasks.some(
          (item) => item.title === title,
        ),
      `验收任务已改 ${stamp}`,
    ),
  );

  await page.goto(`${base}/#/goals`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建目标" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("目标名称").fill(`验收目标 ${stamp}`);
  await dialog.getByLabel("预期成果").fill("形成可验证的目标成果");
  await dialog.getByRole("button", { name: "创建目标" }).click();
  check(
    "goal-create",
    await page.getByText(`验收目标 ${stamp}`, { exact: true }).count(),
  );
  let goalCard = page
    .locator(".goal-card")
    .filter({ hasText: `验收目标 ${stamp}` });
  await goalCard.getByRole("button", { name: "编辑目标" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("目标名称").fill(`验收目标已改 ${stamp}`);
  await dialog.getByRole("button", { name: "保存修改" }).click();
  await page.waitForTimeout(120);
  check(
    "goal-edit",
    await page.evaluate(
      (title) =>
        JSON.parse(localStorage.getItem("personal-os-data-v1")).goals.some(
          (item) => item.title === title,
        ),
      `验收目标已改 ${stamp}`,
    ),
  );
  goalCard = page
    .locator(".goal-card")
    .filter({ hasText: `验收目标已改 ${stamp}` });
  await goalCard.getByRole("button", { name: "删除目标" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "删除" }).click();
  await page.waitForTimeout(120);
  check(
    "goal-delete",
    await page.evaluate(
      (title) =>
        !JSON.parse(localStorage.getItem("personal-os-data-v1")).goals.some(
          (item) => item.title === title,
        ),
      `验收目标已改 ${stamp}`,
    ),
  );

  await page.getByRole("button", { name: "新建项目" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("项目名称").fill(`验收项目 ${stamp}`);
  await dialog.getByLabel("预期成果").fill("完成项目交付");
  await dialog.getByRole("button", { name: "创建项目" }).click();
  check(
    "project-create",
    await page.getByText(`验收项目 ${stamp}`, { exact: true }).count(),
  );
  let projectRow = page
    .locator(".project-row")
    .filter({ hasText: `验收项目 ${stamp}` });
  await projectRow.click();
  await page.getByRole("button", { name: "编辑项目" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("项目名称").fill(`验收项目已改 ${stamp}`);
  await dialog.getByRole("button", { name: "保存修改" }).click();
  await page.waitForTimeout(120);
  check(
    "project-edit",
    await page.evaluate(
      (title) =>
        JSON.parse(localStorage.getItem("personal-os-data-v1")).projects.some(
          (item) => item.title === title,
        ),
      `验收项目已改 ${stamp}`,
    ),
  );
  projectRow = page
    .locator(".project-row")
    .filter({ hasText: `验收项目已改 ${stamp}` });
  await projectRow.click();
  await page.getByRole("button", { name: "删除项目" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "删除" }).click();
  await page.waitForTimeout(120);
  check(
    "project-delete",
    await page.evaluate(
      (title) =>
        !JSON.parse(localStorage.getItem("personal-os-data-v1")).projects.some(
          (item) => item.title === title,
        ),
      `验收项目已改 ${stamp}`,
    ),
  );

  await page.goto(`${base}/#/schedule`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建日程" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("日程名称").fill(`验收日程 ${stamp}`);
  await dialog.getByRole("button", { name: "创建日程" }).click();
  check(
    "schedule-create",
    await page.getByText(`验收日程 ${stamp}`, { exact: true }).count(),
  );
  const scheduleBlock = page
    .locator(".schedule-block")
    .filter({ hasText: `验收日程 ${stamp}` });
  await scheduleBlock.getByRole("button", { name: "编辑日程" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("日程名称").fill(`验收日程已改 ${stamp}`);
  await dialog.getByRole("button", { name: "保存修改" }).click();
  check(
    "schedule-edit",
    await page.getByText(`验收日程已改 ${stamp}`, { exact: true }).count(),
  );
  const editedBlock = page
    .locator(".schedule-block")
    .filter({ hasText: `验收日程已改 ${stamp}` });
  await editedBlock.getByRole("button", { name: "删除日程" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "删除" }).click();
  check(
    "schedule-delete",
    (await page.getByText(`验收日程已改 ${stamp}`, { exact: true }).count()) ===
      0,
  );

  await page.goto(`${base}/#/inbox`, { waitUntil: "networkidle" });
  await page
    .locator(".capture-main textarea")
    .fill(`联系供应商并确认交付时间 ${stamp}`);
  await page.getByRole("button", { name: "保存到收集箱" }).click();
  const inboxArticle = page
    .locator(".inbox-item")
    .filter({ hasText: `联系供应商并确认交付时间 ${stamp}` });
  await inboxArticle.getByRole("button", { name: /整理/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /临时任务/ }).click();
  await dialog.getByRole("button", { name: "确认转换" }).click();
  check("inbox-convert", (await inboxArticle.count()) === 0);

  await page.goto(`${base}/#/knowledge`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "添加资料" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("标题").fill(`验收知识 ${stamp}`);
  await dialog.getByLabel("正文").fill("这是通过浏览器自动验收写入的知识正文。");
  await dialog.getByRole("button", { name: "添加资料" }).click();
  check(
    "knowledge-create",
    await page.getByText(`验收知识 ${stamp}`, { exact: true }).count(),
  );
  await page.getByText(`验收知识 ${stamp}`, { exact: true }).click();
  await page.getByRole("button", { name: "删除资料" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "删除" }).click();
  check(
    "knowledge-delete",
    (await page.getByText(`验收知识 ${stamp}`, { exact: true }).count()) === 0,
  );

  await page.goto(`${base}/#/growth`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "添加记录" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("记录标题").fill(`验收成长 ${stamp}`);
  await dialog.getByLabel("具体变化").fill("完成一次完整的交互验收并留下记录。");
  await dialog.getByLabel("能力标签").fill("验收, 测试");
  await dialog.getByRole("button", { name: "保存记录" }).click();
  await page.waitForTimeout(200);
  check(
    "growth-create",
    await page.evaluate(
      (title) =>
        JSON.parse(localStorage.getItem("personal-os-data-v1")).growth.some(
          (item) => item.title === title,
        ),
      `验收成长 ${stamp}`,
    ),
  );

  await page.goto(`${base}/#/review`, { waitUntil: "networkidle" });
  const reviewFields = page.locator(".review-prompts textarea");
  await reviewFields.nth(0).fill("完成了所有核心路径的浏览器验收。");
  await reviewFields.nth(1).fill("无。");
  await reviewFields.nth(2).fill("继续保持小步验证和成果记录。");
  await page.getByRole("button", { name: "保存这次复盘" }).click();
  check(
    "review-save",
    await page.getByText("继续保持小步验证和成果记录。", { exact: true }).count(),
  );

  await page.goto(`${base}/#/notifications`, { waitUntil: "networkidle" });
  const unreadBefore = await page.locator(".notification-item.unread").count();
  await page.getByRole("button", { name: "全部已读" }).click();
  await page.waitForTimeout(150);
  check(
    "notifications-read",
    unreadBefore > 0 &&
      (await page.locator(".notification-item.unread").count()) === 0,
  );

  await page.goto(`${base}/#/focus`, { waitUntil: "networkidle" });
  await page.locator(".focus-task-options button").first().click();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "结束专注" }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("实际完成了什么？")
    .fill("完成任务流转的核心验收，并确认成果会被保存。");
  await dialog.getByLabel("任务当前状态").selectOption("done");
  await dialog.getByRole("button", { name: "保存并结束" }).click();
  await page.waitForTimeout(150);
  check(
    "focus-complete-evidence",
    (await page.getByText("任务流转的核心验收", { exact: false }).count()) > 0,
  );
  const storage = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("personal-os-data-v1")),
  );
  check(
    "focus-persisted",
    storage.focusSessions.some((session) => session.status === "ended"),
  );
  check(
    "evidence-linked",
    storage.evidence.some((item) =>
      item.content.includes("任务流转的核心验收"),
    ),
  );

  await page.reload({ waitUntil: "networkidle" });
  check(
    "reload-persistence",
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("personal-os-data-v1"),
        ).evidence.some((item) => item.content.includes("任务流转的核心验收")),
    ),
  );

  console.log(
    JSON.stringify(
      {
        checks,
        passed: checks.filter((item) => item.pass).length,
        total: checks.length,
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
