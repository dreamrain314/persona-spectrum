-- counter-v1.sql — 匿名测评计数器
-- 运行方式:Supabase Dashboard → SQL Editor → 粘贴全部内容 → Run
-- 语义:只在测评真正完成(报告生成)时 +1;不收集任何个人数据、无任何身份信息
-- 前端通过 RPC 调用,anon 对表本身无任何直接权限(RLS + revoke)

create table if not exists test_counter (
  id int primary key,
  total bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into test_counter (id, total) values (1, 0) on conflict (id) do nothing;

-- 每日计数(便于看趋势,不影响前端)
create table if not exists test_counter_daily (
  day date primary key,
  total bigint not null default 0
);
insert into test_counter_daily (day, total) values (current_date, 0) on conflict (day) do nothing;

alter table test_counter enable row level security;
alter table test_counter_daily enable row level security;
revoke all on test_counter from anon, authenticated;
revoke all on test_counter_daily from anon, authenticated;

-- 匿名自增(security definer 绕过 RLS,只暴露这一个动作)
create or replace function increment_test_count()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total bigint;
begin
  update test_counter
     set total = total + 1, updated_at = now()
   where id = 1
   returning total into new_total;

  insert into test_counter_daily (day, total) values (current_date, 1)
  on conflict (day) do update set total = test_counter_daily.total + 1;

  return new_total;
end;
$$;

-- 匿名读取总数
create or replace function get_test_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select total from test_counter where id = 1;
$$;

revoke all on function increment_test_count() from public;
revoke all on function get_test_count() from public;
grant execute on function increment_test_count() to anon;
grant execute on function get_test_count() to anon;
