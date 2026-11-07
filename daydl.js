/* =====================================================================
   daydl.js — скачивание одного дня или одного приёма пищи.
   Подключать ПОСЛЕ script.js, translater.js (и tools.js, если он есть):
     <script src="daydl.js"></script>

   Что добавляет на каждую карточку дня:
   • в каждом разделителе (Завтрак / Обед / Ужин) две кнопки: 📄 .docx и 🖼️ .jpeg
     — скачивается один файл;
   • внизу карточки «День .docx» и «День .jpeg» — все приёмы пищи этого дня одним ZIP
     (если приём пищи один, скачается просто файл).
   Берутся только отмеченные галочками блюда, как и при выгрузке недели.
   Использует готовые функции сайта, ничего в них не меняет.
   Если удалить файл, всё вернётся как было.
   ===================================================================== */
(() => {
  'use strict';
  const box = document.getElementById('weekContainer');
  if (!box) return;
  let busy = false;

  /* ---------- стили (подстраиваются под тему сайта) ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .dl-m{margin-left:auto;display:flex;gap:6px;position:relative;z-index:2}
  .dl-m button{width:34px;height:34px;padding:0;border:1px solid color-mix(in srgb,var(--mc,var(--ink)) 55%,transparent);border-radius:4px;background:var(--paper,#fff);font-size:16px;line-height:1;cursor:pointer;transition:transform .2s,background-color .2s,box-shadow .2s}
  .dl-m button:hover{transform:translateY(-2px);background:color-mix(in srgb,var(--mc,var(--neon)) 22%,var(--paper,#fff));box-shadow:0 6px 12px -6px rgba(0,0,0,.4)}
  .dl-foot{margin-top:auto;display:flex;gap:8px;padding:12px 14px;border-top:1px dotted var(--line-strong);background:var(--input-bg)}
  .dl-foot button{flex:1;padding:10px 8px;border:1px solid var(--line-strong);border-radius:4px;background:transparent;color:var(--ink);font:600 13px var(--sans,system-ui,sans-serif);cursor:pointer;transition:border-color .2s,background-color .2s,box-shadow .2s}
  .dl-foot button:hover{border-color:var(--neon);background:var(--input-bg-hover);box-shadow:inset 0 -3px 0 var(--shu,var(--neon))}
  .dl-busy [data-dl]{opacity:.45;pointer-events:none;cursor:progress}`;
  document.head.appendChild(css);

  /* ---------- вспомогательное: какой это день и какие приёмы пищи ---------- */
  function ctx(card) {
    const w = window.weeks && window.weeks[window.cur.week]; if (!w) return null;
    const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => w.dates[d] != null);
    const day = days[[...box.children].indexOf(card)]; if (day == null) return null;
    const keys = MEALS.filter((m) => (w.blocks[m.k] || []).length).map((m) => m.k);   // порядок как в карточке
    return { w, day, keys, dayObj: { w, col: 2 + day, serial: w.dates[day] } };
  }
  function pickedCount(c, k) {
    const list = c.w.blocks[k] || [];
    window.ensureSel(c.day, k, list);
    return window.sel[window.selKey(c.day, k)].size;
  }

  /* ---------- сама выгрузка ---------- */
  async function run(card, mode, onlyKey) {
    if (busy) return;
    const c = ctx(card); if (!c) return;
    const ready = (onlyKey ? [onlyKey] : c.keys).filter((k) => pickedCount(c, k));
    if (!ready.length) { window.say('Нет отмеченных блюд для выгрузки.', true); return; }
    busy = true; box.classList.add('dl-busy'); window.say('Собираю файлы…');
    try {
      const jpg = mode === 'jpg', stamp = window.fmt(c.dayObj.serial, '_'), files = [];
      for (const k of ready) {
        if (jpg) {
          const meal = MEALS.find((m) => m.k === k);
          files.push({ name: stamp + '_' + meal.name + '.jpg', data: await window.buildJpegByMeal(c.dayObj, c.day, k) });
        } else {
          files.push(await window.buildDocxDay(c.dayObj, c.day, k));
        }
      }
      if (files.length === 1) {
        if (jpg) saveBlob(files[0].name, files[0].data); else await saveFile(files[0].name, files[0].data);
      } else {
        const z = new JSZip(); files.forEach((f) => z.file(f.name, f.data));
        const zn = 'Меню_' + stamp + (jpg ? '_jpeg' : '') + '.zip';
        if (jpg) saveBlob(zn, await z.generateAsync({ type: 'blob' }));
        else await saveFile(zn, await z.generateAsync({ type: 'uint8array' }));
      }
    } catch (e) {
      window.say('Ошибка: ' + ((e && e.message) || e), true);
    } finally {
      busy = false; box.classList.remove('dl-busy');
    }
  }

  /* ---------- кнопки на карточках ---------- */
  function enhance() {
    [...box.children].forEach((card) => {
      if (!card.classList.contains('day-card') || card.dataset.dlOk) return;
      const c = ctx(card); if (!c) return;
      card.dataset.dlOk = 1;
      card.querySelectorAll('.meal-section').forEach((sec, i) => {
        const h = sec.querySelector('.meal-header'), k = c.keys[i]; if (!h || !k) return;
        const name = MEALS.find((m) => m.k === k).label;
        h.insertAdjacentHTML('beforeend',
          `<span class="dl-m"><button type="button" data-dl="docx" data-k="${k}" title="Скачать «${name}» (.docx)">📄</button>` +
          `<button type="button" data-dl="jpg" data-k="${k}" title="Скачать «${name}» (.jpeg)">🖼️</button></span>`);
      });
      card.insertAdjacentHTML('beforeend',
        '<div class="dl-foot"><button type="button" data-dl="docx" title="Все приёмы пищи этого дня">📄 День .docx</button>' +
        '<button type="button" data-dl="jpg" title="Все приёмы пищи этого дня">🖼️ День .jpeg</button></div>');
    });
  }
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dl]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    run(b.closest('.day-card'), b.dataset.dl, b.dataset.k || null);
  });
  new MutationObserver(() => requestAnimationFrame(enhance)).observe(box, { childList: true });
  enhance();
})();
