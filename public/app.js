const $ = (sel) => document.querySelector(sel);
const rowsTbody = $("#rows");
const form = $("#review-form");
const submitBtn = $("#submitBtn");
const cancelBtn = $("#cancelBtn");
const editHint = $("#editHint");

let editId = null;

function escapeHtml(str = "") {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

async function fetchJSON(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        let msg = "Błąd żądania.";
        try { const j = JSON.parse(text); if (j.error) msg = j.error; } catch { }
        throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
}

async function loadRows() {
    const data = await fetchJSON("/api/reviews");
    renderRows(data);
}

function renderRows(list) {
    rowsTbody.innerHTML = list.map(r => `
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
        <button class="btn" data-action="edit" data-id="${r.id}" title="Edytuj" aria-label="Edytuj">✏️</button>
        <button class="btn" data-action="delete" data-id="${r.id}" title="Usuń" aria-label="Usuń">🗑️</button>
      </td>
    </tr>
  `).join("");
}

function fillForm(item) {
    $("#title").value = item.title ?? "";
    $("#year").value = item.year ?? "";
    $("#genre").value = item.genre ?? "";
    $("#kind").value = item.kind ?? "";
    $("#rating").value = item.rating ?? "";
    $("#review").value = item.review ?? "";

    editId = item.id;
    submitBtn.textContent = "Zapisz zmiany";
    cancelBtn.style.display = "";
    editHint.style.display = "";
    editHint.textContent = `Edycja #${item.id}`;
}

function resetForm() {
    form.reset();
    editId = null;
    submitBtn.textContent = "Dodaj";
    cancelBtn.style.display = "none";
    editHint.style.display = "none";
}

rowsTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;

    if (action === "edit") {
        const item = await fetchJSON(`/api/reviews/${id}`);
        fillForm(item);
    }
    if (action === "delete") {
        if (!confirm(`Na pewno usunąć #${id}?`)) return;
        await fetchJSON(`/api/reviews/${id}`, { method: "DELETE" });
        await loadRows();
        if (editId === id) resetForm();
    }
});

cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    resetForm();
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
        title: $("#title").value.trim(),
        year: $("#year").value ? Number($("#year").value) : null,
        genre: $("#genre").value.trim() || null,
        kind: $("#kind").value,
        rating: $("#rating").value !== "" ? Number($("#rating").value) : null,
        review: $("#review").value.trim() || null
    };

    if (!payload.title || !payload.kind) {
        alert("Pola 'title' i 'kind' są obowiązkowe.");
        return;
    }

    if (editId) {
        await fetchJSON(`/api/reviews/${editId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } else {
        await fetchJSON("/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    }

    await loadRows();
    resetForm();
});

// Start
loadRows().catch(err => alert(err.message));

