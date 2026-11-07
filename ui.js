/* ui.js — украшения и удобства. Ничего не ломает: если файл убрать, сайт работает как раньше. */
(() => {
  const R = document.documentElement, $ = s => document.querySelector(s);
  R.classList.add('ui');

  /* ---- всплывающие сообщения (say() пишет в #msg) ---- */
  const msg = $('#msg'); let tm;
  if (msg) {
    new MutationObserver(() => {
      if (!msg.textContent.trim()) return;
      msg.dataset.show = 1; clearTimeout(tm);
      tm = setTimeout(() => delete msg.dataset.show, 6000);
    }).observe(msg, { childList: true, characterData: true, subtree: true });
    msg.onclick = () => { delete msg.dataset.show; };
  }

  /* ---- карточки дней: счётчик блюд и кнопка «все / снять» ---- */
  const box = $('#weekContainer');
  const boxes = c => [...c.querySelectorAll('input[type=checkbox]')];
  function upd(c) {
    const b = boxes(c), n = b.filter(x => x.checked).length;
    c.querySelector('.dc-n').textContent = n + ' из ' + b.length;
    c.querySelector('.dc-all').textContent = n === b.length ? 'снять' : 'все';
    c.classList.toggle('is-off', !n);
  }
  function enhance() {
    box.querySelectorAll('.day-card:not([data-enh])').forEach(c => {
      c.dataset.enh = 1;
      c.querySelectorAll('.meal-header').forEach(h => {
        const t = h.textContent.trim().toLowerCase(), k = t.startsWith('зав') ? 'b' : t.startsWith('об') ? 'l' : 'd';
        h.dataset.meal = k; h.insertAdjacentHTML('beforeend', '<span class="mk" aria-hidden="true">' + ({ b: '朝', l: '昼', d: '夕' })[k] + '</span>');
      });
      const t = document.createElement('span'); t.className = 'dc-tools';
      t.innerHTML = '<b class="dc-n"></b><button type="button" class="dc-all" title="Отметить все блюда дня или снять отметки"></button>';
      c.querySelector('.day-header').append(t); upd(c);
    });
  }
  if (box) {
    new MutationObserver(() => requestAnimationFrame(enhance)).observe(box, { childList: true });
    box.addEventListener('change', e => {
      const c = e.target.closest('.day-card'); if (!c || !c.dataset.enh) return;
      upd(c);
      const x = e.target; x.classList.remove('pop'); void x.offsetWidth; if (x.checked) x.classList.add('pop');
      const n = c.querySelector('.dc-n'); n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump');
    });
    box.addEventListener('click', e => {
      const a = e.target.closest('.dc-all'); if (!a) return;
      const b = boxes(a.closest('.day-card')), on = b.some(x => !x.checked);
      b.forEach(x => { if (x.checked !== on) x.click(); });   // click вызывает штатный обработчик сайта
    });
    /* стрелки ← → листают дни, пока не печатаешь и нет открытых окон */
    addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input,select,textarea')) return;
      if ($('.modal-overlay:not(.hide)')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft')
        box.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * 340, behavior: 'smooth' });
    });
  }

  /* ---- волна чернил от нажатия на кнопку ---- */
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn'); if (!b || b.disabled) return;
    const r = b.getBoundingClientRect(), s = document.createElement('span');
    s.className = 'rip'; s.style.left = e.clientX - r.left + 'px'; s.style.top = e.clientY - r.top + 'px';
    b.append(s); setTimeout(() => s.remove(), 650);
  });

  /* ---- лепестки сакуры (canvas, на паузе во вкладке в фоне) ---- */
  const cv = document.createElement('canvas'); cv.id = 'sakura'; document.body.prepend(cv);
  const g = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, P = [], on = !still && localStorage.getItem('sakura') !== 'off', raf = 0;
  const mk = top => ({ x: Math.random() * W, y: top ? -20 : Math.random() * H, s: 6 + Math.random() * 7, v: .3 + Math.random() * .5,
    w: Math.random() * 6.28, ws: .008 + Math.random() * .012, r: Math.random() * 6.28, rs: (Math.random() - .5) * .02, a: .3 + Math.random() * .4 });
  function size() {
    W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.max(10, Math.min(26, Math.round(W / 60)));
    while (P.length < n) P.push(mk(false)); P.length = n;
  }
  function loop() {
    g.clearRect(0, 0, W, H);
    const dark = R.dataset.theme === 'dark'; g.fillStyle = dark ? '#f2bfce' : '#e8a0b3';
    for (const p of P) {
      p.y += p.v; p.w += p.ws; p.x += Math.sin(p.w) * .5 + .15; p.r += p.rs;
      if (p.y > H + 20 || p.x > W + 20) Object.assign(p, mk(true));
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = p.a * (dark ? .75 : 1);
      g.beginPath(); g.moveTo(0, -p.s);
      g.bezierCurveTo(p.s * .9, -p.s * .6, p.s * .7, p.s * .6, 0, p.s * .5);
      g.bezierCurveTo(-p.s * .7, p.s * .6, -p.s * .9, -p.s * .6, 0, -p.s); g.fill(); g.restore();
    }
    raf = requestAnimationFrame(loop);
  }
  function run() { cancelAnimationFrame(raf); if (on && !document.hidden) raf = requestAnimationFrame(loop); else g.clearRect(0, 0, W, H); }
  size(); addEventListener('resize', size); document.addEventListener('visibilitychange', run);
  const sb = $('#sakuraBtn');
  if (sb) {
    const sync = () => { sb.setAttribute('aria-pressed', on); };
    sb.onclick = () => { on = !on; localStorage.setItem('sakura', on ? 'on' : 'off'); sync(); run(); };
    sync();
  }
  run();
})();
