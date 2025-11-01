// auth.js — logowanie/rejestracja + walidacja front + obsługa błędów API

async function fetchJSON(url, opts) {
    const res = await fetch(url, Object.assign({ credentials: "include" }, opts));
    if (!res.ok) {
        // próbujemy odczytać standardowy error JSON z backendu
        let fallbackMsg = "Błąd żądania";
        try {
            const j = await res.json();
            // backend zwraca {status, error, message, fieldErrors[]} // format błędu JSON
            if (j && j.fieldErrors && j.fieldErrors.length) {
                fallbackMsg = j.fieldErrors.map(f => `${f.field}: ${f.message}`).join("\n");
            } else if (j && j.message) {
                fallbackMsg = j.message;
            } else if (j && j.error) {
                fallbackMsg = j.error;
            }
        } catch { }
        throw new Error(fallbackMsg);
    }
    return res.json();
}

// prosta walidacja frontowa wg wymagań (długość, znaki itd.) // walidacja front
function validateCredsFront(username, password) {
    if (!username || username.length < 3 || username.length > 20) {
        return "Login 3–20 znaków";
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return "Login: tylko litery/cyfry/_/-";
    }
    if (!password || password.length < 4 || password.length > 50) {
        return "Hasło 4–50 znaków";
    }
    return null;
}

function setupRegister() {
    const form = document.getElementById("register-form");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = document.getElementById("reg-username").value.trim();
        const password = document.getElementById("reg-password").value;

        // walidacja przeglądarka/JS przed wysyłką (blokada formularza)
        const localErr = validateCredsFront(username, password); // walidacja hasla/login
        if (localErr) {
            alert(localErr);
            return;
        }

        try {
            await fetchJSON("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            // sukces → redirect
            window.location.replace("/index.html");
        } catch (err) {
            // może być 409 Conflict przy duplikacie // błąd 409
            alert(err.message);
        }
    });
}

function setupLogin() {
    const form = document.getElementById("login-form");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = document.getElementById("login-username").value.trim();
        const password = document.getElementById("login-password").value;

        const localErr = validateCredsFront(username, password); // walidacja front
        if (localErr) {
            alert(localErr);
            return;
        }

        try {
            await fetchJSON("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            window.location.replace("/index.html");
        } catch (err) {
            // np. 404 user nie istnieje, 401 złe hasło
            if (err.message.toLowerCase().includes("nie istnieje")) {
                if (confirm("Taki użytkownik nie istnieje. Chcesz się zarejestrować?")) {
                    window.location.href = "/register.html?prefill=" + encodeURIComponent(username);
                }
            } else {
                alert(err.message);
            }
        }
    });
}

// status logowania w headerze, logout, przekierowania
async function attachAuthStatusUI({ containerSelector } = {}) {
    const container = containerSelector ? document.querySelector(containerSelector) : null;
    try {
        const meRes = await fetch("/api/me", { credentials: "include" });
        const me = await meRes.json();

        if (me && me.username) {
            // zalogowany
            if (container) {
                container.innerHTML =
                    `Zalogowano jako: <strong>${me.username}</strong> <button id="logoutBtn">Wyloguj się</button>`;
                container.querySelector("#logoutBtn").addEventListener("click", async () => {
                    await fetchJSON("/api/logout", { method: "POST" });
                    window.location.href = "/home.html";
                });
            }

            const goReview = document.querySelectorAll('[data-action="go-review"]');
            const viewAll = document.querySelectorAll('[data-action="view-all"]');
            goReview.forEach(a => a.setAttribute("href", "/index.html"));
            viewAll.forEach(a => a.setAttribute("href", "/index.html"));

            document.querySelectorAll('[data-auth="show-when-logged-out"]').forEach(el => el.style.display = "none");
            document.querySelectorAll('[data-auth="show-when-logged-in"]').forEach(el => el.style.display = "");
        } else {
            // gość
            if (container) {
                container.innerHTML = `<a href="/login.html">Zaloguj się</a> | <a href="/register.html">Rejestracja</a>`;
            }

            const goReview = document.querySelectorAll('[data-action="go-review"]');
            const viewAll = document.querySelectorAll('[data-action="view-all"]');
            goReview.forEach(a => a.setAttribute("href", "/login.html"));
            viewAll.forEach(a => a.setAttribute("href", "/login.html"));

            document.querySelectorAll('[data-auth="show-when-logged-out"]').forEach(el => el.style.display = "");
            document.querySelectorAll('[data-auth="show-when-logged-in"]').forEach(el => el.style.display = "none");
        }
    } catch {
        // ignoruj
    }
}
