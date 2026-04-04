-- AI 教练：会话与消息表已在 20260403120000_initial_schema.sql 中创建。
-- 本迁移补齐 ai_messages 的 user_id、safety_flag，放宽 metadata 为可空，
-- 增加校验触发器与列表索引，并收紧 RLS（按 user_id 隔离消息）。

-- -----------------------------------------------------------------------------
-- 1. ai_messages：新增 user_id、safety_flag
-- -----------------------------------------------------------------------------

alter table public.ai_messages
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.ai_messages
  add column if not exists safety_flag boolean not null default false;

-- 历史数据：从所属会话回填 user_id（迁移前若表为空则无副作用）
update public.ai_messages m
set user_id = c.user_id
from public.ai_conversations c
where m.conversation_id = c.id
  and m.user_id is null;

alter table public.ai_messages
  alter column user_id set not null;

comment on column public.ai_messages.user_id is '与 ai_conversations.user_id 一致，便于 RLS 与跨会话查询；插入时必须与会话归属相同';
comment on column public.ai_messages.safety_flag is 'true 表示该条与安全策略相关（如拦截后的固定回复或需审计的内容）';

-- -----------------------------------------------------------------------------
-- 2. metadata：允许为 NULL（jsonb 仍须为 object 当非空时）
-- -----------------------------------------------------------------------------

alter table public.ai_messages drop constraint if exists ai_messages_metadata_object;

alter table public.ai_messages
  add constraint ai_messages_metadata_object check (
    metadata is null or jsonb_typeof(metadata) = 'object'
  );

alter table public.ai_messages alter column metadata drop default;
alter table public.ai_messages alter column metadata drop not null;

-- -----------------------------------------------------------------------------
-- 3. 校验：message.user_id 必须与 conversation.user_id 一致
-- -----------------------------------------------------------------------------

create or replace function public.ai_messages_enforce_conversation_user()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  conv_user uuid;
begin
  select c.user_id into conv_user
  from public.ai_conversations c
  where c.id = new.conversation_id;

  if conv_user is null then
    raise exception 'ai_messages: conversation % not found', new.conversation_id;
  end if;

  if new.user_id is distinct from conv_user then
    raise exception 'ai_messages.user_id must equal ai_conversations.user_id for this conversation_id';
  end if;

  return new;
end;
$$;

drop trigger if exists ai_messages_enforce_conversation_user_trg on public.ai_messages;

create trigger ai_messages_enforce_conversation_user_trg
before insert or update of conversation_id, user_id
on public.ai_messages
for each row execute procedure public.ai_messages_enforce_conversation_user();

comment on function public.ai_messages_enforce_conversation_user() is '防止跨会话伪造 user_id；与 RLS 双保险';

-- -----------------------------------------------------------------------------
-- 4. 索引（列表、审计）
-- -----------------------------------------------------------------------------

-- 按用户跨会话浏览消息时间线（可选；与按会话索引互补）
create index if not exists ai_messages_user_id_created_at_idx
  on public.ai_messages (user_id, created_at desc);

-- 会话内消息顺序 + 用户维度（覆盖常见查询）
create index if not exists ai_messages_conversation_user_created_idx
  on public.ai_messages (conversation_id, user_id, created_at asc);

-- -----------------------------------------------------------------------------
-- 5. RLS：消息按 user_id 隔离，且会话必须属于当前用户
-- -----------------------------------------------------------------------------

drop policy if exists "ai_messages_select_own" on public.ai_messages;
drop policy if exists "ai_messages_insert_own" on public.ai_messages;
drop policy if exists "ai_messages_update_own" on public.ai_messages;
drop policy if exists "ai_messages_delete_own" on public.ai_messages;

create policy "ai_messages_select_own"
  on public.ai_messages for select
  using (user_id = (select auth.uid()));

create policy "ai_messages_insert_own"
  on public.ai_messages for insert
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.ai_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "ai_messages_update_own"
  on public.ai_messages for update
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.ai_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "ai_messages_delete_own"
  on public.ai_messages for delete
  using (user_id = (select auth.uid()));
