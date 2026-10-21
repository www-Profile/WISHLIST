// ============================================================
//  НАСТРОЙКИ API
// ============================================================
const SUPABASE_URL = 'https://cnrgmrwxglmkysqvvivh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DtksfpZ0Nn1-SJBbiyETfw_Ak8t807o';
const API_URL = `${SUPABASE_URL}/rest/v1/wishes`;

// ============================================================
//  ID УСТРОЙСТВА (fingerprint)
// ============================================================
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function getUserId() {
  let id = localStorage.getItem('wishlist_user_id');
  if (!id) {
    const parts = [screen.width, screen.height, new Date().getTimezoneOffset(), navigator.language, navigator.platform, navigator.hardwareConcurrency];
    id = 'dev_' + hashString(parts.join('|'));
    localStorage.setItem('wishlist_user_id', id);
  }
  return id;
}
const USER_ID = getUserId();
const CACHE_KEY = 'wishlist_data_cache';

// ============================================================
//  ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================================
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
  const d = Math.floor(diff / 86400000), h = Math.floor((diff / 3600000) % 24), m = Math.floor((diff / 60000) % 60), s = Math.floor((diff / 1000) % 60);
  document.getElementById('countdown-text').textContent = `${d}д ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
setInterval(updateCountdown, 1000); updateCountdown();

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

// ==== СКЕЛЕТОНЫ ====
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
    const isMine = w.reserved_by === USER_ID;
    
    let extraClass = '';
    if (w.status === 'reserved') extraClass = isMine ? 'is-reserved is-mine' : 'is-reserved';

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

  // Следим за загрузкой картинок, чтобы обновить полоски
  document.querySelectorAll('.wish-card img').forEach(img => {
    img.addEventListener('load', drawDividers);
    img.addEventListener('error', drawDividers);
  });

  drawDividers();
  observeCards(); // Включаем ResizeObserver
}

async function loadWishes() {
  const cached = localStorage.getItem(CACHE_KEY);
  
  if (!cached) {
    renderSkeletons();
  } else {
    try { 
      wishes = JSON.parse(cached); 
      renderWishes(); 
    } catch(e) {}
  }

  let skeletonTimer;
  if (!cached) {
    skeletonTimer = setTimeout(() => {
      if (wishList.querySelector('.skeleton')) return;
      renderSkeletons();
    }, 300);
  }

  try {
    const res = await fetch(`${API_URL}?select=*&order=id.asc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    
    if (!res.ok) throw new Error('Network error');
    
    wishes = await res.json();
    localStorage.setItem(CACHE_KEY, JSON.stringify(wishes));
    
    clearTimeout(skeletonTimer);
    renderWishes();
    
  } catch (err) {
    console.log('Работаем с локальными данными.');
    clearTimeout(skeletonTimer);
    if (!cached) {
      wishList.innerHTML = '';
      emptyState.style.display = '';
    }
  }
}

// ============================================================
//  МОДАЛКА
// ============================================================
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalImage = document.getElementById('modal-image');
const modalPrice = document.getElementById('modal-price');
const modalLink = document.getElementById('modal-link');
const modalAction = document.getElementById('modal-action');

function openModal(id) {
  const wish = wishes.find(w => w.id === id);
  if (!wish) return;
  activeWishId = id;

  modalTitle.textContent = wish.name;
  
  if (wish.image) {
    modalImage.innerHTML = `<img src="${IMAGES_PATH}${wish.image}" alt="">`;
    modalImage.style.display = '';
  } else {
    modalImage.style.display = 'none';
  }

  modalPrice.textContent = wish.price ? formatPrice(wish.price, wish.currency) : '';

  if (wish.url && wish.url !== 'ноль' && wish.url !== 'Ноль') {
    modalLink.href = wish.url;
    modalLink.style.display = '';
  } else {
    modalLink.style.display = 'none';
  }

  const isMine = wish.reserved_by === USER_ID;
  if (wish.status === 'wanted') {
    modalAction.textContent = 'Забронировать';
    modalAction.className = 'modal-action';
    modalAction.disabled = false;
  } else if (wish.status === 'reserved' && isMine) {
    modalAction.textContent = 'Отменить бронь';
    modalAction.className = 'modal-action is-reserved';
    modalAction.disabled = false;
  } else {
    modalAction.textContent = 'Забронировано';
    modalAction.className = 'modal-action';
    modalAction.disabled = true;
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
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalOverlay.classList.contains('active')) closeModal(); });

// ============================================================
//  ДЕЙСТВИЕ
// ============================================================
modalAction.addEventListener('click', async () => {
  if (!activeWishId) return;
  const wish = wishes.find(w => w.id === activeWishId);
  if (!wish) return;

  let newStatus, newReservedBy;
  if (wish.status === 'wanted') {
    newStatus = 'reserved'; newReservedBy = USER_ID;
  } else if (wish.status === 'reserved' && wish.reserved_by === USER_ID) {
    newStatus = 'wanted'; newReservedBy = null;
  } else return;

  wish.status = newStatus; 
  wish.reserved_by = newReservedBy;
  closeModal(); 
  renderWishes();
  localStorage.setItem(CACHE_KEY, JSON.stringify(wishes));

  try {
    await fetch(`${API_URL}?id=eq.${activeWishId}`, {
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
  } catch (err) {
    alert('Ошибка синхронизации.');
  }
});

// ============================================================
//  ФИЛЬТРЫ
// ============================================================
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    
    if (wishes.length === 0) {
      renderSkeletons();
    } else {
      renderWishes();
    }
  });
});

// ============================================================
//  УМНЫЕ РАЗДЕЛИТЕЛИ (Без таймеров)
// ============================================================
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

// ResizeObserver — сам следит за изменением размера карточек
const cardObserver = new ResizeObserver(() => {
  // Используем requestAnimationFrame, чтобы не нагружать браузер
  requestAnimationFrame(drawDividers);
});

function observeCards() {
  document.querySelectorAll('.wish-card').forEach(card => {
    cardObserver.observe(card);
  });
}

let resizeT; 
window.addEventListener('resize', () => { 
  clearTimeout(resizeT); 
  resizeT = setTimeout(drawDividers, 150); 
});

// ============================================================
//  СТАРТ
// ============================================================
loadWishes();