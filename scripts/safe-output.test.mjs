// npm test  (node --test "scripts/**/*.test.mjs")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonLdText, httpUrl, storyHtml } from '../src/lib/safe-output.js';

test('a credit name holding </script> stays inside the JSON-LD block and parses back the same', () => {
  const value = { '@type': 'ImageObject', creator: { '@type': 'Person', name: '</script><b>x' }, creditText: 'a & b > c \u2028 \u2029' };
  const text = jsonLdText(value);
  assert.ok(!/[<>&\u2028\u2029]/.test(text), text);
  assert.ok(!text.includes('</script'));
  assert.ok(!text.includes('<b>'));
  assert.deepEqual(JSON.parse(text), value);
});

test('only http(s) addresses become links', () => {
  assert.equal(httpUrl('javascript:alert(1)'), undefined);
  assert.equal(httpUrl(' JavaScript:alert(1)'), undefined);
  assert.equal(httpUrl('data:text/html,<b>x'), undefined);
  assert.equal(httpUrl('mailto:a@example.com'), undefined);
  assert.equal(httpUrl('www.example.com'), undefined);
  assert.equal(httpUrl(''), undefined);
  assert.equal(httpUrl(undefined), undefined);
  assert.equal(httpUrl('https://example.com'), 'https://example.com/');
  assert.equal(httpUrl('http://example.com/a?b=1'), 'http://example.com/a?b=1');
});

test('a post text keeps paragraphs, emphasis, safe links and picture blocks; scripts, attributes and other tags go', () => {
  const out = storyHtml('<p style="x">Hi <b>there</b> <a href="javascript:alert(1)">x</a> <a href="https://reddymaekers.com/shop/" target="_blank">shop</a></p><script>bad()</script><div class="a">kept words</div><figure data-media="3,4"></figure><img src=x onerror=alert(1)><figure>junk</figure>');
  assert.equal(out, '<p>Hi <b>there</b> <a>x</a> <a href="https://reddymaekers.com/shop/">shop</a></p>kept words<br><figure data-media="3,4"></figure>junk');
});

test('a post text never lets a tag through half-way: an unclosed tag or comment is written out as text', () => {
  assert.equal(storyHtml('<p>x <img src=x onerror=alert(1)//'), '<p>x &lt;img src=x onerror=alert(1)//');
  assert.equal(storyHtml('<p>a</p><!-- x'), '<p>a</p>&lt;!-- x');
  assert.equal(storyHtml('a <script>alert(1)'), 'a alert(1)');
});

test('headings as the page shows them, rules kept, links only to the web or this site', () => {
  assert.equal(storyHtml('<h1 class="x">Title</h1><h5>Small</h5><hr class="y">'), '<h2>Title</h2><h4>Small</h4><hr>');
  assert.equal(storyHtml('<a href="/\\evil.example/x">a</a><a href="//evil.example">b</a><a href="/portfolio/x/">c</a>'), '<a>a</a><a>b</a><a href="/portfolio/x/">c</a>');
});
