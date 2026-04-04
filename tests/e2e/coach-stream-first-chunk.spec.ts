import { expect, test } from "@playwright/test";

test("发送消息后 assistant 出现占位并显示首段流式文本", async ({ page }) => {
  let chatRequestCount = 0;
  let lastMessage: string | null = null;
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });

  await page.route("**/api/coach/chat", async (route) => {
    chatRequestCount += 1;
    const data = route.request().postDataJSON() as {
      message?: string;
    } | null;
    lastMessage = data?.message ?? null;

    await responseGate;
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Conversation-Id": "e2e-stream-c1",
        "X-Coach-Response-Mode": "stream",
        "X-Coach-Log-Id": "e2e-stream-log-1",
      },
      // 返回首段即可：本用例只验证“开始流了”，不要求完整结束。
      body: "首段流式文本",
    });
  });

  await page.goto("/app/coach");
  await expect(page.getByRole("heading", { name: "历史会话" })).toBeVisible();

  const input = page.getByTestId("coach-input-textarea");
  const message = "我今晚应该几点准备睡觉？";
  await input.fill(message);
  await expect(input).toHaveValue(message);

  await page.getByTestId("coach-send-button").click();
  await expect.poll(() => chatRequestCount).toBe(1);
  expect(lastMessage).toBe(message);

  // 请求发出后，助手占位消息应先出现。
  await expect(page.getByText("正在回复...")).toBeVisible();

  releaseResponse();

  // 首段文本到达即认为“开始流了”。
  await expect(page.getByText("首段流式文本")).toBeVisible();
});
