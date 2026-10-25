// comment-config.js — 评论区配置
// 启用步骤(约 2 分钟):
//   1. 在 https://supabase.com 免费建一个项目
//   2. Dashboard → SQL Editor → 运行项目根目录 sql/comments.sql 全部内容
//   3. Dashboard → Settings → API,复制 Project URL 与 anon public key 填到下面,enabled 改 true
//   4. 提交部署
// anon key 是设计上可公开的浏览器密钥(真正的写权限由数据库 RLS 约束),不是 service_role。
// 未配置(enabled=false)时,报告页不显示评论区。

export const COMMENT_CONFIG = {
  enabled: false,
  supabaseUrl: "",      // 例:https://xxxxxxxx.supabase.co
  supabaseAnonKey: "",  // anon public key
};
