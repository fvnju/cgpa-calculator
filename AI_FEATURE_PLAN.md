# AI Assistant Feature Plan

## Overview

An AI chat assistant embedded directly into the CGPA Calculator canvas. It receives the student's full transcript as context on every message, enabling both retrospective analysis and forward-looking CGPA planning through a natural conversation interface.

---

## Provider: Google Gemini (`gemini-2.0-flash`)

- Free tier: 15 RPM, 1 million tokens/day — no billing required
- API key obtained in ~30 seconds at [aistudio.google.com](https://aistudio.google.com)
- Integrated via the Vercel AI SDK (`ai` + `@ai-sdk/google`) for clean streaming support in Next.js App Router

---

## What the AI Can Do

The assistant is aware of every semester, course, grade, and credit hour currently on the canvas — including manual entries and Nile Portal imports.

| Mode                | Example Prompts                                                                       |
| ------------------- | ------------------------------------------------------------------------------------- |
| **Retrospective**   | "Which semester was my worst?"                                                        |
|                     | "What's dragging my CGPA down the most?"                                              |
|                     | "Summarise my academic performance so far."                                           |
| **Forward-looking** | "What GPA do I need next semester to hit 4.9?"                                        |
|                     | "If I retake MTH 205, what happens to my CGPA?"                                       |
|                     | "I have 4 semesters left. What's the minimum GPA per semester to graduate with 4.75?" |
| **Strategic**       | "Which courses should I prioritise to recover my CGPA?"                               |
|                     | "Is a 5.0 CGPA still achievable for me?"                                              |

---

## Architecture

```
CGPACalculatorCanvas
  └── nodes / cgpa state (already exists)
        │
        ▼
  <AIChatPanel />              ← new right-side drawer component
        │  sends { messages, transcript }
        ▼
  POST /api/ai/chat            ← new Next.js Route Handler (raw, not tRPC — streaming)
        │
        ▼
  Google Gemini via Vercel AI SDK
  (system prompt contains serialised transcript)
```

> tRPC is **not** used for this endpoint. Streaming text responses require a raw Next.js Route Handler that returns a `ReadableStream`.

The transcript is re-serialised from live canvas state on every request, so the AI always reflects the latest data regardless of manual edits or Nile Portal imports.

---

## UI: `AIChatPanel`

A right-side drawer that slides in over the canvas, matching the visual style of the existing `PropertiesPanel`.

```
┌─────────────────────────────────┐
│  AI Assistant            [×]    │
├─────────────────────────────────┤
│  3 semesters · 47 credits       │
│  CGPA 4.87                      │
├─────────────────────────────────┤
│                                 │
│  [AI] Hi! I can see your full   │
│  transcript. Ask me anything    │
│  about your grades or CGPA.     │
│                                 │
│  [You] What GPA do I need       │
│  next semester to reach 4.9?    │
│                                 │
│  [AI] Given your 47 credits     │
│  at 4.87 CGPA, you would need   │
│  at least a 5.0 GPA over...     │
│                        ░░░░░    │  ← streaming
│                                 │
├─────────────────────────────────┤
│  ╭─ Suggested ──────────────╮  │
│  │ Analyse my transcript    │  │
│  │ Plan for 4.9 CGPA        │  │
│  ╰──────────────────────────╯  │
│  [Type a message…]    [Send ↑] │
└─────────────────────────────────┘
```

**Behaviour:**

- Opening the AI panel closes any open semester `PropertiesPanel`, and vice versa
- Suggested prompt chips are shown on first open; hidden once conversation starts
- Messages stream in word-by-word via the Vercel AI SDK `useChat` hook
- Chat history lives in React state — cleared when the panel is closed
- Course names sent to the AI use the full format: `COS 201 – Computer Programming I`

---

## Files to Create / Modify

| File                                  | Change                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/app/api/ai/chat/route.ts`        | **New** — streaming POST route handler                                                              |
| `src/components/app/flow-builder.tsx` | **Modify** — add `AIChatPanel`, "Ask AI" button in `TopBar`, state wiring in `CGPACalculatorCanvas` |
| `src/env.js`                          | **Modify** — add `GEMINI_API_KEY` to server schema                                                  |
| `.env.example`                        | **Modify** — document the new variable                                                              |
| `package.json`                        | **Modify** — add `ai` and `@ai-sdk/google` dependencies                                             |

---

## New Environment Variable

```env
GEMINI_API_KEY=your_key_here
```

Get a free key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).

---

## Packages to Install

```bash
bun add ai @ai-sdk/google
```

---

## System Prompt Design

The system prompt sent with every request will be structured as:

```
You are an academic advisor AI embedded in a CGPA calculator app (5.0 grade scale).
The student's current transcript is below. Use it to answer questions accurately.
Always show your working when doing CGPA calculations.

--- TRANSCRIPT ---
CGPA: 4.87 | Total Credits: 47 | Semesters: 3

Semester: 2024 - 2025. 1 | GPA: 5.00 | Credits: 15
  - BIO 101 – General Biology I | Grade: A | Credits: 2
  - COS 101 – Introduction to Computing Sciences | Grade: A | Credits: 3
  ...

Semester: 2025 - 2026. 1 | GPA: 4.60 | Credits: 15
  - MTH 205 – Linear Algebra I | Grade: C | Credits: 2
  ...
-----------------
```

---

## Out of Scope (for now)

- Persisting chat history across sessions
- Uploading documents or images to the AI
- Multiple AI provider support
- Auth / per-user usage limits
