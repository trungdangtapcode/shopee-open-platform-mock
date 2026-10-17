# Shopee Open Platform v2 Mock Server & SDK Suite

Full-featured **Shopee Open Platform v2** local mock backend (`shopee-mock`), **Developer Console UI**, **Seller Centre UI**, **TypeScript SDK (`shopee-sdk`)**, and **Python SDK (`python-shopee-sdk`)** supporting all **455 official Shopee v2 API schemas** across **31 modules**.

## Workspace Structure

- [`shop.sh`](./shop.sh) — One-command project controller (`on`, `off`, `restart`, `status`, `test`, `reset`, `logs`)
- [`shopee-mock/`](./shopee-mock) — Modular TypeScript + Express Shopee Open Platform v2 Mock Server (`managers/*.manager.ts`, `schemas/`, `storage/`, `utils/`)
- [`shopee-sdk/`](./shopee-sdk) — TypeScript Shopee Open Platform v2 SDK + 455 official JSON schemas (`schemas/`)
- [`python-shopee-sdk/`](./python-shopee-sdk) — Zero-dependency Python 3 Shopee v2 SDK (`shopee_client.py`) & end-to-end test suite (`test_app.py`)
- [`materials/shopee-mock-sdk-report.md`](./materials/shopee-mock-sdk-report.md) — Full architecture, compatibility, and usage guide

## Quick Start (One Command)

```bash
./shop.sh on        # Build & start Shopee Mock Server + Console UI in the background
./shop.sh status    # Check server status and Web UI URLs
./shop.sh test      # Run Python SDK end-to-end test suite (455/455 API schemas)
./shop.sh reset     # Reset mock database state to fresh defaults
./shop.sh off       # Stop the server cleanly
```

## Web UIs (Default Port: `3099`)

- **Open Platform Developer Console**: `http://localhost:3099/console`
- **Shopee Seller Centre UI**: `http://localhost:3099/`
- **OAuth 2.0 Authorize Page**: `http://localhost:3099/auth`
- **API v2 Base URL**: `http://localhost:3099/api/v2`
