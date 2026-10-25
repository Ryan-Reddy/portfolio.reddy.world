// Words Ryan types on the image desk (credits, descriptions, keywords) end up inside the
// pages' HTML. These two keep them from being read as markup or as a script link.

// JSON for a <script type="application/ld+json"> block: the same JSON, but with < > & and the
// two line separators written as \u escapes, so a name holding "</script>" cannot end the block
const ESCAPES = { '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029' };
export const jsonLdText = (value) => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => ESCAPES[c]);

// an address to link to: only http(s), as a full URL; anything else (javascript:, data:, "www.x") gives undefined
export const httpUrl = (value) => {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
};
