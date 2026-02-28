import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { pool } from "./config/db.js";
import { attachUser, requireRole } from "./middleware/auth.js";
import authRouter from "./routes/auth.js";
import publicRouter from "./routes/public.js";
import adminRouter from "./routes/admin.js";
import transcriptionRouter from "./routes/transcription.js";
import reviewRouter from "./routes/review.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicWebDir = path.resolve(__dirname, env.publicWebDir);
const adminWebDir = path.resolve(__dirname, env.adminWebDir);
const landingRootDir = path.resolve(__dirname, "../..");
const landingImagesDir = path.resolve(landingRootDir, "src/public/images");

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(attachUser);

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (_error) {
    res.status(500).json({ ok: false });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/public", publicRouter);
app.use("/api/admin", requireRole(["admin"]), adminRouter);
app.use("/api/transcriptions", requireRole(["admin", "transcriber"]), transcriptionRouter);
app.use("/api/review", requireRole(["admin", "reviewer"]), reviewRouter);

app.get("/", (_req, res) => {
  res.sendFile(path.join(landingRootDir, "index.html"));
});

app.get("/styles.v2.css", (_req, res) => {
  res.sendFile(path.join(landingRootDir, "styles.v2.css"));
});

app.use("/src/public/images", express.static(landingImagesDir));

app.get("/login", (_req, res) => {
  res.sendFile(path.join(adminWebDir, "login.html"));
});

app.get("/admin/login", (_req, res) => {
  res.redirect(302, "/login");
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(adminWebDir, "index.html"));
});

app.get(/^\/search\/?$/, (_req, res) => {
  res.sendFile(path.join(publicWebDir, "index.html"));
});

app.use("/admin", express.static(adminWebDir));
app.use("/search", express.static(publicWebDir));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal_server_error", message: err.message });
});

app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
  console.log(`Public web root: ${publicWebDir}`);
  console.log(`Admin web root: ${adminWebDir}`);
});
