import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { getPlanCalendarDateForUser } from "@/lib/sleep-plan/calendar-today";
import { fetchActiveSleepPlan } from "@/lib/sleep-plan/db";
import { getTodayActiveSleepPlan } from "@/lib/sleep-plan/today-active";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/sleep-plan/calendar-today", () => ({
  getPlanCalendarDateForUser: vi.fn(),
}));

vi.mock("@/lib/sleep-plan/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/sleep-plan/db")>();
  return {
    ...mod,
    fetchActiveSleepPlan: vi.fn(),
  };
});

describe("getTodayActiveSleepPlan", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as never);
    vi.mocked(getPlanCalendarDateForUser).mockReset();
    vi.mocked(fetchActiveSleepPlan).mockReset();
  });

  it("只读今天 active 计划并返回 data", async () => {
    vi.mocked(getPlanCalendarDateForUser).mockResolvedValue("2026-04-04");
    vi.mocked(fetchActiveSleepPlan).mockResolvedValue({
      data: {
        id: "p1",
        user_id: "u1",
        plan_date: "2026-04-04",
        source_window_start: "2026-03-29",
        source_window_end: "2026-04-04",
        based_on_entry_count: 2,
        based_on_entry_ids: ["d1", "d2"],
        status: "active",
        fixed_wake_time: "07:00",
        earliest_bedtime: "23:30",
        allow_nap: true,
        nap_limit_minutes: 20,
        sleep_if_not_sleepy_action: null,
        awake_too_long_action: null,
        notes: "说明",
        rule_version: "v1",
        rule_inputs: {},
        rule_outputs: {},
        created_by: "rules_engine",
        created_at: "t",
        updated_at: "t",
      },
      error: null,
    });

    const result = await getTodayActiveSleepPlan("u1");

    expect(result.planDate).toBe("2026-04-04");
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe("p1");
    expect(fetchActiveSleepPlan).toHaveBeenCalledWith({}, "u1", "2026-04-04");
  });

  it("无 active 计划时返回 data: null", async () => {
    vi.mocked(getPlanCalendarDateForUser).mockResolvedValue("2026-04-04");
    vi.mocked(fetchActiveSleepPlan).mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await getTodayActiveSleepPlan("u1");

    expect(result.planDate).toBe("2026-04-04");
    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });
});
