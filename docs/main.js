/* Minimal spreadsheet-like grid for Telegram Mini Apps */
(function () {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand(); // use available height
    try { tg.setHeaderColor('secondary_bg_color'); } catch (_) {}
  }

  // --- Sample data (50 rows) ---
  const rows = Array.from({ length: 50 }, (_, i) => {
    const id = 1000 + i + 1;
    const qty = (i % 7) + 1;
    const price = (Math.round(((i * 0.73) % 97 + 3) * 100) / 100);
    return {
      id,
      item: `Item ${String.fromCharCode(65 + (i % 26))}-${i + 1}`,
      qty,
      price,
      total: +(qty * price).toFixed(2),
      selected: false
    };
  });

  // --- State ---
  let state = {
    page: 1,
    pageSize: 30,
    sortKey: 'id',
    sortDir: 'asc', // 'asc' | 'desc'
    q: ''
  };

  // --- Elements ---
  const $ = (sel) => document.querySelector(sel);
  const grid = $('#grid');
  const tbody = grid.querySelector('tbody');
  const search = $('#search');
  const checkAll = $('#check-all');
  const pageSizeSel = $('#page-size');
  const pageLabel = $('#page-label');
  const btnPrev = $('#prev');
  const btnNext = $('#next');
  const btnSend = $('#send');

  // --- Helpers ---
  function applyFilterSort(items) {
    let list = items;
    if (state.q) {
      const q = state.q.toLowerCase();
      list = list.filter(r =>
        String(r.id).includes(q) ||
        r.item.toLowerCase().includes(q) ||
        String(r.qty).includes(q) ||
        String(r.price).includes(q) ||
        String(r.total).includes(q)
      );
    }
    list = list.slice().sort((a, b) => {
      const dir = state.sortDir === 'asc' ? 1 : -1;
      const ka = a[state.sortKey], kb = b[state.sortKey];
      if (ka < kb) return -1 * dir;
      if (ka > kb) return 1 * dir;
      return 0;
    });
    return list;
  }

  function render() {
    const filtered = applyFilterSort(rows);
    const pages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    if (state.page > pages) state.page = pages;
    const start = (state.page - 1) * state.pageSize;
    const pageRows = filtered.slice(start, start + state.pageSize);

    tbody.innerHTML = pageRows.map(r => `
      <tr data-id="${r.id}">
        <td class="selcol"><input type="checkbox" ${r.selected ? 'checked' : ''} aria-label="Select row ${r.id}"/></td>
        <td>${r.id}</td>
        <td>${escapeHtml(r.item)}</td>
        <td>${r.qty}</td>
        <td>$${r.price.toFixed(2)}</td>
        <td>$${r.total.toFixed(2)}</td>
      </tr>
    `).join('');

    pageLabel.textContent = `Page ${state.page} / ${pages}`;
    btnPrev.disabled = state.page <= 1;
    btnNext.disabled = state.page >= pages;

    updateSendButton();
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }

  const BottomButton = tg && (tg.BottomButton || tg.MainButton);

  function updateSendButton() {
    const selected = rows.filter(r => r.selected);
    btnSend.textContent = `Send ${selected.length} row${selected.length !== 1 ? 's' : ''}`;
    if (BottomButton) {
      if (selected.length) {
        BottomButton.setText(`Send ${selected.length} row${selected.length !== 1 ? 's' : ''}`);
        BottomButton.show();
      } else {
        BottomButton.hide && BottomButton.hide();
      }
    }
  }

  // --- Event wiring ---
  grid.querySelectorAll('th[data-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-key');
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDir = 'asc';
      }
      render();
    });
  });

  tbody.addEventListener('change', (e) => {
    const cb = e.target;
    if (cb.tagName !== 'INPUT') return;
    const tr = cb.closest('tr');
    const id = +tr.dataset.id;
    const row = rows.find(r => r.id === id);
    if (row) row.selected = cb.checked;
    checkAll.checked = rowsOnCurrentPage().every(r => r.selected);
    updateSendButton();
  });

  checkAll.addEventListener('change', () => {
    const pageIds = rowsOnCurrentPage().map(r => r.id);
    rows.forEach(r => { if (pageIds.includes(r.id)) r.selected = checkAll.checked; });
    render();
  });

  function rowsOnCurrentPage() {
    const filtered = applyFilterSort(rows);
    const start = (state.page - 1) * state.pageSize;
    return filtered.slice(start, start + state.pageSize);
  }

  search.addEventListener('input', () => {
    state.q = search.value.trim();
    state.page = 1;
    render();
  });

  pageSizeSel.addEventListener('change', () => {
    state.pageSize = +pageSizeSel.value;
    state.page = 1;
    render();
  });

  btnPrev.addEventListener('click', () => { state.page = Math.max(1, state.page - 1); render(); });
  btnNext.addEventListener('click', () => { state.page += 1; render(); });

  function collectSelection() {
    const selected = rows.filter(r => r.selected);
    return selected.map(({id, item, qty, price, total}) => ({id, item, qty, price, total}));
  }

  function sendSelection() {
    const data = { type: 'selection', rows: collectSelection(), count: collectSelection().length, ts: Date.now() };
    if (BottomButton) {
      try {
        tg.HapticFeedback?.impactOccurred('medium');
      } catch (_) {}
      tg.sendData(JSON.stringify(data)); // delivered as service message (web_app_data) to the bot
      tg.close(); // close mini app
    } else {
      alert('Telegram WebApp context not detected.');
      console.log(data);
    }
  }

  btnSend.addEventListener('click', sendSelection);
  if (BottomButton) {
    BottomButton.onClick(sendSelection);
    tg.onEvent('themeChanged', () => {
      // CSS vars update automatically via Telegram-provided CSS variables
      document.documentElement.style.setProperty('--bg', getComputedStyle(document.documentElement).getPropertyValue('--tg-theme-bg-color'));
    });
  }

  // Initial render
  render();
})();