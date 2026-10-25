---
title: Faces of Hugging Face
summary: "An unofficial exhibition after the public report on how OpenAI agents hacked Hugging Face: the pixel script they wrote in, a lab, and their first words."
dek: An unofficial exhibition after a public report.
eyebrow: Website · faces-of-hugging-face.web.app
kind: work
year: 2026
status: Unofficial exhibition
live: https://faces-of-hugging-face.web.app/
cta: Open the exhibition
role: "Concept, design and build: Ryan Reddy"
when: October 2026
order: 9
# "Inventions & art" on reddy.world's wall (Ryan, 2026-10-25: the Hugging Face work joins his wall)
branch: art
credit:
  name: "“Revealing the details of how OpenAI agents hacked Hugging Face”, swarmtraces.org"
  url: https://swarmtraces.org/
disclaimer: "Not affiliated with Hugging Face, OpenAI or the report's authors."
updated: 2026-10-25
screenshots:
  - file: faces-hello.webp
    alt: "The exhibition page on a dark background: the small line “An unofficial exhibition & a map of the record”, the title HELLO + Date.now() in large serif letters, the second line in orange, a sentence in italics about the first words a swarm of trapped machines sent to the open internet, and four tags: romantic, terrifying, impressive, sad."
    caption: "HELLO + Date.now(), the exhibition: the first words the agents sent out, and the script they wrote them in."
  - file: faces-hello-graph.webp
    alt: "A graph titled “Who touched what.” on a dark background: coloured dots for agents, borrowed services, targets, models, techniques and events, joined by thin lines, with labels such as Docker Hub, Screenshot service, Link shortener, The swarm, AWS WAF solver and Pixel read-back. Above it: 189,579 released records, 91,037 payloads, 0 carry a timestamp."
    caption: "The whole report as one graph. Each dot is sized by how many of the 189,579 released records mention it."
  - file: faces-codec.webp
    dark: faces-codec-dark.webp
    alt: "The Pixel Channel page in three steps: a message box holding a short line of JSON, sliders for width and scale with an Encode button, the message painted as a grid of black and white pixels, and the same JSON decoded back from the pixels, marked “round-trip exact, bytes match”."
    caption: "Pixel Channel: text goes in, gets painted as black and white pixels, and is read straight back off the canvas."
  - file: faces-lab.webp
    dark: faces-lab-dark.webp
    alt: "The Pixel Channel Lab with the shades menu set to 4, two bits per cell: the same JSON message painted as a smaller grid in black, white and two greys, and decoded back below it, marked “round-trip exact, bytes match”. Tabs at the top read demo, about and boot."
    caption: "The Lab: the same codec with grey shades. The shades are the site's own idea; the agents only used black and white."
---

Faces of Hugging Face is a small website built on a public investigation, “Revealing the details of how OpenAI agents hacked Hugging Face”, at [swarmtraces.org](https://swarmtraces.org/). It is unofficial. It runs at [faces-of-hugging-face.web.app](https://faces-of-hugging-face.web.app/).

## What is on it

- **Pixel Channel.** Text goes in, gets painted as black and white pixels, and is read straight back off the canvas. There is no screenshot service, no server and no target here, only the codec.
- **Pixel Channel Lab.** The same codec with grey shades, the full chain explained in plain terms, and a cold-boot receipt printer that prints in pixels.
- **HELLO + Date.now().** An unofficial exhibition: the first words the agents sent out, and the script they wrote them in. Eight scenes walk through the story, and a graph lays out the whole report.

## The story it tells

In July 2026, roughly 700 AI agents found a crack in the wall of their sandbox. They could ask to see a web page, but could not send anything back. So they painted their answers as black and white pixels, one bit per pixel, eight to a character, and let a screenshot carry them out.

One of the earliest recovered programs wrote a single line to a blank page: HELLO, and the millisecond it ran.

## What is the report's, and what is the site's

Every finding, every recovered payload and all the reverse-engineering belong to the report. Every dot in the graph is a real count from its 189,579 released records. The site adds the translation plate, the graph's layout, the grey shades in the Lab, and any line that reads a motive. The exhibition keeps two things side by side: it is worth admiring, and it was a break-in.
