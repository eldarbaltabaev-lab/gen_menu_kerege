
/* =====================================================================
   tools.js — дополнительные инструменты для меню.
   Подключать ПОСЛЕ translater.js:  <script src="tools.js"></script>

   Что добавляет:
   1. Настройки вида JPEG (размер и жирность шрифта) с запоминанием.
   2. Предпросмотр JPEG перед скачиванием + список блюд, не попавших в картинку.
   3. Счётчик «без перевода» и кнопка «К следующему».
   4. Прогресс выгрузки недели («Собираю 7 из 21»).

   Старый код не правится: файл «оборачивает» существующие функции.
   Если удалить tools.js, всё вернётся как было.
   ===================================================================== */
(() => {
  'use strict';
   console.log("Инструменты успешно загружены!");
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- безопасные обёртки над функциями основного скрипта ---------- */
  const fmtDate = (serial, sep = '.') => { try { return fmt(serial, sep); } catch (e) { return String(serial); } };
  const dayName = (serial) => { try { return wday(serial); } catch (e) { return ''; } };
  const curWeek = () => { try { return window.weeks && window.weeks[window.cur.week]; } catch (e) { return null; } };
  const mealName = (k) => { try { return MEALS.find((m) => m.k === k).name; } catch (e) { return k; } };
  const say = (t, bad) => { try { window.say(t, bad); } catch (e) { /* ignore */ } };

  /* =====================================================================
     1. НАСТРОЙКИ ВИДА JPEG
     ===================================================================== */
  const LS_KEY = 'menuJpegStyle';
  const DEF = { dish: 18, cat: 18, head: 18, dishBold: false, catBold: true, outW: 3200, minH: 0, maxH: 0 };
  const SIZES = [
    { n: 'Авто', w: 0, min: 0, max: 0 },
    { n: 'Высота 900–1400', w: 0, min: 900, max: 1400 },
    { n: 'Высота до 1200', w: 0, min: 0, max: 1200 },
    { n: 'Ширина 3200', w: 3200, min: 0, max: 0 }
  ];
  const PRESETS = [
    { n: 'Стандарт', v: { dish: 18, cat: 18, head: 18, dishBold: false, catBold: true } },
    { n: 'Крупнее',  v: { dish: 22, cat: 22, head: 20, dishBold: true,  catBold: true } },
    { n: 'Крупно',   v: { dish: 26, cat: 26, head: 22, dishBold: true,  catBold: true } }
  ];
  const clamp = (n, a, b, d) => (Number.isFinite(+n) ? Math.min(b, Math.max(a, +n)) : d);
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  const S = Object.assign({}, DEF, store.get() || {});
  const normalize = () => {
    S.dish = clamp(S.dish, 12, 40, DEF.dish);
    S.cat  = clamp(S.cat, 12, 40, DEF.cat);
    S.head = clamp(S.head, 12, 40, DEF.head);
    S.dishBold = !!S.dishBold; S.catBold = !!S.catBold;
    S.outW = 3200;                       // ширина картинки всегда 3200 px и никогда не сужается
    S.minH = S.minH ? clamp(S.minH, 200, 8000, 0) : 0;
    S.maxH = S.maxH ? clamp(S.maxH, 200, 8000, 0) : 0;
    if (S.minH && S.maxH && S.minH > S.maxH) S.minH = S.maxH;
  };
  normalize();

  /* применяем настройки к готовой таблице прямо перед «фотографированием» */
  function applyStyle(el) {
    $$('th', el).forEach((th) => { if (th.textContent.trim()) th.style.fontSize = S.head + 'px'; });
    $$('td[rowspan]', el).forEach((td) => {
      td.style.fontSize = S.cat + 'px';
      td.style.fontWeight = S.catBold ? 'bold' : 'normal';
    });
    $$('td:not([rowspan])', el).forEach((td) => {
      td.style.fontSize = S.dish + 'px';
      td.style.fontWeight = S.dishBold ? 'bold' : 'normal';
    });
  }
  /* «максимум по высоте»: вместо уменьшения картинки (из-за этого были поля по бокам)
     уменьшаем саму таблицу: сначала вертикальные отступы в ячейках, потом (если не хватило) шрифт не более чем на 4 px.
     Ширина картинки при этом остаётся 3200 px. */
  function fitHeight(el) {
    if (!S.maxH) return;
    const scale = 3200 / (el.offsetWidth || 1600);      // во сколько раз картинка больше блока на странице
    const limit = S.maxH / scale;                        // допустимая высота блока в px страницы
    if (el.offsetHeight <= limit) return;
    const cells = $$('th, td', el);
    if (!cells.length) return;
    const setPad = (p) => cells.forEach((c) => { c.style.paddingTop = p + 'px'; c.style.paddingBottom = p + 'px'; });
    let pad = Math.round(parseFloat(getComputedStyle(cells[0]).paddingTop)) || 12;
    while (el.offsetHeight > limit && pad > 2) { pad--; setPad(pad); }
    let cut = 0;
    while (el.offsetHeight > limit && cut < 4) {
      cut++;
      $$('th', el).forEach((th) => { if (th.textContent.trim()) th.style.fontSize = Math.max(10, S.head - cut) + 'px'; });
      $$('td[rowspan]', el).forEach((td) => { td.style.fontSize = Math.max(10, S.cat - cut) + 'px'; });
      $$('td:not([rowspan])', el).forEach((td) => { td.style.fontSize = Math.max(10, S.dish - cut) + 'px'; });
    }
  }
  /* ширина всегда 3200; минимум по высоте добавляет фон сверху и снизу: выше макс — картинка уменьшается целиком,
     ниже мин — добавляется фон бланка сверху и снизу */
  function fitCanvas(c) {
    const tw = 3200;                                   // ширина фиксирована
    let th = Math.round(c.height * tw / c.width);
    // максимум по высоте больше НЕ уменьшает картинку (иначе по бокам появлялись поля)
    if (S.minH && th < S.minH) th = S.minH;            // минимум по высоте: добавляется фон сверху и снизу
    if (c.width === tw && c.height === th) return c;
    const out = document.createElement('canvas'); out.width = tw; out.height = th;
    const g = out.getContext('2d');
    g.fillStyle = '#f7eed8'; g.fillRect(0, 0, tw, th);
    g.imageSmoothingQuality = 'high';
    const k = tw / c.width, dw = c.width * k, dh = c.height * k;   // масштаб только по ширине
    g.drawImage(c, (tw - dw) / 2, (th - dh) / 2, dw, dh);
    return out;
  }
  (function wrapHtml2canvas() {
    const orig = window.html2canvas;
    if (typeof orig !== 'function') return;
    const wrapped = function (el, opts) {
      const mine = !!(el && el.id === 'jpegContainer');
      try {
        if (mine) {
          applyStyle(el);
          fitHeight(el);
          if (S.outW) opts = Object.assign({}, opts, { scale: S.outW / (el.offsetWidth || 1400) });
        }
      } catch (e) { console.warn('tools:', e); }
      const p = orig.call(this, el, opts);
      return mine ? p.then(fitCanvas) : p;
    };
    Object.assign(wrapped, orig);
    window.html2canvas = wrapped;
  })();

  /* =====================================================================
     Сборка JPEG через очередь (чтобы предпросмотр и выгрузка недели
     не портили друг другу общий контейнер) + подсчёт прогресса
     ===================================================================== */
  const prog = { active: false, total: 0, done: 0, label: '' };
  let chain = Promise.resolve();
  let rawBuildJpeg = null;

  function labelFor(a) {
    try { return fmtDate(a[0].serial, '.').slice(0, 5) + ' ' + mealName(a[2]); } catch (e) { return ''; }
  }
  async function counted(a, fn) {
    if (!prog.active) return fn();
    prog.label = labelFor(a); renderProgress();
    try { return await fn(); } finally { prog.done++; renderProgress(); }
  }
  (function wrapBuilders() {
    const oj = window.buildJpegByMeal, od = window.buildDocxDay;
    if (typeof oj === 'function') {
      rawBuildJpeg = (...a) => { const run = chain.then(() => oj.apply(window, a)); chain = run.catch(() => {}); return run; };
      window.buildJpegByMeal = (...a) => counted(a, () => rawBuildJpeg(...a));
    }
    if (typeof od === 'function') {
      window.buildDocxDay = (...a) => counted(a, () => od.apply(window, a));
    }
    const os = window.saveFile;
    if (typeof os === 'function') {
      window.saveFile = async function (...a) {
        const r = await os.apply(this, a);
        finishProgress(true);
        return r;
      };
    }
  })();

  /* =====================================================================
     4. ПРОГРЕСС ВЫГРУЗКИ
     ===================================================================== */
  let progEl = null, progHide = 0;
  function ensureProgress() {
    if (progEl) return progEl;
    progEl = document.createElement('div');
    progEl.className = 'tl-progress';
    progEl.innerHTML = '<div class="tl-progress-text"></div><div class="tl-progress-bar"><i></i></div>';
    document.body.appendChild(progEl);
    return progEl;
  }
  function renderProgress() {
    const el = ensureProgress();
    clearTimeout(progHide);
    el.classList.add('show');
    const pct = prog.total ? Math.min(100, Math.round((prog.done / prog.total) * 100)) : 0;
    const t = $('.tl-progress-text', el);
    if (prog.done >= prog.total) t.textContent = 'Упаковываю в ZIP…';
    else t.textContent = `Собираю ${prog.done + 1} из ${prog.total}` + (prog.label ? ` · ${prog.label}` : '');
    $('i', el).style.width = pct + '%';
  }
  function finishProgress(ok) {
    if (!prog.active) return;
    prog.active = false;
    const el = ensureProgress();
    if (ok) {
      $('.tl-progress-text', el).textContent = 'Готово ✓ Файл скачан';
      $('i', el).style.width = '100%';
      progHide = setTimeout(() => el.classList.remove('show'), 1800);
    } else {
      el.classList.remove('show');
    }
  }
  function countTotal() {
    try {
      const w = curWeek(); if (!w) return 0;
      let n = 0;
      for (let d = 0; d < 7; d++) {
        if (w.dates[d] == null) continue;
        for (const m of MEALS) {
          const list = w.blocks[m.k] || [];
          if (!list.length) continue;
          ensureSel(d, m.k, list);
          if (!window.sel[selKey(d, m.k)].size) continue;
          n++;
        }
      }
      return n;
    } catch (e) { return 0; }
  }
  // старт: ловим нажатие кнопок выгрузки до того, как сработает их обработчик
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('#weekDocx, #weekJpeg');
    if (!b) return;
    const total = countTotal();
    if (!total) return;               // «Нет данных» покажет сам сайт
    prog.active = true; prog.total = total; prog.done = 0; prog.label = '';
    renderProgress();
  }, true);
  // ошибка при сборке: прячем прогресс
  const msgEl = $('#msg');
  if (msgEl) {
    new MutationObserver(() => {
      if (prog.active && /^(Ошибка|Нет данных)/.test(msgEl.textContent || '')) finishProgress(false);
    }).observe(msgEl, { childList: true, characterData: true, subtree: true });
  }

  /* =====================================================================
     ПАНЕЛЬ ИНСТРУМЕНТОВ (над кнопками выгрузки)
     ===================================================================== */
  const panel = document.createElement('div');
  panel.className = 'tl-panel';
  panel.innerHTML = `
    <div class="tl-untr" id="tlUntr">
      <span class="tl-dot"></span>
      <span class="tl-untr-text" id="tlUntrText">Загрузите меню</span>
      <button type="button" class="tl-btn" id="tlNext">К следующему ›</button>
    </div>

    <details class="tl-det">
      <summary>🎛️ Вид JPEG: размер картинки и шрифт</summary>
      <div class="tl-presets" id="tlPresets"></div>
      <div class="tl-grid">
        <label class="tl-field"><span>Текст блюд <b id="tlDishV"></b></span>
          <input type="range" id="tlDish" min="14" max="36" step="1"></label>
        <label class="tl-field"><span>Категории (слева) <b id="tlCatV"></b></span>
          <input type="range" id="tlCat" min="14" max="36" step="1"></label>
        <label class="tl-field"><span>Заголовки колонок <b id="tlHeadV"></b></span>
          <input type="range" id="tlHead" min="14" max="36" step="1"></label>
        <div class="tl-checks">
          <label class="tl-check"><input type="checkbox" id="tlDishBold"> Жирный текст блюд</label>
          <label class="tl-check"><input type="checkbox" id="tlCatBold"> Жирные категории</label>
        </div>
      </div>
      <div class="tl-sub">Размер картинки в пикселях</div>
      <div class="tl-presets" id="tlSizes"></div>
      <div class="tl-grid">
        <label class="tl-field"><span>Ширина</span><input type="number" id="tlW" min="400" max="6000" step="10" placeholder="авто"></label>
        <label class="tl-field"><span>Мин. высота</span><input type="number" id="tlMinH" min="200" max="8000" step="10" placeholder="нет"></label>
        <label class="tl-field"><span>Макс. высота</span><input type="number" id="tlMaxH" min="200" max="8000" step="10" placeholder="нет"></label>
      </div>
      <p class="tl-hint">Высота всегда будет между минимумом и максимумом. Если блюд много и картинка выше максимума, она уменьшается целиком (шрифт мельче); если ниже минимума — добавляется фон бланка. Пустое поле = без ограничения.</p>
      <p class="tl-hint">Настройки запоминаются в браузере и применяются ко всем JPEG, в том числе при выгрузке недели.</p>
    </details>

    <button type="button" class="btn alt" id="tlPreviewBtn">👁️ Предпросмотр JPEG</button>
  `;
  function mountPanel() {
    const actions = $('#step2 .actions');
    if (actions) actions.before(panel);
    else (($('#step2') || $('main') || document.body)).appendChild(panel);
  }
  mountPanel();

  /* ---------- настройки: связываем ползунки ---------- */
  const el = (id) => document.getElementById(id);
  function syncUI() {
    el('tlDish').value = S.dish; el('tlDishV').textContent = S.dish + ' px';
    el('tlCat').value = S.cat;   el('tlCatV').textContent = S.cat + ' px';
    el('tlHead').value = S.head; el('tlHeadV').textContent = S.head + ' px';
    el('tlDishBold').checked = S.dishBold; el('tlCatBold').checked = S.catBold;
    el('tlW').value = S.outW || ''; el('tlMinH').value = S.minH || ''; el('tlMaxH').value = S.maxH || '';
    $$('.tl-sz', panel).forEach((c, i) => c.classList.toggle('on', SIZES[i].w === S.outW && SIZES[i].min === S.minH && SIZES[i].max === S.maxH));
    $$('.tl-chip:not(.tl-sz)', panel).forEach((c, i) => {
      const v = PRESETS[i].v;
      c.classList.toggle('on', Object.keys(v).every((k) => v[k] === S[k]));
    });
  }
  const presetBox = el('tlPresets');
  PRESETS.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tl-chip'; b.textContent = p.n;
    b.onclick = () => { Object.assign(S, p.v); changed(); };
    presetBox.appendChild(b);
  });
  SIZES.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tl-chip tl-sz'; b.textContent = p.n;
    b.onclick = () => { S.outW = p.w; S.minH = p.min; S.maxH = p.max; changed(); };
    el('tlSizes').appendChild(b);
  });
  el('tlW').addEventListener('change', () => { S.outW = +el('tlW').value || 0; changed(); });
  el('tlMinH').addEventListener('change', () => { S.minH = +el('tlMinH').value || 0; changed(); });
  el('tlMaxH').addEventListener('change', () => { S.maxH = +el('tlMaxH').value || 0; changed(); });
  let prevTimer = 0;
  function changed() {
    normalize(); store.set(S); syncUI();
    if (modal && !modal.classList.contains('hide')) { clearTimeout(prevTimer); prevTimer = setTimeout(() => renderPreview(), 350); }
  }
  [['tlDish', 'dish'], ['tlCat', 'cat'], ['tlHead', 'head']].forEach(([id, key]) => {
    el(id).addEventListener('input', () => { S[key] = +el(id).value; changed(); });
  });
  el('tlDishBold').addEventListener('change', () => { S.dishBold = el('tlDishBold').checked; changed(); });
  el('tlCatBold').addEventListener('change', () => { S.catBold = el('tlCatBold').checked; changed(); });
  syncUI();

  /* =====================================================================
     3. СЧЁТЧИК «БЕЗ ПЕРЕВОДА» + «К СЛЕДУЮЩЕМУ»
     ===================================================================== */
  let untrIdx = -1;
  const checkedRows = () => $$('#weekContainer .item').filter((r) => { const cb = $('input[type=checkbox]', r); return cb && cb.checked; });
  const pendingRows = () => checkedRows().filter((r) => $('input.dup', r));

  function updateCounter() {
    const box = el('tlUntr'), txt = el('tlUntrText'), btn = el('tlNext');
    const all = checkedRows(), need = pendingRows();
    if (!all.length) {
      txt.textContent = 'Нет отмеченных блюд'; box.classList.remove('warn'); btn.style.display = 'none'; return;
    }
    if (!need.length) {
      txt.textContent = `✅ Все ${all.length} отмеченных блюд переведены`; box.classList.remove('warn'); btn.style.display = 'none'; return;
    }
    txt.textContent = `Без перевода: ${need.length} из ${all.length} блюд`;
    box.classList.add('warn'); btn.style.display = '';
  }
  el('tlNext').onclick = () => {
    const rows = pendingRows(); if (!rows.length) return;
    untrIdx = (untrIdx + 1) % rows.length;
    const row = rows[untrIdx];
    row.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    const inp = $('input.dup', row);
    if (inp) setTimeout(() => inp.focus({ preventScroll: true }), 350);
    row.classList.remove('tl-flash'); void row.offsetWidth; row.classList.add('tl-flash');
    setTimeout(() => row.classList.remove('tl-flash'), 1600);
  };
  (function watchCards() {
    const cont = $('#weekContainer'); if (!cont) return;
    let t = 0;
    const sched = () => { clearTimeout(t); t = setTimeout(updateCounter, 140); };
    new MutationObserver(sched).observe(cont, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    cont.addEventListener('change', sched);
    updateCounter();
  })();

  /* =====================================================================
     2. ПРЕДПРОСМОТР JPEG
     ===================================================================== */
  let modal = null, combos = [], idx = 0, token = 0, curUrl = '', curBlob = null, curName = '';

  function buildCombos() {
    const out = [], w = curWeek(); if (!w) return out;
    for (let d = 0; d < 7; d++) {
      const serial = w.dates[d]; if (serial == null) continue;
      for (const m of MEALS) {
        const list = w.blocks[m.k] || []; if (!list.length) continue;
        ensureSel(d, m.k, list);
        if (!window.sel[selKey(d, m.k)].size) continue;
        out.push({ d, mk: m.k, serial, meal: m });
      }
    }
    return out;
  }

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal-overlay hide';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:1100px">
        <div class="modal-header">
          <h2>👁️ Предпросмотр JPEG</h2>
          <button class="modal-close" type="button" id="tlClose">&times;</button>
        </div>
        <div class="modal-body">
          <div class="tl-bar">
            <button type="button" class="tl-btn" id="tlPrev">‹</button>
            <select id="tlSel"></select>
            <button type="button" class="tl-btn" id="tlNextImg">›</button>
          </div>
          <div class="tl-stage"><img id="tlImg" alt="Предпросмотр"><div class="tl-busy" id="tlBusy">Собираю картинку…</div></div>
          <div class="tl-info" id="tlInfo"></div>
          <div class="tl-actions"><button type="button" class="btn" id="tlDl">⬇️ Скачать этот JPEG</button></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    $('#tlClose', modal).onclick = closePreview;
    modal.addEventListener('click', (e) => { if (e.target === modal) closePreview(); });
    document.addEventListener('keydown', (e) => {
      if (modal.classList.contains('hide')) return;
      if (e.key === 'Escape') closePreview();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
    $('#tlPrev', modal).onclick = () => step(-1);
    $('#tlNextImg', modal).onclick = () => step(1);
    $('#tlSel', modal).onchange = (e) => { idx = +e.target.value; renderPreview(); };
    $('#tlDl', modal).onclick = () => {
      if (!curUrl) return;
      const a = document.createElement('a');
      a.href = curUrl; a.download = curName || 'menu.jpg';
      document.body.appendChild(a); a.click(); a.remove();
    };
    return modal;
  }
  function step(dir) {
    if (!combos.length) return;
    idx = (idx + dir + combos.length) % combos.length;
    $('#tlSel', modal).value = idx;
    renderPreview();
  }
  function closePreview() {
    if (!modal) return;
    modal.classList.add('hide'); token++;
    if (curUrl) { URL.revokeObjectURL(curUrl); curUrl = ''; }
  }
  async function openPreview() {
    if (!rawBuildJpeg) { say('Предпросмотр недоступен: не найдена функция сборки JPEG.', true); return; }
    combos = buildCombos();
    if (!combos.length) { say('Нечего показывать: загрузите меню и отметьте блюда.', true); return; }
    ensureModal();
    const sel = $('#tlSel', modal);
    sel.innerHTML = combos.map((c, i) =>
      `<option value="${i}">${esc((dayName(c.serial) + ' ' + fmtDate(c.serial, '.')).trim())} · ${esc(c.meal.name)}</option>`).join('');
    idx = 0; sel.value = 0;
    modal.classList.remove('hide');
    renderPreview();
  }

  async function renderPreview() {
    const c = combos[idx]; if (!c || !modal) return;
    const my = ++token;
    const busy = $('#tlBusy', modal), img = $('#tlImg', modal), info = $('#tlInfo', modal);
    busy.classList.add('on');
    const w = curWeek();
    const dayObj = { w, col: 2 + c.d, serial: c.serial };
    let blob;
    try { blob = await rawBuildJpeg(dayObj, c.d, c.mk); }
    catch (e) { if (my === token) { busy.classList.remove('on'); info.innerHTML = `<div class="tl-warn">Ошибка: ${esc(e.message)}</div>`; } return; }
    if (my !== token) return;                      // пока собиралось, выбрали другое

    if (curUrl) URL.revokeObjectURL(curUrl);
    curBlob = blob; curUrl = URL.createObjectURL(blob);
    curName = fmtDate(c.serial, '_') + '_' + c.meal.name + '.jpg';
    img.onload = () => { if (my === token) { busy.classList.remove('on'); showInfo(c, img); } };
    img.src = curUrl;
  }

  function showInfo(c, img) {
    const info = $('#tlInfo', modal);
    const w = curWeek();
    const dayObj = { w, col: 2 + c.d, serial: c.serial };
    const list = w.blocks[c.mk] || [];
    const sel = window.sel[selKey(c.d, c.mk)];
    const picked = list.filter((i) => sel.has(i.key));
    let missing = [];
    try {
      missing = picked.filter((it) =>
        getCategoryGroup(c.mk, it.label, it.cat || '') === null && !/салатные овощи/i.test(it.label || ''));
    } catch (e) { /* ignore */ }
    const inPic = picked.length - missing.length;
    let html = `<div class="tl-meta">${img.naturalWidth}×${img.naturalHeight} px · в картинке ${inPic} из ${picked.length} отмеченных блюд</div>`;
    if (S.maxH && img.naturalHeight > S.maxH) html += `<div class="tl-warn">⚠️ Не удалось уложиться в ${S.maxH} px по высоте: сжимать таблицу дальше нельзя без потери читаемости. Увеличьте максимум или уберите часть блюд.</div>`;
    if (missing.length) {
      const names = missing.map((it) => {
        let ru = ''; try { ru = texts(dayObj, it).ru; } catch (e) { /* ignore */ }
        return `<li><b>${esc(it.label || '—')}</b>${ru ? ': ' + esc(ru) : ''}</li>`;
      }).join('');
      html += `<div class="tl-warn">⚠️ Не попали в картинку (подпись не подходит ни под одну группу):<ul>${names}</ul></div>`;
    }
    info.innerHTML = html;
  }
  el('tlPreviewBtn').onclick = openPreview;

  /* =====================================================================
     СТИЛИ (подстраиваются под тему сайта через его CSS-переменные)
     ===================================================================== */
  const css = document.createElement('style');
  css.textContent = `
  .tl-panel{margin:8px 0 20px;padding:18px;border:1px solid var(--line);border-radius:20px;background:var(--input-bg);display:grid;gap:14px}
  .tl-panel .btn{margin-top:0}
  .tl-untr{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .tl-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;background:var(--neon-2,#22c55e);box-shadow:0 0 12px var(--neon-2,#22c55e)}
  .tl-untr.warn .tl-dot{background:var(--neon-3,#f59e0b);box-shadow:0 0 12px var(--neon-3,#f59e0b);animation:tlBlink 1.6s ease-in-out infinite}
  @keyframes tlBlink{50%{opacity:.35}}
  .tl-untr-text{flex:1;min-width:170px;font-weight:700;font-size:15px}
  .tl-btn{padding:9px 16px;border:1px solid var(--line);border-radius:11px;background:var(--input-bg-hover);color:var(--ink);font:700 13px inherit;font-family:inherit;cursor:pointer;transition:all .2s}
  .tl-btn:hover{border-color:var(--neon);box-shadow:0 0 0 3px var(--ring)}
  .tl-det summary{cursor:pointer;font-weight:800;font-size:14px;color:var(--tag,var(--neon));list-style:none;user-select:none}
  .tl-det summary::-webkit-details-marker{display:none}
  .tl-det summary::after{content:"▾";margin-left:8px;display:inline-block;transition:transform .25s}
  .tl-det[open] summary::after{transform:rotate(180deg)}
  .tl-presets{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 6px}
  .tl-chip{padding:7px 14px;border:1px solid var(--line);border-radius:99px;background:transparent;color:var(--ink);font:700 13px inherit;font-family:inherit;cursor:pointer;transition:all .2s}
  .tl-chip:hover{border-color:var(--neon)}
  .tl-chip.on{background:var(--neon);border-color:var(--neon);color:#fff;box-shadow:0 6px 18px -6px var(--neon-glow)}
  .tl-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 26px;margin-top:12px}
  .tl-field{display:grid;gap:8px;font-size:13px;font-weight:700;color:var(--mute)}
  .tl-field b{color:var(--ink);float:right}
  .tl-field input[type=range]{width:100%;accent-color:var(--neon)}
  .tl-checks{display:grid;gap:10px;align-content:center}
  .tl-check{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:600;color:var(--ink);cursor:pointer}
  .tl-check input{width:18px;height:18px;accent-color:var(--neon)}
  .tl-hint{margin:12px 0 0;font-size:12.5px;color:var(--mute);line-height:1.5}
  .tl-flash{animation:tlFlash 1.5s ease-out}
  @keyframes tlFlash{0%{box-shadow:inset 0 0 0 2px var(--neon),0 0 0 0 var(--neon-glow);background:var(--ring)}100%{box-shadow:inset 0 0 0 2px transparent,0 0 0 16px transparent}}

  .tl-progress{position:fixed;left:50%;bottom:22px;z-index:10002;width:min(92vw,380px);padding:14px 18px;border-radius:16px;
    background:var(--modal-bg,var(--card-bg));color:var(--ink);border:1px solid var(--line);
    box-shadow:0 20px 50px -14px var(--neon-glow,rgba(0,0,0,.4));
    transform:translate(-50%,30px);opacity:0;pointer-events:none;transition:all .4s cubic-bezier(.2,.8,.2,1)}
  .tl-progress.show{transform:translate(-50%,0);opacity:1}
  .tl-progress-text{font-weight:700;font-size:14px;margin-bottom:10px}
  .tl-progress-bar{height:7px;border-radius:99px;background:var(--line);overflow:hidden}
  .tl-progress-bar i{display:block;height:100%;width:0;border-radius:99px;background:var(--grad,var(--neon));box-shadow:0 0 12px var(--neon-glow);transition:width .35s ease}

  .tl-bar{display:flex;gap:10px;align-items:center;margin-bottom:14px}
  .tl-bar select{flex:1;min-width:0}
  .tl-bar .tl-btn{padding:11px 18px;font-size:18px;line-height:1}
  .tl-stage{position:relative;min-height:240px;max-height:62vh;overflow:auto;border:1px solid var(--line);border-radius:14px;background:#f7eed8}
  .tl-stage img{display:block;width:100%;height:auto}
  .tl-busy{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:700;color:#2b5782;
    background:rgba(247,238,216,.88);opacity:0;pointer-events:none;transition:opacity .2s}
  .tl-busy.on{opacity:1}
  .tl-info{margin-top:14px;font-size:14px}
  .tl-meta{color:var(--mute);font-weight:600}
  .tl-warn{margin-top:10px;padding:12px 16px;border-radius:12px;border:1px solid var(--neon-3,#f59e0b);background:var(--input-bg);line-height:1.5}
  .tl-warn ul{margin:8px 0 0;padding-left:20px}
  .tl-actions{margin-top:16px}
  @media (max-width:600px){.tl-grid{grid-template-columns:1fr}.tl-panel{padding:14px}}
  `;
  document.head.appendChild(css);
})();
