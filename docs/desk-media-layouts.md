# Desk images, page layouts and publishing

Open https://reddy.world/private/portfolio/ and sign in with the desk owner account.

## Images

**Upload images** works for both projects and articles. It adds files to the current piece, even if you move elsewhere while the upload finishes. Project uploads join the picture library and its description, keywords, photographer and lead-picture controls. The upload status stays beside the button. The current picture is identified by thumbnail, number and filename; **Add this image to page** places that exact image at the editor's last caret position.

Original files stay in private Storage. Publishing makes stripped, rotated WebP copies at up to 2000 px, with responsive variants. Existing archive media indices stay unchanged; new project pictures use stable ids in the text. Only public projects are eligible for new public image copies.

## Guidance where it is used

Tag ideas are beside Tags and open when that input is focused. The original summary sits beside Summary. Original captions and alt text sit beside the picture description, with a use action. Writing help sits above the actual text editor. The obsolete bottom WordPress drawers are hidden.

## Three page layouts

- **Text first:** readable text with wide media, suitable for articles and process accounts.
- **Full-width banner:** a wide lead picture or click-to-play video with the title over it on desktop.
- **Side by side:** the title/introduction beside the media on desktop, stacked on phones.

Open **Page design** under Summary to choose a layout. Cover image or video options choose the lead picture or a YouTube/Vimeo link and the picture's framing. These settings survive publishing and are carried in the feed so the expanded wall panel uses the same layout. This changes opened pages; arrangement and styling of the wall tiles remain a separate control.

These are built-in layouts, with no purchased WordPress theme or page-builder dependency. Reference patterns: https://wordpress.org/patterns/ . No award claim is made for these new layouts.

## Publish and restore

The desk autosaves privately. **Include in next publish** makes an article eligible; unfinished article drafts stay private. **Publish changes** snapshots the desk, queues its internal data PR, and publishes automatically only after the exact head passes Preview. The live wall rebuild follows. The previous nightly send schedule is removed, so autosave alone never publishes.

Automatic publishing is restricted to the owner's `Your desk changes` PR, a same-repository `desk/` branch into main, and the complete inventory of allowed data, article and image files. Application code is refused. The merge request supplies the checked head SHA to prevent an untested update slipping in. `publishing-policy.js` gates both the UI wording and the merge script. Ryan explicitly approved this mechanism on 30 October 2026.

**Tools → Version history** keeps four recent sent versions (three updates back) in owner-only `private-desk/image-desk-version-0` through `-3`. Text and metadata are compressed; image files are referenced rather than copied. A representative archive snapshot was about 59 KB compressed. History starts with the first send from the updated desk; existing Git history remains available for earlier site versions.

Restore first preserves the current work, then loads a version as a new draft with fresh merge stamps. It does not publish immediately. Review it, then use Publish changes. History needs sign-in and the existing owner-only Firestore rules; no new account permission is required.

## Verification

Tests cover archive-source preservation, new project image processing/idempotency, old media indices, stable image markers, layout field publishing, bounded/validated video values, compressed Unicode history, restore stamps and the auto-publish file/owner boundaries. Desktop and phone checks use local-only fixtures, removed before commit. No production test image or draft was uploaded.

## Desk navigation

**Edit page** shows title, summary, tags and page design. **Images** shows the selected image, Add to page, descriptions and photographer credits. **Wall preview** previews cards. **View live page** opens the published page. **Reviewed** records editorial progress and never means published. Autosave says **Saved privately**; only **Publish changes** sends work live after checks. Version history and backup files live under Tools.

## Defaults, saving and progress

Untouched projects start with their WordPress title, content, summary/excerpt, tags and categories. Published keyword edits and explicit empty keyword lists take precedence. Draft edits and deliberate cleared fields also win; opening a project does not save or mark it reviewed.

**Save** stores the current draft privately and reports **Saved** (account) or **Saved here** (signed out/browser). It does not publish or mark reviewed. **Save & next** saves and marks the project reviewed, then opens the next pending item. **Next to review** skips reviewed items and prefers untouched work before returning to in-progress items. Previous and the project list can still revisit anything. Default WordPress tags alone do not mark a project reviewed.

The saved position uses stable project/image ids and a separate navigation timestamp, so image insertions and older account cursors do not reset progress. Navigation from the project list, image strip and overview is saved too. Signed-in navigation syncs even when no content changed. Legacy numeric cursors remain supported.

## Adding page blocks and video files

Use the visible **Add text / Add images / Add video** row above the page. Add text creates a paragraph after the last selected block, ready to type. Click existing text to edit it; Enter creates a paragraph; select words for headings, lists or formatting. Images upload to the current piece and are placed on the page. Images mode still provides the library and credits.

Add video offers a YouTube/Vimeo link or an MP4/WebM file up to 25 MB. Use as the page banner is optional. Large clips can use a hosted link. Uploaded video files stay in the existing private originals bucket and are copied into the public archive only when a public project or ready article references them during Publish changes. Files are served as supplied, without transcoding; use a browser-compatible MP4/WebM. Previously published video files remain available when removed from a page.

An unconfigured layout now defaults to **Full-width banner**, including the public feed. An explicit Text first or Side by side selection is retained. Native videos can play on the standalone page and in the expanded wall's body/banner.
