-- Sleep App MVP — initial schema (Postgres / Supabase)
-- Domains: profile, screening, sleep diary, daily plan, AI chat, weekly review, safety

-- -----------------------------------------------------------------------------
-- Extensions (gen_random_uuid is built-in on Postgres 13+; Supabase provides it)
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. profiles — 与 auth.users 1:1，存放非敏感展示字段与偏好
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'Asia/Shanghai',
  display_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

comment on table public.profiles is '用户档案；id 等同 auth.users.id，供审计与扩展元数据';

-- -----------------------------------------------------------------------------
-- 2. screening_responses — 入组筛查答卷与规则引擎派生标记
-- -----------------------------------------------------------------------------

create table public.screening_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  questionnaire_version text not null default '1',
  responses jsonb not null default '{}'::jsonb,
  derived_flags jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint screening_responses_responses_object check (jsonb_typeof(responses) = 'object'),
  constraint screening_responses_derived_object check (jsonb_typeof(derived_flags) = 'object'),
  constraint screening_responses_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index screening_responses_user_id_created_at_idx
  on public.screening_responses (user_id, created_at desc);

create trigger screening_responses_set_updated_at
before update on public.screening_responses
for each row execute procedure public.set_updated_at();

comment on table public.screening_responses is '入组筛查；responses 为原始答案，derived_flags 为规则引擎输出';

-- -----------------------------------------------------------------------------
-- 3. sleep_diary_entries — 每日睡眠日记（每用户每天最多一条）
-- -----------------------------------------------------------------------------

create table public.sleep_diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sleep_diary_entries_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint sleep_diary_entries_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint sleep_diary_entries_user_date_unique unique (user_id, entry_date)
);

create index sleep_diary_entries_user_id_entry_date_idx
  on public.sleep_diary_entries (user_id, entry_date desc);

create trigger sleep_diary_entries_set_updated_at
before update on public.sleep_diary_entries
for each row execute procedure public.set_updated_at();

comment on column public.sleep_diary_entries.entry_date is '用户日历日（由客户端按用户时区约定为 YYYY-MM-DD）';

-- -----------------------------------------------------------------------------
-- 4. daily_plans — 规则引擎每日计划（每用户每天最多一条）
-- -----------------------------------------------------------------------------

create table public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_date date not null,
  payload jsonb not null,
  engine_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_plans_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint daily_plans_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint daily_plans_user_date_unique unique (user_id, plan_date)
);

create index daily_plans_user_id_plan_date_idx
  on public.daily_plans (user_id, plan_date desc);

create trigger daily_plans_set_updated_at
before update on public.daily_plans
for each row execute procedure public.set_updated_at();

comment on table public.daily_plans is '每日计划；payload 为规则引擎结构化输出';

-- -----------------------------------------------------------------------------
-- 5. ai_conversations — AI 对话会话
-- -----------------------------------------------------------------------------

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_conversations_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index ai_conversations_user_id_updated_at_idx
  on public.ai_conversations (user_id, updated_at desc);

create trigger ai_conversations_set_updated_at
before update on public.ai_conversations
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. ai_messages — 会话内消息（无外显 user_id，归属由会话限定）
-- -----------------------------------------------------------------------------

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_messages_role_check check (role in ('user', 'assistant', 'system')),
  constraint ai_messages_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index ai_messages_conversation_id_created_at_idx
  on public.ai_messages (conversation_id, created_at asc);

create trigger ai_messages_set_updated_at
before update on public.ai_messages
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. weekly_reviews — 每周复盘（每用户每周一条，week_start_date 为周起始日）
-- -----------------------------------------------------------------------------

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start_date date not null,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_reviews_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint weekly_reviews_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint weekly_reviews_user_week_unique unique (user_id, week_start_date)
);

create index weekly_reviews_user_id_week_start_idx
  on public.weekly_reviews (user_id, week_start_date desc);

create trigger weekly_reviews_set_updated_at
before update on public.weekly_reviews
for each row execute procedure public.set_updated_at();

comment on column public.weekly_reviews.week_start_date is '该周起始日（建议约定为周一，与客户端一致）';

-- -----------------------------------------------------------------------------
-- 8. safety_events — 安全与转诊相关事件
-- -----------------------------------------------------------------------------

create table public.safety_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  severity text not null,
  detail jsonb not null default '{}'::jsonb,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint safety_events_severity_check check (severity in ('low', 'medium', 'high')),
  constraint safety_events_detail_object check (jsonb_typeof(detail) = 'object'),
  constraint safety_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index safety_events_user_id_created_at_idx
  on public.safety_events (user_id, created_at desc);

create index safety_events_user_id_severity_idx
  on public.safety_events (user_id, severity);

create trigger safety_events_set_updated_at
before update on public.safety_events
for each row execute procedure public.set_updated_at();

comment on column public.safety_events.source is '如 client_rule、llm_classifier、server_guard';

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.screening_responses enable row level security;
alter table public.sleep_diary_entries enable row level security;
alter table public.daily_plans enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.weekly_reviews enable row level security;
alter table public.safety_events enable row level security;

-- profiles：仅能读写自己的行
create policy "profiles_select_own"
  on public.profiles for select
  using (id = (select auth.uid()));

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles_delete_own"
  on public.profiles for delete
  using (id = (select auth.uid()));

-- 通用：user_id 表 — 仅本人
create policy "screening_responses_isolation"
  on public.screening_responses for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "sleep_diary_entries_isolation"
  on public.sleep_diary_entries for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "daily_plans_isolation"
  on public.daily_plans for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "ai_conversations_isolation"
  on public.ai_conversations for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ai_messages：通过会话归属约束，避免跨用户插入
create policy "ai_messages_select_own"
  on public.ai_messages for select
  using (
    exists (
      select 1
      from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "ai_messages_insert_own"
  on public.ai_messages for insert
  with check (
    exists (
      select 1
      from public.ai_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "ai_messages_update_own"
  on public.ai_messages for update
  using (
    exists (
      select 1
      from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.ai_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "ai_messages_delete_own"
  on public.ai_messages for delete
  using (
    exists (
      select 1
      from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "weekly_reviews_isolation"
  on public.weekly_reviews for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "safety_events_isolation"
  on public.safety_events for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
