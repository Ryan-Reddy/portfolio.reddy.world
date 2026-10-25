// Module hooks for json-imports.mjs: a bare JSON import gets `type: 'json'`.
export async function load(url, context, next) {
  if (url.startsWith('file:') && url.endsWith('.json') && !context.importAttributes?.type) {
    return next(url, { ...context, importAttributes: { ...context.importAttributes, type: 'json' } });
  }
  return next(url, context);
}
