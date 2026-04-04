import { describe, expect, it } from "vitest";
import {
  buildActivePlanSummary,
  buildConversationHistoryContext,
  summarizeSleepRows7D,
} from "@/lib/coach/context";
import type { CoachMessageRecord } from "@/lib/coach/types";

describe("buildActivePlanSummary", () => {
  it("无 active plan 时返回可审计 fallback", () => {
    const summary = buildActivePlanSummary(null);
    expect(summary.status).toBe("missing");
    expect(summary.notes).toContain("当前无计划");
  });

  it("有 active plan 时返回结构化摘要", () => {
    const summary = buildActivePlanSummary({
      fixed_wake_time: "07:00",
      earliest_bedtime: "23:30",
      allow_nap: false,
      nap_limit_minutes: 20,
      sleep_if_not_sleepy_action: "未困不要上床",
      awake_too_long_action: "先离床",
      notes: "基于最近 7 天数据",
    });
    expect(summary.status).toBe("available");
    expect(summary.fixedWakeTime).toBe("07:00");
    expect(summary.allowNap).toBe(false);
  });
});

describe("buildConversationHistoryContext", () => {
  it("只保留必要最近轮次", () => {
    const messages = Array.from({ length: 8 }, (_, index) => ({
      id: `m${index}`,
      conversation_id: "c1",
      user_id: "u1",
      role: index % 2 === 0 ? "user" : "assistant",
      content: `content-${index}`,
      safety_flag: false,
      metadata: null,
      created_at: `2026-04-0${index + 1}T00:00:00Z`,
      updated_at: `2026-04-0${index + 1}T00:00:00Z`,
    })) as CoachMessageRecord[];

    const history = buildConversationHistoryContext(messages, 6);
    expect(history).toHaveLength(6);
    expect(history[0].content).toBe("content-2");
    expect(history[5].content).toBe("content-7");
  });
});

describe("summarizeSleepRows7D", () => {
  it("汇总最近 7 天最小必要睡眠摘要", () => {
    const rows = [
      {
        entry_date: "2026-04-01",
        payload: {
          bed_time: "23:00",
          lights_out_time: "23:10",
          sleep_latency_min: 20,
          night_wake_count: 1,
          night_wake_duration_min: 30,
          final_awakening_time: "06:45",
          out_of_bed_time: "07:00",
          daytime_nap_min: 0,
          caffeine: "none",
          alcohol: "none",
          daytime_energy: 3,
        },
      },
      {
        entry_date: "2026-04-02",
        payload: {
          bed_time: "23:10",
          lights_out_time: "23:20",
          sleep_latency_min: 15,
          night_wake_count: 0,
          night_wake_duration_min: 20,
          final_awakening_time: "06:50",
          out_of_bed_time: "07:10",
          daytime_nap_min: 10,
          caffeine: "light",
          alcohol: "none",
          daytime_energy: 4,
        },
      },
    ];

    const summary = summarizeSleepRows7D(rows, "2026-03-27", "2026-04-02");
    expect(summary.validEntryCount).toBe(2);
    expect(summary.avgTstMinutes).not.toBeNull();
    expect(summary.avgTibMinutes).not.toBeNull();
    expect(summary.avgSleepEfficiencyPercent).not.toBeNull();
    expect(summary.avgWakeTime).toBe("07:05");
    expect(summary.hasMissingRecentDays).toBe(true);
  });
});
