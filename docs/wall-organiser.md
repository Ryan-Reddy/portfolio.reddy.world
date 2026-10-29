# Wall organiser (#82)

Open **Wall organiser** on the desk. Search by title or kind, filter on/off, use ↑ ↓ within a year and row, and choose a year or row. Row 0 is the automatic group; numbered rows stay separate while their tiles wrap responsively. Hiding a tile keeps its page. Study/work spans retain their CV dates and can be hidden or shown.

Placement lives in `state.wall`, separately from project and article content. Each tile is stamped and merged through the existing account sync. Exports include the wall; loading one stamps its placements. Draft articles keep a stable `a-<desk-id>` key even when renamed and must be published through their editor.

Send to site writes only validated placement fields to `src/data/wall.json`. The existing workflow already stages `src/data`, so arrangements use the same preview/review/release path as other desk changes. `/portfolio/wall.json` contains only public placement settings. RSS carries a namespaced desk id for matching published articles.

The companion change in `Ryan-Reddy/reddy.world` serves `/wall-catalog.json` from the software/CV sources and reads `/portfolio/wall.json` in the wall. Deploy the companion first; until it is available the organiser explains why software/CV tiles are missing. Existing archive feeds and walls without placement settings still work.

For a combined local preview, run the wall with `PORTFOLIO_ORIGIN=http://127.0.0.1:4321` on port 5175, and the archive with `WALL_SITE_URL=http://127.0.0.1:5175` on port 4321. These environment variables affect development proxies only.

Validation: portfolio and wall unit suites, both production builds, organiser checks at 1280 and 390 px, hide/show, reorder, reload persistence, and a temporary importer fixture verified on the companion wall. Account sync is covered by merge/stamp tests; no production account writes or live Send to site were made. Ryan approved the combined local preview on 29 October 2026: "merge this is grand".

## #81 — note of 29 October

The same field controls now move between projects and articles: title, summary, tags, fixed craft choices, publication date and a wall-organiser shortcut. The existing kind/person/case-study and image details remain available below the common fields. Page, Pictures and Preview actions are available for both kinds. A publication date also updates the staged wall year while retaining its row.

`piece-fields.js` holds the craft vocabulary, date validation and tag normalization. Send to site preserves article tags/craft/date as front matter, emits tags in structured data and the feed, and carries the resolved craft through the namespaced feed field to the wall. Project metadata changes retain the source title separately and preserve untouched content. Related articles inherit their case study's craft unless explicitly overridden.

The video controls add an embed or a plain link, edit an existing embed, and move/remove it. Project video markers now survive serialization and reload, and public players load on click. Project pictures use the existing image library, alt text, tags, credits and lead controls, with an action to insert the selected picture in the text. Articles retain their upload flow. Moving project text onto Tiptap remains the separately queued editor migration; the existing project source-preservation path remains in use.

Checked with a disposable signed-out local draft: metadata survives reload, embed-to-link conversion works, and a project video survives reload and can be removed. A temporary generated article confirmed its publication date/tags in public structured data and no iframe before play. Temporary content was removed. The current browser session could not capture fresh screenshots; responsive DOM-width checks are separate from Ryan's final visual approval.
