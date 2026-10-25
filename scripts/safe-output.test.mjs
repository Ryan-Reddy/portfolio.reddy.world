// npm test  (node --test "scripts/**/*.test.mjs")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonLdText, httpUrl } from '../src/lib/safe-output.js';

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
