import test from "node:test";
import assert from "node:assert/strict";
import { requireRole } from "../backend/src/middleware/rbac.js";

function runRoleMiddleware(role, allowedRoles) {
  const req = { user: { role } };
  const payload = { statusCode: 200, body: null };
  const res = {
    status(code) {
      payload.statusCode = code;
      return this;
    },
    json(body) {
      payload.body = body;
      return this;
    }
  };

  let passed = false;
  requireRole(allowedRoles)(req, res, () => {
    passed = true;
  });

  return { passed, payload };
}

test("public user cannot access admin endpoint", () => {
  const result = runRoleMiddleware("public", ["admin"]);
  assert.equal(result.passed, false);
  assert.equal(result.payload.statusCode, 403);
});

test("admin role can access admin endpoint", () => {
  const result = runRoleMiddleware("admin", ["admin"]);
  assert.equal(result.passed, true);
  assert.equal(result.payload.statusCode, 200);
});

test("reviewer role can access review queue but not admin", () => {
  const reviewResult = runRoleMiddleware("reviewer", ["reviewer", "admin"]);
  const adminResult = runRoleMiddleware("reviewer", ["admin"]);
  assert.equal(reviewResult.passed, true);
  assert.equal(adminResult.passed, false);
  assert.equal(adminResult.payload.statusCode, 403);
});
