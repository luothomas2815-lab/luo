import { expect, test } from "@playwright/test";

test("计划提示问题可填入输入框并仅在手动发送时发请求", async ({ page }) => {
  let chatRequestCount = 0;
  let lastMessage: string | null = null;

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
        "X-Conversation-Id": "e2e-c1",
        "X-Coach-Response-Mode": "stream",
        "X-Coach-Log-Id": "e2e-log-1",
      },
      body: "e2e-ok",
    });
  });

  await page.goto("/app/coach");

  await expect(page.getByRole("heading", { name: "历史会话" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "今日计划摘要" })).toBeVisible();

  const promptText = "为什么今天不建议补觉？";
  await page
    .getByTestId("coach-prompt-suggestion")
    .filter({ hasText: promptText })
    .first()
    .click();

  const input = page.getByTestId("coach-input-textarea");
  await expect(input).toHaveValue(promptText);
  await expect(input).toBeFocused();
  expect(chatRequestCount).toBe(0);

  await page.getByTestId("coach-send-button").click();
  await expect.poll(() => chatRequestCount).toBe(1);
  expect(lastMessage).toBe(promptText);
});
