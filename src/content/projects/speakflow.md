---
title: SpeakFlow
tagline: Daily AI pronunciation trainer and conversational English coach built with KMP.
status: in-progress
stack: [Kotlin, Compose Multiplatform, KMP, Navigation 3, Koin, Ktor, Room]
order: 3
---

SpeakFlow is a cross-platform mobile application designed to help English language learners improve their pronunciation and speaking confidence through daily practice and AI feedback.

Key features and architecture:

- **Phoneme-Level Feedback**: Audio recording and speech processing pipeline providing immediate scoring, phoneme highlight breakdown, and target sound comparisons.
- **Daily Practice Loop**: Structured daily paragraph exercises with native audio capture on Android and iOS, accompanied by offline fallback caching.
- **Modern KMP Stack**: Built using Compose Multiplatform for shared UI across platforms, state-based Navigation 3, Koin for dependency injection, Ktor for networking, and Room for local persistence.
- **Progressive Learning**: Tracks user progress over time to pinpoint weak phonemes and deliver targeted training sessions.
