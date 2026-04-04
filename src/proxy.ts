import { NextResponse, type NextRequest } from "next/server";
import {
  COACH_E2E_FIXTURE_HEADER,
  shouldBypassAuthForCoachE2E,
} from "@/lib/e2e/coach-fixture-guard";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  if (
    shouldBypassAuthForCoachE2E({
      pathname: request.nextUrl.pathname,
      host: request.headers.get("host"),
    })
  ) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(COACH_E2E_FIXTURE_HEADER, "1");
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
