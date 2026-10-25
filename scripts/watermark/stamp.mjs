// The mark's size, place and metadata, kept apart from the file walking so the test can
// check them (stamp.test.mjs). Used by scripts/watermark.mjs and scripts/check-watermark.mjs.
import { CREATOR, CREDIT, COPYRIGHT, WEB_STATEMENT } from '../../src/lib/image-rights.js';

// The corner mark: about a tenth of the picture's shorter side, never under 44 or over
// 160 px tall, a small margin from the bottom-right edges, slightly see-through.
// With reddy.world under the unicorn the mark is a little taller than the unicorn alone was.
// From qrMin px tall it carries a QR code for https://reddy.world/ beside it: its 27 modules are
// then 3.5 px or more, enough for a phone camera.
export const MARK = { share: 0.13, min: 48, max: 190, margin: 0.025, minMargin: 6, opacity: 0.85, qrMin: 96 };
// Bump when the mark or the metadata change, so cached stamped files are made again
export const STAMP = 'unicorn-ascii-2';

/** Where the mark goes in a width x height picture: { height, margin } in px */
export function markBox(width, height, markAspect) {
  const short = Math.min(width, height);
  let h = Math.round(Math.min(MARK.max, Math.max(MARK.min, short * MARK.share)));
  // a picture too small for the minimum gets a mark no larger than a fifth of its shorter side
  if (h > short / 5) h = Math.max(1, Math.floor(short / 5));
  const margin = Math.max(MARK.minMargin, Math.round(short * MARK.margin));
  return { height: h, width: Math.round(h * markAspect), margin };
}

/** Which mark: with the QR code when the mark is tall enough for it to scan */
export const markVariant = (height) => (height >= MARK.qrMin ? 'qr' : 'plain');

/** Light corner (mean luminance over half): the black mark; dark corner: the white one */
export const markColour = (luminance) => (luminance > 0.5 ? 'black' : 'white');

/** Mean luminance (0..1) of a box in a raw RGB(A) buffer */
export function meanLuminance(data, { width, channels }, { left, top, w, h }) {
  let sum = 0;
  let n = 0;
  for (let y = top; y < top + h; y++) {
    for (let x = left; x < left + w; x++) {
      const i = (y * width + x) * channels;
      const [r, g, b] = channels >= 3 ? [data[i], data[i + 1], data[i + 2]] : [data[i], data[i], data[i]];
      sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      n++;
    }
  }
  return n ? sum / n / 255 : 0;
}

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/**
 * The XMP packet: the IPTC Photo Metadata fields Google Images shows (Creator, Credit Line,
 * Copyright Notice, Web Statement of Rights), plus which stamp the picture has.
 */
export const XMP = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/" xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/" xmlns:reddy="https://reddy.world/ns/picture/1.0/" photoshop:Credit="${xml(CREDIT)}" xmpRights:Marked="True" xmpRights:WebStatement="${xml(WEB_STATEMENT)}" reddy:Stamp="STAMP_KIND">
<dc:creator><rdf:Seq><rdf:li>${xml(CREATOR)}</rdf:li></rdf:Seq></dc:creator>
<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${xml(COPYRIGHT)}</rdf:li></rdf:Alt></dc:rights>
<Iptc4xmpCore:CreatorContactInfo Iptc4xmpCore:CiUrlWork="${xml(WEB_STATEMENT)}"/>
</rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="r"?>`;

/** The XMP for a picture that is not Ryan's work but carries the mark ('stamp'): which stamp, nothing else */
export const XMP_STAMP_ONLY = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:reddy="https://reddy.world/ns/picture/1.0/" reddy:Stamp="${STAMP}"/>
</rdf:RDF></x:xmpmeta>
<?xpacket end="r"?>`;

/** The XMP for a picture with the mark ('mark'), Ryan's metadata only ('meta') or the mark only ('stamp') */
export const xmpFor = (kind) => (kind === 'stamp' ? XMP_STAMP_ONLY : XMP.replace('STAMP_KIND', kind === 'mark' ? STAMP : 'metadata-only'));

/** EXIF (IFD0) Artist and Copyright */
export const EXIF = { IFD0: { Artist: CREATOR, Copyright: COPYRIGHT } };

/** What a picture's own metadata says: the check reads it back with this */
export function readRights(xmp = '') {
  const s = Buffer.isBuffer(xmp) ? xmp.toString('utf-8') : xmp;
  const pick = (re) => s.match(re)?.[1];
  return {
    creator: pick(/<dc:creator>\s*<rdf:Seq>\s*<rdf:li>([^<]*)</),
    copyright: pick(/<dc:rights>\s*<rdf:Alt>\s*<rdf:li[^>]*>([^<]*)</),
    credit: pick(/photoshop:Credit="([^"]*)"/),
    webStatement: pick(/xmpRights:WebStatement="([^"]*)"/),
    stamp: pick(/reddy:Stamp="([^"]*)"/),
  };
}
