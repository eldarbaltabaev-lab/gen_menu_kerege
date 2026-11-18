console.log("Файл script-translate.js успешно загружен");

// Безопасное хранилище (чтобы скрипт не падал, если браузер блокирует localStorage)
const safeStorage = {
  get: (k) => { try { return localStorage.getItem(k); } catch(e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch(e) { console.error(e); } },
  remove: (k) => { try { localStorage.removeItem(k); } catch(e) { console.error(e); } }
};

async function googleTranslate(text,target){
  if(!text||!text.trim())return null;
  try{
    const url=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
    const r=await fetch(url);
    if(r.ok){
      const d=await r.json();
      if(Array.isArray(d)&&Array.isArray(d[0]))return d[0].map(x=>x[0]).join('');
    }
  }catch(e){console.warn("Google error:",e);}
  try{
    const r2=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ru|${target}`);
    const d2=await r2.json();
    if(d2&&d2.responseData&&d2.responseData.translatedText)return d2.responseData.translatedText;
  }catch(e){console.warn("MyMemory error:",e);}
  return null;
}

function collectWeekItems(){
  const w=window.weeks[window.cur.week];
  if(!w) return {itemList: [], uniqueTexts: []};
  const itemList=[]; const textSet=new Set();
  
  for(let day=0;day<7;day++){
    const serial=w.dates[day];if(serial==null)continue;
    const dayObj={w,col:2+day,serial};
    for(const meal of MEALS){
      const list=w.blocks[meal.k]||[];
      ensureSel(day,meal.k,list);
      const sk=selKey(day,meal.k);
      for(const it of list){
        if(!window.sel[sk].has(it.key))continue;
        const t=texts(dayObj,it);
        if(!t.ru)continue;

        // Проверяем глобальную память по русскому тексту
        const mem = window.TM.get(t.ru.trim());
        
        // Нужно ли переводить, если в Excel пусто ИЛИ в памяти пусто
        const needKk = (!t.kk || t.kk === t.ru) && !mem['kk'];
        const needEn = (!t.en || t.en === t.ru || /[А-Яа-яЁё]/.test(t.en)) && !mem['en'];

        // Если в памяти уже есть, сразу применяем к этой ячейке
        if (mem['kk']) window.overrides['kk|'+t.ru.trim()] = mem['kk'];
        if (mem['en']) window.overrides['en|'+t.ru.trim()] = mem['en'];

        if(!needKk && !needEn) continue; // Если переводить не нужно, идем дальше

        textSet.add(t.ru);
        itemList.push({day,meal:meal.k,it,ruText:t.ru,needKk,needEn});
      }
    }
  }
  return {itemList,uniqueTexts:[...textSet],w};
}

function applyTranslations(itemList,kkMap,enMap){
  for(const {day,it,ruText,needKk,needEn} of itemList){
    if(needKk && kkMap[ruText]) {
        console.log(`Сохраняю казахский: "${ruText}" -> "${kkMap[ruText]}"`); 
        window.overrides['kk|'+ruText] = kkMap[ruText];
        window.TM.set(ruText, 'kk', kkMap[ruText]);
    }
    if(needEn && enMap[ruText]) {
        console.log(`Сохраняю английский: "${ruText}" -> "${enMap[ruText]}"`); 
        window.overrides['en|'+ruText] = enMap[ruText];
        window.TM.set(ruText, 'en', enMap[ruText]);
    }
  }
}

/* ====== GOOGLE ====== */
const btnGoogle = document.getElementById('translateBtn');
if(btnGoogle) {
  btnGoogle.addEventListener('click', async function(){
    console.log("Клик по кнопке Google");
    this.disabled=true;
    try{
      const {itemList,uniqueTexts}=collectWeekItems();
      if(!itemList.length){say('Нечего переводить — всё заполнено.');return;}
      const kkMap={},enMap={};
      const needsKkSet=new Set(),needsEnSet=new Set();
      itemList.forEach(x=>{if(x.needKk)needsKkSet.add(x.ruText);if(x.needEn)needsEnSet.add(x.ruText);});

      for(let i=0;i<uniqueTexts.length;i++){
        const t=uniqueTexts[i];
        const nK=needsKkSet.has(t),nE=needsEnSet.has(t);
        if(!nK&&!nE)continue;
        say(`Google: ${i+1}/${uniqueTexts.length} — "${t.slice(0,30)}…"`);
        if(nK){const kk=await googleTranslate(t,'kk');if(kk){kkMap[t]=kk; window.TM.set(t, 'kk', kk);}}
        if(nE){const en=await googleTranslate(t,'en');if(en){enMap[t]=en; window.TM.set(t, 'en', en);}}
        await new Promise(r=>setTimeout(r,300));
      }
      applyTranslations(itemList,kkMap,enMap);
      renderWeek();
      say(`Готово (Google): переведено ${Object.keys(kkMap).length+Object.keys(enMap).length} текстов.`);
    }catch(e){say('Ошибка Google: '+e.message,true); console.error(e);}
    finally{this.disabled=false;}
  });
}

async function aiTranslateBatch(items, target) {
  const apiKey = safeStorage.get('gemini_api_key');
  if (!apiKey) throw new Error('Сначала нажми «⚙️ Настроить ИИ».');
  
  const langName = target === 'kk' ? 'казахский' : 'английский';
  const prompt = `Переведи названия блюд с русского на ${langName}. 
Верни результат СТРОГО в формате JSON-объекта, где ключ - это оригинальный русский текст, а значение - перевод на ${langName}.
Не добавляй лишнего текста, только JSON.
Исходный список: ${JSON.stringify(items)}`;

  // МАССИВ МОДЕЛЕЙ ДЛЯ ПЕРЕБОРА
  const modelsToTry = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-1.5-flash'
  ];

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    
    // ТЕПЕРЬ ТЫ УВИДИШЬ В КОНСОЛИ, КАКУЮ МОДЕЛЬ ОН ПРОБУЕТ
    console.log(`[ИИ] Пробую модель: ${currentModel}...`);
    
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: prompt }] }], 
          generationConfig: { temperature: 0.1 } 
        })
      });

      // Если лимит 429 (Too Many Requests)
      if (res.status === 429) {
        console.warn(`[ИИ] Модель ${currentModel} уперлась в лимит 429. Ждем 3 сек и переключаемся на следующую...`);
        await new Promise(r => setTimeout(r, 3000)); // Ждем 3 секунды
        continue; // Идем к следующей модели в списке
      }

      // Если 404 (нет модели) или 503 (перегрузка)
      if (!res.ok) {
        console.warn(`[ИИ] Модель ${currentModel} не сработала (HTTP ${res.status}). Переключаюсь...`);
        continue; 
      }
      
      const data = await res.json();
      let text = data.candidates[0].content.parts[0].text.trim();
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      const m = text.match(/\{[\s\S]*\}/); 
      if (!m) throw new Error('ИИ вернул не JSON: ' + text.slice(0, 50));
      
      console.log(`[ИИ] УСПЕХ! Переведено через модель: ${currentModel}`);
      return JSON.parse(m[0]); 
      
    } catch (err) {
      console.warn(`[ИИ] Ошибка на модели ${currentModel}: ${err.message}`);
      if (i === modelsToTry.length - 1) {
        throw new Error('Все модели ИИ недоступны или перегружены. Попробуйте позже.');
      }
    }
  }
}
async function aiTranslateSafe(items,target){
  try{return await aiTranslateBatch(items,target);}
  catch(e){
    if(items.length>40){
      say(`Партия слишком большая — делю на 2 части…`);
      await new Promise(r=>setTimeout(r,1500));
      const half=Math.ceil(items.length/2);
      const a=await aiTranslateBatch(items.slice(0,half),target);
      await new Promise(r=>setTimeout(r,1500));
      const b=await aiTranslateBatch(items.slice(half),target);
      return [...a,...b];
    }
    throw e;
  }
}

const btnAi = document.getElementById('translateAiBtn');
if(btnAi) {
  btnAi.addEventListener('click', async function(){
    this.disabled=true;
    try{
      if(!safeStorage.get('gemini_api_key')){say('Сначала нажми «⚙️ Настроить ИИ».',true);return;}
      const {itemList,uniqueTexts}=collectWeekItems();
      if(!itemList.length){say('Нечего переводить.');return;}
      
      const kkMap={},enMap={};
      const needsKkSet=new Set(),needsEnSet=new Set();
      itemList.forEach(x=>{if(x.needKk)needsKkSet.add(x.ruText);if(x.needEn)needsEnSet.add(x.ruText);});

      say(`ИИ: перевожу ${uniqueTexts.length} текстов…`);
      
      if(needsKkSet.size){
        say('ИИ: казахский…');
        const kkObj = await aiTranslateSafe(uniqueTexts, 'kk');
        // Читаем объект
        for (const [ru, translated] of Object.entries(kkObj)) {
            kkMap[ru] = translated;
            window.TM.set(ru, 'kk', translated);
        }
      }
      
      if(needsEnSet.size){
        say('ИИ: английский…');
        await new Promise(r=>setTimeout(r,1200));
        const enObj = await aiTranslateSafe(uniqueTexts, 'en');
        // Читаем объект
        for (const [ru, translated] of Object.entries(enObj)) {
            enMap[ru] = translated;
            window.TM.set(ru, 'en', translated);
        }
      }
      
      // Добавим проверку, что мы реально что-то сохранили
      console.log("Сохранено в казахский:", kkMap);
      console.log("Сохранено в английский:", enMap);
      
      applyTranslations(itemList,kkMap,enMap);
      renderWeek();
      say(`Готово (ИИ): переведено ${itemList.length} строк.`);
    }catch(e){say('Ошибка ИИ: '+e.message,true); console.error(e);}
    finally{this.disabled=false;}
  });
}

/* ====== КЛЮЧ ИИ ====== */
const keyBtn=document.getElementById('aiKeyBtn');
function updateKeyBtnState(){
  if(!keyBtn) return;
  const k=safeStorage.get('gemini_api_key');
  if(k){keyBtn.textContent='🔒 Ключ сохранён';keyBtn.style.color='var(--mute)';}
  else{keyBtn.textContent='⚙️ Настроить ИИ (API-ключ)';keyBtn.style.color='';}
}
updateKeyBtnState();

if(keyBtn) {
  keyBtn.addEventListener('click',function(){
    console.log("Клик по кнопке ключа");
    try {
      const cur=safeStorage.get('gemini_api_key')||'';
      if(cur){
        if(!confirm('Ключ уже сохранён. Удалить и ввести новый?'))return;
        safeStorage.remove('gemini_api_key');
        updateKeyBtnState();say('Ключ удалён.');return;
      }
      const key=prompt('Вставь API-ключ Google Gemini:');
      if(key===null)return;
      if(key.trim()===''){say('Ключ не введён.',true);return;}
      safeStorage.set('gemini_api_key',key.trim());
      updateKeyBtnState();say('Ключ сохранён.');
    } catch(err) {
      alert("Браузер заблокировал окно ввода (prompt). Нажмите F12 -> Консоль и вставьте: localStorage.setItem('gemini_api_key', 'ВАШ_КЛЮЧ')");
    }
  });
}
// ===== ЛОГИКА СЛОВАРЯ И СПРАВКИ =====
const dictModal = document.getElementById('dictModal');
const helpModal = document.getElementById('helpModal');

// Открытие Словаря
document.getElementById('dictBtn').onclick = (e) => {
  e.stopPropagation(); // Останавливаем клик, чтобы он не закрыл окно сразу же
  helpModal.classList.add('hide'); // Закрываем справку, если открыта
  renderDictionary();
  dictModal.classList.remove('hide');
};

// Открытие Справки
document.getElementById('helpBtn').onclick = (e) => {
  e.stopPropagation();
  dictModal.classList.add('hide'); // Закрываем словарь, если открыт
  helpModal.classList.remove('hide');
};

// Закрытие по крестику (с остановкой события)
document.getElementById('closeDict').onclick = (e) => {
  e.stopPropagation();
  dictModal.classList.add('hide');
};

document.getElementById('closeHelp').onclick = (e) => {
  e.stopPropagation();
  helpModal.classList.add('hide');
};

// Закрытие по клику на темный фон вне окна
window.addEventListener('click', (e) => {
  if (e.target === dictModal) dictModal.classList.add('hide');
  if (e.target === helpModal) helpModal.classList.add('hide');
});

// ===== УДАЛЕНИЕ ИЗ СЛОВАРЯ =====
// Что удаляется: сохранённые переводы (память переводов) и ваши ручные правки казахского/английского
// для этих слов. Исправления названий в карточках и сам файл меню не затрагиваются.
let lastRemoved = null;       // то, что удалили в последний раз (для кнопки «Отменить»)
let lastRemovedCount = 0;

function persistDict() {
  safeStorage.set('translation_memory', JSON.stringify(window.TM.data));
  safeStorage.set('manual_overrides', JSON.stringify(window.overrides));
}

// list: массив русских слов; null = удалить всё. Возвращает удалённое, чтобы можно было отменить.
function dictRemove(list) {
  const set = list ? new Set(list.map(s => s.trim())) : null;
  const removed = { tm: {}, ov: {} };
  for (const k of Object.keys(window.TM.data)) {
    if (!set || set.has(k.trim())) { removed.tm[k] = window.TM.data[k]; delete window.TM.data[k]; }
  }
  for (const key of Object.keys(window.overrides || {})) {
    const p = key.split('|');
    if ((p.length === 2 || p.length === 3) && (p[0] === 'kk' || p[0] === 'en') && (!set || set.has(p[p.length - 1].trim()))) {
      removed.ov[key] = window.overrides[key]; delete window.overrides[key];
    }
  }
  window.TM._idx = null;
  persistDict();
  return removed;
}

function dictDeleteWords(list) {
  const removed = dictRemove(list);
  const words = new Set([
    ...Object.keys(removed.tm).map(k => k.trim()),
    ...Object.keys(removed.ov).map(k => k.split('|').pop().trim())
  ]);
  lastRemoved = words.size ? removed : null;
  lastRemovedCount = words.size;
  afterDictChange();
}

function dictUndo() {
  if (!lastRemoved) return;
  Object.assign(window.TM.data, lastRemoved.tm);
  Object.assign(window.overrides, lastRemoved.ov);
  window.TM._idx = null;
  persistDict();
  lastRemoved = null; lastRemovedCount = 0;
  afterDictChange();
}

function afterDictChange() {
  renderDictionary();
  if (typeof renderWeek === 'function') renderWeek();   // карточки сразу показывают, что осталось
}

// Панель над таблицей: счётчик, «Очистить словарь», «Отменить». Создаётся скриптом, index.html менять не нужно.
function ensureDictTools() {
  if (document.getElementById('dictTools')) return;
  const style = document.createElement('style');
  style.textContent = `
  .dict-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 28px 8px}
  .dict-count{flex:1;min-width:140px;font-size:13px;font-weight:600;color:var(--mute,#666)}
  .dict-tools button{padding:8px 14px;border:1px solid var(--line-strong,#bbb);border-radius:4px;background:transparent;
    font:700 13px inherit;font-family:inherit;cursor:pointer;transition:background-color .15s,color .15s,border-color .15s}
  .dict-clear{color:var(--warn,#c0392b)}
  .dict-clear:hover:not(:disabled){background:var(--warn,#c0392b);border-color:var(--warn,#c0392b);color:#fff}
  .dict-clear:disabled{opacity:.4;cursor:default}
  .dict-undo{color:var(--ink,#222)}
  .dict-undo:hover{background:var(--input-bg-hover,#eee);border-color:var(--neon,#1f3a6e)}
  .dict-del-cell{width:44px;text-align:center}
  .dict-del{width:34px;height:34px;border:1px solid transparent;border-radius:4px;background:transparent;
    cursor:pointer;font-size:16px;line-height:1;opacity:.55;transition:opacity .15s,background-color .15s,border-color .15s}
  .dict-del:hover{opacity:1;background:var(--input-bg-hover,#eee);border-color:var(--warn,#c0392b)}
  @media (max-width:768px){.dict-tools{margin:0 18px 6px}}`;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.id = 'dictTools'; bar.className = 'dict-tools';
  bar.innerHTML = '<span class="dict-count" id="dictCount"></span>' +
    '<button type="button" class="dict-undo" id="dictUndo" style="display:none"></button>' +
    '<button type="button" class="dict-clear" id="dictClear">🗑 Очистить словарь</button>';
  const sw = document.querySelector('#dictModal .dict-search-wrapper');
  if (sw) sw.after(bar);
  else { const mb = document.querySelector('#dictModal .modal-body'); if (mb) mb.before(bar); }

  // четвёртая колонка таблицы (кнопка удаления строки)
  const headRow = document.querySelector('#dictModal thead tr');
  if (headRow && headRow.children.length === 3) headRow.appendChild(document.createElement('th'));

  document.getElementById('dictUndo').onclick = dictUndo;
  document.getElementById('dictClear').onclick = () => {
    const shown = window.__dictShown || [];
    if (!shown.length) return;
    const field = document.getElementById('dictSearch');
    const q = field ? field.value.trim() : '';
    const msg = q
      ? 'Удалить найденные слова (' + shown.length + ') из словаря?\n\nИх переводы и ваши ручные правки переводов будут удалены.'
      : 'Очистить словарь целиком (слов: ' + window.__dictTotal + ')?\n\nБудут удалены все сохранённые переводы и ваши ручные правки переводов. ' +
        'Файл меню и исправления названий в карточках не пострадают. Сразу после очистки её можно отменить.';
    if (!confirm(msg)) return;
    dictDeleteWords(q ? shown : null);
  };
}

function updateDictTools(shown, total, query) {
  ensureDictTools();
  window.__dictTotal = total;
  const cnt = document.getElementById('dictCount'), clr = document.getElementById('dictClear'), und = document.getElementById('dictUndo');
  cnt.textContent = query ? 'Найдено: ' + shown + ' из ' + total : 'Слов в словаре: ' + total;
  clr.textContent = query ? '🗑 Удалить найденные (' + shown + ')' : '🗑 Очистить словарь';
  clr.disabled = shown === 0;
  und.style.display = lastRemoved ? '' : 'none';
  if (lastRemoved) und.textContent = '↶ Отменить удаление (' + lastRemovedCount + ')';
}

function renderDictionary() {
  const tbody = document.getElementById('dictBody');
  tbody.innerHTML = '';
  
  // Получаем текст поиска
  const searchInput = document.getElementById('dictSearch');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const combinedDict = {};
  
  // 1. Читаем из оперативной памяти
  if (window.TM && window.TM.data) {
    for (const ru in window.TM.data) {
      const cleanRu = ru.trim();
      if (!cleanRu) continue;
      if (!combinedDict[cleanRu]) combinedDict[cleanRu] = { kk: '', en: '' };
      
      const mem = window.TM.data[ru];
      if (mem && typeof mem === 'object') {
         if (typeof mem.kk === 'string') combinedDict[cleanRu].kk = mem.kk.trim();
         if (typeof mem.en === 'string') combinedDict[cleanRu].en = mem.en.trim();
      }
    }
  }
  
  // 2. Читаем оверрайды (ручные правки)
  if (window.overrides) {
    for (const key in window.overrides) {
      const parts = key.split('|');
      if (parts.length === 2 || parts.length === 3) {
        const lang = parts[0];
        const cleanRu = parts[parts.length - 1].trim();
        if (!cleanRu) continue;
        if (!combinedDict[cleanRu]) combinedDict[cleanRu] = { kk: '', en: '' };
        
        const val = window.overrides[key];
        if (typeof val === 'string') combinedDict[cleanRu][lang] = val.trim();
      }
    }
  }

  // ВОТ ЗДЕСЬ СОЗДАЕТСЯ МАССИВ validWords (он фильтрует и сортирует)
  const validWords = Object.keys(combinedDict).filter(ru => {
    const data = combinedDict[ru];
    const hasTranslation = data.kk !== '' || data.en !== '';
    if (!hasTranslation) return false;

    if (!query) return true;

    return ru.toLowerCase().includes(query) || 
           data.kk.toLowerCase().includes(query) || 
           data.en.toLowerCase().includes(query);
  }).sort((a,b) => a.localeCompare(b));
  const totalWords = Object.keys(combinedDict).filter(r => combinedDict[r].kk !== '' || combinedDict[r].en !== '').length;
  window.__dictShown = validWords;
  updateDictTools(validWords.length, totalWords, query);
  
  // Проверка на пустоту
  if (validWords.length === 0) {
    if (query) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color: #6b7280;">По запросу «${query}» ничего не найдено.</td></tr>`;
    } else {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Словарь пока пуст. Переведите меню.</td></tr>';
    }
    return;
  }

  // Отрисовка строк таблицы
  validWords.forEach(ru => {
    const data = combinedDict[ru];
    
    const tr = document.createElement('tr');
    
    // Русский
    const tdRu = document.createElement('td');
    const inRu = document.createElement('input');
    inRu.type = 'text'; inRu.value = ru; inRu.disabled = true;
    inRu.style.background = '#f3f4f6'; inRu.style.color = '#6b7280';
    tdRu.appendChild(inRu);
    
    // Казахский
    const tdKk = document.createElement('td');
    const inKk = document.createElement('input');
    inKk.type = 'text'; inKk.value = data.kk;
    inKk.onchange = () => {
      const v = inKk.value.trim();
      if (v) {
        window.overrides['kk|' + ru] = v;
        window.TM.set(ru, 'kk', v);
      } else {
        delete window.overrides['kk|' + ru];
      }
      localStorage.setItem('manual_overrides', JSON.stringify(window.overrides));
      if (typeof renderWeek === 'function') renderWeek(); 
    };
    tdKk.appendChild(inKk);
    
    // Английский
    const tdEn = document.createElement('td');
    const inEn = document.createElement('input');
    inEn.type = 'text'; inEn.value = data.en;
    inEn.onchange = () => {
      const v = inEn.value.trim();
      if (v) {
        window.overrides['en|' + ru] = v;
        window.TM.set(ru, 'en', v);
      } else {
        delete window.overrides['en|' + ru];
      }
      localStorage.setItem('manual_overrides', JSON.stringify(window.overrides));
      if (typeof renderWeek === 'function') renderWeek();
    };
    tdEn.appendChild(inEn);

    // Удаление строки (можно отменить кнопкой «Отменить удаление» над таблицей)
    const tdDel = document.createElement('td');
    tdDel.className = 'dict-del-cell';
    const btnDel = document.createElement('button');
    btnDel.type = 'button'; btnDel.className = 'dict-del'; btnDel.textContent = '🗑';
    btnDel.title = 'Удалить из словаря';
    btnDel.setAttribute('aria-label', 'Удалить «' + ru + '» из словаря');
    btnDel.onclick = () => dictDeleteWords([ru]);
    tdDel.appendChild(btnDel);

    tr.append(tdRu, tdKk, tdEn, tdDel);
    tbody.appendChild(tr);
  });
}
// Добавляем слушатель на поле поиска (один раз при загрузке скрипта)
const searchField = document.getElementById('dictSearch');
if (searchField) {
  searchField.addEventListener('input', () => {
    renderDictionary();
  });
}
// ===== ЛОГИКА ЧТО НОВОГО =====
const updateModal = document.getElementById('updateModal');
const updateBtn = document.getElementById('updateBtn');
const closeUpdate = document.getElementById('closeUpdate');

if (updateBtn) {
  updateBtn.onclick = (e) => {
    e.stopPropagation();
    // Закрываем другие окна, если они открыты
    dictModal.classList.add('hide');
    helpModal.classList.add('hide');
    
    updateModal.classList.remove('hide');
  };
}

if (closeUpdate) {
  closeUpdate.onclick = (e) => {
    e.stopPropagation();
    updateModal.classList.add('hide');
  };
}

// Закрытие по клику на фон
window.addEventListener('click', (e) => {
  if (e.target === updateModal) updateModal.classList.add('hide');
});
// ===== ПЕРЕКЛЮЧАТЕЛЬ ТЕМ =====
const themeToggleBtn = document.getElementById('themeToggle');
const currentTheme = localStorage.getItem('theme') || 'light';

// Устанавливаем тему при загрузке
if (currentTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
  themeToggleBtn.textContent = '☀️ Светлая';
}

// Обработчик клика
if (themeToggleBtn) {
  themeToggleBtn.onclick = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      themeToggleBtn.textContent = '🌙 Тёмная';
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      themeToggleBtn.textContent = '☀️ Светлая';
    }
  };
}



/* ====== DRAG & DROP ====== */
const dropZone=document.getElementById('drop-zone');
const fileInput=document.getElementById('file');
if(dropZone&&fileInput){
  ['dragenter','dragover'].forEach(ev=>dropZone.addEventListener(ev,e=>{
    e.preventDefault();e.stopPropagation();dropZone.classList.add('drag-over');
  },false));
  ['dragleave','dragend'].forEach(ev=>dropZone.addEventListener(ev,e=>{
    e.preventDefault();e.stopPropagation();dropZone.classList.remove('drag-over');
  },false));
  dropZone.addEventListener('drop',e=>{
    e.preventDefault();e.stopPropagation();dropZone.classList.remove('drag-over');
    const files=e.dataTransfer.files;
    if(files.length>0){
      try{const dt=new DataTransfer();dt.items.add(files[0]);fileInput.files=dt.files;}
      catch(err){fileInput.files=files;}
      fileInput.dispatchEvent(new Event('change',{bubbles:true}));
    }
  },false);
}
