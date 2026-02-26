export const ALLOWED_ADMIN_ROLES = new Set(["admin", "reviewer", "transcriber"]);

export function normalizeCredentials(form) {
  return {
    email: String(form?.get("email") || "").trim().toLowerCase(),
    password: String(form?.get("password") || "")
  };
}

export function buildStoredUser(authUser, profile) {
  return {
    id: authUser?.id || null,
    email: profile?.email || authUser?.email || null,
    role: profile?.role || "public",
    displayName: profile?.display_name || authUser?.email || "Unknown User",
    isActive: profile?.is_active ?? true
  };
}

export function canAccessAdminPortal(user) {
  return Boolean(user?.isActive) && ALLOWED_ADMIN_ROLES.has(user?.role);
}

export function toAuthResult(responseData) {
  return {
    session: {
      accessToken: responseData?.access_token || null
    },
    user: {
      id: responseData?.user?.id || null,
      email: responseData?.user?.email || null
    }
  };
}

export function loginErrorMessage({ authError, authResult }) {
  if (authError?.message) return authError.message;
  if (!authResult?.session?.accessToken || !authResult?.user?.id) {
    return "Missing authentication session.";
  }
  return "Unknown login error.";
}
