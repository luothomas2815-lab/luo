import { describe, expect, it } from "vitest";
import { truncateForCardNotes } from "@/components/sleep-plan/truncate-notes";

describe("truncateForCardNotes", () => {
  it("短文本不截断", () => {
    expect(truncateForCardNotes("abc")).toBe("abc");
  });

  it("长文本截断", () => {
    const s = "a".repeat(150);
    expect(truncateForCardNotes(s, 120).length).toBeLessThanOrEqual(120);
    expect(truncateForCardNotes(s, 120).endsWith("…")).toBe(true);
  });
});
