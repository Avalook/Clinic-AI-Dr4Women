# CURRENT_PROGRESS.md
_Cập nhật sau mỗi task. File này = bộ nhớ chuyển giao session._

## Trạng thái: 2026-05-20
**Phase:** P0 → P1 (chuyển giao)
**Task gần nhất hoàn thành:** 
  - T-P0-03: repo structure + CLAUDE.md ✅
  - T-P0-04: 12 canon files committed (00–11) ✅

**Task tiếp theo:** T-P1-01 — Local dev environment setup

## Blockers đang mở
- H-1: v6 schema 35 vs 28 entities — chờ Anh Quang confirm
- H-7: Antigravity vs Kiro boundary — chờ Anh Quang confirm
- H-8: Qwen3-14B Mac Mini vs VPS — chờ Anh Quang confirm
- MANUAL PENDING: Anh Quang tạo Supabase project + lấy connection string

## Quyết định đã lock
- D014: Anthropic (Sonnet + Haiku), không phải Gemini
- Tech stack CANON: FastAPI + Supabase + LangGraph 1.0 + RabbitMQ + Anthropic

## Ghi chú cho session sau
Trước khi chạy T-P1-01, cần Anh Quang cung cấp:
  1. SUPABASE_URL + SUPABASE_ANON_KEY + DATABASE_URL
  2. Confirm Python version trên Mac Mini (target 3.12)
  3. Confirm Docker Desktop đã cài trên Mac Mini
