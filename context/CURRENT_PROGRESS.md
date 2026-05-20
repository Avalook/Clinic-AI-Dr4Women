# CURRENT_PROGRESS.md

Cập nhật sau mỗi task. File này = bộ nhớ chuyển giao session.

## Trạng thái: 2026-05-20

- **Phase:** P0 — Repo bootstrap
- **Task gần nhất hoàn thành:** T-P0-03 (repo structure)
- **Task tiếp theo:** Tuyền copy 11 canon files vào `final_canon/` rồi commit

## Blockers đang mở

- **H-1:** v6 schema 35 vs 28 entities — chờ Anh Quang confirm
- **H-7:** Antigravity vs Kiro boundary — chờ Anh Quang confirm
- **H-8:** Qwen3-14B trên Mac Mini hay VPS — chờ Anh Quang confirm

## Quyết định mới nhất

- **D014 confirmed:** Anthropic (Sonnet + Haiku), không phải Gemini
- **Tech stack CANON:** FastAPI + Supabase + LangGraph + RabbitMQ + Anthropic

## Ghi chú cho session sau

Bước tiếp theo sau khi copy canon files:

1. Tạo Supabase project (Anh Quang manual)
2. T-P1-01: setup local dev environment (Claude Code)
