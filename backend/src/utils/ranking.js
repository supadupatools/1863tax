import { normalizeText } from "./security.js";

function bigramSet(text) {
  const value = ` ${normalizeText(text)} `;
  const set = new Set();
  for (let i = 0; i < value.length - 1; i += 1) {
    set.add(value.slice(i, i + 2));
  }
  return set;
}

function diceCoefficient(a, b) {
  if (!a || !b) return 0;
  const A = bigramSet(a);
  const B = bigramSet(b);
  if (A.size === 0 || B.size === 0) return 0;

  let intersection = 0;
  for (const token of A) {
    if (B.has(token)) intersection += 1;
  }

  return (2 * intersection) / (A.size + B.size);
}

export function scoreNameMatch(query, candidate) {
  const q = normalizeText(query);
  const c = normalizeText(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.startsWith(q)) return 80;
  if (c.includes(q)) return 65;
  return Math.round(diceCoefficient(q, c) * 60);
}

export function rankCandidates(query, candidates) {
  return [...candidates]
    .map((candidate) => ({
      ...candidate,
      rank: scoreNameMatch(query, candidate.name_normalized || candidate.name_original || "")
    }))
    .sort((a, b) => b.rank - a.rank);
}
