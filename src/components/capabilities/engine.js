// Reproduces Centrifugo PRO connection-caps evaluation
// (internal/caps/match.go HasChannelCapability). Reuses the verified matcher
// from the permissions engine so wildcard/doublestar/regex/exact stay identical.
//
// IMPORTANT (verified against source): evaluation is PER OPERATION. For an op X
// on channel C, Centrifugo scans caps objects, SKIPS any whose `allow` lacks X,
// then returns allowed on the first remaining object with a channel matching C.
// Consequently a channel's effective capabilities are the UNION of the `allow`
// sets of every caps object whose channels match it — a later object can grant
// an op an earlier (channel-matching) object didn't, and object ORDER does not
// change the outcome. Caps only ever GRANT; they never deny.

import { checkMatch } from '../permissions/engine.js';

export const CAP_OPS = ['sub', 'pub', 'hst', 'prs'];
export const CAP_LABEL = { sub: 'subscribe', pub: 'publish', hst: 'history', prs: 'presence' };

// caps: array of { channels: [], allow: [], match: '' }
export function resolveCaps(caps, channel) {
  const list = Array.isArray(caps) ? caps : [];
  const objects = list.map((cap, index) => {
    const match = (cap && cap.match) || '';
    const channels = cap && Array.isArray(cap.channels) ? cap.channels : [];
    const allow = cap && Array.isArray(cap.allow) ? cap.allow : [];
    const matchedResource = channels.find((r) => checkMatch(r, channel, match));
    return { index, match, channels, allow, matches: matchedResource !== undefined, matchedResource };
  });

  const ops = {};
  for (const op of CAP_OPS) {
    // First object that both allows the op AND matches the channel (source order).
    const granting = objects.find((o) => o.allow.includes(op) && o.matches);
    ops[op] = granting
      ? { allowed: true, by: granting.index, resource: granting.matchedResource, match: granting.match }
      : { allowed: false };
  }

  const effective = CAP_OPS.filter((op) => ops[op].allowed);
  return { objects, ops, effective };
}
