<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Quy trình deploy (yêu cầu của user)

- LUÔN tự động commit + push lên `origin main` sau khi hoàn thành mỗi thay đổi — Vercel auto deploy từ GitHub (khopiopio.vercel.app). Không cần hỏi user từng lần.
- Commit message theo style hiện có: `fix(ten-trang): mo ta ngan` / `feat(ten-trang): ...` (không dấu, thường tiếng Việt không dấu).
- Chỉ stage file đã sửa chủ đích; KHÔNG commit `supabase/full-001-015.sql` (file untracked của user).
- Sau khi push, báo user URL kiểm tra.
