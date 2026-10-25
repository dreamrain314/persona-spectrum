-- 人格光谱 · 评论区建表脚本
-- 使用方法:Supabase Dashboard → SQL Editor → 粘贴本文件全部内容 → Run
-- 之后把项目 Settings → API 里的 Project URL 与 anon public key 填入 js/data/comment-config.js

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  title text not null,                       -- 人格称号(房间键)
  nickname text not null default '匿名访客',
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_title_idx on public.comments (title, created_at desc);

-- 行级安全:匿名可读、可插入;插入受长度约束(与前端一致),禁止任何人更新/删除
alter table public.comments enable row level security;

drop policy if exists "任何人可读" on public.comments;
create policy "任何人可读" on public.comments
  for select using (true);

drop policy if exists "任何人可匿名发布" on public.comments;
create policy "任何人可匿名发布" on public.comments
  for insert with check (
    char_length(title) between 1 and 60
    and char_length(nickname) between 1 and 24
    and char_length(content) between 1 and 500
  );

-- 实时推送(重复运行时跳过)
do $$
begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null;
end $$;

-- 管理方式:Dashboard → Table Editor → comments,可手动删除不当内容
