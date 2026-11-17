/* =====================================================================
   session.js — сеанс работы с файлом меню.

   • Загрузили файл: он сохраняется в браузере (IndexedDB), появляется плашка
     с кнопкой «Завершить сеанс», зона загрузки скрывается.
   • Перезагрузили страницу (F5, закрыли и открыли вкладку): файл, выбранная
     неделя, галочки, ваши правки и прокрутка карточек восстанавливаются сами.
   • Загрузить другой файл можно только после «Завершить сеанс».

   Подключать ПОСЛЕ остальных скриптов:  <script src="session.js"></script>
   Остальной код не меняется. Если удалить session.js, всё работает как раньше.
   ===================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const input = $('#file'), zone = $('#drop-zone'), step2 = $('#step2');
  if (!input || !zone || !step2) return;

  const DB = 'gen_menu_session', STORE = 'kv', LS = 'menu_session_state';
  let active = false, restoring = false, persisted = false, meta = null;

  /* ---------------- IndexedDB: тут лежит сам файл ---------------- */
  const openDb = () => new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('IndexedDB недоступна'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => {
    const db = await openDb();
    return new Promise((res, rej) => {
      const t = db.transaction(STORE, mode), q = fn(t.objectStore(STORE));
      t.oncomplete = () => { db.close(); res(q && q.result); };
      t.onerror = t.onabort = () => { db.close(); rej(t.error); };
    });
  };
  const kvGet = (k) => tx('readonly', (s) => s.get(k));
  const kvSet = (k, v) => tx('readwrite', (s) => s.put(v, k));
  const kvDel = (k) => tx('readwrite', (s) => s.delete(k));

  /* ---------------- localStorage: тут лежат галочки, неделя, правки ---------------- */
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } };
  const lsSet = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch (e) { /* ignore */ } };

  const say = (t, bad) => { try { window.say(t, bad); } catch (e) { /* ignore */ } };

  /* ---------------- ждём, пока основной скрипт разберёт файл ---------------- */
  const loaded = async (ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (!step2.classList.contains('hide') && window.weeks && window.weeks.length) return true;
      await new Promise((r) => setTimeout(r, 60));
    }
    return false;
  };

  /* ---------------- плашка сеанса ---------------- */
  const bar = document.createElement('div');
  bar.id = 'sessBar'; bar.className = 'sess hide';
  bar.innerHTML = '<span class="sess-ic" aria-hidden="true">📄</span>' +
    '<div class="sess-txt"><b id="sessName"></b><span id="sessMeta"></span></div>' +
    '<button type="button" class="btn alt" id="sessEnd">Завершить сеанс</button>';
  zone.after(bar);

  const css = document.createElement('style');
  css.textContent = `
  .sess{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 18px;border:1.5px solid var(--line-strong,#999);
    border-left:5px solid var(--shu,#c0392b);border-radius:6px;background:var(--paper,#fff)}
  .sess-ic{font-size:28px;line-height:1}
  .sess-txt{flex:1;min-width:190px;display:grid;gap:3px}
  .sess-txt b{font-size:16px;word-break:break-word}
  .sess-txt span{font-size:13px;color:var(--mute,#666)}
  .sess-txt span::before{content:"";display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;
    background:var(--ml,#3f7a5a);box-shadow:0 0 8px var(--ml,#3f7a5a)}
  .sess.warn .sess-txt span::before{background:var(--warn,#c0392b);box-shadow:0 0 8px var(--warn,#c0392b)}
  .sess .btn{width:auto!important;margin:0!important;padding:10px 18px!important}
  .sess.hide{display:none!important}`;
  document.head.appendChild(css);

  const stamp = () => {
    if (!active || !meta) return;
    const hm = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const kb = Math.max(1, Math.round(meta.size / 1024));
    $('#sessMeta').textContent = persisted
      ? `Сеанс сохранён в браузере · ${hm} · недель: ${meta.weeks} · ${kb} КБ`
      : 'Файл не удалось сохранить в браузере: после перезагрузки сеанс не восстановится';
    bar.classList.toggle('warn', !persisted);
  };
  const paint = () => {
    zone.classList.toggle('hide', active);
    bar.classList.toggle('hide', !active);
    input.disabled = active;                       // и клик, и подпись «1. Файл…» больше не открывают выбор файла
    if (active) { $('#sessName').textContent = meta.name; stamp(); }
  };

  /* ---------------- автосохранение состояния ---------------- */
  function snapshot() {
    const sel = {};
    for (const [k, v] of Object.entries(window.sel || {})) sel[k] = [...v];
    const box = $('#weekContainer');
    return {
      name: meta.name, size: meta.size, weeks: meta.weeks, started: meta.started, savedAt: Date.now(),
      week: (window.cur && window.cur.week) | 0, sel, overrides: window.overrides || {}, scrollX: box ? box.scrollLeft : 0
    };
  }
  const save = () => { if (active && meta) { lsSet(snapshot()); stamp(); } };
  let timer = 0;
  const later = () => { clearTimeout(timer); timer = setTimeout(save, 250); };
  ['input', 'change'].forEach((ev) => document.addEventListener(ev, (e) => { if (active && e.target !== input) later(); }, true));
  const wc = $('#weekContainer');
  if (wc) new MutationObserver(later).observe(wc, { childList: true });
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  /* ---------------- начало сеанса: пользователь выбрал файл ---------------- */
  input.addEventListener('click', (e) => { if (active) e.preventDefault(); });
  document.addEventListener('change', async (e) => {
    if (e.target !== input || restoring) return;
    if (active) {                                   // защита, если событие всё же пришло
      e.stopImmediatePropagation(); input.value = '';
      say('Сначала нажмите «Завершить сеанс».', true);
      return;
    }
    const f = input.files && input.files[0];
    if (!f) return;
    let buf;
    try { buf = await f.arrayBuffer(); } catch (err) { return; }
    if (!(await loaded(8000))) return;              // файл не разобрался: сеанс не начинаем
    meta = { name: f.name, size: f.size, weeks: window.weeks.length, started: Date.now() };
    active = true;
    try { localStorage.removeItem('manual_overrides'); } catch (err) { /* ignore */ }
    try { await kvSet('file', { buffer: buf, name: f.name, type: f.type, lastModified: f.lastModified }); persisted = true; }
    catch (err) { persisted = false; console.warn('session:', err); }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (err) { /* ignore */ }
    paint(); save();
  }, true);

  /* ---------------- восстановление после перезагрузки ---------------- */
  async function restore() {
    let rec = null;
    try { rec = await kvGet('file'); } catch (err) { /* ignore */ }
    const st = lsGet();
    if (!rec || !rec.buffer) { try { localStorage.removeItem(LS); } catch (err) { /* ignore */ } return; }

    restoring = true;
    try {
      const file = new File([rec.buffer], rec.name || 'menu.xlsx', { type: rec.type || '', lastModified: rec.lastModified || Date.now() });
      const dt = new DataTransfer(); dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));   // тот же путь, что при ручной загрузке
    } catch (err) { console.warn('session:', err); }

    const ok = await loaded(12000);
    restoring = false;
    if (!ok) {
      try { await kvDel('file'); localStorage.removeItem(LS); } catch (err) { /* ignore */ }
      say('Не удалось восстановить сохранённый сеанс. Загрузите файл заново.', true);
      return;
    }

    meta = { name: rec.name, size: rec.buffer.byteLength, weeks: window.weeks.length, started: (st && st.started) || Date.now() };
    active = true; persisted = true;

    if (st) {                                        // возвращаем неделю, галочки, правки, прокрутку
      window.sel = {};
      for (const [k, arr] of Object.entries(st.sel || {})) window.sel[k] = new Set(arr);
      window.overrides = st.overrides || {};
      try { localStorage.setItem('manual_overrides', JSON.stringify(window.overrides)); } catch (err) { /* ignore */ }
      const wk = Math.max(0, Math.min(st.week | 0, window.weeks.length - 1));
      window.cur = { week: wk };
      const ws = $('#weekSel'); if (ws) ws.value = wk;
      try { renderWeek(); } catch (err) { console.warn('session:', err); }
      const box = $('#weekContainer');
      if (box && st.scrollX) requestAnimationFrame(() => { box.style.scrollBehavior = 'auto'; box.scrollLeft = st.scrollX; box.style.scrollBehavior = ''; });
    }
    paint();
    say('Сеанс восстановлен: ' + meta.name);
  }

  /* ---------------- завершение сеанса ---------------- */
  async function end() {
    if (!active) return;
    const ok = confirm('Завершить сеанс?\n\nФайл «' + meta.name + '», галочки и ваши правки в карточках будут удалены из браузера. ' +
                       'Словарь переводов останется.');
    if (!ok) return;
    active = false; persisted = false; meta = null;
    try { await kvDel('file'); } catch (err) { /* ignore */ }
    try { localStorage.removeItem(LS); localStorage.removeItem('manual_overrides'); } catch (err) { /* ignore */ }
    window.weeks = []; window.sel = {}; window.overrides = {}; window.cur = { week: 0 };
    const box = $('#weekContainer'); if (box) box.replaceChildren();
    const ws = $('#weekSel'); if (ws) ws.replaceChildren();
    step2.classList.add('hide');
    input.disabled = false; input.value = '';
    paint();
    say('Сеанс завершён. Можно загрузить другой файл.');
  }
  $('#sessEnd').addEventListener('click', end);

  restore();
})();
