import { describe, expect, it } from "vitest";
import {
  shouldBypassAuthForCoachE2E,
  shouldUseCoachFixtureByHeader,
} from "./coach-fixture-guard";

const testEnvBase = { NODE_ENV: "test" } as NodeJS.ProcessEnv;

describe("coach fixture guard", () => {
  it("未开启 E2E 开关时不会放行或启用 fixture", () => {
    expect(
      shouldBypassAuthForCoachE2E({
        pathname: "/app/coach",
        host: "127.0.0.1:3101",
        env: testEnvBase,
      }),
    ).toBe(false);

    expect(
      shouldUseCoachFixtureByHeader({
        headerValue: "1",
        env: testEnvBase,
      }),
    ).toBe(false);
  });

  it("开启 E2E 开关时仅 /app/coach* 且本机 host 才放行", () => {
    const env = {
      NODE_ENV: "test",
      E2E_COACH_FIXTURE: "1",
    } as NodeJS.ProcessEnv;

    expect(
      shouldBypassAuthForCoachE2E({
        pathname: "/app/coach",
        host: "localhost:3101",
        env,
      }),
    ).toBe(true);
    expect(
      shouldBypassAuthForCoachE2E({
        pathname: "/app/coach/history",
        host: "127.0.0.1:3101",
        env,
      }),
    ).toBe(true);

    expect(
      shouldBypassAuthForCoachE2E({
        pathname: "/app/diary",
        host: "127.0.0.1:3101",
        env,
      }),
    ).toBe(false);
    expect(
      shouldBypassAuthForCoachE2E({
        pathname: "/app/coach",
        host: "staging.example.com",
        env,
      }),
    ).toBe(false);
  });
});
