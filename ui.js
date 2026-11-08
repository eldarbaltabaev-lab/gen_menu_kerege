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
  function enhance() {
    box.querySelectorAll('.day-card:not([data-enh])').forEach(c => {
      c.dataset.enh = 1;
      c.querySelectorAll('.meal-header').forEach(h => {
        const t = h.textContent.trim().toLowerCase(), k = t.startsWith('зав') ? 'b' : t.startsWith('об') ? 'l' : 'd';
        h.dataset.meal = k; h.insertAdjacentHTML('beforeend', '<span class="mk" aria-hidden="true">' + ({ b: '朝', l: '昼', d: '夕' })[k] + '</span>');
      });
    });
  }
  if (box) {
    new MutationObserver(() => requestAnimationFrame(enhance)).observe(box, { childList: true });
    box.addEventListener('change', e => {
      const x = e.target; if (!x.matches('input[type=checkbox]')) return;
      x.classList.remove('pop'); void x.offsetWidth; if (x.checked) x.classList.add('pop');
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

  /* ---- кнопка темы: подпись меняет сам сайт, значок-кандзи подставляем после него ---- */
  const tg = $('#themeToggle');
  if (tg) {
    const paint = () => {
      if (tg.firstElementChild && tg.firstElementChild.classList.contains('jk')) return;
      const light = /светл/i.test(tg.textContent);
      tg.innerHTML = '<i class="jk ' + (light ? 'kin' : 'ink') + '">' + (light ? '日' : '月') + '</i>' + (light ? 'Светлая' : 'Тёмная');
    };
    new MutationObserver(paint).observe(tg, { childList: true }); paint();
  }

  /* ---- снегопад: canvas, готовые спрайты, пауза во вкладке в фоне ---- */
  const cv = document.createElement('canvas'); cv.id = 'snow'; document.body.prepend(cv);
  const g = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, F = [], SP = null, on = !still && localStorage.getItem('snow') !== 'off', raf = 0, last = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const sheet = s => { const c = document.createElement('canvas'); c.width = c.height = Math.ceil(s * dpr); const x = c.getContext('2d'); x.scale(dpr, dpr); return [c, x]; };

  /* пушистая точка: белая, с голубоватой каймой на светлой теме, чтобы была видна на снежном небе */
  function dotSprite(s, dark) {
    const [c, x] = sheet(s), r = s / 2, k = x.createRadialGradient(r, r, 0, r, r, r);
    if (dark) { k.addColorStop(0, 'rgba(255,255,255,.95)'); k.addColorStop(.45, 'rgba(232,242,255,.6)'); k.addColorStop(1, 'rgba(232,242,255,0)'); }
    else { k.addColorStop(0, 'rgba(255,255,255,1)'); k.addColorStop(.52, 'rgba(255,255,255,.95)'); k.addColorStop(.8, 'rgba(130,170,215,.55)'); k.addColorStop(1, 'rgba(130,170,215,0)'); }
    x.fillStyle = k; x.fillRect(0, 0, s, s); return c;
  }
  /* резная снежинка с шестью лучами */
  function crystalSprite(s, dark) {
    const [c, x] = sheet(s); x.translate(s / 2, s / 2); x.lineCap = 'round';
    const passes = dark ? [[1.5, 'rgba(240,247,255,.95)']] : [[3.2, 'rgba(110,155,205,.6)'], [1.5, '#fff']];
    for (const [w, col] of passes) {
      x.lineWidth = w; x.strokeStyle = col;
      for (let i = 0; i < 6; i++) {
        x.save(); x.rotate(i * Math.PI / 3); x.beginPath();
        x.moveTo(0, 0); x.lineTo(0, -s * .46);
        x.moveTo(0, -s * .2); x.lineTo(s * .12, -s * .31); x.moveTo(0, -s * .2); x.lineTo(-s * .12, -s * .31);
        x.moveTo(0, -s * .34); x.lineTo(s * .08, -s * .42); x.moveTo(0, -s * .34); x.lineTo(-s * .08, -s * .42);
        x.stroke(); x.restore();
      }
    }
    return c;
  }
  function sprites() {
    const dark = R.dataset.theme === 'dark';
    SP = { dots: [5, 8, 12, 17].map(s => ({ s, c: dotSprite(s, dark) })), cry: [16, 22, 28].map(s => ({ s, c: crystalSprite(s, dark) })) };
    F.forEach(pick);
  }
  function pick(p) { const sp = (p.cr ? SP.cry : SP.dots)[p.i]; p.sp = sp.c; p.s = sp.s; }
  function make(top) {
    const z = Math.random(), cr = Math.random() < .14;
    const p = { cr, i: cr ? Math.min(2, (z * 3) | 0) : z < .4 ? 0 : z < .7 ? 1 : z < .9 ? 2 : 3,
      x: rnd(0, W), y: top ? rnd(-40, -10) : rnd(0, H), z, v: .35 + z * 1.05, w: rnd(0, 6.28), ws: rnd(.006, .018),
      r: rnd(0, 6.28), rs: rnd(-.02, .02), a: .5 + z * .45 };
    if (SP) pick(p); return p;
  }
  function size() {
    W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.max(30, Math.min(80, Math.round(W / 20)));
    while (F.length < n) F.push(make(false)); F.length = n;
  }
  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min(3, (t - last) / 16.67) : 1; last = t;
    const wind = Math.sin(t / 3600) * .45 + Math.sin(t / 1300) * .12;
    g.clearRect(0, 0, W, H);
    for (const p of F) {
      p.y += p.v * dt; p.w += p.ws * dt; p.x += (Math.sin(p.w) * .35 + wind * (.4 + p.z)) * dt; p.r += p.rs * dt;
      if (p.y > H + 30) { Object.assign(p, make(true)); }
      else if (p.x > W + 30) p.x = -30; else if (p.x < -30) p.x = W + 30;
      g.globalAlpha = p.a;
      if (p.cr) { g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.drawImage(p.sp, -p.s / 2, -p.s / 2, p.s, p.s); g.restore(); }
      else g.drawImage(p.sp, p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    g.globalAlpha = 1;
  }
  function run() { cancelAnimationFrame(raf); last = 0; if (on && !document.hidden) raf = requestAnimationFrame(loop); else g.clearRect(0, 0, W, H); }
  sprites(); size(); addEventListener('resize', size); document.addEventListener('visibilitychange', run);
  new MutationObserver(sprites).observe(R, { attributes: true, attributeFilter: ['data-theme'] });
  const sb = $('#snowBtn');
  if (sb) {
    const sync = () => { sb.setAttribute('aria-pressed', on); };
    sb.onclick = () => { on = !on; localStorage.setItem('snow', on ? 'on' : 'off'); sync(); run(); };
    sync();
  }
  run();
})();
