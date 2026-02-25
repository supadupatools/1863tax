import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
export { requireRole } from "./rbac.js";

export function attachUser(req, _res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    req.user = {
      id: req.headers["x-user-id"] || null,
      role: req.headers["x-user-role"] || "public",
      email: req.headers["x-user-email"] || null
    };
    return next();
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = {
      id: payload.sub,
      role: payload.role || "public",
      email: payload.email || null
    };
  } catch (_err) {
    req.user = { id: null, role: "public", email: null };
  }

  return next();
}
