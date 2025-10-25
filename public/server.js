// --- server.js (robust public/ routing) ---
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import session from "express-session";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// === Helpers for serving files from /public or fallback ===
const PUBLIC_DIR = path.join(__dirname, "public");
function sendFromPublic(res, file) {
    const pubPath = path.join(PUBLIC_DIR, file);
    const rootPath = path.join(__dirname, file);
    res.sendFile(pubPath, (err) => {
        if (err) res.sendFile(rootPath);
    });
}

// === Middleware ===
app.use(express.json());
app.use(session({
        secret: process.env.SESSION_SECRET || "dev-secret",
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: { httpOnly: true, sameSite: 'lax', maxAge: 20 * 60 * 1000 }, // session cookie (logout on browser close)
    }));
// === Database ===
const db = new Database(path.join(__dirname, "database.db"));

// === Tables ===
db.prepare(`
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  year INTEGER,
  genre TEXT,
  kind TEXT,
  rating REAL,
  username TEXT,
  review TEXT,
  review_date TEXT DEFAULT (datetime('now'))
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
)
`).run();

// === Root -> home.html (prefer /public) ===
app.get("/", (_, res) => sendFromPublic(res, "home.html"));

// === Static files (no automatic index.html) ===
app.use(express.static(PUBLIC_DIR, { index: false }));
app.use(express.static(__dirname, { index: false }));

// === Reviews API ===
app.get("/api/reviews", (req, res) => {
    const rows = db.prepare("SELECT * FROM reviews ORDER BY id DESC").all();
    res.json(rows);
});

app.post("/api/reviews", requireAuth, (req, res) => {
    const { title, year, genre, kind, rating, review } = req.body || {};
    const username = (req.session.user && req.session.user.username) || null;
    if (!title || !kind || rating == null)
        return res.status(400).json({ error: "Brak wymaganych danych." });

    db.prepare(
        "INSERT INTO reviews (title, year, genre, kind, rating, username, review) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(title, year, genre, kind, rating, username, review);

    res.json({ ok: true });
});

app.delete("/api/reviews/:id", (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Nieprawidłowe id." });

    const info = db.prepare("DELETE FROM reviews WHERE id = ?").run(id);
    if (info.changes === 0) return res.status(404).json({ error: "Nie znaleziono." });

    res.status(204).end();
});

// === Auth API ===
app.post("/api/register", async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Podaj nazwę i hasło." });
    try {
        const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
        if (exists) return res.status(409).json({ error: "Taki nick już istnieje." });
        const hash = await bcrypt.hash(password, 10);
        db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, hash);
        req.session.user = { username };
        return res.json({ ok: true, username });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Błąd serwera przy rejestracji." });
    }
});

app.post("/api/login", async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Podaj nazwę i hasło." });
    try {
        const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
        if (!user) return res.status(404).json({ error: "Użytkownik o podanym nicku nie istnieje." });
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: "Nieprawidłowe hasło." });
        req.session.user = { username: user.username };
        return res.json({ ok: true, username: user.username });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Błąd serwera przy logowaniu." });
    }
});

app.post("/api/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
    res.json(req.session.user || {});
});

// === Access guard for index ===
function requireAuth(req, res, next) {
    if (!req.session.user) return res.redirect("/login.html");
    next();
}
app.get(["/index", "/index.html"], requireAuth, (_, res) => sendFromPublic(res, "index.html"));

// === Explicit page routes (work whether files in /public or root) ===
app.get("/app.js", (_, res) => sendFromPublic(res, "app.js"));
app.get("/home.html", (_, res) => sendFromPublic(res, "home.html"));
app.get("/login.html", (_, res) => sendFromPublic(res, "login.html"));
app.get("/register.html", (_, res) => sendFromPublic(res, "register.html"));
app.get("/auth.js", (_, res) => sendFromPublic(res, "auth.js"));
app.get("/auth-status.js", (_, res) => sendFromPublic(res, "auth-status.js"));
app.get("/home.js", (_, res) => sendFromPublic(res, "home.js")); // если используешь


// UPDATE (PUT) and alias (POST /:id/edit) — only author
app.put("/api/reviews/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { rating, review } = req.body || {};
  const username = (req.session.user && req.session.user.username) || null;
  if (!id || username == null) return res.status(400).json({ error: "Błędne żądanie." });

  const row = db.prepare("SELECT * FROM reviews WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Nie znaleziono wpisu." });
  if (row.username !== username) return res.status(403).json({ error: "Brak uprawnień." });

  db.prepare("UPDATE reviews SET rating = COALESCE(?, rating), review = COALESCE(?, review) WHERE id = ?")
    .run(rating, review, id);
  res.json({ ok: true });
});

app.post("/api/reviews/:id/edit", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { rating, review } = req.body || {};
  const username = (req.session.user && req.session.user.username) || null;
  if (!id || username == null) return res.status(400).json({ error: "Błędne żądanie." });

  const row = db.prepare("SELECT * FROM reviews WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Nie znaleziono wpisu." });
  if (row.username !== username) return res.status(403).json({ error: "Brak uprawnień." });

  db.prepare("UPDATE reviews SET rating = COALESCE(?, rating), review = COALESCE(?, review) WHERE id = ?")
    .run(rating, review, id);
  res.json({ ok: true });
});


// === 404 fallback ===
app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: `Endpoint ${req.originalUrl} nie istnieje.` });
    }
    res.status(404).send(`<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><title>404</title></head>
<body><h1>404</h1><p>Strona <code>${req.originalUrl}</code> nie istnieje.</p>
<a href="/">← Powrót do strony głównej</a></body></html>`);
});

// === Start ===
app.listen(PORT, () => {
    console.log(`✅ Serwer działa na http://localhost:${PORT}`);
});
