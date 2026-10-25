import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subjectImageObject } from '../src/lib/model-page.js';

const ID = 'https://reddy.world/#ryan';
const base = {
  '@type': 'ImageObject',
  contentUrl: 'https://reddy.world/portfolio/images/vaguelyvulgar/2016/08/a.jpg',
  keywords: 'Ryan Reddy, model, fur coat',
  creator: { '@id': ID },
  creditText: 'Ryan Reddy',
  copyrightNotice: '© Ryan Reddy',
};

test('Ryan is what the picture is about, not its creator, credit or copyright', () => {
  const out = subjectImageObject(base, { alt: 'Ryan Reddy in a fur coat.', description: 'Ryan Reddy in a fur coat.' }, ID);
  assert.deepEqual(out.about, { '@id': ID });
  assert.equal(out.creator, undefined);
  assert.equal(out.creditText, undefined);
  assert.equal(out.copyrightNotice, undefined);
  assert.equal(out.description, 'Ryan Reddy in a fur coat.');
  assert.equal(out.keywords, 'Ryan Reddy, model, fur coat');
});

test('the alt text is the description when no description was written', () => {
  assert.equal(subjectImageObject(base, { alt: 'Close-up.' }, ID).description, 'Close-up.');
  assert.equal(subjectImageObject(base, { alt: '' }, ID).description, undefined);
});

test("a photographer's credit stays", () => {
  const credited = { ...base, creator: { '@type': 'Person', name: 'A. Photographer' }, creditText: 'A. Photographer', copyrightNotice: undefined };
  const out = subjectImageObject(credited, { alt: 'x' }, ID);
  assert.equal(out.creator.name, 'A. Photographer');
  assert.equal(out.creditText, 'A. Photographer');
});
