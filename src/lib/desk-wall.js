// Wall placement is its own stamped entry: moving a tile never changes its page or date.
export const wallKey = (...parts) => parts.join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-');
export function cleanPlacement(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  if (Number.isInteger(value.year) && value.year >= 1900 && value.year <= 2200) out.year = value.year;
  if (Number.isInteger(value.row) && value.row >= 0 && value.row <= 99) out.row = value.row;
  if (Number.isFinite(value.order) && value.order >= 0) out.order = value.order;
  if (typeof value.hidden === 'boolean') out.hidden = value.hidden;
  return out;
}
export function wallSettings(entries = {}) {
  return Object.fromEntries(Object.entries(entries).filter(([key]) => /^[a-z0-9-]{1,200}$/.test(key))
    .map(([key, value]) => [key, cleanPlacement(value)]).filter(([, value]) => Object.keys(value).length));
}
export function placedTiles(tiles, entries = {}) {
  return tiles.map((tile, index) => ({...tile, row: 0, order: index, hidden: false, ...cleanPlacement(entries[tile.key])}))
    .sort((a, b) => b.year - a.year || a.row - b.row || a.order - b.order || a.key.localeCompare(b.key));
}
