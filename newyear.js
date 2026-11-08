/* newyear.js — маленький счётчик «до Нового года» в шапке, салют и лепестки сакуры. Убери файл — сайт работает как раньше. */
(() => {
  const CELEB_DAYS = 14; /* сколько дней после 1 января писать «прошло» */
  /* сообщения: переносим в body, иначе стеклянная панель (backdrop-filter) «приклеивает» их к себе, а не к экрану */
  const msg = document.getElementById('msg');
  if (msg) {
    document.body.append(msg);
    /* пока идёт работа («Собираю…», «ИИ: казахский…», «Google: 3/40…»), сообщение не пропадает и крутит индикатор */
    const busy = /(…|\.\.\.)["»]?$/;
    setInterval(() => {
      const on = busy.test(msg.textContent.trim());
      msg.classList.toggle('ny-busy', on);
      if (on && !msg.dataset.show) msg.dataset.show = 1;
    }, 300);
  }
  const dock = document.querySelector('.dock'); if (!dock) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const plural = (n, f) => { const m = n % 100, k = n % 10; return m > 10 && m < 20 ? f[2] : k === 1 ? f[0] : k > 1 && k < 5 ? f[1] : f[2]; };

  const aur = document.createElement('div'); aur.className = 'ny-aur'; aur.innerHTML = '<i></i><i></i><i></i>' + Array.from({ length: 16 }, () => '<b style="left:' + rnd(0, 100).toFixed(1) + '%;--s:' + rnd(9, 17).toFixed(0) + 'px;--t:' + rnd(14, 26).toFixed(1) + 's;--d:-' + rnd(0, 24).toFixed(1) + 's;--dx:' + rnd(-25, 25).toFixed(0) + 'vw"></b>').join(''); document.body.prepend(aur);

  const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'btn alt ny-chip'; dock.prepend(chip);
  let prev = null;
  function tick() {
    const now = new Date(), y = now.getFullYear(), d0 = new Date(y, now.getMonth(), now.getDate());
    const after = now >= new Date(y, 0, 1) && now < new Date(y, 0, 1 + CELEB_DAYS);
    const ref = after ? new Date(y, 0, 1) : new Date(y + 1, 0, 1);
    const days = Math.round(Math.abs(ref - d0) / 864e5), w = plural(days, ['день', 'дня', 'дней']);
    chip.innerHTML = '<i class="jk">年</i>' + (after ? (days === 0 ? 'С Новым годом!' : 'С Новым годом · прошло <b>' + days + '</b> ' + w.replace('день', 'дн.').replace('дня', 'дн.').replace('дней', 'дн.'))
      : days === 0 ? 'Новый год сегодня!' : 'До Нового года <b>' + days + '</b> дн.');
    chip.title = after ? 'Нажмите, чтобы запустить салют' : 'Новый год: ' + ref.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    if (prev === false && after && !still) volley(26, 520); /* страница была открыта в полночь */
    prev = after;
  }

  /* ---- салют на прозрачном canvas ---- */
  const cv = document.createElement('canvas'); cv.id = 'fw'; document.body.append(cv);
  const g = cv.getContext('2d'); let W, H, P = [], raf = 0;
  const size = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; }; size(); addEventListener('resize', size);
  function burst(x, y) {
    const hue = [350, 42, 50, 200, 320, 150][(Math.random() * 6) | 0], ring = Math.random() < .4;
    for (let i = 0; i < 80; i++) {
      const a = i / 80 * 6.283 + rnd(-.05, .05), s = ring ? 4.2 : rnd(1.2, 5.6);
      P.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 1, d: rnd(.008, .017), c: 'hsl(' + (hue + rnd(-12, 12)) + ' 100% ' + rnd(58, 78) + '%)', s: rnd(1.4, 2.8) });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function loop() {
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter'; P = P.filter(p => p.l > 0);
    for (const p of P) { p.x += p.vx; p.y += p.vy; p.vx *= .985; p.vy = p.vy * .985 + .045; p.l -= p.d; g.globalAlpha = Math.max(p.l, 0); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 6.283); g.fill(); }
    g.globalAlpha = 1;
    if (P.length) raf = requestAnimationFrame(loop); else { raf = 0; g.clearRect(0, 0, W, H); }
  }
  function volley(n, gap) { if (still) return; for (let i = 0; i < n; i++) setTimeout(() => burst(rnd(.12, .88) * W, rnd(.1, .5) * H), i * gap); }
  chip.addEventListener('click', () => volley(7, 260));

  tick(); setInterval(tick, 30000); document.addEventListener('visibilitychange', tick);
  /* первый заход за день после Нового года: салют */
  const today = new Date().toDateString();
  if (prev && localStorage.getItem('nyShown') !== today) { localStorage.setItem('nyShown', today); setTimeout(() => volley(6, 420), 800); }
})();
