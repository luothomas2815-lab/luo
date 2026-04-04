-- 入组筛查结果（onboarding 提交）

create table public.sleep_screenings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  responses jsonb not null,
  risk_level text not null,
  risk_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sleep_screenings_responses_object check (jsonb_typeof(responses) = 'object'),
  constraint sleep_screenings_risk_flags_array check (jsonb_typeof(risk_flags) = 'array'),
  constraint sleep_screenings_risk_level_check check (risk_level in ('low', 'medium', 'high')),
  constraint sleep_screenings_one_per_user unique (user_id)
);

create index sleep_screenings_user_id_idx on public.sleep_screenings (user_id);

create trigger sleep_screenings_set_updated_at
before update on public.sleep_screenings
for each row execute procedure public.set_updated_at();

comment on table public.sleep_screenings is '入组/初筛问卷答案与规则引擎风险分级';

alter table public.sleep_screenings enable row level security;

create policy "sleep_screenings_isolation"
  on public.sleep_screenings for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
