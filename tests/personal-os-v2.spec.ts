import { expect, test } from "@playwright/test";
import { occurrencesForDate, timeToMinutes } from "../src/course";
import { buildPlanningSuggestions } from "../src/planner";
import type { AppData } from "../src/types";

const storageKey = "personal-os-data-v1";

const readData = (page: import("@playwright/test").Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);

test("migrates V2 data to V3 without clearing it", async ({ page }) => {
  await page.goto("/#/dashboard");
  const current = await readData(page);
  const { courses, ...legacy } = current;
  const legacyCourses = courses.map(
    (course: Record<string, unknown>) => {
      const {
        availableMinutes: _minutes,
        arrangementMode: _mode,
        allowedTaskFocus: _focus,
        avoidStartEnd: _avoid,
        availableWindows: _windows,
        ...rest
      } = course;
      return rest;
    },
  );
  const migrated = {
    ...legacy,
    version: 2,
    courses: legacyCourses,
    tasks: legacy.tasks.map(
      (task: Record<string, unknown>) => {
        const {
          completedAt: _completed,
          remainingWork: _remaining,
          minDuration: _minDuration,
          allowSplit: _allowSplit,
          focusRequirement: _focusRequirement,
          planningScenes: _planningScenes,
          prerequisiteTaskId: _prerequisite,
          ...rest
        } = task;
        return rest;
      },
    ),
  };
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, JSON.stringify(value)),
    [storageKey, migrated],
  );
  await page.reload();
  const data = await readData(page);
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(data.version).toBe(3);
  expect(data.tasks.length).toBeGreaterThan(0);
  expect(data.tasks[0].remainingWork).toBe("");
  expect(data.tasks[0].minDuration).toBeGreaterThan(0);
  expect(data.tasks[0].allowSplit).toBeDefined();
  expect(data.tasks[0].focusRequirement).toBe("normal");
  expect(data.tasks[0].planningScenes.length).toBeGreaterThan(0);
  expect(data.courses.length).toBe(courses.length);
  expect(data.courses[0].availableMinutes).toBe(0);
  expect(data.courses[0].arrangementMode).toBe("manual");
  expect(keys.some((key) => key.startsWith(`${storageKey}-backup-`))).toBe(
    true,
  );
});

test("starts, pauses, resumes after reload, and completes from dashboard", async ({
  page,
}) => {
  await page.goto("/#/dashboard");
  const select = page.locator(".home-focus-start select");
  const firstTaskId = await select.locator("option").nth(1).getAttribute("value");
  await select.selectOption(firstTaskId!);
  await page.locator(".home-focus-start .button-primary").click();
  await expect(page.locator(".home-focus-panel.active")).toBeVisible();
  await page.waitForTimeout(1100);
  await page.locator(".home-focus-actions .button-primary").click();
  await page.reload();
  await expect(page.getByText("执行已暂停")).toBeVisible();
  await page.locator(".home-focus-actions .button-secondary").click();
  await page
    .getByRole("dialog")
    .locator("textarea")
    .first()
    .fill("V2 首页执行验收成果");
  await page.getByRole("dialog").locator("select").first().selectOption("done");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存并结束" })
    .click();
  await page.waitForTimeout(200);
  const data = await readData(page);
  const task = data.tasks.find(
    (item: { id: string }) => item.id === firstTaskId,
  );
  expect(task.status).toBe("done");
  expect(task.completedAt).toBeTruthy();
  expect(
    data.evidence.some(
      (item: { content: string }) =>
        item.content === "V2 首页执行验收成果",
    ),
  ).toBe(true);
});

test("keeps fixed courses when adding temporary changes and confirms real schedule slots", async ({
  page,
}) => {
  await page.goto("/#/planning");
  await page.locator(".planning-topline .segmented button").nth(1).click();
  const before = await readData(page);
  await page.locator(".course-toolbar-actions button").first().click();
  const dialog = page.getByRole("dialog", { name: "添加临时变动" });
  await dialog.getByLabel("名称").fill("V2 临时活动");
  await dialog.getByLabel("开始时间").fill("18:00");
  await dialog.getByLabel("结束时间").fill("18:45");
  await dialog.getByRole("button", { name: "保存临时变动" }).click();
  await page.waitForTimeout(150);
  const withChange = await readData(page);
  expect(withChange.courses.length).toBe(before.courses.length);
  expect(withChange.courseChanges.length).toBe(
    before.courseChanges.length + 1,
  );

  await page.locator(".course-day-head").first().click();
  const stopButton = page
    .locator(".course-detail-actions")
    .getByRole("button", { name: "停课" });
  await expect(stopButton).toBeVisible();
  await stopButton.click();
  await page.waitForTimeout(100);
  const withCancellation = await readData(page);
  expect(withCancellation.courses.length).toBe(before.courses.length);
  expect(
    withCancellation.courseChanges.some(
      (change: { type: string }) => change.type === "cancelled",
    ),
  ).toBe(true);

  const planning = buildPlanningSuggestions(
    withCancellation as AppData,
    "steady",
  );
  for (const suggestion of planning.suggestions.filter(
    (item) => item.source === "free",
  )) {
    const mustCourses = occurrencesForDate(
      suggestion.date,
      withCancellation.courses,
      withCancellation.courseChanges,
      withCancellation.settings,
    ).filter((course) => course.focusLevel === "must");
    expect(
      mustCourses.some(
        (course) =>
          timeToMinutes(suggestion.start) < timeToMinutes(course.endTime) &&
          timeToMinutes(suggestion.end) > timeToMinutes(course.startTime),
      ),
    ).toBe(false);
  }

  await page.locator(".planning-topline .segmented button").first().click();
  await page.locator(".page-actions .button").click();
  await expect(page.getByRole("dialog", { name: "智能排程" })).toBeVisible();
  const slots = await page
    .locator(".planner-suggestion-head span")
    .allTextContents();
  if (slots.length) {
    expect(slots.every((slot) => slot.includes("16:00-17:00"))).toBe(false);
  }
  const confirm = page.getByRole("button", { name: /确认写入/ });
  if (await confirm.isEnabled()) {
    await confirm.click();
    await page.waitForTimeout(150);
    const after = await readData(page);
    expect(after.schedules.length).toBeGreaterThanOrEqual(before.schedules.length);
  }
});

test("persists water-class and task timing settings from existing editors", async ({
  page,
}) => {
  await page.goto("/#/planning");
  await page.locator(".planning-topline .segmented button").nth(1).click();
  await page
    .locator(".fixed-course-list article")
    .nth(1)
    .locator(".icon-button")
    .first()
    .click();
  const courseDialog = page.getByRole("dialog", { name: "编辑课程" });
  await courseDialog.getByLabel("可利用总分钟数").fill("40");
  await courseDialog.getByLabel("安排模式").selectOption("hybrid");
  await courseDialog.getByRole("button", { name: "添加时段" }).click();
  const windowInputs = courseDialog.locator(".course-window-row input");
  await windowInputs.nth(0).fill("14:10");
  await windowInputs.nth(1).fill("14:30");
  await courseDialog.getByRole("button", { name: "保存修改" }).click();
  await page.waitForTimeout(150);
  const withCourseSettings = await readData(page);
  const course = withCourseSettings.courses.find(
    (item: { id: string }) => item.id === "course-design",
  );
  expect(course.availableMinutes).toBe(40);
  expect(course.arrangementMode).toBe("hybrid");
  expect(course.availableWindows).toHaveLength(1);

  await page.goto("/#/dashboard");
  await page.locator(".page-actions .button-primary").click();
  const taskDialog = page.getByRole("dialog", { name: "创建任务" });
  await taskDialog.getByLabel("任务名称").fill("深度排程属性测试");
  await taskDialog.locator("details").click();
  await taskDialog.getByLabel("最短执行时长").fill("25");
  await taskDialog.getByLabel("拆分方式").selectOption("yes");
  await taskDialog.getByLabel("专注要求").selectOption("deep");
  await taskDialog.getByRole("button", { name: "创建任务" }).click();
  await page.waitForTimeout(150);
  const withTaskSettings = await readData(page);
  const task = withTaskSettings.tasks.find(
    (item: { title: string }) => item.title === "深度排程属性测试",
  );
  expect(task.minDuration).toBe(25);
  expect(task.allowSplit).toBe(true);
  expect(task.focusRequirement).toBe("deep");
});

test("stores uploaded evidence as an IndexedDB file and metadata", async ({
  page,
}) => {
  await page.goto("/#/dashboard");
  await page.getByRole("button", { name: "新任务", exact: true }).click();
  const taskDialog = page.getByRole("dialog");
  await taskDialog.getByLabel("任务名称").fill("V2 成果文件测试");
  await taskDialog.getByRole("button", { name: "创建任务" }).click();
  await page.getByText("V2 成果文件测试", { exact: true }).click();
  const editDialog = page.getByRole("dialog");
  await editDialog.getByRole("button", { name: "添加成果" }).click();
  const evidenceDialog = page.getByRole("dialog", { name: "添加成果证明" });
  await evidenceDialog.getByRole("button", { name: "图片/文件" }).click();
  await evidenceDialog.getByLabel("成果标题").fill("本地测试图片");
  await evidenceDialog.locator('input[type="file"]').setInputFiles({
    name: "proof.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await evidenceDialog.getByRole("button", { name: "保存成果" }).click();
  await page.waitForTimeout(250);
  await expect(page.locator(".evidence-image-preview img")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载成果文件" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("proof.png");
  const data = await readData(page);
  const evidence = data.evidence.find(
    (item: { title: string }) => item.title === "本地测试图片",
  );
  expect(evidence.fileId).toBeTruthy();
  const storedFile = await page.evaluate(async (fileId) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("personal-os-files");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<{ size: number; type: string }>((resolve, reject) => {
      const request = database
        .transaction("evidence-files", "readonly")
        .objectStore("evidence-files")
        .get(fileId);
      request.onsuccess = () =>
        resolve({
          size: request.result.blob.size,
          type: request.result.blob.type,
        });
      request.onerror = () => reject(request.error);
    });
  }, evidence.fileId);
  expect(storedFile.type).toBe("image/png");
  expect(storedFile.size).toBeGreaterThan(0);
});

test("saves converted object IDs and exports review formats", async ({
  page,
}) => {
  await page.goto("/#/library");
  const note = `V2 信息转化 ${Date.now()}`;
  await page.locator(".capture-main textarea").fill(note);
  await page.getByRole("button", { name: "保存到收集箱" }).click();
  const item = page.locator(".inbox-item").filter({ hasText: note });
  await item.getByRole("button", { name: "整理", exact: true }).click();
  const convertDialog = page.getByRole("dialog", { name: "整理这条记录" });
  await convertDialog.getByRole("button", { name: /临时任务/ }).click();
  await convertDialog.getByRole("button", { name: "确认转换" }).click();
  await page.waitForTimeout(150);
  const data = await readData(page);
  const inboxItem = data.inbox.find(
    (entry: { content: string }) => entry.content === note,
  );
  expect(inboxItem.convertedToId).toMatch(/^task-/);

  await page.goto("/#/review");
  for (const format of ["Markdown", "CSV"]) {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: format }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      format === "Markdown" ? /\.md$/ : /\.csv$/,
    );
  }
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "PDF" }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveTitle(/复盘/);
});

test("new navigation and legacy routes render responsively", async ({
  page,
}) => {
  for (const route of [
    "dashboard",
    "planning",
    "library",
    "goals",
    "growth",
    "assistant",
    "review",
    "notifications",
    "schedule",
    "inbox",
    "knowledge",
    "focus",
  ]) {
    await page.goto(`/#/${route}`);
    await expect(page.locator("h1")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["dashboard", "planning", "library", "assistant"]) {
    await page.goto(`/#/${route}`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  }
});

test("does not fake AI when the service is not configured", async ({ page }) => {
  await page.goto("/#/assistant");
  await expect(
    page.getByText("不会用固定回复冒充 AI", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".quick-actions button").first()).toBeDisabled();
  await expect(page.locator(".composer-box button")).toBeDisabled();
});
