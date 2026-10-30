# Wall editing: revised scope for #82 and #83

Ryan's feedback, 30 October 2026: the organiser exists, but managing the wall should happen on the actual wall. Titles and cover pictures need quick edits. Tiles and article blocks need dragging. Creating an item and adding the first content to an empty page must always be possible.

## Current status

- #82 and #83 are open. Their descriptions understate the remaining product work.
- The organiser writes year, row, order and visibility to the existing desk state. The public wall reads the published settings. These are currently separate views.
- The private desk has New item, Add text, Add images and Add video. The expanded items on the actual wall have no equivalent editing interface.
- The archive-page edit bar is another editing route. It creates an empty text region in some layouts, but does not expose the full desk's insertion controls.
- The saved-link recognition bug is fixed separately in #114/#115: the active editor now receives resolved image blocks and labelled Instagram sources.

## Delivery order

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
