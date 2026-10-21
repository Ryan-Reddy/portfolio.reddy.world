---
title: Reddy.Mail
summary: "A private communications workspace: email, calendars and messaging channels in one place, with a public demo on a made-up studio's sample data."
dek: Your conversations, with a little more context.
eyebrow: Web app · mail.reddy.world
kind: app
category: CommunicationApplication
platform: Web browser
year: 2026
status: Private workspace; the demo is open to everyone
live: https://mail.reddy.world/demo/
cta: Try the demo
stack: [Google sign-in, Gemini API, WhatsApp Cloud API]
audience: People who juggle several inboxes, calendars and chats
maker: Reddy.World Enterprises
role: "Concept, design and code: Ryan Reddy"
order: 3
updated: 2026-10-21
screenshots:
  - file: reddy-mail-cleanbox.webp
    alt: "Reddy.Mail's demo on sample data: the Cleanbox with messages from three accounts on the left, and an opened message about poster proofs with a short summary, the action items found in it and the key date."
    caption: "The Cleanbox in the demo: one list for every connected mailbox, and a message with its summary and action items. All of it is sample data."
  - file: reddy-mail-socials.webp
    alt: "The Socials & Berichten hub: Instagram, WhatsApp and Messenger messages in one list, an Instagram message from a bakery opened, and a suggested reply above the reply box."
    caption: "Messages from WhatsApp, Instagram and Messenger in one list, with a suggested reply to edit or ignore."
  - file: reddy-mail-my-day.webp
    alt: "My Day: to-dos and calendar events in one list, filtered into bills to approve, replies owed, events to attend, dates to remember and personal to-dos, each with its due date."
    caption: "My Day: the replies you owe, the bills to approve and the events to attend, from your mail and calendars."
  - file: reddy-mail-publish.webp
    alt: "Publish: posts written once for several channels, each marked as posted, waiting or scheduled, with tabs for posts, calendar, channels and stats."
    caption: "Publish: write once, post to your channels now or at a set time."
---

Reddy.Mail brings connected email, calendars and messaging channels into one place, so you can focus on the conversation rather than where it happened. The workspace is private for now: only I can sign in. The [demo](https://mail.reddy.world/demo/) shows every screen on a made-up studio's sample data. It needs no sign-in, and nothing is sent or saved.

## What you can do

- Connect Gmail, Microsoft mail or an IMAP/SMTP mailbox through a setup wizard, and read them all in one Cleanbox.
- Read WhatsApp, Instagram and Messenger messages in one list, next to your mail.
- See your day in one place: the replies you owe, the bills to approve, the events to attend and the dates to remember.
- See the calendars you chose in one view.
- Write a post once and send it to Instagram, Facebook, a blog, Mastodon and the Fediverse, now or at a set time.
- If you want, let Gemini summarise a message and prepare a draft for you to review.

## The hard parts

**Permission, step by step.** Signing in with Google only opens the app. Reading your mail and calendars needs a separate connection, with its own consent, for each account.

**Private by design.** The workspace sits behind Google sign-in and a check on the server that you are its owner. The keys for each connection are encrypted before they are stored.

**Honest about the edges.** WhatsApp comes in through the Cloud API, for a business number set up for it, and personal chats are not imported. The AI features are optional, and the site says plainly what goes to Google's Gemini API when you use them.

**A demo that can't leak.** The demo runs entirely in your browser on invented people and messages, so anyone can try every screen without an account.
