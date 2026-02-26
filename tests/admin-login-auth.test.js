import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStoredUser,
  canAccessAdminPortal,
  loginErrorMessage,
  normalizeCredentials,
  toAuthResult
} from "../web/admin/login-auth.js";

test("normalizeCredentials trims/lowercases email and preserves password", () => {
  const form = new Map([
    ["email", "  ADMIN@Example.COM  "],
    ["password", "Secret123!  "]
  ]);

  assert.deepEqual(normalizeCredentials(form), {
    email: "admin@example.com",
    password: "Secret123!  "
  });
});

test("buildStoredUser uses profile values when available", () => {
  const authUser = { id: "u1", email: "auth@example.com" };
  const profile = {
    email: "profile@example.com",
    role: "reviewer",
    display_name: "Profile Name",
    is_active: true
  };

  assert.deepEqual(buildStoredUser(authUser, profile), {
    id: "u1",
    email: "profile@example.com",
    role: "reviewer",
    displayName: "Profile Name",
    isActive: true
  });
});

test("canAccessAdminPortal enforces active + allowed role", () => {
  assert.equal(canAccessAdminPortal({ role: "admin", isActive: true }), true);
  assert.equal(canAccessAdminPortal({ role: "public", isActive: true }), false);
  assert.equal(canAccessAdminPortal({ role: "admin", isActive: false }), false);
});

test("toAuthResult maps REST payload and tolerates missing values", () => {
  assert.deepEqual(toAuthResult({ access_token: "token", user: { id: "u1", email: "a@b.com" } }), {
    session: { accessToken: "token" },
    user: { id: "u1", email: "a@b.com" }
  });

  assert.deepEqual(toAuthResult({}), {
    session: { accessToken: null },
    user: { id: null, email: null }
  });
});

test("loginErrorMessage prioritizes explicit auth errors then missing session", () => {
  assert.equal(
    loginErrorMessage({ authError: { message: "invalid login" }, authResult: null }),
    "invalid login"
  );
  assert.equal(loginErrorMessage({ authResult: { session: { accessToken: null }, user: { id: null } } }), "Missing authentication session.");
});
