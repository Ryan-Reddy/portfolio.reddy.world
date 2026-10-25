// npm test: the mark's size and colour rules, whose picture is whose, and that the metadata
// sharp writes reads back as Ryan's.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { COPYRIGHT, CREATOR, imageRights, rightsOf } from '../../src/lib/image-rights.js';
import { EXIF, MARK, STAMP, markBox, markColour, markVariant, readRights, xmpFor } from './stamp.mjs';

test('the mark is about a tenth of the shorter side, within its limits', () => {
  assert.equal(markBox(1200, 800, 1).height, Math.round(800 * MARK.share));
  assert.equal(markBox(480, 320, 1).height, MARK.min);
  assert.equal(markBox(4000, 3000, 1).height, MARK.max);
  // too small for the minimum: a fifth of the shorter side at most
  assert.equal(markBox(120, 100, 1).height, 20);
  assert.ok(markBox(1200, 800, 1).margin >= MARK.minMargin);
});

test('black on a light corner, white on a dark one', () => {
  assert.equal(markColour(0.8), 'black');
  assert.equal(markColour(0.2), 'white');
});

test("whose picture: Ryan's work, his logos, and what is not his", () => {
  assert.equal(rightsOf('/portfolio/images/rrproductions/2016/03/img_0655.jpg'), 'mark');
  assert.equal(rightsOf('/portfolio/images/rrproductions/2016/03/img_0655-800w.jpg'), 'mark');
  assert.equal(rightsOf('/portfolio/images/software/dekost/dekost-chart-480w.webp'), 'mark');
  // every picture is marked; Ryan's own logos too (2026-10-25: "all images hosted on my site")
  assert.equal(rightsOf('/portfolio/images/rmaekers/2016/07/logo-round-2-480w.jpg'), 'mark');
  // not his own work: the mark, without his name or copyright
  assert.equal(rightsOf('/portfolio/images/rmaekers/2016/07/radion-logo.jpg'), 'stamp');
  assert.equal(rightsOf('/portfolio/images/maup/2019/01/sketch.jpg'), 'stamp');
  assert.equal(rightsOf('/portfolio/images/vaguelyvulgar/2016/08/a.jpg'), 'stamp');
  assert.deepEqual(imageRights('https://reddy.world/portfolio/images/vaguelyvulgar/2016/08/a.jpg', '#ryan'), {});
  assert.deepEqual(imageRights('https://reddy.world/portfolio/images/maup/x.jpg', '#ryan'), {});
  assert.equal(imageRights('https://reddy.world/portfolio/images/rrproductions/x.jpg', '#ryan').copyrightNotice, COPYRIGHT);
});

test('the metadata sharp writes reads back as Ryan\'s', async () => {
  for (const format of ['jpeg', 'png', 'webp']) {
    const buf = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#888' } })
      .withExif(EXIF).withXmp(xmpFor('mark'))[format]().toBuffer();
    const { xmp, exif } = await sharp(buf).metadata();
    const r = readRights(xmp);
    assert.equal(r.creator, CREATOR, format);
    assert.equal(r.copyright, COPYRIGHT, format);
    assert.equal(r.stamp, STAMP, format);
    assert.ok(exif.includes(Buffer.from(CREATOR)), `${format} EXIF Artist`);
  }
});

test('a mark tall enough for a phone to read it carries the QR code', () => {
  assert.equal(markVariant(MARK.qrMin - 1), 'plain');
  assert.equal(markVariant(MARK.qrMin), 'qr');
  assert.equal(markVariant(MARK.badgeMin - 1), 'qr');
  assert.equal(markVariant(MARK.badgeMin), 'badge');
  assert.equal(markVariant(markBox(4000, 3000, 1).height), 'badge');
  assert.equal(markVariant(markBox(480, 320, 1).height), 'plain');
});
