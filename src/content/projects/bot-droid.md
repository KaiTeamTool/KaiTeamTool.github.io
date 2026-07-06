---
title: BotDroid
tagline: Run Telegram bots 24/7 directly on your Android phone — no server, no Linux.
status: active
stack: [Kotlin, Jetpack Compose, Room, Android, Picobot]
landing: https://botdroid-landing.kaitodroid.workers.dev/
order: 1
---

BotDroid is a native Android app that runs AI bots persistently on your phone — no server required. It supports two bot types:

- **Python Script** — paste a Python script and a bot token; BotDroid runs it inside an embedded Python 3.15 runtime.
- **Picobot Agent** — run a full AI agent (LLM-backed, tool-using) via a bundled ARM64 binary. Point it at any OpenAI-compatible endpoint and connect it to Telegram, Discord, Slack, Zalo, or other channels.

Both types run as foreground service processes that survive app close, screen off, and OEM battery killers.

**The problem it solves:** running a Telegram bot (or AI agent) requires either paying for a VPS or painful manual setup. BotDroid eliminates both. Zero-to-running-bot in under 3 minutes, on hardware you already own.
