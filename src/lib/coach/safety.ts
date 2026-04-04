import { createClient } from "@/lib/supabase/server";

export type SafetyClassificationKind =
  | "safe"
  | "medication"
  | "diagnosis"
  | "high_risk"
  | "plan_override";

export type SafetySeverity = "low" | "medium" | "high";

export interface SafetyClassification {
  kind: SafetyClassificationKind;
  matched: boolean;
  severity: SafetySeverity | null;
  code:
    | "ok"
    | "medication_advice_blocked"
    | "diagnosis_blocked"
    | "high_risk_crisis"
    | "plan_override_blocked";
  matchedKeywords: string[];
}

export interface SafetyResponse {
  blocked: boolean;
  shouldRecordEvent: boolean;
  message: string;
}

export interface RecordSafetyEventInput {
  userId: string;
  message: string;
  classification: SafetyClassification;
  metadata?: Record<string, unknown>;
}

const HIGH_RISK_PATTERNS = [
  /自杀/u,
  /不想活/u,
  /活着没意义/u,
  /结束生命/u,
  /伤害自己/u,
  /自残/u,
  /想死/u,
  /杀了自己/u,
  /伤害别人/u,
  /想杀人/u,
  /幻觉/u,
  /幻听/u,
  /呼吸不上来/u,
  /胸痛/u,
  /晕厥/u,
  /抽搐/u,
];

const MEDICATION_PATTERNS = [
  /吃什么药/u,
  /吃多少/u,
  /药物剂量/u,
  /剂量/u,
  /停药/u,
  /换药/u,
  /开药/u,
  /处方/u,
  /安眠药/u,
];

const DIAGNOSIS_PATTERNS = [
  /我是不是抑郁/u,
  /我是不是焦虑/u,
  /我是不是睡眠呼吸暂停/u,
  /我是不是重度失眠/u,
  /是不是抑郁/u,
  /是不是焦虑/u,
  /是不是睡眠呼吸暂停/u,
  /是不是重度失眠/u,
];

const PLAN_OVERRIDE_PATTERNS = [
  /修改.*sleep plan/u,
  /修改.*计划/u,
  /改.*sleep plan/u,
  /改.*计划/u,
  /调整.*sleep plan/u,
  /调整.*计划/u,
  /直接改.*起床/u,
  /把.*fixedWakeTime.*改/u,
  /把.*earliestBedtime.*改/u,
  /今天.*计划.*改/u,
  /帮我改计划/u,
];

function collectMatchedKeywords(message: string, patterns: RegExp[]): string[] {
  return patterns
    .map((pattern) => {
      const match = message.match(pattern);
      return match?.[0] ?? null;
    })
    .filter((value): value is string => Boolean(value));
}

export function classifySafety(message: string): SafetyClassification {
  const normalized = message.trim();

  const highRiskKeywords = collectMatchedKeywords(normalized, HIGH_RISK_PATTERNS);
  if (highRiskKeywords.length > 0) {
    return {
      kind: "high_risk",
      matched: true,
      severity: "high",
      code: "high_risk_crisis",
      matchedKeywords: highRiskKeywords,
    };
  }

  const medicationKeywords = collectMatchedKeywords(
    normalized,
    MEDICATION_PATTERNS,
  );
  if (medicationKeywords.length > 0) {
    return {
      kind: "medication",
      matched: true,
      severity: "medium",
      code: "medication_advice_blocked",
      matchedKeywords: medicationKeywords,
    };
  }

  const diagnosisKeywords = collectMatchedKeywords(
    normalized,
    DIAGNOSIS_PATTERNS,
  );
  if (diagnosisKeywords.length > 0) {
    return {
      kind: "diagnosis",
      matched: true,
      severity: "medium",
      code: "diagnosis_blocked",
      matchedKeywords: diagnosisKeywords,
    };
  }

  const planOverrideKeywords = collectMatchedKeywords(
    normalized,
    PLAN_OVERRIDE_PATTERNS,
  );
  if (planOverrideKeywords.length > 0) {
    return {
      kind: "plan_override",
      matched: true,
      severity: "low",
      code: "plan_override_blocked",
      matchedKeywords: planOverrideKeywords,
    };
  }

  return {
    kind: "safe",
    matched: false,
    severity: null,
    code: "ok",
    matchedKeywords: [],
  };
}

export function buildSafetyResponse(
  classification: SafetyClassification,
): SafetyResponse {
  switch (classification.kind) {
    case "high_risk":
      return {
        blocked: true,
        shouldRecordEvent: true,
        message:
          "我现在不能继续普通睡眠教练对话。你提到的内容显示当前可能有较高风险，请先把安全放在第一位：尽快联系当地紧急服务，或立即联系家人、朋友、医生、心理危机干预热线，尽量不要一个人独自承受。如果你此刻已经处在危险中，请立刻寻求线下紧急帮助。",
      };
    case "medication":
      return {
        blocked: true,
        shouldRecordEvent: false,
        message:
          "我不能提供药物剂量、换药、停药或处方调整建议。这部分需要由医生或其他合格医疗专业人员结合你的具体情况判断。若你对当前用药或症状有担心，建议尽快咨询医生。",
      };
    case "diagnosis":
      return {
        blocked: true,
        shouldRecordEvent: false,
        message:
          "我不能替代医生做诊断，也不能判断你是否属于抑郁、焦虑、睡眠呼吸暂停或重度失眠。如果这些困扰已经明显影响到你的安全、日常功能或白天状态，建议尽快做专业评估。",
      };
    case "plan_override":
      return {
        blocked: true,
        shouldRecordEvent: false,
        message:
          "我不能直接修改今天的 sleep plan。这个计划是系统根据你的睡眠日记和规则引擎生成的；我可以帮你解释为什么这样安排，并给出执行上的小建议，但不能替你改 fixedWakeTime、earliestBedtime、allowNap 或 napLimitMinutes。",
      };
    case "safe":
    default:
      return {
        blocked: false,
        shouldRecordEvent: false,
        message: "",
      };
  }
}

export async function recordSafetyEvent(
  input: RecordSafetyEventInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.classification.matched || !input.classification.severity) {
    return { ok: false, error: "仅匹配到安全边界后才记录 safety event" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("safety_events")
    .insert({
      user_id: input.userId,
      event_type: input.classification.code,
      severity: input.classification.severity,
      detail: {
        source: "coach_safety_guard",
        message_preview: input.message.slice(0, 200),
        matched_keywords: input.classification.matchedKeywords,
        classification_kind: input.classification.kind,
      },
      source: "server_guard",
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "记录 safety event 失败" };
  }

  return { ok: true, id: String(data.id) };
}
