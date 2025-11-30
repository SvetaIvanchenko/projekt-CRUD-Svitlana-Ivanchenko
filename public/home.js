(function () {
    const $ = (s) => document.querySelector(s);
    const loginBtn = $('#loginBtn');
    const registerBtn = $('#registerBtn');
    const goIndexBtn = $('#goIndexBtn');
    const seeAllBtn = $('#seeAllBtn');
    const logoutHome = $('#logoutHome');

    function markInternalNav() { try { sessionStorage.setItem('internalNav', '1'); } catch { } }
    function applyAuthUI(me) {
        const logged = !!(me && me.username);
        if (logged) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (registerBtn) registerBtn.style.display = 'none';
            if (goIndexBtn) { goIndexBtn.style.display = 'inline-flex'; goIndexBtn.onclick = () => { markInternalNav(); location.href = '/index.html'; }; }
            if (seeAllBtn) { seeAllBtn.style.display = 'inline-flex'; seeAllBtn.onclick = () => { markInternalNav(); location.href = '/index.html?filter=all'; }; }
            if (logoutHome) { logoutHome.style.display = 'inline-flex'; logoutHome.onclick = async () => { try { await fetch('/api/logout', { method: 'POST' }); location.href = '/home.html'; } catch (e) { location.reload(); } }; }
        } else {
            if (loginBtn) { loginBtn.style.display = 'inline-flex'; loginBtn.onclick = () => { location.href = '/login.html'; } }
            if (registerBtn) { registerBtn.style.display = 'inline-flex'; registerBtn.onclick = () => { location.href = '/register.html'; } }
            if (goIndexBtn) goIndexBtn.style.display = 'none';
            if (seeAllBtn) seeAllBtn.style.display = 'none';
            if (logoutHome) logoutHome.style.display = 'none';
        }
    }
    async function checkMe() { try { const r = await fetch('/api/me', { credentials: 'include' }); const j = await r.json(); applyAuthUI(j); } catch { applyAuthUI(null); } }
    checkMe();

    // === ОСНОВНАЯ ЛОГИКА ЗАГРУЗКИ ДАННЫХ ===
    const popularWrap = $("#popular-list");
    const reviewsList = $("#reviews");

    function escapeHtml(str = "") {
        return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
    }

    async function fetchJSON(url, opts) {
        const res = await fetch(url, opts);
        if (!res.ok) {
            try {
                const j = await res.json();
                throw new Error(j.error || "Błąd żądania.");
            } catch {
                throw new Error("Błąd żądania.");
            }
        }
        return res.json();
    }

    function mode(values) {
        const m = new Map();
        for (const v of values) {
            if (v == null || v === "") continue;
            m.set(v, (m.get(v) || 0) + 1);
        }
        let b = null, c = -1;
        for (const [k, v] of m) {
            if (v > c) { b = k; c = v; }
        }
        return b ?? null;
    }

    function fmtAvg(n) {
        return Number.isFinite(n) ? n.toFixed(2) : "—";
    }

    async function load() {
        const all = await fetchJSON("/api/reviews");
        renderLatest(all);
        renderPopular(all);
    }

    function renderLatest(all) {
        if (!reviewsList) return;

        const last3 = all.slice(0, 3);
        if (!last3.length) {
            reviewsList.innerHTML = `<div class="review-card"><p>Brak opinii.</p></div>`;
            return;
        }

        reviewsList.innerHTML = last3.map(r => {
            const title = escapeHtml(r.title ?? "");
            const genre = escapeHtml(r.genre ?? "");
            const user = escapeHtml(r.username ?? "Anonim");
            const date = escapeHtml(r.review_date ?? "");
            const rating = r.rating != null && r.rating !== "" ? String(r.rating) : "—";
            const body = escapeHtml(r.review ?? "");

            return `<article class="review-card">
        <h3>${title}</h3>
        ${genre ? `<div class="meta">${genre}</div>` : ""}
        <div class="rating">Ocena: <strong>${rating}</strong></div>
        <div class="author">od ${user}, ${date}</div>
        ${body ? `<p>${body}</p>` : ""}
      </article>`;
        }).join("");
    }

    function renderPopular(all) {
        if (!popularWrap) return;

        const groups = new Map();
        for (const r of all) {
            const kind = r.kind === "Serial" ? "Serial" : "Film";
            const title = r.title ?? "";
            const key = kind + "||" + title;

            if (!groups.has(key)) {
                groups.set(key, {
                    kind,
                    title,
                    genres: [],
                    ratings: [],
                    count: 0,
                    lastDate: r.review_date || null
                });
            }

            const g = groups.get(key);
            if (r.genre) g.genres.push(String(r.genre));
            if (r.rating != null && r.rating !== "") g.ratings.push(Number(r.rating));
            g.count++;
            if (r.review_date && (!g.lastDate || r.review_date > g.lastDate)) {
                g.lastDate = r.review_date;
            }
        }

        const aggregates = [];
        for (const g of groups.values()) {
            const sum = g.ratings.reduce((a, b) => a + b, 0);
            const avg = g.ratings.length ? sum / g.ratings.length : NaN;
            aggregates.push({
                kind: g.kind,
                title: g.title,
                genre: mode(g.genres),
                avgRating: avg,
                reviewsCount: g.count,
                lastDate: g.lastDate || ""
            });
        }

        const bestByKind = { Film: null, Serial: null };
        for (const row of aggregates) {
            const k = row.kind;
            const curr = bestByKind[k];

            if (!curr) {
                bestByKind[k] = row;
                continue;
            }

            const currAvg = Number.isFinite(curr.avgRating) ? curr.avgRating : -1;
            const rowAvg = Number.isFinite(row.avgRating) ? row.avgRating : -1;

            if (rowAvg > currAvg) {
                bestByKind[k] = row;
            } else if (rowAvg === currAvg) {
                if (row.reviewsCount > curr.reviewsCount) {
                    bestByKind[k] = row;
                } else if (row.reviewsCount === curr.reviewsCount) {
                    if (row.lastDate > curr.lastDate) {
                        bestByKind[k] = row;
                    } else if (row.lastDate === curr.lastDate && row.title.localeCompare(curr.title) < 0) {
                        bestByKind[k] = row;
                    }
                }
            }
        }

        const cards = [];
        for (const kind of ["Serial", "Film"]) {
            const item = bestByKind[kind];
            if (item) {
                cards.push(`<article class="movie-card" data-kind="${item.kind}">
          <div class="body">
            <div class="title">${escapeHtml(item.title || "")}</div>
            <div class="meta">
              Typ: <strong>${item.kind}</strong><br>
              Gatunek: ${escapeHtml(item.genre || "") || "—"}<br>
              Średnia ocena: <strong>${fmtAvg(item.avgRating)}</strong><br>
              Liczba opinii: <strong>${item.reviewsCount}</strong>
            </div>
          </div>
        </article>`);
            } else {
                cards.push(`<article class="movie-card" data-kind="${kind}">
          <div class="body">
            <div class="title">${kind}</div>
            <p>Brak danych.</p>
          </div>
        </article>`);
            }
        }

        popularWrap.innerHTML = cards.join("");
    }

    load().catch(err => {
        console.error(err);
        if (popularWrap) popularWrap.innerHTML = `<p>Błąd ładowania.</p>`;
        if (reviewsList) reviewsList.innerHTML = `<div class="review-card"><p>Błąd ładowania.</p></div>`;
    });

    const toTop = document.querySelector("#toTop");
    if (toTop) toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    })();
// === Home search module (isolated, fixed) ===
(function () {
    const qInput = document.getElementById('q');
    const qBtn = document.getElementById('searchBtn');

    const searchSection = document.getElementById('home-search-results');
    const table = searchSection ? searchSection.querySelector('table') : null;
    const searchRowsBody = document.getElementById('homeSearchRows');
    const guestNoticeEl = document.getElementById('homeGuestNotice');
    const emptyNoticeEl = document.getElementById('homeEmptyNotice');
    const pagerWrap = document.getElementById('homeSearchPagination');
    const prevBtn = document.getElementById('homePrevSearchPage');
    const nextBtn = document.getElementById('homeNextSearchPage');
    const pageInfo = document.getElementById('homeSearchPageInfo');

    if (!qInput || !qBtn || !searchSection || !table || !searchRowsBody) return;

    let meUser = null;
    let cache = [];
    let matched = [];
    let page = 1;
    const perPage = 3;

    const esc = (s = "") => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    const normalize = (str = "") => String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const matchTitle = (r, q) => !q || normalize(r.title || "").includes(normalize(q));

    function drawRows(items) {
        searchRowsBody.innerHTML = items.map(m => {
            const title = esc(m.Title);
            const year = esc(m.Year);
            const type = esc(m.Type);   // movie / series / episode
            const imdbID = esc(m.imdbID);

            const imdbLink = imdbID
                ? `<a href="https://www.imdb.com/title/${imdbID}/" target="_blank" rel="noopener noreferrer">Otwórz</a>`
                : "—";

            return `
        <tr>
          <td>${title}</td>
          <td>${year}</td>
          <td>${type}</td>
          <td>${imdbID}</td>
          <td>${imdbLink}</td>
        </tr>`;
        }).join("");
    }


    function showSection(show) { searchSection.style.display = show ? '' : 'none'; }
    function hideTable() { table.style.display = 'none'; }
    function showTable() { table.style.removeProperty('display'); }
    function noBgCard(on) {
        const card = searchSection.querySelector('.card');
        if (!card) return;
        if (on) card.classList.add('no-bg'); else card.classList.remove('no-bg');
    }

    function updatePager(total) {
        const pages = Math.max(1, Math.ceil(total / perPage));
        page = Math.min(page, pages);
        pageInfo.textContent = `Strona ${page} z ${pages}`;
        prevBtn.disabled = page <= 1;
        nextBtn.disabled = page >= pages;
    }

    async function getMe() {
        try {
            const r = await fetch('/api/me', { credentials: 'include' });
            const j = await r.json(); meUser = (j && j.username) ? j : null;
        } catch { meUser = null; }
    }
    async function getReviews() {
        if (cache.length) return cache;
        const r = await fetch('/api/reviews');
        cache = await r.json();
        return cache;
    }

    function renderResults() {
        emptyNoticeEl.style.display = 'none';
        noBgCard(false);
        showTable();

        if (!meUser) {
            // показать первые 3 записи, без пагинации
            drawRows(matched.slice(0, 3));
            pagerWrap.style.display = 'none';

            // подготовить и вынести сообщение ПОД карточку
            emptyNoticeEl.style.display = 'none';
            guestNoticeEl.textContent = '*Zaloguj się, aby zobaczyć więcej';
            guestNoticeEl.style.display = '';
            guestNoticeEl.classList.add('login-note');

            const card = searchSection.querySelector('.card');
            if (card && guestNoticeEl) {
                // переносим сразу после карточки (не внутрь!)
                card.insertAdjacentElement('afterend', guestNoticeEl);
            }

            return;
        }

        guestNoticeEl.style.display = 'none';
        pagerWrap.style.removeProperty('display');
        page = 1;
        drawRows(matched.slice(0, perPage));
        updatePager(matched.length);

        prevBtn.onclick = () => {
            if (page > 1) {
                page--;
                const s = (page - 1) * perPage;
                drawRows(matched.slice(s, s + perPage));
                updatePager(matched.length);
            }
        };
        nextBtn.onclick = () => {
            const pages = Math.ceil(matched.length / perPage);
            if (page < pages) {
                page++;
                const s = (page - 1) * perPage;
                drawRows(matched.slice(s, s + perPage));
                updatePager(matched.length);
            }
        };
    }

    function renderEmpty() {
        drawRows([]);
        hideTable();
        pagerWrap.style.display = 'none';
        guestNoticeEl.style.display = 'none';
        emptyNoticeEl.style.display = '';
        noBgCard(true);
    }

    async function run() {
        const q = (qInput.value || '').trim();
        if (!q) {
            showSection(false);
            return;
        }

        showSection(true);
        hideTable();
        pagerWrap.style.display = 'none';
        guestNoticeEl.style.display = 'none';
        emptyNoticeEl.style.display = 'none';
        noBgCard(false);

        let data;
        try {
            // ТВОЙ backend: GET /api/omdb?q=...
            const res = await fetch(`/api/omdb?q=${encodeURIComponent(q)}`);
            data = await res.json();
        } catch (e) {
            console.error(e);
            emptyNoticeEl.textContent = "Błąd połączenia z OMDb.";
            emptyNoticeEl.style.display = "";
            return;
        }

        if (!data || !data.Search || !Array.isArray(data.Search)) {
            renderEmpty();
            return;
        }

        // теперь matched — это СЫРЫЕ объекты OMDb (Title, Year, imdbID, Type, Poster)
        matched = data.Search;

        showTable();
        pagerWrap.style.display = 'none';
        guestNoticeEl.style.display = 'none';

        drawRows(matched);
    }


    // run only on button click
    qBtn.addEventListener('click', run);
})();