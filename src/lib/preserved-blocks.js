// Serializers provide sanitized HTML and a stable signature for each current block.
// Only a block still identical to its original may reuse the archive's original markup.
export function preserveBlocks(original, baseline, blocks) {
  const known = new Map(baseline.map(block => [block.id, block]));
  const same = (a,b) => a?.id === b.id && a.signature === b.signature;
  if (blocks.length === baseline.length && blocks.every((block,index) => same(baseline[index],block))) return original;
  return blocks.map(block => {
    const before = known.get(block.id);
    return before && same(before,block) ? before.source : block.html;
  }).filter(Boolean).join('\n\n');
}
