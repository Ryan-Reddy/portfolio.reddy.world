---
title: Reddy.Neuro
summary: "A free web app that makes busy pages easier to read: a clear typeface, a soft dark palette, a shorter line and fewer distractions."
dek: Calmer reading for loud web pages.
eyebrow: Web app · neuro.reddy.world
kind: app
category: UtilitiesApplication
platform: Web browser
year: 2026
status: Live, free to use
live: https://neuro.reddy.world
stack: [React 19, TypeScript, Vite, Tailwind CSS, Firebase Hosting]
audience: Readers who tire on busy, glaring pages
maker: Reddy.World Enterprises
role: "Concept, design and code: Ryan Reddy"
order: 1
updated: 2026-10-17
screenshots:
  - file: neuro-baseline-vs-velvet-olive.webp
    alt: "Reddy.Neuro's side-by-side comparison. On the left, a task card in pure white text on pure black, labelled 'Harsh OLED dark, pure black (high glare)'. On the right, the same card in Velvet Olive: off-white text on a dark olive background, labelled 'Calibrated: Velvet Olive'."
    caption: "The Baseline Matrix: the same card in pure white on pure black, and in Velvet Olive, with the glare simulation on."
  - file: neuro-reader-mode-wikipedia.webp
    alt: "The Wikipedia article on Atkinson Hyperlegible, opened in Reddy.Neuro's Reader Mode: off-white text on dark olive with gold section headings, a 68-character line and 1.75 line spacing. The settings panel on the right shows Reader Mode, the Velvet Olive palette and the Atkinson Hyperlegible Next typeface."
    caption: "Reader Mode on a real page: the Wikipedia article on Atkinson Hyperlegible, at 68 characters per line."
  - file: neuro-room-color-sets.webp
    alt: "Reddy.Neuro's Room Color Sets: a note explaining why soft dark mode glares less than pure black, then palette cards for Velvet Olive (selected), Twilight Slate, Amber Hearth, Smoked Plum and Abyssal Teal, each with its colour swatches."
    caption: "Room Color Sets. Choosing one re-themes the whole app."
  - file: neuro-landing-phone.webp
    alt: "Reddy.Neuro's home page on a phone: the heading 'Websites are loud. Turn them down.', a short line about a readable font, soft dark mode and reading ruler, and a link to open the app."
    caption: "The home page on a phone."
---

Reddy.Neuro makes a busy web page easier to read: a clear typeface, a soft dark palette, a shorter line length and fewer distractions. Paste the address of an article, choose how it should look, and read it right there. It is free to use at [neuro.reddy.world](https://neuro.reddy.world).

I made it for people who tire quickly on glaring, cluttered pages, with ADHD in mind. The typefaces include Atkinson Hyperlegible Next, Lexend and OpenDyslexic.

## What you can do

- Open a public article in the Studio and read it in your own palette and typeface, either in the site's layout or as a clean reader view.
- Set the line width in characters, the line spacing, how far ads are dimmed, and whether the text is split into cards. Add a reading ruler, or bold the start of each word.
- Compare pure white on pure black with a softer palette side by side, with a glare simulation.
- Choose a room palette, from soft dark to light, and export it as CSS, Tailwind, JSON or a VS Code theme.

## The hard parts

**One choice restyles everything.** Each palette is a small set of named colours: a background, surfaces, three levels of text and an accent. The app applies them as CSS variables, so the interface and the article preview change together.

**Reading real pages.** The Studio pulls the readable text out of a live page. Some pages build their text with JavaScript and return nothing readable. The Studio then says so plainly, rather than showing an empty frame.

**Contrast without the glare.** Velvet Olive keeps body text at 14.5 : 1 against its background. That's far above the 4.5 : 1 that WCAG AA asks for, and well short of the 21 : 1 extreme of pure white on black.

The same settings also come as a browser extension, [NeuroOverlay, in the Chrome Web Store](https://chromewebstore.google.com/detail/neurooverlay-adhd-coga-vi/bdghhcffdfnpjlejhjcfnllofaidmija), so any page you visit can look this way.
