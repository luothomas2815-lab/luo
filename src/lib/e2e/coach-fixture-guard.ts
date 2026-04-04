/**
 * 仅用于 E2E 的 /app/coach fixture 与鉴权放行守卫。
 * 禁止在生产或预发开启；必须显式设置 E2E_COACH_FIXTURE=1 才会生效。
 */
export const COACH_E2E_FIXTURE_ENV_KEY = "E2E_COACH_FIXTURE";
export const COACH_E2E_FIXTURE_HEADER = "x-e2e-coach-fixture";

const COACH_PATH_RE = /^\/app\/coach(?:\/|$)/;

function isLocalhost(host: string | null | undefined): boolean {
  if (!host) return false;
  const normalized = host.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.startsWith("localhost:") ||
    normalized === "127.0.0.1" ||
    normalized.startsWith("127.0.0.1:") ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.startsWith("[::1]:")
  );
}

export function isCoachE2EFixtureEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[COACH_E2E_FIXTURE_ENV_KEY] === "1";
}

export function isCoachRoutePath(pathname: string): boolean {
  return COACH_PATH_RE.test(pathname);
}

export function shouldBypassAuthForCoachE2E(params: {
  pathname: string;
  host: string | null | undefined;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = params.env ?? process.env;
  return (
    isCoachE2EFixtureEnabled(env) &&
    isCoachRoutePath(params.pathname) &&
    isLocalhost(params.host)
  );
}

export function shouldUseCoachFixtureByHeader(params: {
  headerValue: string | null | undefined;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = params.env ?? process.env;
  return isCoachE2EFixtureEnabled(env) && params.headerValue === "1";
}
