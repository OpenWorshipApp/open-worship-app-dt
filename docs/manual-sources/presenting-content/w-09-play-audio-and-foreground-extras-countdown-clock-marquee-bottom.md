---
id: W-09
title: "Play audio, and foreground extras (countdown, clock, marquee bottom…)"
section: "Presenting content"
verify: [PM-15, PM-16, PM-17, PM-18, PM-19, PM-20, PM-21, PM-22, PM-23, PM-24, PM-25, PM-28, PM-34, KB-03, KB-07]
screenshots: 2
generatedFrom: user-workflows.md
workflowsVersion: "2026-07-16"
---
# W-09 — Play audio, and foreground extras (countdown, clock, marquee bottom…)

**Goal:** run service extras.

**Audio:** in the Background panel, toggle the **Audios** (សំលេង) tab open, click play
on a track — the tab is marked while playing; click stop to end. 📸

**Foreground widgets** — open the middle **Foreground** (ផ្ទៃខាងមុខ) tab; each widget
has its own controls and a Show/Start button:

- **Marquee Top:** type the scrolling text, click Show — it scrolls along the top edge.
- **Marquee Bottom:** type the scrolling text, click Show — it scrolls along the bottom
  edge. Top and bottom can be shown at the same time.
- Both marquees expose a **scroll speed** (%) under *Properties*: `100%` is the default
  pace, higher is faster, lower is slower. Changing it while a marquee is showing
  re-paces it without having to click Show again.
- **Quick Text:** type a short message, click Show.
- **Countdown:** two modes — *to a date/time* (set date + time, press Start) or *for a
  duration* (set hours/minutes, press Start). Hide with its Hide button. 📸
- **Stopwatch**, **Clock**, **Images slideshow**, **Camera overlay**, **Web overlay**:
  same pattern — configure, Show, Hide.
- The shared properties row (font size / color / position) restyles the live widget.
- Power move: **drag** a widget's Show button and **drop it on the mini screen** to
  start it there; **right-click** the button to choose a specific display.

Press **F10** (Clear Foreground) to clear all foreground widgets, or **F6** to clear
everything at once.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PM-15` · `PM-16` · `PM-17` · `PM-18` · `PM-19` · `PM-20` · `PM-21` · `PM-22` · `PM-23` · `PM-24` · `PM-25` · `PM-28` · `PM-34` · `KB-03` · `KB-07`

Regenerated from `user-workflows.md` (workflowsVersion 2026-07-16).
:::
