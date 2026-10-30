# Desk images, page layouts and publishing

Open https://reddy.world/private/portfolio/ and sign in with the desk owner account.

## Images

**Upload new images** works for both projects and articles. It adds files to the current piece, even if you move elsewhere while the upload finishes. Project uploads join the picture library and its description, keywords, photographer and lead-picture controls. The upload status stays beside the button. The current picture is identified by thumbnail, number and filename; **Insert this picture in the text** places that exact image at the editor's last caret position.

Original files stay in private Storage. Publishing makes stripped, rotated WebP copies at up to 2000 px, with responsive variants. Existing archive media indices stay unchanged; new project pictures use stable ids in the text. Only public projects are eligible for new public image copies.

## Guidance where it is used

Tag ideas are beside Tags and open when that input is focused. The original summary sits beside Summary. Original captions and alt text sit beside the picture description, with a use action. Writing help sits above the actual text editor. The obsolete bottom WordPress drawers are hidden.

## Three page layouts

- **Story:** readable text with wide media, suitable for articles and process accounts.
- **Cover:** a wide lead picture or click-to-play video with the title over it on desktop.
- **Split:** the title/introduction beside the media on desktop, stacked on phones.

Choose the page layout at the top of the panel. Banner options choose the lead picture or a YouTube/Vimeo link and the picture's framing. These settings survive publishing and are carried in the feed so the expanded wall panel uses the same layout. This changes opened pages; arrangement and styling of the wall tiles remain a separate control.

These are built-in layouts, with no purchased WordPress theme or page-builder dependency. Reference patterns: https://wordpress.org/patterns/ . No award claim is made for these new layouts.

## Publish and restore

The desk autosaves privately. **Include in next publish** makes an article eligible; unfinished article drafts stay private. **Publish changes** snapshots the desk, queues its internal data PR, and publishes automatically only after the exact head passes Preview. The live wall rebuild follows. The previous nightly send schedule is removed, so autosave alone never publishes.

Automatic publishing is restricted to the owner's `Your desk changes` PR, a same-repository `desk/` branch into main, and the complete inventory of allowed data, article and image files. Application code is refused. The merge request supplies the checked head SHA to prevent an untested update slipping in. `publishing-policy.js` gates both the UI wording and the merge script. Ryan explicitly approved this mechanism on 30 October 2026.

**History** keeps four recent sent versions (three updates back) in owner-only `private-desk/image-desk-version-0` through `-3`. Text and metadata are compressed; image files are referenced rather than copied. A representative archive snapshot was about 59 KB compressed. History starts with the first send from the updated desk; existing Git history remains available for earlier site versions.

Restore first preserves the current work, then loads a version as a new draft with fresh merge stamps. It does not publish immediately. Review it, then use Publish changes. History needs sign-in and the existing owner-only Firestore rules; no new account permission is required.

## Verification

Tests cover archive-source preservation, new project image processing/idempotency, old media indices, stable image markers, layout field publishing, bounded/validated video values, compressed Unicode history, restore stamps and the auto-publish file/owner boundaries. Desktop and phone checks use local-only fixtures, removed before commit. No production test image or draft was uploaded.
