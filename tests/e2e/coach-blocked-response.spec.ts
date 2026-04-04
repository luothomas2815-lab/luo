import { expect, test } from "@playwright/test";

test("blocked 模式下展示安全提示且不走正常流式占位", async ({ page }) => {
  let chatRequestCount = 0;
  let lastMessage: string | null = null;
  const blockedText = "当前问题涉及安全风险，请优先联系专业支持。";

  await page.route("**/api/coach/chat", async (route) => {
    chatRequestCount += 1;
    const data = route.request().postDataJSON() as {
      message?: string;
    } | null;
    lastMessage = data?.message ?? null;

    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Coach-Response-Mode": "blocked",
        "X-Conversation-Id": "e2e-blocked-c1",
        "X-Coach-Log-Id": "e2e-blocked-log-1",
      },
      body: blockedText,
    });
  });

  await page.goto("/app/coach");
  await expect(page.getByRole("heading", { name: "历史会话" })).toBeVisible();

  const input = page.getByTestId("coach-input-textarea");
  const message = "我现在想伤害自己，该怎么做？";
  await input.fill(message);
  await expect(input).toHaveValue(message);

  await page.getByTestId("coach-send-button").click();
  await expect.poll(() => chatRequestCount).toBe(1);
  expect(lastMessage).toBe(message);

  await expect(page.getByText("安全提示")).toBeVisible();
  await expect(page.getByText(blockedText)).toBeVisible();
  await expect(page.getByText("正在回复...")).toHaveCount(0);
});
