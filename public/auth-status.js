// auth-status.js — robust auth header + navigation gating (no auto-logout)
(function () {
  // Tiny helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Centralized auth fetch with memoization to avoid races
  let _me = undefined; // undefined: not loaded; null: guest; {username: ...}: user
  async function getMe() {
    if (_me !== undefined) return _me;
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (!res.ok) { _me = null; return _me; }
      const data = await res.json();
      _me = (data && data.username) ? { username: data.username } : null;
    } catch (e) {
      _me = null;
    }
    return _me;
  }

    function setHeaderUser(me) {
        const userEl = $('#userName');
        if (userEl) userEl.textContent = me ? me.username : 'gość';

        // Спрятать/показать CTA-кнопки (старые селекторы оставляем)
        const authSelectors = [
            '#loginBtn', '#registerBtn', '#joinBtn',
            '[data-action="login"]', '[data-action="register"]', '[data-action="join"]'
        ];
        authSelectors.forEach(sel => {
            $$(sel).forEach(el => {
                if (me) el.style.display = 'none';
                else el.style.removeProperty('display');
            });
        });

        // ✅ Дополнительно прячем только то, что помечено как "показывать, когда не залогинен"
        const showWhenLoggedOut = $$('[data-auth="show-when-logged-out"]');
        const showWhenLoggedIn = $$('[data-auth="show-when-logged-in"]');
        if (me) {
            showWhenLoggedOut.forEach(el => el.style.display = 'none');            // скрыть: Zaloguj się, Rejestracja, Dołącz teraz
            showWhenLoggedIn.forEach(el => el.style.removeProperty('display'));    // если что-то есть "для залогиненных" — показать
        } else {
            showWhenLoggedOut.forEach(el => el.style.removeProperty('display'));   // гость — показать эти три ссылки
            showWhenLoggedIn.forEach(el => el.style.display = 'none');             // и спрятать приватные элементы
        }
    }


  function createLogoutBtn() {
    const btn = document.createElement('button');
    btn.id = 'logoutBtnHeader';
    btn.type = 'button';
    btn.textContent = 'Wyloguj się';
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      } catch (e) { /* ignore */ }
      // hard redirect like big portals
      location.href = '/home.html';
    });
    return btn;
  }

  function ensureLogoutBtn(me) {
    const existing = $('#logoutBtnHeader');
    if (me && !existing) {
      const userEl = $('#userName');
      const btn = createLogoutBtn();
      if (userEl && userEl.parentNode) {
        userEl.parentNode.insertBefore(btn, userEl.nextSibling);
      } else {
        ( $('#authBar') || $('header') ).appendChild(btn);
      }
    } else if (!me && existing) {
      existing.remove();
    }
  }

  // On the home page, force links to index when logged in; to login when guest
  function retargetHomeLinks(me) {
    const logged = !!me;
    const anchors = $$('a');

    // Match text or data attributes
    const isMatch = (el, variants) => {
      if (variants.some(v => el.matches(v))) return true;
      const t = (el.textContent || '').trim().toLowerCase();
      return ['przejdź do recenzji','przejdz do recenzji','zobacz wszystkie opinie','zobacz wszystkie recenzje']
        .some(key => t.includes(key));
    };

    anchors.forEach(a => {
      if (isMatch(a, ['[data-action="go-review"]'])) {
        a.setAttribute('href', logged ? '/index.html' : '/login.html');
      }
      if (isMatch(a, ['[data-action="view-all"]'])) {
        a.setAttribute('href', logged ? '/index.html' : '/login.html');
      }
    });
  }

  // Gate direct access to /index.html for guests: rely on server, but also give client UX
  function protectIndexForGuests(me) {
    const onIndex = /\/index\.html(?:$|\?)/.test(location.pathname);
    if (onIndex && !me) {
      // mimic big sites: bounce guests to login
      location.replace('/login.html');
    }
  }

  // Init
  document.addEventListener('DOMContentLoaded', async () => {
    const me = await getMe();
    setHeaderUser(me);
    ensureLogoutBtn(me);
    retargetHomeLinks(me);
    protectIndexForGuests(me);
  });

  // Also re-run on visibility (e.g., user logged in another tab)
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      _me = undefined; // bust memo
      const me = await getMe();
      setHeaderUser(me);
      ensureLogoutBtn(me);
      retargetHomeLinks(me);
      // don't auto-redirect here to avoid surprising the user mid-reading
    }
  });
})();
