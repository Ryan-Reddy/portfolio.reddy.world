---
title: Reddy.Neuro
summary: "NeuroOverlay, a browser extension for Chrome and Brave: a clearer font, softer colours, shorter lines and a reading ruler on any website."
dek: Websites are loud. Turn them down.
eyebrow: Browser extension · Chrome and Brave
kind: app
category: BrowserApplication
platform: Chrome, Brave
year: 2026
status: Early version, free
live: https://neuro.reddy.world
store:
  - name: Chrome Web Store
    url: https://chromewebstore.google.com/detail/neurooverlay-adhd-coga-vi/bdghhcffdfnpjlejhjcfnllofaidmija
cta: Add to Chrome
stack: [JavaScript, Manifest V3, Chrome scripting and side panel APIs]
audience: Readers who tire on busy, glaring pages
maker: Reddy.World Enterprises
role: "Concept, design and code: Ryan Reddy"
order: 1
updated: 2026-10-19
screenshots:
  - file: neuro-overlay-after.webp
    pair: after
    label: With NeuroOverlay
    alt: "The Wikipedia article on Atkinson Hyperlegible with NeuroOverlay on: off-white text in Atkinson Hyperlegible on a soft dark olive background, more space between the lines, and underlined green links."
    caption: "The same Wikipedia article without and with NeuroOverlay, on its standard settings. Drag the line, or use the arrow keys, to compare."
  - file: neuro-overlay-before.webp
    pair: before
    label: Without
    alt: "The Wikipedia article on Atkinson Hyperlegible as Wikipedia shows it: black text on a white page with blue links, the contents on the left and the appearance settings on the right."
    caption: "The article as Wikipedia shows it, without NeuroOverlay."
  - file: neuro-overlay-work-mode.webp
    alt: "NeuroOverlay's Work mode on the same article: the title, a dial with Gist, Key points, Structured (selected) and Full, the sections as short folded blocks, and a side column with next steps, the outline, tools (reading ruler, wait timers, read aloud) and the page score."
    caption: "Work mode, an early version: a quiet view of the page, with a dial for how much you see."
  - file: neuro-overlay-popup.webp
    alt: "NeuroOverlay's popup on Wikipedia: on for en.wikipedia.org, a page score of 90 out of 100, sliders for Text (Comfortable), Colour (Dark), Clutter (fade 95%) and Focus, buttons for Work mode, Ruler and a wait timer, and the quick looks Calm, Night, Daylight and Dyslexia."
    caption: "The popup: how much help you want, in four sliders."
  - file: neuro-overlay-page-check.webp
    alt: "The side panel's page check for the article: 90 out of 100 from its own checks, then five findings, from one long text block to lines of about 201 characters, each with a suggestion."
    caption: "The page check in the side panel: a quick look at how a page is built, not an official accessibility test."
---

NeuroOverlay is a browser extension that makes any website calmer to read. It sets a clear typeface, soft colours and comfortable spacing, adds a reading ruler, and fades sidebars and ads. Add it to Chrome or Brave from the [Chrome Web Store](https://chromewebstore.google.com/detail/neurooverlay-adhd-coga-vi/bdghhcffdfnpjlejhjcfnllofaidmija).

I made it for people who tire quickly on glaring, cluttered pages, with ADHD in mind. It runs on your device: no page content, history or settings leave it.

## What you can do

- Set how much help you want with four sliders: Text, Colour, Clutter and Focus. Or pick a quick look: Calm, Night, Daylight or Dyslexia.
- Choose the font (Atkinson Hyperlegible, Lexend Deca or OpenDyslexic), the line length, and the space between lines, letters and words.
- Read in a soft dark theme such as Velvet Olive, or in a calm, paper-like light one.
- Turn on a reading ruler, or set a wait timer of 30 seconds, 1 minute or 2 minutes.
- Open Work mode for a quiet view of the page. A dial shows the gist, the key points, the structure or everything, and it can read the text aloud.
- Keep your settings for every site or for one site only, or switch a site off.
- Run a page check: a score out of 100 from its own checks, with what to improve.

## The hard parts

**Invisible to the page.** The styles go in through the browser rather than as a style element in the page, and every name the extension adds is random for each install. A website's own scripts can't recognise it.

**Off means off.** A site you switch off gets nothing at all: no script and no styles. The extension tells the browser where to run, rather than running everywhere and staying quiet.

**Fading without hiding what matters.** Sidebars and ads fade, but alerts, warnings and pop-up choices never do, and a faded block comes back when you hover over it.

**Everything on your device.** Work mode and the page check read the page in your tab and send nothing anywhere. The fonts come with the extension, so none is downloaded.

You can also try the settings without installing anything, in the [Web Studio at neuro.reddy.world](https://neuro.reddy.world).
