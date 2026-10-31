# Wall editing: revised scope for #82 and #83

Ryan's feedback, 30 October 2026: the organiser exists, but managing the wall should happen on the actual wall. Titles and cover pictures need quick edits. Tiles and article blocks need dragging. Creating an item and adding the first content to an empty page must always be possible.

## Current status

- #82 and #83 are open. Their descriptions understate the remaining product work.
- The organiser writes year, row, order and visibility to the existing desk state. The public wall reads the published settings. These are currently separate views.
- The private desk has New item, Add text, Add images and Add video. A reproduced bug inherited wall-preview mode when creating/opening an article, hiding the editor although Edit page looked selected; fix this with the searchable overview. The expanded items on the actual wall have no equivalent editing interface.
- The archive-page edit bar is another editing route. It creates an empty text region in some layouts, but does not expose the full desk's insertion controls.
- The saved-link recognition bug is fixed separately in #114/#115: the active editor now receives resolved image blocks and labelled Instagram sources.

## Shared item model and category settings

Ryan, 30 October: projects and articles should be interchangeable in the interface. Treat them as items sharing the same editor, properties, media blocks and arrangement tools. Project, Story, Recipe and other types are descriptive choices with optional specialist fields, not separate editing capabilities. Retain existing public addresses and WordPress source history.

Categories currently group/filter work; they do not supply an inherited design-settings interface. Ryan's follow-up favours optional templates rather than automatically applying a category layout to every post. Categories may suggest suitable templates, but applying one is an explicit choice. Applying a template supplies an editable starting structure; later template changes must not rewrite existing items.

Keep content type (Project, Story, Recipe) distinct from work category (Signs & light, Stages & decor, etc.) while allowing the same editing tools for every item. Tags and categories organise items without imposing a fixed number of images or a mandatory template.

## Reusable galleries and wall sections

The ADNIGHT @ MERKTROUBADOUR source contains a single nine-picture media block, rendered in balanced rows of up to three. Preserve this as a reference layout and make it available as an Add gallery choice in every item's editor, including for newly uploaded pictures.

Gallery choices to implement: Balanced rows (the Merktroubadour arrangement), Even grid, Featured image with smaller images, and a Carousel. Allow changing image order, adding/removing pictures, column count, gaps and whether pictures keep their full proportions or use a chosen crop. Moving or changing a gallery layout must retain image descriptions, credits, source references and individual enlargement.

The actual wall should support multiple layout sections rather than a single global grid choice: compact grid, photo mosaic and featured rows, with section-level columns, spacing and image-shape options. Tile and block positions snap into responsive rows and columns, as Ryan selected. Templates are optional starting choices; section, item and block controls provide fine adjustment. Galleries adapt to the chosen pictures and do not require filling a prescribed number of slots; longer photo stories and videos remain supported.

## Media performance and motion previews

New desk pictures and recovered supported links already publish local WebP copies. Uploaded pictures have responsive sizes; older archive JPEGs also have smaller copies. Preserve originals separately from the public delivery copies. Measure actual loading performance before choosing a bulk format migration; file dimensions, responsive selection, loading priority and total page media matter as well as the extension.

Uploaded videos currently publish without automatic transcoding. Add an optional short, compressed MP4/WebM preview and a WebP poster for wall tiles and hero media, retaining the full video separately. This provides the looping effect Ryan previously made with GIFs without requiring large GIF downloads. Load/play previews only on visibility or deliberate interaction, pause them when offscreen, and use static posters for reduced motion/data-saving. Avoid many simultaneous looping decoders.

The latest production release passed its existing checks; its main wall script is about 125 KB gzip. The current Lighthouse gate covers accessibility, SEO and best practices, not loading performance. A fresh anonymous PageSpeed mobile request returned quota-exceeded, so no new mobile speed score has been established. Add mobile performance measurement and page-media budgets before treating this as fully performance-verified.

## Instagram and keyword feedback (31 October)

Instagram's official public oEmbed endpoint reports the Koupe post `BhbX9RjAW02` as Private Media (HTTP 400). Keep its source link; displaying its photograph requires a copy the owner can upload. A profile address does not identify a photo. Do not treat a working Instagram page link as a recoverable image file or claim all such media is permanently missing.

The shared keyword field now uses a compact entry with removable chips, inline demand scores and related suggestions. Demand/Rising sorting appears only while typing; method details stay behind the info button. Ryan rejected the former large helper panel and external Trends-link workflow.

The existing Bing Webmaster connection is working. A 180-phrase catalog returned 56 usable dated weekly series on 31 October; remaining phrases are unscored. The 0–100 logarithmic score uses the latest four reported weeks of Bing Netherlands/nl-NL counts, with growth against the previous four weeks only when the baseline has at least 20 searches. Stale data and missing coverage remain unknown. This is not Google demand or ranking difficulty. Weekly refreshes submit only the dataset through checked automatic publishing; no key enters the browser.

Datamuse supplies additional related wording, with no invented demand scores. Local measured suggestions and saving continue if it is unavailable. The actual wall editor, drag arrangement and reusable galleries below remain unfinished; #82 and #83 stay open.

## Delivery steps

### 0. Find every item

- All items searches titles, body text and tags across projects and articles, including private drafts.
- Filter to articles, drafts, published articles or items with no body text.
- Create a New item from this overview or the current organiser.
- Keep project review progress available without putting it ahead of the item list.

### 1. No empty-page dead ends

- A signed-in owner can enter editing from an expanded item on the actual wall.
- Add text, Add images, Add video and Add link remain visible when the item has no content.
- An empty item has a visible insertion target. Adding the first paragraph needs no existing text, picture or selection.
- The same insertion controls work for projects and articles.
- Verify the exact empty item Ryan encountered when its address is available; also test an empty article and an existing image-only project.

### 2. Create and quick-edit on the actual wall

- Edit wall activates owner controls on the actual wall renderer, retaining the current position and filters.
- New item creates a private draft and opens its editing controls there.
- A tile exposes title and cover-picture editing. Existing pictures can be selected; a new picture can be uploaded.
- The draft title and cover immediately appear on the wall being edited.
- Opening the item exposes its text and media controls in the same session.
- Reuse the existing desk state, uploads, sync, backups and publishing. Do not create another content store or saving protocol.

### 3. Drag arrangement on the actual wall

- Drag a tile to another position or row, with a visible insertion indicator and an undo action.
- Retain the existing year/row/order/visibility representation where possible.
- Provide keyboard and touch-friendly move controls as well as dragging.
- Use the actual responsive wall renderer for the editing preview.
- Ryan selected snapping into responsive rows and columns on 30 October; use this for wall tiles and article blocks.

### 4. Arrange the expanded page

- Treat text, pictures, galleries, videos and links as selectable blocks.
- Add a block before or after a selected block; insert the first block into an empty page.
- Drag blocks to change reading order, with keyboard alternatives and undo.
- Offer a small set of responsive widths/alignment choices; keep mobile reading order predictable.
- Reuse the existing project/article text editor and preservation rules rather than introducing a second text format.

## Completion criteria

Keep both issues open until Ryan can use the actual wall to create an item, edit its title and cover, arrange it, add and reorder its content, save, reload and publish. Verify the resulting public wall and expanded item. An isolated organiser preview or passing unit tests alone does not meet this definition.

Private drafts must remain private. A real publishing check should use Ryan's chosen content and arrangement, without publishing arbitrary rearrangements or test items.

## Questions awaiting Ryan

- Ryan cannot identify the blank item yet because article search/overview is missing. Verify the empty-page routes generally and make those items findable through the new overview.
