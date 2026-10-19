---
title: Focus Desk
summary: "A Pomodoro timer on one page: the whole screen takes the colour of the session, with tasks, background noise and music in one tab."
dek: A Pomodoro timer that stays out of the way.
eyebrow: Web app · focus.reddy.world
kind: app
category: UtilitiesApplication
platform: Web browser
year: 2026
status: Live, free to use
live: https://focus.reddy.world
stack: [HTML, JavaScript, Web Audio API, Firebase Hosting]
audience: Anyone who works in focus blocks
maker: Reddy.World Enterprises
role: "Concept, design and code: Ryan Reddy"
order: 2
updated: 2026-10-17
screenshots:
  - file: focus-desk-three-sessions.webp
    alt: "Three Focus Desk screens side by side in fullscreen. A red focus session on 'Write the project summary' with 15:40 left, a teal short break with 02:51 left, and a blue long break with 12:51 left. Each ring shows the time remaining."
    caption: "Focus, short break, long break: the whole screen takes the colour of the session."
  - file: focus-desk-running.webp
    alt: "Focus Desk during a focus session: the timer at 15:42 with a Pause button, 'Now focusing on: Write the project summary', a task list with three tasks, and panels for noise, YouTube and SoundCloud below."
    caption: "A focus session nine minutes in, with the task list and the sound panels. The tasks are examples."
  - file: focus-desk-cast-view.webp
    alt: "Focus Desk's cast view at 1280 by 800: a large 25:00 timer on the left and the three tasks on the right, with the settings and sound panels hidden."
    caption: "Cast view for a 1280 × 800 wall display: just the timer and the tasks."
  - file: focus-desk-phone.webp
    alt: "Focus Desk on a phone during a focus session: the ring at 15:42 with Pause, Reset and Skip buttons, and the task list below."
    caption: "On a phone, mid-session."
---

Focus Desk is a Pomodoro timer on one page. Focus for 25 minutes, rest for 5, and take a 15-minute break after every fourth session. You can change each length. The whole screen takes the colour of the session, so you can see at a glance whether it's time to work or to rest. It runs in the browser, with no account. Open it at [focus.reddy.world](https://focus.reddy.world).

## What you can do

- Keep a task list and count the sessions each task takes. Paste a whole list at once, one task per line.
- Play background noise made in the browser (white, pink, brown or rain), only while you focus if you like.
- Play music from YouTube or SoundCloud. It pauses on your breaks.
- Pick an alarm (chime, bell, digital, wood block or gong) and, if you want, a ticking clock.
- Go fullscreen, or switch to a cast view sized for a wall display. Every action has a keyboard shortcut.

## The hard parts

**Time that survives a sleeping tab.** The timer stores the moment the session ends, rather than counting down. A background tab the browser slows down, or a reload, still shows the right time.

**Sound without files.** The noise, alarms and ticking are all made with the Web Audio API. Pink noise is shaped from random samples, and rain is noise under a slowly moving filter. Nothing is downloaded.

**Light enough to cast.** In cast view the page redraws once a second instead of four times, so a tab mirrored to a wall display keeps up.

It's one HTML page with no build step and no dependencies.
