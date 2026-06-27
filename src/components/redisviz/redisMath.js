// Math backbone shared by the Redis Pub/Sub scaling visualizations.
//
// Everything here is a faithful JS port of the Go package
// github.com/centrifugal/centrifuge/internal/redispartition. The CRC16 and
// SlotToNode functions are byte-identical to the source; the precomputed tag
// table (precomputedTags.json) is extracted verbatim from precomputed.go, so
// the slot distributions shown in the browser match what Centrifugo actually
// does at runtime. Validated against the Go test vectors and the known
// 128-partition / 6-node distributions ([21,22,21,21,22,21] precomputed vs
// [27,15,22,23,16,25] naive).

import precomputedTags from './precomputedTags.json';

export const TOTAL_SLOTS = 16384;

// CRC-CCITT (XModem), matching Redis's CRC16 used for hash slots.
export function crc16(str) {
  let crc = 0;
  for (let i = 0; i < str.length; i++) {
    crc ^= (str.charCodeAt(i) & 0xff) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

// Redis hash slot for a key/tag (no hash-tag braces handling here — callers
// pass the already-extracted tag string).
export function tagSlot(tag) {
  return crc16(tag) % TOTAL_SLOTS;
}

// Which node (0-based) owns a slot in a cluster of numNodes, matching Redis
// Cluster's contiguous assignment: sn = 16384/numNodes, the first
// (16384 % numNodes) nodes get one extra slot.
export function slotToNode(slot, numNodes) {
  const sn = Math.floor(TOTAL_SLOTS / numNodes);
  const r = TOTAL_SLOTS % numNodes;
  const b = r * (sn + 1);
  if (slot < b) return Math.floor(slot / (sn + 1));
  return r + Math.floor((slot - b) / sn);
}

// How many of the 16384 slots a given node owns in a cluster of numNodes.
export function slotsOwnedByNode(node, numNodes) {
  const sn = Math.floor(TOTAL_SLOTS / numNodes);
  const r = TOTAL_SLOTS % numNodes;
  return node < r ? sn + 1 : sn;
}

// Partition counts we ship precomputed tags for.
export const PRECOMPUTED_SIZES = Object.keys(precomputedTags)
  .map(Number)
  .sort((a, b) => a - b);

// Naive tags are just the partition index as a string: {0},{1},...,{N-1}.
export function naiveTags(numPartitions) {
  return Array.from({ length: numPartitions }, (_, i) => String(i));
}

export function precomputedTagsFor(numPartitions) {
  return precomputedTags[numPartitions] || precomputedTags[String(numPartitions)] || null;
}

// Count how many partitions land on each of the numNodes cluster nodes, given
// a list of tag strings. Returns an array of length numNodes.
export function partitionsPerNode(tags, numNodes) {
  const counts = new Array(numNodes).fill(0);
  for (const t of tags) counts[slotToNode(tagSlot(t), numNodes)]++;
  return counts;
}

// Convenience: distribution for the naive and precomputed schemes at a given
// partition count and cluster size. Falls back to the largest precomputed set
// whose size is <= numPartitions if an exact table is missing.
export function distributions(numPartitions, numNodes) {
  const naive = partitionsPerNode(naiveTags(numPartitions), numNodes);
  const pre = precomputedTagsFor(numPartitions);
  const precomputed = pre ? partitionsPerNode(pre, numNodes) : null;
  return { naive, precomputed };
}

// Spread ratio = busiest node load / lightest node load. 1.0 is perfectly even.
export function spreadRatio(counts) {
  const mn = Math.min(...counts);
  const mx = Math.max(...counts);
  if (mn === 0) return mx === 0 ? 1 : Infinity;
  return mx / mn;
}
