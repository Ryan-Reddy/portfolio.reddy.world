---
title: Cufflink
summary: "A Windows app that reads the text you select aloud, in any program, and lights up each word as it goes. Fully offline: no account, nothing leaves your PC."
dek: Select anything. Press a key. Hear it.
eyebrow: Windows app · cufflink.reddy.world
kind: app
category: UtilitiesApplication
platform: Windows 10 and 11
year: 2026
status: Free and open source
live: https://cufflink.reddy.world
cta: How to install
repo: https://github.com/Ryan-Reddy/cufflink
stack: [Python, Kokoro-82M, ONNX Runtime]
audience: Anyone who would rather listen than read, or who proofreads by ear
maker: Reddy.World Enterprises
role: "Concept, design and code: Ryan Reddy"
order: 4
updated: 2026-10-21
screenshots:
  - file: cufflink-reading.webp
    alt: "Cufflink's reading window: a sentence about reading a draft aloud, with the word 'repeated' lit, the words already read bright and the rest dim, and below it the speed (1.0×), repeat, pause, back, volume, select and help controls."
    caption: "The reading window mid-sentence: the current word lit, the words already read bright, the rest dim."
  - file: cufflink-voices.webp
    alt: "Cufflink's voices window: a profile, two voices blended at 70% Emma and 30% Nicole, the speed at 1.30×, the sound read by The Informant, and dials for narrow, transistor, squash, tape, spy, fade, room and hiss."
    caption: "The voices window: blend two speakers, then shape the sound with the dials."
---

Cufflink reads the text you select aloud, in any program on Windows, and lights up each word as it goes. Select some text in a browser, an email or a document, press Ctrl + Alt + M, and a small window appears straight away with the whole selection in it. It's free and open source. [Install it from cufflink.reddy.world](https://cufflink.reddy.world).

These pictures are Cufflink's own window, from its [code on GitHub](https://github.com/Ryan-Reddy/cufflink).

## What you can do

- Pause by clicking the text. Change the speed and the volume, or let it read the same text again until you stop it.
- Turn on select mode, and everything you select is read straight away.
- Go back to the window you were reading from with one key.
- Pick who reads to you: five voices, each with its own character. Or blend two speakers and shape the sound with eight dials, from tape flutter to hiss.
- Let your own programs speak through it: while it runs, any program on the same computer can send it text to read.

## The hard parts

**The window comes first.** The reading window appears the moment you press the key, with the whole selection in it, rather than waiting for the first sound.

**Speech on your own computer.** The voices are made by a small speech model on your PC, not by a cloud service. The installer downloads the model once and checks each file before keeping it. After that, reading aloud works with the internet switched off.

**Out of the way when you don't need it.** The text you select is held in memory only while it is read, then forgotten. Select mode is the only part that listens to the mouse, and only while it is on.
