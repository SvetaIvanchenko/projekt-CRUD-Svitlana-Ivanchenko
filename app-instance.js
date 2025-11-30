// app-instance.js
// Express app jako moduł (do testów i do server.js)
// Zawiera walidację, kody błędów, /health itp.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import session from "express-session";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, "public");

// === helpers ===

// timestamp ISO (dla błędów JSON)
function nowISO() {
    return new Date().toISOString();
}

// Wspólny format błędów JSON (wymóg zadania)
function sendError(res, status, errorText, fieldErrors = []) {
    return res.status(status).json({
        timestamp: nowISO(),
        status,
        error: errorText,
        message: fieldErrors.length
            ? fieldErrors.map(f => f.message).join("; ")
            : errorText,
        fieldErrors
    });
}

// walidacja login/hasło (frontend + backend spójne)
// walidacja hasla
function validateUserCredentials({ username, password }) {
    const fieldErrors = [];

    // username
    if (!username || typeof username !== "string") {
        fieldErrors.push({
            field: "username",
            code: "REQUIRED",
            message: "Podaj nazwę użytkownika"
        });
    } else {
        if (username.length < 3 || username.length > 20) {
            fieldErrors.push({
                field: "username",
                code: "INVALID_LENGTH",
                message: "Login 3–20 znaków"
            });
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            fieldErrors.push({
                field: "username",
                code: "INVALID_FORMAT",
                message: "Dozwolone litery/cyfry/_/-"
            });
        }
    }

    // password
    if (!password || typeof password !== "string") {
        fieldErrors.push({
            field: "password",
            code: "REQUIRED",
            message: "Podaj hasło"
        });
    } else {
        if (password.length < 4 || password.length > 50) {
            fieldErrors.push({
                field: "password",
                code: "INVALID_LENGTH",
                message: "Hasło 4–50 znaków"
            });
        }
    }

    return fieldErrors;
}

// walidacja payloadu recenzji użytkownika
function validateReviewPayload({ title, year, genre, kind, rating, review }) {
    const fieldErrors = [];

    // title required 2–100 // walidacja tytułu
    if (!title || typeof title !== "string" || !title.trim()) {
        fieldErrors.push({
            field: "title",
            code: "REQUIRED",
            message: "Tytuł jest wymagany"
        });
    } else {
        const t = title.trim();
        if (t.length < 2 || t.length > 100) {
            fieldErrors.push({
                field: "title",
                code: "INVALID_LENGTH",
                message: "Tytuł 2–100 znaków"
            });
        }
    }

    // kind required
    if (!kind || typeof kind !== "string") {
        fieldErrors.push({
            field: "kind",
            code: "REQUIRED",
            message: "Typ (Film/Serial/Anime) jest wymagany"
        });
    } else if (!["Film", "Serial", "Anime"].includes(kind)) {
        fieldErrors.push({
            field: "kind",
            code: "INVALID_VALUE",
            message: "Nieprawidłowy typ"
        });
    }

    // rating required 0–10
    if (rating == null || rating === "") {
        // brak oceny → błąd REQUIRED
        fieldErrors.push({
            field: "rating",
            code: "REQUIRED",
            message: "Ocena 0–10 jest wymagana"
        });
    } else {
        const numRating = Number(rating);

        if (!Number.isFinite(numRating)) {
            fieldErrors.push({
                field: "rating",
                code: "INVALID_FORMAT",
                message: "Ocena musi być liczbą"
            });
        } else if (numRating < 0 || numRating > 10) {
            fieldErrors.push({
                field: "rating",
                code: "OUT_OF_RANGE",
                message: "Ocena musi być 0–10"
            });
        }
    }


    // year opcjonalny => 1900..currentYear
    if (year != null && year !== "") {
        const y = Number(year);
        const currentYear = new Date().getFullYear();
        if (!Number.isInteger(y) || y < 1900 || y > currentYear) {
            fieldErrors.push({
                field: "year",
                code: "OUT_OF_RANGE",
                message: `Rok 1900–${currentYear}`
            });
        }
    }

    // genre opcjonalny max 30 znaków
    if (genre != null && genre !== "") {
        if (typeof genre !== "string" || genre.length > 30) {
            fieldErrors.push({
                field: "genre",
                code: "INVALID_LENGTH",
                message: "Gatunek max 30 znaków"
            });
        }
    }

    // review opcjonalny max 1000 znaków
    if (review != null && review !== "") {
        if (typeof review !== "string" || review.length > 1000) {
            fieldErrors.push({
                field: "review",
                code: "INVALID_LENGTH",
                message: "Opinia max 1000 znaków"
            });
        }
    }

    return fieldErrors;
}

// narzędzie pomocnicze do wysyłania pojedynczych plików statycznych
function sendFromPublic(res, file) {
    const pubPath = path.join(PUBLIC_DIR, file);
    const rootPath = path.join(__dirname, file);
    res.sendFile(pubPath, (err) => {
        if (err) res.sendFile(rootPath);
    });
}

// Tworzymy app (Express)
const app = express();

// Middleware JSON
app.use(express.json());

// sesje + cookie (auth) // kod 401/403
app.use(
    session({
        secret: process.env.SESSION_SECRET || "dev-secret",
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 20 * 60 * 1000
        }
    })
);

// Baza danych SQLite
const db = new Database(path.join(__dirname, "database.db"));

// Tworzymy tabele jeśli nie istnieją
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

// Middlewares autoryzacji
function requireAuthApi(req, res, next) {
    if (!req.session.user) {
        return sendError(res, 401, "Unauthorized", [
            { field: "auth", code: "NO_SESSION", message: "Musisz być zalogowany" }
        ]); // kod 401 brak autoryzacji
    }
    next();
}

function requireAuthPage(req, res, next) {
    if (!req.session.user) return res.redirect("/login.html");
    next();
}

// === STATYCZNE PLIKI FRONTENDU ===

// root -> home.html
app.get("/", (_, res) => sendFromPublic(res, "home.html"));

// endpoint do smoke test w CI/CD
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// serwujemy /public oraz katalog główny (dla np. style.css, js)
app.use(express.static(PUBLIC_DIR, { index: false }));
app.use(express.static(__dirname, { index: false }));

// chronimy /index.html przed gośćmi
app.get(["/index", "/index.html"], requireAuthPage, (_, res) =>
    sendFromPublic(res, "index.html")
);

// jawne endpointy plików
app.get("/app.js", (_, res) => sendFromPublic(res, "app.js"));
app.get("/home.html", (_, res) => sendFromPublic(res, "home.html"));
app.get("/login.html", (_, res) => sendFromPublic(res, "login.html"));
app.get("/register.html", (_, res) => sendFromPublic(res, "register.html"));
app.get("/auth.js", (_, res) => sendFromPublic(res, "auth.js"));
app.get("/auth-status.js", (_, res) => sendFromPublic(res, "auth-status.js"));
app.get("/home.js", (_, res) => sendFromPublic(res, "home.js"));
app.get("/info.html", (_, res) => sendFromPublic(res, "info.html"));
app.get("/style.css", (_, res) => sendFromPublic(res, "style.css"));
app.get("/style-mobile.css", (_, res) => sendFromPublic(res, "style-mobile.css"));
app.get("/style-index.css", (_, res) => sendFromPublic(res, "style-index.css"));
app.get("/style-index-mobile.css", (_, res) => sendFromPublic(res, "style-index-mobile.css"));
app.get("/style-auth.css", (_, res) => sendFromPublic(res, "style-auth.css"));
// ...добавь сюда другие css/img/js если нужно, но это не критично для тестов

// endpoint do smoke test w CI/CD
app.get("/health", (req, res) => {
    res.json({ ok: true }); // smoke test OK
});

// === API AUTH ===

// rejestracja
app.post("/api/register", async (req, res) => {
    const { username, password } = req.body || {};

    // walidacja biznesowa -> kod 422
    const fieldErrors = validateUserCredentials({ username, password });
    if (fieldErrors.length > 0) {
        return sendError(res, 422, "Unprocessable Entity", fieldErrors); // kod 422
    }

    try {
        const exists = db
            .prepare("SELECT id FROM users WHERE username = ?")
            .get(username);
        if (exists) {
            // 409 Conflict (duplikat) // kod 409 duplikat
            return sendError(res, 409, "Conflict", [
                {
                    field: "username",
                    code: "DUPLICATE",
                    message: "Taki nick już istnieje."
                }
            ]);
        }

        const hash = await bcrypt.hash(password, 10);
        db.prepare(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)"
        ).run(username, hash);

        req.session.user = { username };
        return res.json({ ok: true, username }); // sukces
    } catch (e) {
        console.error(e);
        return sendError(res, 500, "Server Error");
    }
});

// logowanie
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body || {};

    // walidacja wejsciowa -> 422
    const fieldErrors = validateUserCredentials({ username, password });
    if (fieldErrors.length > 0) {
        return sendError(res, 422, "Unprocessable Entity", fieldErrors); // 422
    }

    try {
        const user = db
            .prepare("SELECT * FROM users WHERE username = ?")
            .get(username);

        if (!user) {
            // 404 user nie istnieje // kod 404
            return sendError(res, 404, "Not Found", [
                {
                    field: "username",
                    code: "NOT_FOUND",
                    message: "Użytkownik o podanym nicku nie istnieje."
                }
            ]);
        }

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            // 401 Unauthorized (złe hasło) // kod 401
            return sendError(res, 401, "Unauthorized", [
                { field: "password", code: "INVALID_PASSWORD", message: "Nieprawidłowe hasło." }
            ]);
        }

        req.session.user = { username: user.username };
        return res.json({ ok: true, username: user.username });
    } catch (e) {
        console.error(e);
        return sendError(res, 500, "Server Error");
    }
});

// wylogowanie
app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true }); // sukces
    });
});

// kto jestem
app.get("/api/me", (req, res) => {
    res.json(req.session.user || {}); // auth status
});

// === API REVIEWS ===

// lista wszystkich opinii (publiczne)
app.get("/api/reviews", (req, res) => {
    const rows = db
        .prepare("SELECT * FROM reviews ORDER BY id DESC")
        .all();
    res.json(rows);
});

// dodaj opinię (wymaga auth -> 401/403)
app.post("/api/reviews", requireAuthApi, (req, res) => {
    const { title, year, genre, kind, rating, review } = req.body || {};
    const username = req.session.user?.username || null;

    if (!username) {
        // fallback gdy brak sesji
        return sendError(res, 401, "Unauthorized", [
            { field: "auth", code: "NO_SESSION", message: "Musisz być zalogowany" }
        ]);
    }

    // walidacja payloadu opinii // kod 422 Unprocessable Entity
    const fieldErrors = validateReviewPayload({
        title,
        year,
        genre,
        kind,
        rating,
        review
    });
    if (fieldErrors.length > 0) {
        return sendError(res, 422, "Unprocessable Entity", fieldErrors); // kod 422
    }

    db.prepare(
        "INSERT INTO reviews (title, year, genre, kind, rating, username, review) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
        title.trim(),
        year || null,
        genre || null,
        kind,
        rating,
        username,
        review || null
    );

    res.json({ ok: true }); // sukces
});

// usuń opinię
app.delete("/api/reviews/:id", (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
        return sendError(res, 400, "Bad Request", [
            { field: "id", code: "INVALID_ID", message: "Nieprawidłowe id." }
        ]); // kod 400 błędny format danych
    }

    const info = db
        .prepare("DELETE FROM reviews WHERE id = ?")
        .run(id);

    if (info.changes === 0) {
        return sendError(res, 404, "Not Found", [
            { field: "id", code: "NOT_FOUND", message: "Nie znaleziono." }
        ]); // kod 404 brak zasobu
    }

    res.status(204).end(); // sukces (No Content)
});

// aktualizacja opinii (PUT) // kod 403 jeśli nie właściciel
app.put("/api/reviews/:id", requireAuthApi, (req, res) => {
    const id = Number(req.params.id);
    const { rating, review } = req.body || {};
    const username = req.session.user?.username || null;

    if (!id || !username) {
        return sendError(res, 400, "Bad Request", [
            { field: "id", code: "INVALID_OR_MISSING", message: "Błędne żądanie." }
        ]);
    }

    const row = db
        .prepare("SELECT * FROM reviews WHERE id = ?")
        .get(id);

    if (!row) {
        return sendError(res, 404, "Not Found", [
            { field: "id", code: "NOT_FOUND", message: "Nie znaleziono wpisu." }
        ]); // kod 404
    }

    if (row.username !== username) {
        return sendError(res, 403, "Forbidden", [
            { field: "auth", code: "NOT_OWNER", message: "Brak uprawnień." }
        ]); // kod 403 brak autoryzacji do zasobu
    }

    // walidacja aktualizacji (ściągamy istniejące wartości i podmieniamy tylko to co zmienia user)
    const fieldErrors = validateReviewPayload({
        title: row.title,
        year: row.year,
        genre: row.genre,
        kind: row.kind,
        rating: rating != null ? rating : row.rating,
        review: review != null ? review : row.review
    });
    if (fieldErrors.length > 0) {
        return sendError(res, 422, "Unprocessable Entity", fieldErrors); // kod 422
    }

    db.prepare(
        "UPDATE reviews SET rating = COALESCE(?, rating), review = COALESCE(?, review) WHERE id = ?"
    ).run(rating, review, id);

    res.json({ ok: true }); // sukces
});

// alias POST /:id/edit → update (fallback dla starszych wywołań)
app.post("/api/reviews/:id/edit", requireAuthApi, (req, res) => {
    const id = Number(req.params.id);
    const { rating, review } = req.body || {};
    const username = req.session.user?.username || null;

    if (!id || !username) {
        return sendError(res, 400, "Bad Request", [
            { field: "id", code: "INVALID_OR_MISSING", message: "Błędne żądanie." }
        ]);
    }

    const row = db
        .prepare("SELECT * FROM reviews WHERE id = ?")
        .get(id);

    if (!row) {
        return sendError(res, 404, "Not Found", [
            { field: "id", code: "NOT_FOUND", message: "Nie znaleziono wpisu." }
        ]);
    }

    if (row.username !== username) {
        return sendError(res, 403, "Forbidden", [
            { field: "auth", code: "NOT_OWNER", message: "Brak uprawnień." }
        ]);
    }

    const fieldErrors = validateReviewPayload({
        title: row.title,
        year: row.year,
        genre: row.genre,
        kind: row.kind,
        rating: rating != null ? rating : row.rating,
        review: review != null ? review : row.review
    });
    if (fieldErrors.length > 0) {
        return sendError(res, 422, "Unprocessable Entity", fieldErrors);
    }

    db.prepare(
        "UPDATE reviews SET rating = COALESCE(?, rating), review = COALESCE(?, review) WHERE id = ?"
    ).run(rating, review, id);

    res.json({ ok: true });
});

// API: proxy OMDb
import axios from "axios";

const OMDB_KEY = "8da92fbc";  // <-- сюда вставь свой ключ

app.get("/api/omdb", async (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Missing ?q=" });

    try {
        const r = await axios.get("https://www.omdbapi.com/", {
            params: { apikey: OMDB_KEY, s: q }
        });
        res.json(r.data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "OMDb request failed" });
    }
});

// 404 fallback dla nieistniejących endpointów API i stron
app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        // 404 API -> JSON w standardzie zadania // kod 404
        return sendError(res, 404, "Not Found", [
            {
                field: "resource",
                code: "NOT_FOUND",
                message: `Endpoint ${req.originalUrl} nie istnieje.`
            }
        ]);
    }

    // 404 dla stron statycznych
    res
        .status(404)
        .send(`<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><title>404</title></head>
<body><h1>404</h1><p>Strona <code>${req.originalUrl}</code> nie istnieje.</p>
<a href="/">← Powrót do strony głównej</a></body></html>`);
});

// eksportujemy app i narzędzia, żeby testy mogły je importować
export {
    app,
    db,
    validateUserCredentials,
    validateReviewPayload
};