/* blizzard.js — снежная буря при открытии сайта.
   Налетает один раз при каждом открытии/перезагрузке страницы. Привязана к кнопке «Снег» (#snowBtn):
   выключили снег — буря сразу стихает, а если снег выключен с прошлого раза, бури не будет. Подключать последним: <script src="blizzard.js"></script>
   Уважает «уменьшить анимацию» в системе. Убери файл — сайт работает как раньше. */
(() => {
  'use strict';
  const btn = document.getElementById('snowBtn');
  const msg = document.getElementById('msg');
  if (!btn) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const DUR = 11000;                  /* сколько длится буря, мс */
  const RISE = 0.22, FALL = 0.35;    /* доли времени: нарастание и затухание */
  const MAX = innerWidth < 700 ? 420 : 900;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const isOn = () => btn.getAttribute('aria-pressed') !== 'false';

  /* стили внутри файла: холст поверх страницы, но под салютом (#fw, z-index 60) и не мешает кликам */
  const css = document.createElement('style');
  css.textContent =
    '#blizzard,#blizzardHaze{position:fixed;inset:0;width:100%;height:100%;pointer-events:none}' +
    '#blizzard{z-index:55;display:none}#blizzard.on{display:block}' +
    '#blizzardHaze{z-index:54;opacity:0;transition:opacity .4s linear;' +
    'background:linear-gradient(100deg,rgba(255,255,255,.55),rgba(235,243,255,.25) 60%,rgba(255,255,255,.5))}' +
    '[data-theme="dark"] #blizzardHaze{background:linear-gradient(100deg,rgba(210,220,245,.22),rgba(150,170,220,.10) 60%,rgba(210,220,245,.2))}';
  document.head.append(css);

  /* холст и дымка */
  const cv = document.createElement('canvas');
  cv.id = 'blizzard';
  const haze = document.createElement('div');
  haze.id = 'blizzardHaze';
  document.body.append(haze, cv);
  const g = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size(); addEventListener('resize', size);

  let P = [], raf = 0, t0 = 0, last = 0, running = false, ending = false;

  /* сила бури 0..1 по времени */
  function power(t) {
    const k = t / DUR;
    if (k < RISE) return k / RISE;
    if (k < 1 - FALL) return 1;
    return Math.max(0, (1 - k) / FALL);
  }

  function spawn(pw) {
    /* слои: далёкие мелкие и медленные, близкие крупные и быстрые */
    const z = Math.random();
    const r = 0.9 + z * z * 4.2;
    P.push({
      x: rnd(-W * 0.4, W * 1.05),
      y: rnd(-40, -4),
      r,
      vx: (5 + z * 11) * (0.6 + pw * 0.9),        /* порывы ветра слева направо */
      vy: 1.2 + z * 3.2,
      ph: rnd(0, 6.283),
      sw: rnd(0.6, 1.8),
      a: 0.45 + z * 0.5
    });
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min((now - (last || now)) / 16.67, 3); last = now;
    const el = now - t0;
    const pw = ending ? 0 : power(el);
    if (!ending && el >= DUR) ending = true;

    /* порыв: ветер то усиливается, то стихает */
    const gust = 0.75 + 0.25 * Math.sin(el / 700) + 0.15 * Math.sin(el / 230);

    /* новые снежинки */
    if (!ending && P.length < MAX) {
      const n = Math.round(pw * 26 * dt);
      for (let i = 0; i < n; i++) spawn(pw);
    }

    g.clearRect(0, 0, W, H);
    const dark = document.documentElement.dataset.theme === 'dark' || document.body.dataset.theme === 'dark';
    g.fillStyle = dark ? '#f2f6ff' : '#ffffff';
    g.strokeStyle = dark ? 'rgba(200,215,255,.0)' : 'rgba(120,150,200,.35)';
    g.lineWidth = 0.8;

    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.ph += 0.03 * p.sw * dt;
      p.x += (p.vx * gust + Math.sin(p.ph) * 1.2) * dt;
      p.y += (p.vy + Math.cos(p.ph * 0.7) * 0.6) * dt;
      if (p.x > W + 20 || p.y > H + 20) { P.splice(i, 1); continue; }
      g.globalAlpha = p.a;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
      if (!dark && p.r > 2) g.stroke();
    }
    g.globalAlpha = 1;
    haze.style.opacity = (pw * 0.78 * (0.85 + 0.15 * gust)).toFixed(3);

    if (ending && !P.length) stop(true);
  }

  function start() {
    if (running || !isOn()) return;
    running = true; ending = false; P = [];
    t0 = performance.now(); last = 0;
    cv.classList.add('on');
    raf = requestAnimationFrame(frame);
  }

  /* quick=true — буря кончилась сама; иначе плавно гасим по нажатию кнопки */
  function stop(done) {
    if (!running) return;
    if (!done) { ending = true; P.forEach(p => { p.vy += 1.5; }); setTimeout(() => stop(true), 900); haze.style.opacity = 0; return; }
    running = false; cancelAnimationFrame(raf); raf = 0;
    g.clearRect(0, 0, W, H); P = [];
    cv.classList.remove('on'); haze.style.opacity = 0;
  }

  /* кнопка «Снег»: выключили — стихает, включили — налетает снова */
  let was = isOn();
  new MutationObserver(() => {
    const now = isOn();
    if (now === was) return;
    was = now;
    if (!now) stop(false);   /* включение кнопки новую бурю не запускает: она бывает один раз за открытие */
  }).observe(btn, { attributes: true, attributeFilter: ['aria-pressed'] });

  /* буря налетает один раз при каждом открытии или перезагрузке страницы;
     небольшая пауза нужна, чтобы сайт успел применить сохранённое состояние кнопки «Снег» */
  const go = () => setTimeout(start, 600);
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
})();
