# GusRouter

GusRouter is an ultra-high-performance AI Router Gateway with a Go-powered backend proxy (`9router-go`) and a clean modern web dashboard (`SRouter frontend`).

## Architecture
- **Backend**: Go proxy server (`gorouter-backend` / `9router-go`) running on port `20128` (or dedicated port) handling high-throughput OpenAI, Anthropic, Gemini, and Ollama format translations, combos, fallback, and token savers.
- **Frontend / Management**: React + Vite dashboard (`frontend/dist`) served via Caddy and/or PM2.
- **Reverse Proxy**: Caddy server on `gorouter.rkhyg.xyz`.

