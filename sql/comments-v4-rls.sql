-- comments-v4:收紧 comments 表的匿名写权限
--
-- 背景(2026-10-26 实测发现):
--   带着公开的 anon key 执行 DELETE /rest/v1/comments?id=eq.<任意 id> 返回 204,
--   说明当前表上的 RLS 策略允许任何人删除任意评论。评论区的设计是
--   「公开只读 + 匿名发布」,删除应该只能在 Supabase 后台人工做。
--   在参赛评审期内,这意味着任何拿到分享链接的人都能清掉评论区。
--
-- 用法:Supabase Dashboard → SQL Editor → New query → 粘贴全文 → Run(可重复执行)

-- 1) 确保 RLS 处于开启状态(未开启时 anon 对表有全部权限)
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 2) 建立我们需要的两条策略:所有人可读、匿名可发布
DROP POLICY IF EXISTS "comments_select_all" ON public.comments;
CREATE POLICY "comments_select_all" ON public.comments
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "comments_insert_anon" ON public.comments;
CREATE POLICY "comments_insert_anon" ON public.comments
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 3) 清掉其余所有策略(含任何 allow-all 的 DELETE / UPDATE)
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comments'
  LOOP
    IF p.policyname NOT IN ('comments_select_all', 'comments_insert_anon') THEN
      EXECUTE format('DROP POLICY %I ON public.comments', p.policyname);
      RAISE NOTICE 'dropped policy: %', p.policyname;
    END IF;
  END LOOP;
END $$;

-- 验证:跑完后再执行一次这条探测,期望返回 401/403 或 0 行受影响(而不是 204 成功)
--   curl -X DELETE "https://<project>.supabase.co/rest/v1/comments?id=eq.999999" \
--     -H "apikey: <anon key>" -H "Authorization: Bearer <anon key>" -o /dev/null -w "%{http_code}\n"
