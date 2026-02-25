import test from "node:test";
import assert from "node:assert/strict";
import { rankCandidates, scoreNameMatch } from "../backend/src/utils/ranking.js";

test("scoreNameMatch prioritizes exact over fuzzy", () => {
  const exact = scoreNameMatch("Julia", "julia");
  const fuzzy = scoreNameMatch("Julia", "Julea");
  assert.ok(exact > fuzzy);
});

test("rankCandidates orders likely misspelling near top", () => {
  const ranked = rankCandidates("Phillis", [
    { id: 1, name_normalized: "felix" },
    { id: 2, name_normalized: "phylis" },
    { id: 3, name_normalized: "phillis" }
  ]);

  assert.equal(ranked[0].id, 3);
  assert.equal(ranked[1].id, 2);
});
