# 9Router

AI gateway/router open-source (lisensi MIT) — **satu endpoint yang kompatibel
OpenAI** untuk 40+ provider AI (Claude, GPT, Gemini, DeepSeek, GLM, Kiro, dsb)
dengan **fallback otomatis 3 lapis**: Subscription -> Murah -> Gratis.

- Dashboard : `http://<IP-VPS>:20128`
- API       : `http://<IP-VPS>:20128/v1` (pakai API key dari dashboard)
- Data      : `./data` (SQLite + token/koneksi provider, tidak di-commit)

## Setup awal

1. Buka dashboard di `http://<IP-VPS>:20128`.
2. Hubungkan provider: API key, OAuth, atau yang gratis (mis. OpenCode Free).
3. Salin **API key** dari dashboard ke tool coding
   (Claude Code, Cursor, Cline, Codex, ...):
   - Endpoint: `http://<IP-VPS>:20128/v1`
   - API key: dari dashboard

## Keamanan

Port 20128 ikut terbuka ke publik bila bootstrap dijalankan dengan
`PUBLIC_PORTS=1`. Siapa pun yang memegang API key bisa memakai kuota AI kamu —
jangan sebarkan API key. Bila tidak perlu diakses publik, jalankan bootstrap
tanpa `PUBLIC_PORTS=1` dan akses via SSH tunnel.
