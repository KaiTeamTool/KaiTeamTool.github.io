---
title: Rumi
tagline: Private, on-device AI chat & local LLM agent execution for mobile devices.
status: in-progress
stack: [Kotlin, Compose Multiplatform, LiteRT-LM, llama.cpp, KMP, Room]
order: 2
---

Rumi is a mobile-first LLM chat and AI agent application built with Kotlin Multiplatform (KMP), designed from the ground up for privacy-first, on-device inference on Android and iOS.

Key architectural highlights:

- **Dual On-Device Engines**: Supports `.litertlm` models via LiteRT-LM (with GPU acceleration and CPU fallback) and GGUF models via an embedded `llama.cpp` engine.
- **Mobile-Native Design**: Built specifically for small screens, short interactive sessions, thumb navigation, and background interruption resilience.
- **Local Agent Execution**: Includes a structured tool call parser allowing local LLM responses to trigger system actions and agent workflows offline.
- **Privacy & Hybrid Remote Fallback**: Operates completely offline by default, while supporting optional remote API providers when higher capability or lower device battery consumption is desired.
