import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../config/db.js";
import { env } from "../config/env.js";
import { asyncHandler } from "../utils/http.js";
import { hashPassword } from "../utils/security.js";

export const authRouter = express.Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email_and_password_required" });
    }

    const result = await query(
      `SELECT id, email, role, password_hash, display_name
       FROM app_users
       WHERE email = $1
       LIMIT 1`,
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];
    if (!user || user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.display_name
      },
      env.jwtSecret,
      { expiresIn: "12h" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.display_name
      }
    });
  })
);

export default authRouter;
