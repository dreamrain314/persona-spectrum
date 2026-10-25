-- 评论区 · v3 增量脚本(SQL Editor 直接运行,可重复执行)
-- 新增:回复功能所需的 parent_id / author_uid 两列 + 索引
-- 说明:不做登录。author_uid 是浏览器本地生成的持久标识(仅用于展示"这是我发的"),
--       不是账号,不含任何身份信息;写权限仍由现有 RLS 的匿名受限插入策略约束。

-- 1) 父评论 id(自引用外键,删父则级联删子)
alter table public.comments add column if not exists parent_id bigint
  references public.comments(id) on delete cascade;

-- 2) 作者本地标识
alter table public.comments add column if not exists author_uid text;

-- 3) 索引:按 title + 时间倒序取主列表、按父 id 取回复
create index if not exists comments_title_created_idx
  on public.comments (title, created_at desc);
create index if not exists comments_parent_idx
  on public.comments (parent_id);

-- 4) 补齐既有数据(原本都是主评论,parent_id 为 null,无需处理)

-- 可选:确认结果
-- select column_name, data_type from information_schema.columns
--   where table_name = 'comments' order by ordinal_position;
