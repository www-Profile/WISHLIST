// ============================================================
//  КОНФИГУРАЦИЯ SUPABASE
// ============================================================
const SUPABASE_URL = 'https://cnrgmrwxglmkysqvvivh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DtksfpZ0Nn1-SJBbiyETfw_Ak8t807o';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
//  ID ПОЛЬЗОВАТЕЛЯ
// ============================================================
function getUserId() {
  let id = localStorage.getItem('wishlist_user_id');
  if (!id) {
    id = 'user_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('wishlist_user_id', id);
  }
  return id;
}

const USER_ID = getUserId();

// ============================================================
//  ДАТА ДНЯ РОЖДЕНИЯ — 6 ДЕКАБРЯ
// ============================================================
const BIRTHDAY = new Date(new Date().getFullYear(), 11, 6);
if (BIRTHDAY < new Date()) {
  BIRTHDAY.setFullYear(BIRTHDAY.getFullYear() + 1);
}

// ============================================================
//  ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================================
let currentFilter = 'wanted';
let activeWishId = null;
let wishes = [];

const wishList = document.getElementById('wish-list');
const filterButtons = document.querySelectorAll('.filter-btn');
const countdownText = document.getElementById('countdown-text');

const currencySymbols = { RUB: '₽', USD: '$', EUR: '€' };
const currencyFormats = { RUB: 'ru-RU', USD: 'en-US', EUR: 'de-DE' };

// Папка с локальными картинками
const IMAGES_PATH = 'images/';

// ==== ОБРАТНЫЙ ОТСЧЁТ ====
function updateCountdown() {
  const diff = BIRTHDAY - new Date();
  if (diff <= 0) {
    countdownText.textContent = 'Сегодня';
    return;
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  const pad = (n) => String(n).padStart(2, '0');
  countdownText.textContent = `${days}д ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
setInterval(updateCountdown, 1000);
updateCountdown();

// ==== ФОРМАТ ЦЕНЫ ====
function formatPrice(price, currency) {
  if (price === null || price === undefined || price === '') return '';
  const cur = currency || 'RUB';
  const symbol = currencySymbols[cur] || '₽';
  const locale = currencyFormats[cur] || 'ru-RU';
  const formatted = Number(price).toLocaleString(locale);
  return cur === 'RUB' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}

// ==== ЗАГРУЗКА ====
async function loadWishes() {
  renderSkeletons(); // показываем серые блоки пока грузим

  const { data, error } = await supabaseClient
    .from('wishes')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('Ошибка загрузки:', error);
    wishList.innerHTML = `<div class="empty">ОШИБКА ЗАГРУЗКИ</div>`;
    return;
  }

  wishes = data;
  renderWishes();
}

// ==== СКЕЛЕТОНЫ (заглушки на время загрузки) ====
function renderSkeletons(count = 6) {
  const card = `
    <div class="wish-card skeleton">
      <div class="sk-line sk-title"></div>
      <div class="sk-image"></div>
      <div class="sk-line sk-price"></div>
    </div>
  `;
  wishList.innerHTML = card.repeat(count);
  drawDividers();
}

// ==== ОТРИСОВКА БЛОКОВ ====
function renderWishes() {
  const filtered = wishes.filter(w => w.status === currentFilter);

  if (filtered.length === 0) {
    wishList.innerHTML = `<div class="empty">ПУСТО</div>`;
    return;
  }

  wishList.innerHTML = filtered.map(w => {
    const imageHTML = w.image
      ? `<div class="wish-image"><img src="${IMAGES_PATH}${escapeHtml(w.image)}" alt="" loading="lazy"></div>`
      : '';

    const priceHTML = w.price
      ? `<div class="price">${formatPrice(w.price, w.currency)}</div>`
      : '';

    let extraClass = '';
    if (w.status === 'reserved') extraClass = 'is-reserved';
    if (w.status === 'done') extraClass = 'is-done';

    return `
      <div class="wish-card ${extraClass}" data-id="${w.id}">
        <h3>${escapeHtml(w.name)}</h3>
        ${imageHTML}
        ${priceHTML}
      </div>
    `;
  }).join('');

  document.querySelectorAll('.wish-card').forEach(card => {
    card.addEventListener('click', () => {
      openModal(Number(card.dataset.id));
    });
  });

  drawDividers();
}

// ============================================================
//  РИСУЕМ ПОЛОСКИ МЕЖДУ КАРТОЧКАМИ
// ============================================================
function drawDividers() {
  const cards = document.querySelectorAll('.wish-card');
  if (!cards.length) return;

  document.querySelectorAll('.card-divider').forEach(el => el.remove());

  cards.forEach((card) => {
    const style = getComputedStyle(card);
    const padTop = parseFloat(style.paddingTop);
    const padBottom = parseFloat(style.paddingBottom);
    const padLeft = parseFloat(style.paddingLeft);
    const padRight = parseFloat(style.paddingRight);

    const innerHeight = card.offsetHeight - padTop - padBottom;
    const innerWidth = card.offsetWidth - padLeft - padRight;

    const rightDivider = document.createElement('div');
    rightDivider.className = 'card-divider card-divider-right';
    rightDivider.style.position = 'absolute';
    rightDivider.style.top = padTop + 'px';
    rightDivider.style.right = '-2px';
    rightDivider.style.width = '2px';
    rightDivider.style.height = innerHeight + 'px';
    rightDivider.style.background = '#FF6347';
    rightDivider.style.borderRadius = '10px';
    rightDivider.style.zIndex = '1';
    card.appendChild(rightDivider);

    const bottomDivider = document.createElement('div');
    bottomDivider.className = 'card-divider card-divider-bottom';
    bottomDivider.style.position = 'absolute';
    bottomDivider.style.left = padLeft + 'px';
    bottomDivider.style.bottom = '-2px';
    bottomDivider.style.width = innerWidth + 'px';
    bottomDivider.style.height = '2px';
    bottomDivider.style.background = '#FF6347';
    bottomDivider.style.borderRadius = '10px';
    bottomDivider.style.zIndex = '1';
    card.appendChild(bottomDivider);
  });

  hideEdgeDividers();
}

function hideEdgeDividers() {
  const cards = Array.from(document.querySelectorAll('.wish-card'));
  if (!cards.length) return;

  const rows = {};
  cards.forEach((card, i) => {
    const top = Math.round(card.getBoundingClientRect().top);
    if (!rows[top]) rows[top] = [];
    rows[top].push({ card, index: i });
  });

  const rowKeys = Object.keys(rows).map(Number).sort((a, b) => a - b);

  rowKeys.forEach((top, rowIdx) => {
    const rowCards = rows[top];
    const isLastRow = rowIdx === rowKeys.length - 1;

    rowCards.forEach((item, colIdx) => {
      const isLastCol = colIdx === rowCards.length - 1;

      if (isLastCol) {
        const r = item.card.querySelector('.card-divider-right');
        if (r) r.remove();
      }

      if (isLastRow) {
        const b = item.card.querySelector('.card-divider-bottom');
        if (b) b.remove();
      }
    });
  });
}

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(drawDividers, 150);
});

// Автообновление разделителей каждые 5 секунд
setInterval(() => {
  if (document.querySelectorAll('.wish-card').length) {
    drawDividers();
  }
}, 1000);

// ==== МОДАЛКА ====
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalImage = document.getElementById('modal-image');
const modalPrice = document.getElementById('modal-price');
const modalLink = document.getElementById('modal-link');
const modalAction = document.getElementById('modal-action');
const modalClose = document.getElementById('modal-close');

function openModal(id) {
  const wish = wishes.find(w => w.id === id);
  if (!wish) return;

  activeWishId = id;
  modalTitle.textContent = wish.name;

  // Фото — то же самое, что и в блоке
  if (wish.image) {
    modalImage.innerHTML = `<img src="${IMAGES_PATH}${escapeHtml(wish.image)}" alt="" loading="lazy">`;
    modalImage.style.display = '';
  } else {
    modalImage.innerHTML = '';
    modalImage.style.display = 'none';
  }

  // Цена
  modalPrice.textContent = wish.price ? formatPrice(wish.price, wish.currency) : '';

  // Ссылка
  if (wish.url) {
    modalLink.href = wish.url;
    modalLink.style.display = '';
  } else {
    modalLink.removeAttribute('href');
    modalLink.style.display = 'none';
  }

  // Логика кнопки
  const isMine = wish.reserved_by === USER_ID;

  if (wish.status === 'done') {
    modalAction.textContent = 'Уже исполнено';
    modalAction.classList.remove('is-reserved');
    modalAction.disabled = true;
  } else if (wish.status === 'reserved' && isMine) {
    modalAction.textContent = 'Отменить бронь';
    modalAction.classList.add('is-reserved');
    modalAction.disabled = false;
  } else if (wish.status === 'reserved' && !isMine) {
    modalAction.textContent = 'Забранировано';
    modalAction.classList.remove('is-reserved');
    modalAction.disabled = true;
  } else {
    modalAction.textContent = 'Забранировать';
    modalAction.classList.remove('is-reserved');
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

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOverlay.classList.contains('active')) closeModal();
});

// ==== БРОНИРОВАНИЕ ====
modalAction.addEventListener('click', async () => {
  if (!activeWishId) return;
  const wish = wishes.find(w => w.id === activeWishId);
  if (!wish) return;

  let newStatus, newReservedBy;

  if (wish.status === 'wanted') {
    newStatus = 'reserved';
    newReservedBy = USER_ID;
  } else if (wish.status === 'reserved' && wish.reserved_by === USER_ID) {
    newStatus = 'wanted';
    newReservedBy = null;
  } else {
    return;
  }

  const { error } = await supabaseClient
    .from('wishes')
    .update({ status: newStatus, reserved_by: newReservedBy })
    .eq('id', activeWishId);

  if (error) {
    console.error(error);
    alert('Не удалось сохранить. Попробуй ещё раз.');
    return;
  }

  wish.status = newStatus;
  wish.reserved_by = newReservedBy;
  closeModal();
  renderWishes();
});

// ==== ФИЛЬТРЫ ====
filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    filterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderWishes();
  });
});

// ==== СТАРТ + REALTIME ====
async function init() {
  await loadWishes();

  supabaseClient
    .channel('wishes-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'wishes' },
      () => loadWishes()
    )
    .subscribe();
}

init();