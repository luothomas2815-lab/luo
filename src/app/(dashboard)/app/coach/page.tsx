import { CoachShell } from "@/components/coach/coach-shell";
import {
  getLatestConversationWithMessages,
  listConversations,
} from "@/lib/coach/storage";
import {
  COACH_E2E_FIXTURE_HEADER,
  shouldUseCoachFixtureByHeader,
} from "@/lib/e2e/coach-fixture-guard";
import { getTodayActiveSleepPlan } from "@/lib/sleep-plan/today-active";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "AI 教练",
};

const HISTORY_LIMIT = 8;

export default async function CoachPage() {
  // 仅 E2E：必须有环境开关 + proxy 注入 header 才启用 fixture。
  if (
    shouldUseCoachFixtureByHeader({
      headerValue: (await headers()).get(COACH_E2E_FIXTURE_HEADER),
    })
  ) {
    return (
      <CoachShell
        initialConversationId="e2e-c1"
        initialTitle={null}
        initialMessages={[
          {
            id: "e2e-m1",
            role: "user",
            content: "这是会话一",
            safetyFlag: false,
          },
        ]}
        initialConversationHistory={[
          {
            conversationId: "e2e-c1",
            title: "E2E 会话一",
            updatedAt: "2026-04-04T10:00:00Z",
          },
          {
            conversationId: "e2e-c2",
            title: "E2E 会话二",
            updatedAt: "2026-04-04T09:00:00Z",
          },
        ]}
        showPlanSummary={{
          fixedWakeTime: "07:00",
          earliestBedtime: "23:30",
          allowNap: false,
          napLimitMinutes: null,
          notes: "本计划基于有限数据生成，后续会继续校准。",
        }}
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app/coach");
  }

  const conversation = await getLatestConversationWithMessages(user.id);
  const recentConversations = (await listConversations(user.id)).slice(0, HISTORY_LIMIT);
  const initialConversationHistory = recentConversations.map((item) => ({
    conversationId: item.id,
    title: item.title,
    updatedAt: item.updated_at,
  }));
  const activePlanResult = await getTodayActiveSleepPlan(user.id);

  return (
    <CoachShell
      initialConversationId={conversation?.id ?? null}
      initialTitle={conversation?.title ?? null}
      initialMessages={
        conversation?.messages.map((message) => ({
          id: message.id,
          role:
            message.role === "assistant"
              ? ("assistant" as const)
              : ("user" as const),
          content: message.content,
          safetyFlag: message.safety_flag,
        })) ?? []
      }
      initialConversationHistory={initialConversationHistory}
      showPlanSummary={
        activePlanResult.data
          ? {
              fixedWakeTime: activePlanResult.data.fixed_wake_time,
              earliestBedtime: activePlanResult.data.earliest_bedtime,
              allowNap: activePlanResult.data.allow_nap,
              napLimitMinutes: activePlanResult.data.nap_limit_minutes,
              notes: activePlanResult.data.notes,
            }
          : null
      }
    />
  );
}
