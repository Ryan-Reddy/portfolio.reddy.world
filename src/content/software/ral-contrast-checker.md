---
title: RAL Contrast Checker
summary: "Pick two RAL colours and see them side by side, scored for physical accessibility (light reflectance) and for screens (WCAG contrast)."
dek: Two RAL colours, scored for contrast.
eyebrow: Web tool · reddy.world/ral-contrast-checker
kind: app
category: DesignApplication
platform: Web browser
year: 2023
status: Live, free to use
live: https://reddy.world/ral-contrast-checker
cta: Open the checker
stack: [JavaScript, Web Components]
audience: Architects, sign makers and designers choosing colours for a building or an object
maker: Reddy.World Enterprises
role: "A 2023 team assignment at Hogeschool Utrecht for Stichting Accessibility; the checker as it runs today: Ryan Reddy"
order: 5
updated: 2026-10-21
screenshots:
  - file: ral-pass.webp
    alt: "The RAL Contrast Checker with RAL 1023 Traffic yellow on RAL 9005 Jet black: a yellow block on a black field, LRV 4 and LRV 54, a difference of 50 that passes ΔLRV 30, and a WCAG contrast of 13.47 to 1."
    caption: "Traffic yellow on jet black: a light reflectance difference of 50, well over the pass mark of 30."
  - file: ral-fail.webp
    alt: "The checker with RAL 7004 Signal grey on RAL 7035 Light grey: a grey block on a light grey field, LRV 57 and LRV 34, a difference of 23 marked as failing ΔLRV 30, and a WCAG contrast of 2.01 to 1, both badges in red."
    caption: "Signal grey on light grey: a difference of 23 fails, and the screen contrast fails too."
---

The RAL Contrast Checker shows two RAL colours side by side and scores them for accessibility. Pick a background and an object or text colour, and you see the pair at once, with two numbers: the difference in light reflectance, for the real world, and the WCAG contrast ratio, for screens. [Open the checker](https://reddy.world/ral-contrast-checker).

It started as a team assignment for Stichting Accessibility by students of Hogeschool Utrecht in 2023, and the team is credited on the checker's page. The colour data comes from that project.

## What you can do

- Choose from 180 RAL Classic colours, by number and name.
- See the light reflectance value (LRV) of each colour and the difference between them, with a pass or fail against a difference of 30.
- See the WCAG contrast ratio of the same pair, for when the colours are used on a screen.
- Swap background and object with one button.

## The hard parts

**Two kinds of contrast.** On a screen, contrast is about light the screen gives off. On a wall, a door or a sign, it is about light the surface reflects. The checker shows both, and says which one applies where: a difference of 30 light reflectance points is the pass mark for physical accessibility, and the WCAG ratio is for on-screen use.

**One checker, used everywhere.** It is a single web component with no dependencies and all 180 colours built in. Any page can load it with one line, and the page on reddy.world loads it live from that library.
