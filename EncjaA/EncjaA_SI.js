//EncjaA.js Svitlana Ivanchenko

import express from "express";
import Database from "better-sqlite3";

const app = express();
const db = new Database("database.db");

//Tworzenie tabeli
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

app.use(express.urlencoded({ extended: true }));

//Tworzenie strony
app.get("/", (req, res) => {
    const rows = db.prepare("SELECT * FROM reviews ORDER BY id DESC").all();
    let editItem = null;

    if (req.query.edit) {
        const id = Number(req.query.edit);
        if (!Number.isNaN(id)) {
            editItem = db.prepare("SELECT * FROM reviews WHERE id = ?").get(id);
        }
    }

    const html = `<!doctype html>
  <html lang="pl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Oceny filmów CRUD</title>
    <style>
      :root{ --radius:12px; }
      body{
        font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Arial,sans-serif;
        max-width:1600px;
        margin:40px auto; padding:0 24px;
        background:#f7f7fa; color:#222;
      }
      h1{margin:0 0 20px}
      form{
        background:#fff; border:1px solid #e5e7eb; border-radius:var(--radius);
        padding:16px; box-shadow:0 1px 3px rgba(0,0,0,.06); margin-bottom:24px;
      }
      .fields{
        display:flex; gap:12px; align-items:flex-end; flex-wrap:nowrap;
      }
      .field{flex:1; min-width:0}
      label{display:block; font-size:12px; color:#374151; margin-bottom:6px}
      input,select,textarea{
        width:100%; padding:10px; border:1px solid #d1d5db; border-radius:8px; background:#fff;
        box-sizing:border-box;
      }
      textarea{min-height:92px; resize:vertical}
      .btn, button, a.btn{
        appearance:none; border:0; border-radius:10px;
        padding:10px 14px; background:#111827; color:#fff; cursor:pointer;
        display:inline-flex; align-items:center; justify-content:center; text-decoration:none;
        height:40px
      }
      .btn.secondary{background:#6b7280}
      .actions{display:flex; gap:8px; justify-content:flex-end}
      .table-wrap{overflow-x:auto}
      table{
        width:100%; border-collapse:separate; border-spacing:0; background:#fff;
        border:1px solid #e5e7eb; border-radius:var(--radius); overflow:hidden; font-size:14px;
        min-width:1100px
      }
      th,td{padding:12px; border-bottom:1px solid #eef0f3; vertical-align:top; text-align:left}
      th{background:#f3f4f6; font-weight:600; white-space:nowrap}
      td,th{white-space:nowrap}
      td.opinia{white-space:normal; word-break:break-word; max-width:700px}
      tr:last-child td{border-bottom:none}
      .badge{display:inline-block; padding:2px 8px; border-radius:999px; background:#eef2ff}
      @media (max-width:1100px){
        .fields{flex-direction:column}
        .field{width:100%}
      }
      .muted{color:#6b7280; font-size:12px}
    </style>
  </head>
  <body>
    <h1>Oceny filmów według opinii widzów</h1>
    <p class="muted">Dodaj wpisy poniżej. Aby edytować, kliknij «✏️» w wierszu; formularz zostanie wypełniony danymi.</p>

    <form method="post" action="${editItem ? `/update/${editItem.id}` : "/add"}">
      <div class="fields">
        <div class="field">
          <label>Nazwa</label>
          <input name="title" required value="${editItem ? escapeHtml(editItem.title) : ""}" />
        </div>
        <div class="field">
          <label>Rok produkcji</label>
          <input name="year" type="number" min="1888" max="2100" value="${editItem?.year ?? ""}" />
        </div>
        <div class="field">
          <label>Rodzaj</label>
          <input name="genre" placeholder="drama, komedia..." value="${editItem ? escapeHtml(editItem.genre ?? "") : ""}" />
        </div>
        <div class="field">
          <label>Typ</label>
          <select name="kind" required>
            <option value="">— Wybierz —</option>
            <option value="Film"   ${editItem?.kind === "Film" ? "selected" : ""}>Film</option>
            <option value="Serial" ${editItem?.kind === "Serial" ? "selected" : ""}>Serial</option>
          </select>
        </div>
        <div class="field">
          <label>Ocena (0–10)</label>
          <input name="rating" type="number" step="0.1" min="0" max="10" value="${editItem?.rating ?? ""}" />
        </div>
        <div class="field"></div>
        <div class="field"></div>
      </div>

      <div style="margin-top:12px">
        <label>Opinia</label>
        <textarea name="review" placeholder="Twoje zdanie...">${editItem ? escapeHtml(editItem.review ?? "") : ""}</textarea>
      </div>

      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn" type="submit">${editItem ? "Zapisz zmiany" : "Dodaj"}</button>
        ${editItem ? `<a href="/" class="btn secondary">Anuluj</a>` : ""}
      </div>
      ${editItem ? `<p class="muted" style="margin-top:8px">Edycja #${editItem.id}</p>` : ""}
    </form>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nazwa</th>
            <th>Rok</th>
            <th>Rodzaj</th>
            <th>Typ</th>
            <th>Ocena</th>
            <th></th>
            <th></th>
            <th>Opinia</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${r.id}</td>
              <td><strong>${escapeHtml(r.title)}</strong></td>
              <td>${r.year ?? ""}</td>
              <td><span class="badge">${escapeHtml(r.genre ?? "")}</span></td>
              <td>${r.kind}</td>
              <td>${r.rating ?? ""}</td>
              <td></td>
              <td></td>
              <td class="opinia">${escapeHtml(r.review ?? "")}</td>
              <td class="actions">
                <a class="btn" title="Edytuj" href="/?edit=${r.id}" aria-label="Edytuj">✏️</a>
                <form method="post" action="/delete/${r.id}" style="display:inline" onsubmit="return confirm('Na pewno usunąć #${r.id}?')">
                  <button class="btn" title="Usuń" aria-label="Usuń">🗑️</button>
                </form>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  </body>
  </html>`;

    res.type("html").send(html);
});

//Dodawanie wpisu
app.post("/add", (req, res) => {
    const { title, year, genre, kind, rating, review } = req.body;
    if (!title || !kind) return res.status(400).send("Pola 'title' i 'kind' są obowiązkowe.");

    const yr = year ? Number(year) : null;
    const rt = rating !== "" && rating !== undefined ? Number(rating) : null;

    db.prepare(`
    INSERT INTO reviews (title, year, genre, kind, rating, review)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(safeStr(title), yr, safeStr(genre), safeKind(kind), rt, safeStr(review));

    res.redirect("/");
});

//Aktualizacja wpisu
app.post("/update/:id", (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).send("Nieprawidłowe id.");

    const { title, year, genre, kind, rating, review } = req.body;
    if (!title || !kind) return res.status(400).send("Pola 'title' i 'kind' są obowiązkowe.");

    const yr = year ? Number(year) : null;
    const rt = rating !== "" && rating !== undefined ? Number(rating) : null;

    db.prepare(`
    UPDATE reviews
       SET title = ?, year = ?, genre = ?, kind = ?, rating = ?, review = ?
     WHERE id = ?
  `).run(safeStr(title), yr, safeStr(genre), safeKind(kind), rt, safeStr(review), id);

    res.redirect("/");
});

//Usuwanie wpisu
app.post("/delete/:id", (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).send("Nieprawidłowe id.");
    db.prepare("DELETE FROM reviews WHERE id = ?").run(id);
    res.redirect("/");
});

//Dodatkowo
function escapeHtml(str = "") {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}
function safeStr(s) { return s == null ? null : String(s).trim(); }
function safeKind(k) {
    return k === "Serial" ? "Serial" : "Film";
}

const PORT = process.env.PORT || 3000;

//Obsługa błędu 404: endpoint nie istnieje
app.use((req, res) => {
    res.status(404).type("html").send(`
    <!doctype html>
    <html lang="pl">
    <head>
      <meta charset="utf-8" />
      <title>404 - Nie znaleziono</title>
      <style>
        body {
          font-family: system-ui, sans-serif;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          height: 100vh; background: #f9fafb; color: #111;
        }
        h1 { font-size: 48px; margin-bottom: 0; }
        p  { color: #6b7280; margin-top: 8px; }
        a  { margin-top: 16px; color: #2563eb; text-decoration: none; }
      </style>
    </head>
    <body>
      <h1>404</h1>
      <p>Strona <code>${req.originalUrl}</code> nie istnieje.</p>
      <a href="/">← Powrót do strony głównej</a>
    </body>
    </html>
  `);
});

app.listen(PORT, () => console.log("Serwer działa na http://localhost:" + PORT));

