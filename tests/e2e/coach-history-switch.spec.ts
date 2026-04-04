import { expect, test } from "@playwright/test";

test("历史会话切换后消息列表与高亮会更新", async ({ page }) => {
  let c2LoadCount = 0;
  await page.route("**/api/coach/conversations/e2e-c2/messages", async (route) => {
    c2LoadCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        conversationId: "e2e-c2",
        messages: [
          {
            id: "e2e-m2",
            role: "assistant",
            content: "这是会话二",
            safetyFlag: false,
          },
        ],
      }),
    });
  });

  await page.goto("/app/coach");

  await expect(page.getByText("这是会话一")).toBeVisible();
  await expect(page.getByTestId("coach-history-item-e2e-c1")).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.getByTestId("coach-history-item-e2e-c2").click();
  await expect(page.getByText("切换会话加载中...")).toBeVisible();

  await expect(page.getByText("这是会话二")).toBeVisible();
  await expect(page.getByText("这是会话一")).toHaveCount(0);
  await expect(page.getByTestId("coach-history-item-e2e-c2")).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.getByTestId("coach-history-item-e2e-c1").click();
  await expect(page.getByText("这是会话一")).toBeVisible();
  await page.getByTestId("coach-history-item-e2e-c2").click();
  await expect(page.getByText("这是会话二")).toBeVisible();
  expect(c2LoadCount).toBe(1);
});
