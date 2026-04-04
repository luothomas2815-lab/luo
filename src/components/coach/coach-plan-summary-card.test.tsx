import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoachPlanSummaryCard } from "./coach-plan-summary-card";

afterEach(() => {
  cleanup();
});

describe("CoachPlanSummaryCard", () => {
  it("只消费传入摘要，不在组件内重算计划", () => {
    const recomputeSpy = vi.fn();

    render(
      <CoachPlanSummaryCard
        summary={{
          fixedWakeTime: "07:30",
          earliestBedtime: "23:45",
          allowNap: false,
          napLimitMinutes: null,
          notes: null,
        }}
      />,
    );

    expect(screen.getByText("固定起床：07:30")).toBeInTheDocument();
    expect(screen.getByText("最早上床：23:45")).toBeInTheDocument();
    expect(screen.getByText("今天能否小睡：不建议")).toBeInTheDocument();
    expect(recomputeSpy).not.toHaveBeenCalled();
  });

  it("有计划时显示核心摘要字段与边界说明", () => {
    render(
      <CoachPlanSummaryCard
        summary={{
          fixedWakeTime: "07:00",
          earliestBedtime: "23:30",
          allowNap: true,
          napLimitMinutes: 20,
          notes: "保持固定起床，今晚按计划执行。",
        }}
      />,
    );

    expect(screen.getByText("固定起床：07:00")).toBeInTheDocument();
    expect(screen.getByText("最早上床：23:30")).toBeInTheDocument();
    expect(screen.getByText("今天能否小睡：允许")).toBeInTheDocument();
    expect(screen.getByText("小睡上限：20 分钟")).toBeInTheDocument();
    expect(screen.getByText(/计划说明：/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "今日计划由系统根据睡眠日记生成，AI 教练可以帮助解释，但不能直接修改计划。",
      ),
    ).toBeInTheDocument();
  });

  it("空状态时显示简洁说明与引导动作", () => {
    render(<CoachPlanSummaryCard summary={null} />);

    expect(screen.getByText("今天还没有可用的睡眠计划。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "先填写睡眠日记" })).toHaveAttribute(
      "href",
      "/app/diary/new",
    );
  });

  it("有计划时按当日计划动态显示可点击提示问题，并通过 onPromptSelect 回调", async () => {
    const user = userEvent.setup();
    const onPromptSelect = vi.fn();

    render(
      <CoachPlanSummaryCard
        summary={{
          fixedWakeTime: "07:00",
          earliestBedtime: "23:30",
          allowNap: true,
          napLimitMinutes: 20,
          notes: null,
        }}
        onPromptSelect={onPromptSelect}
      />,
    );

    expect(
      screen.getByRole("button", { name: "今天可以小睡多久？为什么只能这么久？" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "为什么今晚最早上床时间是这个？" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "今天可以小睡多久？为什么只能这么久？",
      }),
    );
    expect(onPromptSelect).toHaveBeenCalledWith(
      "今天可以小睡多久？为什么只能这么久？",
    );
    expect(onPromptSelect).toHaveBeenCalledTimes(1);
  });

  it("无计划时显示通用问题提示，并可通过回调抛出", async () => {
    const user = userEvent.setup();
    const onPromptSelect = vi.fn();
    render(<CoachPlanSummaryCard summary={null} onPromptSelect={onPromptSelect} />);

    const genericPrompt = "我现在先做什么，才能尽快生成今日计划？";
    await user.click(screen.getByRole("button", { name: genericPrompt }));
    expect(onPromptSelect).toHaveBeenCalledWith(genericPrompt);
  });
});
