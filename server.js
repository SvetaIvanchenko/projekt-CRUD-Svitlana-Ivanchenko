import express from "express";
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const db = new Database("database.db");

//  DB 
db.prepare(`
  CREATE TABLE IF NOT EXISTS reviews (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    year        INTEGER,
    genre       TEXT,
    kind        TEXT    NOT NULL CHECK (kind IN ('Film','Serial')),
    rating      REAL    CHECK (rating >= 0 AND rating <= 10),
    review      TEXT
  )
`).run();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//  API 
app.get("/api/reviews", (req, res) => {
    const rows = db.prepare("SELECT * FROM reviews ORDER BY id DESC").all();
    res.json(rows);
});

app.get("/api/reviews/:id", (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Nieprawidłowe id." });
    const row = db.prepare("SELECT * FROM reviews WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "Nie znaleziono." });
    res.json(row);
});

app.post("/api/reviews", (req, res) => {
    const { title, year, genre, kind, rating, review } = req.body;
    if (!title || !kind) return res.status(400).json({ error: "Pola 'title' i 'kind' są obowiązkowe." });

    const yr = year ? Number(year) : null;
    const rt = rating !== "" && rating !== undefined ? Number(rating) : null;

    const info = db.prepare(`
    INSERT INTO reviews (title, year, genre, kind, rating, review)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(safeStr(title), yr, safeStr(genre), safeKind(kind), rt, safeStr(review));

    const created = db.prepare("SELECT * FROM reviews WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(created);
});

app.put("/api/reviews/:id", (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Nieprawidłowe id." });

    const { title, year, genre, kind, rating, review } = req.body;
    if (!title || !kind) return res.status(400).json({ error: "Pola 'title' i 'kind' są obowiązkowe." });

    const yr = year ? Number(year) : null;
    const rt = rating !== "" && rating !== undefined ? Number(rating) : null;

    const info = db.prepare(`
    UPDATE reviews
       SET title = ?, year = ?, genre = ?, kind = ?, rating = ?, review = ?
     WHERE id = ?
  `).run(safeStr(title), yr, safeStr(genre), safeKind(kind), rt, safeStr(review), id);

    if (info.changes === 0) return res.status(404).json({ error: "Nie znaleziono." });

    const updated = db.prepare("SELECT * FROM reviews WHERE id = ?").get(id);
    res.json(updated);
});

app.delete("/api/reviews/:id", (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Nieprawidłowe id." });
    const info = db.prepare("DELETE FROM reviews WHERE id = ?").run(id);
    if (info.changes === 0) return res.status(404).json({ error: "Nie znaleziono." });
    res.status(204).end();
});

//  helpers 
function safeStr(s) { return s == null ? null : String(s).trim(); }
function safeKind(k) { return k === "Serial" ? "Serial" : "Film"; }

//  static files 
app.use(express.static(path.join(__dirname, "public")));

// 404 (API)
app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: `Endpoint ${req.originalUrl} nie istnieje.` });
    }
    res.status(404).type("html").send(`
    <!doctype html>
    <html lang="pl"><head><meta charset="utf-8"><title>404 - Nie znaleziono</title>
    <style>
      body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f9fafb;color:#111}
      h1{font-size:48px;margin-bottom:0} p{color:#6b7280;margin-top:8px} a{margin-top:16px;color:#2563eb;text-decoration:none}
    </style></head>
    <body><h1>404</h1><p>Strona <code>${req.originalUrl}</code> nie istnieje.</p><a href="/">← Powrót do strony głównej</a></body></html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Serwer działa na http://localhost:" + PORT));
