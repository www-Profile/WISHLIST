// ============================================================
//  НАСТРОЙКИ API
// ============================================================
const SUPABASE_URL = 'https://cnrgmrwxglmkysqvvivh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DtksfpZ0Nn1-SJBbiyETfw_Ak8t807o';
const API_URL = `${SUPABASE_URL}/rest/v1/wishes`;

const CACHE_KEY = 'wishlist_data_cache';
let currentFilter = 'wanted';
let activeWishId = null;
let wishes = [];
const IMAGES_PATH = 'images/';
const currencySymbols = { RUB: '₽', USD: '$', EUR: '€' };

const wishList = document.getElementById('wish-list');
const emptyState = document.getElementById('empty-state');

// ============================================================
//  ОБРАТНЫЙ ОТСЧЁТ
// ============================================================
const BIRTHDAY = new Date(new Date().getFullYear(), 11, 6);
if (BIRTHDAY < new Date()) BIRTHDAY.setFullYear(BIRTHDAY.getFullYear() + 1);

function updateCountdown() {
  const diff = BIRTHDAY - new Date();
  if (diff <= 0) { document.getElementById('countdown-text').textContent = 'Сегодня'; return; }
  
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  const m = Math.floor((diff / 60000) % 60);
  
  const pad = n => String(n).padStart(2, '0');
  
  // Оборачиваем буквы в тег <small>
  document.getElementById('countdown-text').innerHTML = 
    `${pad(d)}<small>д</small> ${pad(h)}<small>ч</small> ${pad(m)}<small>м</small>`;
}
setInterval(updateCountdown, 1000); 
updateCountdown();

// ============================================================
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================
function formatPrice(price, currency) {
  if (!price) return '';
  const cur = currency || 'RUB';
  const symbol = currencySymbols[cur] || '₽';
  const formatted = Number(price).toLocaleString('ru-RU');
  return cur === 'RUB' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

function renderSkeletons() {
  emptyState.style.display = 'none';
  const card = `
    <div class="wish-card skeleton">
      <div class="sk-line sk-title"></div>
      <div class="sk-image"></div>
      <div class="sk-line sk-price"></div>
    </div>
  `;
  wishList.innerHTML = card.repeat(6);
  drawDividers();
}

// ============================================================
//  ЗАГРУЗКА И ОТРИСОВКА
// ============================================================
function renderWishes() {
  const filtered = wishes.filter(w => w.status === currentFilter);

  if (filtered.length === 0) {
    wishList.innerHTML = '';
    emptyState.style.display = '';
    return;
  }
  emptyState.style.display = 'none';

  wishList.innerHTML = filtered.map(w => {
    const imageHTML = w.image ? `<div class="wish-image"><img src="${IMAGES_PATH}${w.image}" alt="" loading="lazy"></div>` : '';
    const priceHTML = w.price ? `<div class="price">${formatPrice(w.price, w.currency)}</div>` : '';
    let extraClass = w.status === 'reserved' ? 'is-reserved' : '';

    return `
      <article class="wish-card ${extraClass}" data-id="${w.id}">
        <h3>${w.name}</h3>
        ${imageHTML}
        ${priceHTML}
      </article>
    `;
  }).join('');

  document.querySelectorAll('.wish-card').forEach(card => {
    card.addEventListener('click', () => openModal(Number(card.dataset.id)));
  });

  document.querySelectorAll('.wish-card img').forEach(img => {
    img.addEventListener('load', drawDividers);
    img.addEventListener('error', drawDividers);
  });

  drawDividers();
  observeCards();
}

async function loadWishes() {
  const cached = localStorage.getItem(CACHE_KEY);

  if (cached) {
    try {
      wishes = JSON.parse(cached);
      renderWishes();
    } catch(e) {}
  } else {
    renderSkeletons();
  }

  // ← Таймаут 12 секунд
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`${API_URL}?select=*&order=id.asc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error('Network error');

    wishes = await res.json();
    localStorage.setItem(CACHE_KEY, JSON.stringify(wishes));
    renderWishes();

  } catch (err) {
    clearTimeout(timeoutId);
    console.log('Работаем с локальными данными:', err.name);

    if (!cached) {
      wishList.innerHTML = '';
      emptyState.style.display = '';
      emptyState.querySelector('.empty-text').textContent =
        'Не удалось загрузить. Потяните вниз, чтобы обновить';
    }
  }
}

// ============================================================
//  ОСНОВНАЯ МОДАЛКА
// ============================================================
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalImage = document.getElementById('modal-image');
const modalPrice = document.getElementById('modal-price');
const modalDescription = document.getElementById('modal-description'); // Новая переменная
const modalLink = document.getElementById('modal-link');
const modalAction = document.getElementById('modal-action');

function openModal(id) {
  const wish = wishes.find(w => w.id === id);
  if (!wish) return;
  activeWishId = id;

  // Название
  modalTitle.textContent = wish.name;
  
  // Картинка
  if (wish.image) {
    modalImage.innerHTML = `<img src="${IMAGES_PATH}${wish.image}" alt="">`;
    modalImage.style.display = '';
  } else {
    modalImage.style.display = 'none';
  }

  // Цена
  modalPrice.textContent = wish.price ? formatPrice(wish.price, wish.currency) : '';

  // Описание (поддерживает и русское 'описание', и английское 'description')
  const desc = wish['описание'] || wish.description || '';
  modalDescription.textContent = desc;

  // Ссылка
  if (wish.url && wish.url !== 'ноль' && wish.url !== 'Ноль') {
    modalLink.href = wish.url;
    modalLink.style.display = '';
  } else {
    modalLink.style.display = 'none';
  }

  // Логика кнопки (Забронировать / Снять бронь)
  if (wish.status === 'wanted') {
    modalAction.textContent = 'Забронировать';
    modalAction.className = 'modal-action';
    modalAction.disabled = false;
  } else {
    modalAction.textContent = 'Снять бронь';
    modalAction.className = 'modal-action is-reserved';
    modalAction.disabled = false;
  }

  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
  activeWishId = null;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

// ============================================================
//  МОДАЛКА PIN-КОДА
// ============================================================
const pinOverlay = document.getElementById('pin-modal-overlay');
const pinInput = document.getElementById('pin-input');
const pinError = document.getElementById('pin-error');
const pinSubmit = document.getElementById('pin-submit');
let pinActionType = 'book';

function openPinModal(action) {
  pinActionType = action;
  pinInput.value = '';
  pinError.style.display = 'none';
  
  // СБРОС КНОПКИ (Возвращаем текст и включаем клики)
  pinSubmit.textContent = 'Подтвердить';
  pinSubmit.disabled = false;

  pinOverlay.querySelector('.modal-title').textContent = 
    action === 'book' ? 'Придумайте 4-значный код' : 'Введите ваш код';
  pinOverlay.querySelector('.modal-body p').textContent = 
    action === 'book' 
      ? 'Запомните его, чтобы потом отменить бронь!' 
      : 'Введите код, который вы указали при бронировании.';

  pinOverlay.classList.add('active');
  setTimeout(() => pinInput.focus(), 100);
}

function closePinModal() {
  pinOverlay.classList.remove('active');
  // СБРОС КНОПКИ (На случай, если закрыли во время загрузки)
  pinSubmit.textContent = 'Подтвердить';
  pinSubmit.disabled = false;
}

document.getElementById('pin-modal-close').addEventListener('click', closePinModal);
pinOverlay.addEventListener('click', e => { if (e.target === pinOverlay) closePinModal(); });

pinInput.addEventListener('input', () => {
  pinInput.value = pinInput.value.replace(/\D/g, '');
});

pinSubmit.addEventListener('click', async () => {
  const code = pinInput.value;
  pinError.style.display = 'none';

  if (code.length !== 4) {
    pinError.textContent = 'Код должен состоять из 4 цифр';
    pinError.style.display = 'block';
    return;
  }

  if (!activeWishId) return;
  const wish = wishes.find(w => w.id === activeWishId);
  if (!wish) return;

  pinSubmit.disabled = true;
  pinSubmit.textContent = 'Проверка...';

  if (pinActionType === 'cancel' && wish.reserved_by !== code) {
    pinError.textContent = 'Неверный код! Попробуйте снова.';
    pinError.style.display = 'block';
    pinSubmit.disabled = false;
    pinSubmit.textContent = 'Подтвердить';
    return;
  }

  const newStatus = pinActionType === 'book' ? 'reserved' : 'wanted';
  const newReservedBy = pinActionType === 'book' ? code : null;

  try {
    const res = await fetch(`${API_URL}?id=eq.${activeWishId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        status: newStatus,
        reserved_by: newReservedBy,
        reserved_at: newReservedBy ? new Date().toISOString() : null
      })
    });

    if (!res.ok) throw new Error();

    wish.status = newStatus;
    wish.reserved_by = newReservedBy;
    localStorage.setItem(CACHE_KEY, JSON.stringify(wishes));
    
    closePinModal();
    closeModal();
    renderWishes();

  } catch (err) {
    pinError.textContent = 'Ошибка соединения. Попробуйте позже.';
    pinError.style.display = 'block';
    pinSubmit.disabled = false;
    pinSubmit.textContent = 'Подтвердить';
  }
});

// ============================================================
//  ДЕЙСТВИЕ КНОПКИ В ОСНОВНОЙ МОДАЛКЕ
// ============================================================
modalAction.addEventListener('click', () => {
  if (!activeWishId) return;
  const wish = wishes.find(w => w.id === activeWishId);
  if (!wish) return;

  if (wish.status === 'wanted') {
    openPinModal('book');
  } else if (wish.status === 'reserved') {
    openPinModal('cancel');
  }
});

// ============================================================
//  ФИЛЬТРЫ И РАЗДЕЛИТЕЛИ
// ============================================================
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    
    // Если данные ещё не загрузились, показываем скелетоны
    if (wishes.length === 0) renderSkeletons();
    else renderWishes();
  });
});

function drawDividers() {
  document.querySelectorAll('.card-divider').forEach(el => el.remove());
  const cards = Array.from(document.querySelectorAll('.wish-card')).filter(c => c.style.display !== 'none');
  if (!cards.length) return;

  cards.forEach(card => {
    const s = getComputedStyle(card);
    const pt = parseFloat(s.paddingTop), pb = parseFloat(s.paddingBottom), pl = parseFloat(s.paddingLeft), pr = parseFloat(s.paddingRight);
    
    const r = document.createElement('div'); r.className = 'card-divider card-divider-right';
    r.style.cssText = `position:absolute;top:${pt}px;right:-2px;width:2px;height:${card.offsetHeight-pt-pb}px;background:#FF6347;border-radius:10px;z-index:1;`;
    card.appendChild(r);

    const b = document.createElement('div'); b.className = 'card-divider card-divider-bottom';
    b.style.cssText = `position:absolute;left:${pl}px;bottom:-2px;width:${card.offsetWidth-pl-pr}px;height:2px;background:#FF6347;border-radius:10px;z-index:1;`;
    card.appendChild(b);
  });

  const rows = {};
  cards.forEach(c => { const top = Math.round(c.getBoundingClientRect().top); (rows[top] ||= []).push(c); });
  const rowKeys = Object.keys(rows).map(Number).sort((a,b)=>a-b);

  rowKeys.forEach((top, ri) => {
    const row = rows[top], lastRow = ri === rowKeys.length - 1;
    row.forEach((card, ci) => {
      if (ci === row.length - 1) card.querySelector('.card-divider-right')?.remove();
      if (lastRow) card.querySelector('.card-divider-bottom')?.remove();
    });
  });
}

const cardObserver = new ResizeObserver(() => requestAnimationFrame(drawDividers));
function observeCards() {
  document.querySelectorAll('.wish-card').forEach(card => cardObserver.observe(card));
}
let resizeT; 
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(drawDividers, 150); });

// ============================================================
//  СТАРТ
// ============================================================
loadWishes();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}