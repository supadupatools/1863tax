import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 3002),
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  publicWebDir: process.env.PUBLIC_WEB_DIR || "../web/public",
  adminWebDir: process.env.ADMIN_WEB_DIR || "../web/admin",
  adminEmail: process.env.ADMIN_EMAIL || "admin@example.org",
  adminPassword: process.env.ADMIN_PASSWORD || "change-me"
};
