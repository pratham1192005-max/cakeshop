/* cakes.js - loads cakes from the backend for the home page (featured) and the cake listing page */
(function () {
  const { api, cakeCard, esc } = window.Shop;

  /* ---------- Home page: featured cakes ---------- */
  const featured = document.getElementById('featured-grid');
  if (featured) {
    featured.innerHTML = '<div class="spinner">Loading cakes…</div>';
    api('/cakes?featured=1')
      .then(({ cakes }) => {
        featured.innerHTML = cakes.length
          ? cakes.slice(0, 4).map(cakeCard).join('')
          : '<div class="empty">No featured cakes yet.</div>';
      })
      .catch((err) => { featured.innerHTML = `<div class="empty">⚠️ ${esc(err.message)}</div>`; });
  }

  /* ---------- Cake listing page ---------- */
  const grid = document.getElementById('cake-grid');
  if (grid) {
    const chips = document.getElementById('category-chips');
    const search = document.getElementById('search');
    let all = [];
    let category = new URLSearchParams(location.search).get('category') || '';

    function render() {
      const q = search.value.trim().toLowerCase();
      const list = all.filter((c) =>
        (!category || c.category === category) &&
        (!q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)));
      grid.innerHTML = list.length ? list.map(cakeCard).join('') : '<div class="empty"><span class="emoji">🔍</span>No cakes match your search.</div>';
    }

    function renderChips() {
      const cats = [...new Set(all.map((c) => c.category))].sort();
      chips.innerHTML = ['', ...cats]
        .map((c) => `<button class="chip ${c === category ? 'active' : ''}" data-cat="${esc(c)}">${c || 'All'}</button>`)
        .join('');
    }

    chips.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      category = b.dataset.cat;
      renderChips(); render();
    });
    search.addEventListener('input', render);

    grid.innerHTML = '<div class="spinner">Loading cakes…</div>';
    api('/cakes')
      .then(({ cakes }) => { all = cakes; renderChips(); render(); })
      .catch((err) => { grid.innerHTML = `<div class="empty">⚠️ ${esc(err.message)}</div>`; });
  }
})();
