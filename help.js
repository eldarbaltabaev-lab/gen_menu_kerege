
(() => {
  'use strict';
  const CONTACT = { whatsapp: '77023471267', email: 'eldarbaltabaev2006@gmail.com' };

  const $ = (id) => document.getElementById(id);
  const wa = $('helpWa'), mail = $('helpMail'), text = $('helpText'), name = $('helpName'), hint = $('helpHint');
  if (!wa || !mail || !text) return;

  const phone = String(CONTACT.whatsapp || '').replace(/\D/g, '');
  const email = String(CONTACT.email || '').trim();
  if (!phone) wa.hidden = true;
  if (!email) mail.hidden = true;
  if (!phone && !email) {
    text.disabled = true; name.disabled = true;
    hint.textContent = 'Форма пока не настроена. Напишите разработчику через портфолио (ссылка ниже).';
  }

  function compose() {
    const q = text.value.trim();
    if (q.length < 5) {
      text.focus();
      if (typeof window.say === 'function') window.say('Напишите вопрос чуть подробнее.', true);
      else hint.textContent = 'Напишите вопрос чуть подробнее.';
      return null;
    }
    const who = name.value.trim();
    return 'Вопрос по сайту «Меню»' + (who ? '\nОт: ' + who : '') + '\n\n' + q;
  }

  wa.addEventListener('click', () => {
    const msg = compose(); if (!msg) return;
    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });
  mail.addEventListener('click', () => {
    const msg = compose(); if (!msg) return;
    location.href = 'mailto:' + email + '?subject=' + encodeURIComponent('Вопрос по сайту «Меню»') + '&body=' + encodeURIComponent(msg);
  });
})();
