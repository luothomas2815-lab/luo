-- sleep_plans：规则引擎生成的「今日/当日」睡眠计划（可版本化、可审计）
-- 计划内容必须由规则引擎写入；LLM 不得写入本表（由应用层保证）。

create table public.sleep_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  plan_date date not null,

  source_window_start date not null,
  source_window_end date not null,

  based_on_entry_count integer not null default 0,

  based_on_entry_ids uuid[] not null default '{}'::uuid[],

  status text not null,
  constraint sleep_plans_status_check check (status in ('active', 'superseded')),

  fixed_wake_time time without time zone not null,
  earliest_bedtime time without time zone not null,

  allow_nap boolean not null default false,
  nap_limit_minutes integer,

  sleep_if_not_sleepy_action text,
  awake_too_long_action text,
  notes text,

  rule_version text not null,

  rule_inputs jsonb not null default '{}'::jsonb,
  rule_outputs jsonb not null default '{}'::jsonb,

  created_by text not null,
  constraint sleep_plans_created_by_check check (created_by in ('rules_engine', 'manual')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sleep_plans_source_window_order check (source_window_start <= source_window_end),
  constraint sleep_plans_based_on_entry_count_nonneg check (based_on_entry_count >= 0),
  constraint sleep_plans_rule_inputs_object check (jsonb_typeof(rule_inputs) = 'object'),
  constraint sleep_plans_rule_outputs_object check (jsonb_typeof(rule_outputs) = 'object'),
  constraint sleep_plans_nap_limit_nonneg check (
    nap_limit_minutes is null or nap_limit_minutes >= 0
  )
);

comment on table public.sleep_plans is '睡眠计划（规则引擎）；同一用户同一 plan_date 仅允许一条 active，其余历史为 superseded';

comment on column public.sleep_plans.plan_date is '计划目标日（展示「今日计划」用），用户本地日历日';
comment on column public.sleep_plans.source_window_start is '用于计算的睡眠日记日期窗口起始日（含）';
comment on column public.sleep_plans.source_window_end is '用于计算的睡眠日记日期窗口结束日（含）';
comment on column public.sleep_plans.based_on_entry_count is '参与计算的日记条数；应与 based_on_entry_ids 长度一致（由应用维护）';
comment on column public.sleep_plans.based_on_entry_ids is '引用的 sleep_diary_entries.id；由应用保证归属当前用户';
comment on column public.sleep_plans.status is 'active=当前生效；superseded=被新版本替代';
comment on column public.sleep_plans.fixed_wake_time is '固定起床时间（TIME，无时区；时区上下文见 rule_inputs 或 profiles）';
comment on column public.sleep_plans.earliest_bedtime is '最早可上床时间';
comment on column public.sleep_plans.sleep_if_not_sleepy_action is '不困仍躺床时的行为指令（可由规则模板填充）';
comment on column public.sleep_plans.awake_too_long_action is '清醒过久时的行为指令';
comment on column public.sleep_plans.rule_inputs is '规则引擎输入快照（审计）';
comment on column public.sleep_plans.rule_outputs is '规则引擎输出快照（审计）';
comment on column public.sleep_plans.created_by is 'rules_engine | manual';

-- 同一用户、同一 plan_date 仅允许一条 active（重新生成时先把旧行标为 superseded，再插入新 active）
create unique index sleep_plans_one_active_per_user_plan_date
  on public.sleep_plans (user_id, plan_date)
  where status = 'active';

create index sleep_plans_user_plan_date_created_idx
  on public.sleep_plans (user_id, plan_date desc, created_at desc);

create index sleep_plans_user_created_idx
  on public.sleep_plans (user_id, created_at desc);

create index sleep_plans_user_status_plan_date_idx
  on public.sleep_plans (user_id, status, plan_date desc);

create trigger sleep_plans_set_updated_at
  before update on public.sleep_plans
  for each row execute procedure public.set_updated_at();

alter table public.sleep_plans enable row level security;

create policy "sleep_plans_select_own"
  on public.sleep_plans for select
  using (user_id = (select auth.uid()));

create policy "sleep_plans_insert_own"
  on public.sleep_plans for insert
  with check (user_id = (select auth.uid()));

create policy "sleep_plans_update_own"
  on public.sleep_plans for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "sleep_plans_delete_own"
  on public.sleep_plans for delete
  using (user_id = (select auth.uid()));
