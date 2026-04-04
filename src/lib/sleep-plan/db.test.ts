import { describe, expect, it } from "vitest";
import { LIMITED_DATA_NOTE } from "@/lib/sleep-plan/constants";
import { mapSleepPlanRow, normalizePgTime } from "@/lib/sleep-plan/db";

describe("normalizePgTime", () => {
  it("截断秒", () => {
    expect(normalizePgTime("07:00:00")).toBe("07:00");
    expect(normalizePgTime("23:30:59")).toBe("23:30");
  });
});

describe("mapSleepPlanRow", () => {
  it("映射 snake_case 行", () => {
    const row = mapSleepPlanRow({
      id: "uuid-1",
      user_id: "user-1",
      plan_date: "2026-04-10",
      source_window_start: "2026-04-04",
      source_window_end: "2026-04-10",
      based_on_entry_count: 3,
      based_on_entry_ids: ["a", "b"],
      status: "active",
      fixed_wake_time: "07:00:00",
      earliest_bedtime: "23:30:00",
      allow_nap: true,
      nap_limit_minutes: 20,
      sleep_if_not_sleepy_action: "x",
      awake_too_long_action: "y",
      notes: "n",
      rule_version: "v1",
      rule_inputs: { a: 1 },
      rule_outputs: { b: 2 },
      created_by: "rules_engine",
      created_at: "2026-04-10T00:00:00Z",
      updated_at: "2026-04-10T00:00:00Z",
    });
    expect(row.fixed_wake_time).toBe("07:00");
    expect(row.based_on_entry_ids).toEqual(["a", "b"]);
    expect(row.rule_inputs).toEqual({ a: 1 });
  });
});

describe("规则 notes 含有限数据说明", () => {
  it("constants 文案存在", () => {
    expect(LIMITED_DATA_NOTE).toContain("有限数据");
  });
});
