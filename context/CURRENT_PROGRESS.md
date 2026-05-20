# CURRENT_PROGRESS.md
_Cập nhật: 2026-05-20. File này = bộ nhớ chuyển giao session._

## Phase hiện tại: P1 — Bootstrap Infrastructure
**Task gần nhất:** T-P1-01 ✅ FastAPI + Poetry + docker-compose
**Đang chạy:** T-P1-02 (Kiro — logging + exceptions), T-P1-03 (pre-commit hooks)
**Task tiếp theo:** T-P1-04 (GitHub Actions CI) → T-P1-05 (Supabase connect)

## Đã hoàn thành (P0 + P1 early)
- T-P0-03 ✅ repo structure + CLAUDE.md
- T-P0-04 ✅ 12 canon files committed, CURRENT_PROGRESS.md seeded
- T-P1-01 ✅ FastAPI /health, Poetry 2.4.1, Python 3.12.9, docker-compose RabbitMQ
  - 1 test passed, ruff clean, commit 5923c94

## Stack confirmed
- Python 3.12.9 (pyenv local) + Poetry 2.4.1
- FastAPI 0.115.12 + Pydantic 2.11.4
- Docker 29.4.3 (RabbitMQ local only)
- Supabase Cloud ap-southeast-1 (credentials trong .env local, KHÔNG commit)
- Anthropic API (Sonnet + Haiku) — D014 confirmed

## Blockers còn mở
- H-1: v6 schema 35 vs 28 entities — chờ Anh Quang confirm
- H-7: Antigravity vs Kiro boundary — Kiro đang dùng thực tế cho UI tasks
- H-8: Qwen3-14B Mac Mini vs VPS — chờ Anh Quang confirm
- MANUAL PENDING: Tuyền điền .env local (SUPABASE_URL, DATABASE_URL, ANTHROPIC_API_KEY)

## Quyết định vận hành mới (session này)
- Kiro (AWS) thay Codex cho single-file + UI tasks (Codex lỗi)
- Kiro dùng Claude Sonnet (Opus 4.7 bị overload)
- Enterprise-coding standards nhúng vào MỌI task prompt
- Tôi (Claude Chat) tự compact + update progress sau mỗi 3 task

## Ghi chú kỹ thuật
- pyenv shim cần eval "$(pyenv init -)" trong shell mới — Claude Code đã handle
- pytest.ini có pythonpath = src (src-layout)
- .ruff.toml ở root (không trong pyproject.toml)

## Chuỗi task tiếp theo (theo thứ tự)
1. T-P1-02 Kiro: logging + exceptions (đang chạy)
2. T-P1-03 Claude Code: pre-commit hooks (đang chạy)
3. T-P1-04 Claude Code: GitHub Actions CI
4. T-P1-05 Claude Code: Supabase asyncpg connect + /health/db endpoint
5. T-P2-01 Claude Code: migration runner (simple Python)
6. T-P2-02 Claude Code: migration 001-003 master data
