// npm test  (node --test "scripts/**/*.test.mjs"): titles and descriptions cut to what a search result shows
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cutAt, fitTitle, fitDescription } from '../src/lib/snippet.js';

test('a title keeps the longest form that fits in 60 characters', () => {
  assert.equal(fitTitle('Giant swings — ReddyMaekers | Ryan Reddy', 'Giant swings — ReddyMaekers', 'Giant swings'), 'Giant swings — ReddyMaekers | Ryan Reddy');
  assert.equal(fitTitle('Tropical stage Vunzige Deuntjes Festival — ReddyMaekers | Ryan Reddy', 'Tropical stage Vunzige Deuntjes Festival — ReddyMaekers', 'x'), 'Tropical stage Vunzige Deuntjes Festival — ReddyMaekers');
  const long = fitTitle('Sander Kleinenberg & Felix Leiter - The One (Official Music Video) — Ryan Reddy Productions', 'Sander Kleinenberg & Felix Leiter - The One (Official Music Video)');
  assert.ok(long.length <= 60, long);
  assert.match(long, /^Sander Kleinenberg & Felix Leiter - The One \(Official…$/);
});

test('a description is the text and the work line, the text cut at a word to fit 160', () => {
  const text = 'For the Wicked Jazz Sounds Festival we where asked to paint a giant 80m2 of panels bright yellow for the main stage, and also they wanted us to make giant letters from compressed polystyrene.';
  const out = fitDescription([text], 'Signage & lettering by ReddyMaekers, 2016');
  assert.ok(out.length <= 160, String(out.length));
  assert.match(out, /^For the Wicked Jazz Sounds Festival .*… Signage & lettering by ReddyMaekers, 2016\.$/);
  assert.equal(fitDescription(['Short words'], 'Light by ReddyMaekers, 2017'), 'Short words. Light by ReddyMaekers, 2017.');
});

test('web addresses are left out; a text that is only addresses gives way to the next', () => {
  assert.equal(fitDescription(['https://www.instagram.com/p/BMKLShOgiOe/ https://www.instagram.com/p/BOQ/', 'Lichtbak Social Swingers Club'], 'Signage & lettering by ReddyMaekers, 2017'),
    'Lichtbak Social Swingers Club. Signage & lettering by ReddyMaekers, 2017.');
  assert.equal(fitDescription(['', undefined, 'The name'], ''), 'The name.');
});

test('cutting never adds words and ends on a whole word', () => {
  assert.equal(cutAt('one two three four', 12), 'one two…');
  assert.equal(cutAt('fits', 10), 'fits');
});
