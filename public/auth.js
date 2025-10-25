// auth.js — rejestracja/logowanie + status (bez CSS)
async function fetchJSON(url, opts) {
  const res = await fetch(url, Object.assign({ credentials: "include" }, opts));
  if (!res.ok) {
    let msg = "Błąd żądania";
    try { const j = await res.json(); msg = j.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

function setupRegister() {
  const form = document.getElementById("register-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("reg-username").value.trim();
    const password = document.getElementById("reg-password").value;
    if (!username || !password) { alert("Podaj nazwę i hasło."); return; }
    try {
      await fetchJSON("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      // auto-login → index (replace to avoid back to login/register)
      window.location.replace("/index.html");
    } catch (err) {
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
    if (!username || !password) { alert("Podaj nazwę i hasło."); return; }
    try {
      await fetchJSON("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      window.location.replace("/index.html");
    } catch (err) {
      if (err.message.includes("nie istnieje")) {
        if (confirm("Taki użytkownik nie istnieje. Chcesz się zarejestrować?")) {
          window.location.href = "/register.html?prefill=" + encodeURIComponent(username);
        }
      } else {
        alert(err.message);
      }
    }
  });
}

async function attachAuthStatusUI({ containerSelector } = {}) {
  const container = containerSelector ? document.querySelector(containerSelector) : null;
  try {
    const meRes = await fetch("/api/me", { credentials: "include" });
    const me = await meRes.json();
    if (me && me.username) {
      if (container) {
        container.innerHTML = `Zalogowano jako: <strong>${me.username}</strong> <button id="logoutBtn">Wyloguj się</button>`;
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
  } catch {}
}
