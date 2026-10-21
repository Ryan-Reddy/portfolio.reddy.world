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
# the three groups the 2023 assignment named (Ryan's Job Push plan, 2026-10-21)
audience: Architects, interior designers and paint suppliers choosing colours for a building or an object
maker: Reddy.World Enterprises
role: "A 2023 team assignment at Hogeschool Utrecht for Stichting Accessibility; the checker as it runs today: Ryan Reddy"
order: 5
updated: 2026-10-21
screenshots:
  - file: ral-pass.webp
    dark: ral-pass-dark.webp
    alt: "The RAL Contrast Checker with RAL 1023 Traffic yellow on RAL 9005 Jet black: a yellow block on a black field, LRV 4 and LRV 54, a difference of 50 that passes ΔLRV 30, and a WCAG contrast of 13.47 to 1."
    caption: "Traffic yellow on jet black: a light reflectance difference of 50, well over the pass mark of 30."
  - file: ral-fail.webp
    dark: ral-fail-dark.webp
    alt: "The checker with RAL 7004 Signal grey on RAL 7035 Light grey: a grey block on a light grey field, LRV 57 and LRV 34, a difference of 23 marked as failing ΔLRV 30, and a WCAG contrast of 2.01 to 1, both badges in red."
    caption: "Signal grey on light grey: a difference of 23 fails, and the screen contrast fails too."
---

The RAL Contrast Checker shows two RAL colours side by side and scores them for accessibility. Pick a background and an object or text colour, and you see the pair at once, with two numbers: the difference in light reflectance, for the real world, and the WCAG contrast ratio, for screens. [Open the checker](https://reddy.world/ral-contrast-checker).

It started in 2023 as a team assignment by students of Hogeschool Utrecht, for Stichting Accessibility (Bartiméus). The brief: a tool that lets architects, interior designers and paint suppliers score a combination of paint colours on contrast. The team is credited on the checker's page, and the colour data comes from that project.

## What you can do

- Choose from 180 RAL Classic colours, by number and name.
- See the light reflectance value (LRV) of each colour and the difference between them, with a pass or fail against a difference of 30.
- See the WCAG contrast ratio of the same pair, for when the colours are used on a screen.
- Swap background and object with one button.

## What the research added

The research for the project included an expert interview with Mijksenaar Wayfinding, about colour and contrast in signs and buildings. What it taught, in short:

- **Contrast decides what gets noticed.** Schiphol's yellow signs stand out so strongly that the eye goes to them on its own, and the colour has become part of the airport's identity.
- **Some people need more contrast.** Older people and people with low vision need a bigger difference between colours than others do.
- **Less light needs more contrast.** The less light there is in a space, the more contrast a design needs. Matte surfaces read better than glossy ones, and very large text can do with a little less.
- **Light reflectance is part of the design.** The reflectance values of the surfaces are always part of the design, together with the contrast between them.
- **Colour is never the only cue.** About 8 in 100 men have some form of colour blindness, so colour is a second signal next to another one, never the message on its own.
- **Test with the people who will use it.** The interview's advice: more research, testing and iteration with real users, in a test group with different abilities.

## The hard parts

**Two kinds of contrast.** On a screen, contrast is about light the screen gives off. On a wall, a door or a sign, it is about light the surface reflects. The checker shows both, and says which one applies where: a difference of 30 light reflectance points is the pass mark for physical accessibility, and the WCAG ratio is for on-screen use.

**A number is a start, not the answer.** The checker scores two colours. The light in the room, the finish of the paint and the size of the letters still change how a pair reads, and only a test with real users shows whether it works.

**One checker, used everywhere.** It is a single web component with no dependencies and all 180 colours built in. Any page can load it with one line, and the page on reddy.world loads it live from that library.
