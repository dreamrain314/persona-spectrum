-- 评论区审核 · v2 增量脚本(SQL Editor 直接运行,可重复执行)
-- 新增:settings 开关表(llm_moderation)+ comments.llm_flag 列(LLM 全盘扫描结果)

-- 1) 开关表:站长在 Table Editor → settings,把 llm_moderation 的 value 改为 on/off
create table if not exists public.settings (
  key text primary key,
  value text not null
);
alter table public.settings enable row level security;
drop policy if exists "任何人可读" on public.settings;
create policy "任何人可读" on public.settings for select using (true);
insert into public.settings (key, value) values ('llm_moderation', 'off')
  on conflict (key) do nothing;

-- 2) LLM 扫描结果列('ok' | 'violation' | 'suspect' | null=未扫描)
--    anon 只有读/插策略,无法改写本列;Edge Function 用 service key 写入
alter table public.comments add column if not exists llm_flag text;
