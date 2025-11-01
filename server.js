// server.js
// plik produkcyjny do uruchamiania serwera np. na Render
// testy NIE używają tego pliku — one importują app z app-instance.js

import { app } from "./app-instance.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`✅ Serwer działa na http://localhost:${PORT}`);
});
