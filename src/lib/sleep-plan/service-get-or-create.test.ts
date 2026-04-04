import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { mapSleepPlanRow } from "@/lib/sleep-plan/db";
import * as persistPlan from "@/lib/sleep-plan/persist-plan";
import * as sleepPlanDb from "@/lib/sleep-plan/db";
import { getOrCreateActiveSleepPlanForDate } from "@/lib/sleep-plan/service";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/sleep-plan/persist-plan", () => ({
  persistSleepPlan: vi.fn(),
}));

vi.mock("@/lib/sleep-plan/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/sleep-plan/db")>();
  return {
    ...mod,
    fetchActiveSleepPlan: vi.fn(),
    fetchSleepPlanById: vi.fn(),
  };
});

const rawActivePlanRow: Record<string, unknown> = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "user-1",
  plan_date: "2026-04-10",
  source_window_start: "2026-04-04",
  source_window_end: "2026-04-10",
  based_on_entry_count: 0,
  based_on_entry_ids: [],
  status: "active",
  fixed_wake_time: "07:00:00",
  earliest_bedtime: "23:00:00",
  allow_nap: true,
  nap_limit_minutes: 20,
  sleep_if_not_sleepy_action: "x",
  awake_too_long_action: "y",
  notes: null,
  rule_version: "cbti-sleep-plan@1.0.0",
  rule_inputs: {},
  rule_outputs: {},
  created_by: "rules_engine",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("getOrCreateActiveSleepPlanForDate", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    vi.mocked(sleepPlanDb.fetchActiveSleepPlan).mockReset();
    vi.mocked(sleepPlanDb.fetchSleepPlanById).mockReset();
    vi.mocked(persistPlan.persistSleepPlan).mockReset();
  });

  it("当日已有 active 计划时不调用 persist，直接返回 existing", async () => {
    const existing = mapSleepPlanRow(rawActivePlanRow);
    vi.mocked(sleepPlanDb.fetchActiveSleepPlan).mockResolvedValue({
      data: existing,
      error: null,
    });

    const result = await getOrCreateActiveSleepPlanForDate("2026-04-10");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("existing");
      expect(result.plan.id).toBe(existing.id);
    }
    expect(persistPlan.persistSleepPlan).not.toHaveBeenCalled();
  });
});
