(async function () {
    const $ = (s) => document.querySelector(s);
    const rowsTbody = $("#rows");
    const form = $("#review-form");
    const userSpan = $("#userName");
    const filterAllBtn = document.querySelector('#filterAll');
    const filterMineBtn = document.querySelector('#filterMine');
    const filterHint = document.querySelector('#filterHint');
    const sortAscCb = document.querySelector('#sortAsc');
    const sortDescCb = document.querySelector('#sortDesc');

    let sortMode = 'none'; // sortowanie daty
    let currentUser = null;
    let allReviews = [];
    let filterMode = 'all';

    let currentPage = 1;
    const perPage = 20;
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');

    function updatePagination(total, page) {
        const pages = Math.max(1, Math.ceil(total / perPage));
        currentPage = Math.min(page, pages);
        if (pageInfo) pageInfo.textContent = `Strona ${currentPage} z ${pages}`;
        if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage >= pages;
    }

    const backBtn = $("#backHome");

    const titleIn = $("#title");
    const yearIn = $("#year");
    const genreIn = $("#genre");
    const kindIn = $("#kind");
    const ratingIn = $("#rating");
    const reviewIn = $("#review");

    async function fetchJSON(url, opts) {
        const res = await fetch(url, Object.assign({ credentials: "include" }, opts));
        if (!res.ok) {
            // tu pokazujemy 400/401/403/409/422 z backendu
            let msg = "Błąd żądania";
            try {
                const j = await res.json();
                if (j && j.fieldErrors && j.fieldErrors.length) {
                    msg = j.fieldErrors.map(f => `${f.field}: ${f.message}`).join("\n");
                } else if (j && j.message) {
                    msg = j.message;
                } else if (j && j.error) {
                    msg = j.error;
                }
            } catch { }
            throw new Error(msg);
        }
        return res.json();
    }

    function esc(s = "") { return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }

    async function loadUser() {
        try {
            const me = await fetchJSON("/api/me");
            if (me && me.username) {
                if (userSpan) userSpan.textContent = me.username;
                currentUser = me.username;
            } else {
                if (userSpan) userSpan.textContent = 'gość';
            }
        } catch {
            if (userSpan) userSpan.textContent = 'gość';
        }
    }

    function renderRows(items) {
        if (!rowsTbody) return;
        rowsTbody.innerHTML = items.map(r => `
      <tr data-id="${r.id}">
        <td>${esc(r.title)}</td>
        <td>${r.year ?? ""}</td>
        <td>${esc(r.genre ?? "")}</td>
        <td>${esc(r.kind ?? "")}</td>
        <td><strong>${Number(r.rating).toFixed(1)}</strong></td>
        <td>${esc(r.username ?? "")}</td>
        <td><time>${esc(r.review_date ?? "")}</time></td>
        <td>${esc(r.review ?? "")}</td>
        <td>${(filterMode === 'mine' && r.username === currentUser)
                ? '<button class="edit">Edytuj</button> <button class="del">Usuń</button>'
                : '<span style="opacity:.4">—</span>'
            }</td>
      </tr>
    `).join("");
    }

    async function loadReviews() {
        try {
            const data = await fetchJSON("/api/reviews");
            allReviews = data;
            resetToFirstPageAndRender();
        } catch (e) {
            console.error(e);
            if (rowsTbody) rowsTbody.innerHTML = `<tr><td colspan="9">Błąd ładowania: ${e.message}</td></tr>`;
        }
    }

    function parseDate(s) {
        // zamiana daty na timestamp do sortowania
        if (!s) return 0;
        const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
        if (m) {
            const [_, y, mo, d, h, mi, se] = m.map(Number);
            return new Date(y, mo - 1, d, h, mi, se).getTime();
        }
        const t = Date.parse(s);
        return Number.isFinite(t) ? t : 0;
    }

    function applySort(items) {
        if (sortMode === 'none') return items.slice();
        const arr = items.slice();
        arr.sort((a, b) => {
            const ta = parseDate(a.review_date);
            const tb = parseDate(b.review_date);
            return sortMode === 'asc' ? (ta - tb) : (tb - ta);
        });
        return arr;
    }

    function getFiltered() {
        if (filterMode === 'mine' && currentUser) {
            return allReviews.filter(r => r.username === currentUser);
        }
        return allReviews;
    }

    function render() {
        const allItems = applySort(getFiltered());
        if (filterHint) {
            filterHint.textContent = filterMode === 'mine'
                ? `pokazuję tylko wpisy użytkownika: ${currentUser || ''}`
                : 'pokazuję wszystkie wpisy';
        }
        const start = (currentPage - 1) * perPage;
        const end = start + perPage;
        const pageItems = allItems.slice(start, end);
        renderRows(pageItems);
        updatePagination(allItems.length, currentPage);
    }

    // walidacja front recenzji przed wysyłką // walidacja front
    function validateReviewFront(payload) {
        const errs = [];

        if (!payload.title || payload.title.trim().length < 2 || payload.title.trim().length > 100) {
            errs.push("Tytuł 2–100 znaków");
        }
        if (!payload.kind || !["Film", "Serial", "Anime"].includes(payload.kind)) {
            errs.push("Podaj typ: Film / Serial / Anime");
        }
        const r = Number(payload.rating);
        if (!Number.isFinite(r) || r < 0 || r > 10) {
            errs.push("Ocena 0–10");
        }
        if (payload.year) {
            const y = Number(payload.year);
            const currentYear = new Date().getFullYear();
            if (!Number.isInteger(y) || y < 1900 || y > currentYear) {
                errs.push(`Rok 1900–${currentYear}`);
            }
        }
        if (payload.genre && payload.genre.length > 30) {
            errs.push("Gatunek max 30 znaków");
        }
        if (payload.review && payload.review.length > 1000) {
            errs.push("Opinia max 1000 znaków");
        }

        return errs;
    }

    async function addReview(e) {
        e.preventDefault();
        const payload = {
            title: titleIn.value.trim(),
            year: yearIn.value ? Number(yearIn.value) : null,
            genre: genreIn.value.trim() || null,
            kind: kindIn.value,
            rating: Number(ratingIn.value),
            review: reviewIn.value.trim() || null
        };

        // walidacja klienta (blokujemy submit jeśli błędne) // walidacja front
        const localErrs = validateReviewFront(payload);
        if (localErrs.length) {
            alert(localErrs.join("\n"));
            return;
        }

        try {
            await fetchJSON("/api/reviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            form.reset();
            await loadReviews(); resetToFirstPageAndRender();
        } catch (e) {
            alert(e.message); // pokaż błąd zwrócony z API (400 / 401/403 / 422)
        }
    }

    function onTableClick(e) {
        const editBtn = e.target.closest(".edit");
        if (editBtn) {
            const tr = editBtn.closest("tr");
            const id = tr?.getAttribute("data-id");
            if (!id) return;

            // 401/403 obsługiwane po stronie API, tu tylko UI
            const userCell = tr.children[5];
            if (filterMode !== 'mine' || (userCell && userCell.textContent.trim() !== (currentUser || ""))) return;

            const ratingCell = tr.children[4];
            const reviewCell = tr.children[7];
            const actionsCell = tr.children[8];

            const currentRating = parseFloat(ratingCell.textContent) || 0;
            const currentReview = reviewCell.textContent;

            ratingCell.innerHTML = `<input type="number" min="0" max="10" step="0.1" value="${currentRating}" style="width:90px">`;
            reviewCell.innerHTML = `<textarea rows="3" style="width:100%">${currentReview}</textarea>`;
            actionsCell.innerHTML = '<button class="save">Zapisz</button> <button class="cancel">Anuluj</button>';
            return;
        }

        const saveBtn = e.target.closest(".save");
        if (saveBtn) {
            const tr = saveBtn.closest("tr");
            const id = tr?.getAttribute("data-id");
            const ratingVal = parseFloat(tr.children[4].querySelector("input").value);
            const reviewVal = tr.children[7].querySelector("textarea").value.trim();

            // mini walidacja edycji // walidacja front
            const localErrs = validateReviewFront({
                title: tr.children[0].textContent.trim(),
                year: tr.children[1].textContent.trim(),
                genre: tr.children[2].textContent.trim(),
                kind: tr.children[3].textContent.trim(),
                rating: ratingVal,
                review: reviewVal
            });
            if (localErrs.length) {
                alert(localErrs.join("\n"));
                return;
            }

            fetchJSON(`/api/reviews/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating: ratingVal, review: reviewVal })
            }).then(() => loadReviews().then(resetToFirstPageAndRender))
                .catch(err => {
                    // fallback POST alias jeśli PUT niedostępny
                    fetchJSON(`/api/reviews/${id}/edit`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ rating: ratingVal, review: reviewVal })
                    }).then(() => loadReviews().then(resetToFirstPageAndRender))
                        .catch(err2 => alert(err2.message));
                });
            return;
        }

        const cancelBtn = e.target.closest(".cancel");
        if (cancelBtn) { loadReviews().then(resetToFirstPageAndRender); return; }

        const btn = e.target.closest(".del");
        if (!btn) return;
        const tr = btn.closest("tr");
        const id = tr?.getAttribute("data-id");
        if (!id) return;
        if (!confirm("Usunąć ten wpis?")) return;

        fetchJSON(`/api/reviews/${id}`, { method: "DELETE" })
            .then(() => loadReviews().then(resetToFirstPageAndRender))
            .catch(err => alert(err.message)); // obsługa 404 "nie znaleziono" itd.
    }

    // paginacja
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; render(); } });
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => {
        const total = applySort(getFiltered()).length;
        const pages = Math.ceil(total / perPage);
        if (currentPage < pages) { currentPage++; render(); }
    });

    function resetToFirstPageAndRender() { currentPage = 1; render(); }

    if (form) form.addEventListener("submit", addReview);
    if (rowsTbody) rowsTbody.addEventListener("click", onTableClick);

    if (filterAllBtn) filterAllBtn.addEventListener('click', () => { filterMode = 'all'; resetToFirstPageAndRender(); });
    if (filterMineBtn) filterMineBtn.addEventListener('click', () => { filterMode = 'mine'; resetToFirstPageAndRender(); });

    if (sortAscCb) sortAscCb.addEventListener('change', () => {
        if (sortAscCb.checked) { sortMode = 'asc'; if (sortDescCb) sortDescCb.checked = false; } else { sortMode = (sortDescCb && sortDescCb.checked) ? 'desc' : 'none'; }
        resetToFirstPageAndRender();
    });
    if (sortDescCb) sortDescCb.addEventListener('change', () => {
        if (sortDescCb.checked) { sortMode = 'desc'; if (sortAscCb) sortAscCb.checked = false; } else { sortMode = (sortAscCb && sortAscCb.checked) ? 'asc' : 'none'; }
        resetToFirstPageAndRender();
    });

    if (backBtn) backBtn.addEventListener("click", () => { location.href = "/home.html"; });

    await Promise.all([loadUser(), loadReviews()]);
})();
