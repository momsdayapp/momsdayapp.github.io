/* =========================================================
   Site da Mãe Sandra
   ========================================================= */

'use strict';

const PHOTOS_URL = 'photos2.json';
const STORE = {
  theme: 'mae.theme',
  date: 'mae.date',
  photo: 'mae.photo',
  quote: 'mae.quote',
  favourites: 'mae.favourites'
};

const PAGE_SIZE = 24;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Safe localStorage — private browsing / disabled storage must not break the page. */
const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }
};

const $ = (sel) => document.querySelector(sel);

/* ---------------------------------------------------------
   Helpers
   --------------------------------------------------------- */

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* Stable hash so "photo of the day" is the same all day, even before it is cached. */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

/* fetch with a hard timeout — a hanging proxy must not stall the fallback chain. */
async function fetchWithTimeout(url, ms = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------
   Theme
   --------------------------------------------------------- */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('#theme-toggle');
  const isDark = theme === 'dark';
  btn.setAttribute('aria-pressed', String(isDark));
  btn.setAttribute('aria-label', isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro');
  store.set(STORE.theme, theme);
}

function initTheme() {
  const saved = store.get(STORE.theme);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));

  $('#theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
}

/* ---------------------------------------------------------
   Greeting + date
   --------------------------------------------------------- */

function initGreeting() {
  const now = new Date();

  $('#today-date').textContent = new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(now);

  const hour = now.getHours();
  const greeting =
    hour < 6 ? 'Boa noite, Mãe' :
    hour < 13 ? 'Bom dia, Mãe' :
    hour < 20 ? 'Boa tarde, Mãe' :
    'Boa noite, Mãe';
  $('#greeting').textContent = greeting;
}

/* ---------------------------------------------------------
   Quote of the day
   --------------------------------------------------------- */

/* Used when every network source is unreachable, so the card is never empty. */
const LOCAL_QUOTES = [
  { text: 'Onde há amor de mãe, nunca falta casa.', author: 'Provérbio popular' },
  { text: 'Um dia de cada vez, com calma e com carinho.', author: 'Anónimo' },
  { text: 'As mãos de uma mãe são feitas de ternura — as crianças dormem profundamente sob elas.', author: 'Provérbio popular' },
  { text: 'A alegria partilhada é alegria a dobrar.', author: 'Provérbio popular' },
  { text: 'Devagar se vai ao longe.', author: 'Provérbio português' },
  { text: 'O coração que dá é o coração que recebe mais.', author: 'Anónimo' },
  { text: 'Cada dia é uma página nova. Escreva-a com gosto.', author: 'Anónimo' },
  { text: 'Quem semeia carinho, colhe família.', author: 'Provérbio popular' },
  { text: 'As pequenas coisas de todos os dias são, no fim, as grandes coisas da vida.', author: 'Anónimo' },
  { text: 'Amor de mãe não se mede, sente-se.', author: 'Provérbio popular' },
  { text: 'Não há almofada tão macia como o colo de uma mãe.', author: 'Provérbio popular' },
  { text: 'Mais vale um sorriso hoje do que uma promessa amanhã.', author: 'Anónimo' },
  { text: 'A saudade é a prova de que valeu a pena.', author: 'Anónimo' },
  { text: 'A casa não se faz de paredes, faz-se de quem lá mora.', author: 'Provérbio popular' }
];

function localQuoteForToday() {
  return LOCAL_QUOTES[hashString(todayKey()) % LOCAL_QUOTES.length];
}

/* Ordered sources: zenquotes needs a CORS proxy (it sends no CORS headers) and that
   proxy is intermittently down, so we fall through to a direct CORS-enabled API and
   finally to the local list. */
const QUOTE_SOURCES = [
  {
    url: () => 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://zenquotes.io/api/today'),
    parse: (data) => ({ text: data[0].q, author: data[0].a })
  },
  {
    url: () => 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://zenquotes.io/api/random'),
    parse: (data) => ({ text: data[0].q, author: data[0].a })
  },
  {
    url: () => 'https://dummyjson.com/quotes/random',
    parse: (data) => ({ text: data.quote, author: data.author })
  }
];

function isUsableQuote(quote) {
  return quote && typeof quote.text === 'string' && quote.text.trim().length > 0;
}

/* Returns null when every source fails, so the caller can keep whatever is on screen. */
async function fetchQuote() {
  for (const source of QUOTE_SOURCES) {
    try {
      const parsed = source.parse(await fetchWithTimeout(source.url(), 4500));
      if (isUsableQuote(parsed)) {
        return { text: parsed.text.trim(), author: (parsed.author || 'Anónimo').trim() };
      }
    } catch {
      /* try the next source */
    }
  }
  return null;
}

function renderQuote(quote) {
  $('#quote-text').textContent = quote.text;
  $('#quote-author').textContent = quote.author ? `— ${quote.author}` : '';
}

async function loadQuote({ force = false } = {}) {
  const body = $('.quote-body');

  if (!force) {
    const cached = store.get(STORE.quote);
    if (store.get(STORE.date) === todayKey() && cached) {
      try {
        const quote = JSON.parse(cached);
        if (isUsableQuote(quote)) { renderQuote(quote); return; }
      } catch { /* cache corrupted — refetch */ }
    }
    /* No cache yet: show today's local quote at once rather than a spinner, then
       upgrade in the background if a source answers. The proxy can take seconds. */
    renderQuote(localQuoteForToday());
  }

  body.classList.add('is-swapping');
  const quote = await fetchQuote();
  body.classList.remove('is-swapping');

  if (!quote) {
    /* Offline: on an explicit tap still give a different quote back, so the
       button never feels dead. */
    if (force) {
      const current = $('#quote-text').textContent;
      const others = LOCAL_QUOTES.filter((q) => q.text !== current);
      renderQuote(others[Math.floor(Math.random() * others.length)] || localQuoteForToday());
      showToast('Sem ligação — frase da nossa coleção');
    }
    return;
  }

  renderQuote(quote);
  store.set(STORE.date, todayKey());
  store.set(STORE.quote, JSON.stringify(quote));
}

function initQuoteControls() {
  $('#new-quote').addEventListener('click', () => loadQuote({ force: true }));

  $('#copy-quote').addEventListener('click', async () => {
    const text = `${$('#quote-text').textContent} ${$('#quote-author').textContent}`.trim();
    try {
      await navigator.clipboard.writeText(text);
      showToast('Frase copiada 💛');
    } catch {
      showToast('Não foi possível copiar');
    }
  });
}

/* ---------------------------------------------------------
   Photos: state
   --------------------------------------------------------- */

const state = {
  photos: [],
  favourites: new Set(),
  filter: 'all',
  shown: 0,
  currentPhoto: null,
  lightboxList: [],
  lightboxIndex: 0
};

function loadFavourites() {
  try {
    const saved = JSON.parse(store.get(STORE.favourites) || '[]');
    if (Array.isArray(saved)) state.favourites = new Set(saved);
  } catch { /* ignore */ }
}

function saveFavourites() {
  store.set(STORE.favourites, JSON.stringify([...state.favourites]));
  $('#fav-count').textContent = String(state.favourites.size);
}

function toggleFavourite(src) {
  if (state.favourites.has(src)) {
    state.favourites.delete(src);
    showToast('Removida das favoritas');
  } else {
    state.favourites.add(src);
    showToast('Guardada nas favoritas 💛');
  }
  saveFavourites();
  syncFavouriteButtons(src);
  if (state.filter === 'favourites') renderGallery({ reset: true });
}

function syncFavouriteButtons(src) {
  const isFav = state.favourites.has(src);

  document.querySelectorAll(`.tile-fav[data-src="${CSS.escape(src)}"]`)
    .forEach((btn) => btn.setAttribute('aria-pressed', String(isFav)));

  if (state.currentPhoto === src) {
    const btn = $('#fav-btn');
    btn.setAttribute('aria-pressed', String(isFav));
    btn.setAttribute('aria-label', isFav ? 'Remover dos favoritos' : 'Guardar nos favoritos');
  }
}

/* ---------------------------------------------------------
   Photo of the day
   --------------------------------------------------------- */

function setDailyPhoto(src) {
  const frame = $('#photo-frame');
  const img = $('#daily-photo');

  state.currentPhoto = src;
  frame.classList.remove('is-ready');
  frame.classList.add('is-loading');

  img.onload = () => {
    frame.classList.remove('is-loading');
    frame.classList.add('is-ready');
  };
  /* A missing file must not leave a permanently blank frame. */
  img.onerror = () => {
    frame.classList.remove('is-loading');
    const fallback = state.photos.find((p) => p !== src);
    if (fallback && img.dataset.retried !== '1') {
      img.dataset.retried = '1';
      setDailyPhoto(fallback);
    }
  };

  img.src = src;
  syncFavouriteButtons(src);
}

function initDailyPhoto() {
  const cachedSrc = store.get(STORE.photo);
  const sameDay = store.get(STORE.date) === todayKey();

  const src = (sameDay && cachedSrc && state.photos.includes(cachedSrc))
    ? cachedSrc
    : state.photos[hashString(todayKey()) % state.photos.length];

  store.set(STORE.photo, src);
  setDailyPhoto(src);

  $('#shuffle-photo').addEventListener('click', () => {
    let next = state.currentPhoto;
    while (state.photos.length > 1 && next === state.currentPhoto) {
      next = state.photos[Math.floor(Math.random() * state.photos.length)];
    }
    $('#daily-photo').dataset.retried = '';
    setDailyPhoto(next);
  });

  $('#fav-btn').addEventListener('click', () => toggleFavourite(state.currentPhoto));
  $('#daily-photo').addEventListener('click', () => {
    openLightbox(state.photos, state.photos.indexOf(state.currentPhoto));
  });
}

/* ---------------------------------------------------------
   Gallery
   --------------------------------------------------------- */

function visiblePhotos() {
  return state.filter === 'favourites'
    ? state.photos.filter((p) => state.favourites.has(p))
    : state.photos;
}

function createTile(src, list, index) {
  const tile = document.createElement('button');
  tile.className = 'tile';
  tile.type = 'button';
  tile.setAttribute('aria-label', 'Ver fotografia em grande');

  /* Native lazy loading keeps 140 photos off the wire until they are needed. */
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('load', () => img.classList.add('is-loaded'));
  img.addEventListener('error', () => tile.remove());
  img.src = src;

  const fav = document.createElement('button');
  fav.className = 'tile-fav';
  fav.type = 'button';
  fav.dataset.src = src;
  fav.setAttribute('aria-pressed', String(state.favourites.has(src)));
  fav.setAttribute('aria-label', 'Guardar nos favoritos');
  fav.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.435c-1.989-2.48-5.142-2.542-7.131-.559-1.804 1.804-1.992 4.638-.517 6.55l8.648 8.56 8.646-8.646c2.078-2.078 2.078-5.44 0-7.518-2.079-2.079-5.441-2.079-7.519 0L12 4.435z"/></svg>';
  fav.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleFavourite(src);
  });

  tile.append(img, fav);
  tile.addEventListener('click', () => openLightbox(list, index));
  return tile;
}

function renderGallery({ reset = false } = {}) {
  const gallery = $('#gallery');
  const list = visiblePhotos();

  if (reset) {
    gallery.innerHTML = '';
    state.shown = 0;
  }

  const next = list.slice(state.shown, state.shown + PAGE_SIZE);
  const fragment = document.createDocumentFragment();
  next.forEach((src, i) => fragment.appendChild(createTile(src, list, state.shown + i)));
  gallery.appendChild(fragment);
  state.shown += next.length;

  $('#gallery-empty').hidden = list.length > 0;
  $('#load-more').hidden = state.shown >= list.length;
}

function initGallery() {
  renderGallery({ reset: true });

  $('#load-more').addEventListener('click', () => renderGallery());

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((other) => {
        const active = other === tab;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-selected', String(active));
      });
      state.filter = tab.dataset.filter;
      renderGallery({ reset: true });
    });
  });
}

/* ---------------------------------------------------------
   Lightbox
   --------------------------------------------------------- */

function showLightboxImage() {
  const src = state.lightboxList[state.lightboxIndex];
  $('#lightbox-img').src = src;
  $('#lightbox-caption').textContent = `${state.lightboxIndex + 1} de ${state.lightboxList.length}`;
}

function openLightbox(list, index) {
  if (!list.length || index < 0) return;
  state.lightboxList = list;
  state.lightboxIndex = index;
  showLightboxImage();
  $('#lightbox').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#lightbox .modal-close').focus();
}

function stepLightbox(delta) {
  const total = state.lightboxList.length;
  state.lightboxIndex = (state.lightboxIndex + delta + total) % total;
  showLightboxImage();
}

function closeModals() {
  $('#lightbox').hidden = true;
  $('#qr-modal').hidden = true;
  document.body.style.overflow = '';
}

function initModals() {
  $('#lightbox-prev').addEventListener('click', () => stepLightbox(-1));
  $('#lightbox-next').addEventListener('click', () => stepLightbox(1));

  $('#show-qr-btn').addEventListener('click', () => {
    $('#qr-modal').hidden = false;
    document.body.style.overflow = 'hidden';
  });

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', closeModals);
  });

  /* Click on the backdrop (but not on the content) closes. */
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModals();
    });
  });

  document.addEventListener('keydown', (event) => {
    if ($('#lightbox').hidden && $('#qr-modal').hidden) return;
    if (event.key === 'Escape') closeModals();
    if ($('#lightbox').hidden) return;
    if (event.key === 'ArrowLeft') stepLightbox(-1);
    if (event.key === 'ArrowRight') stepLightbox(1);
  });
}

/* ---------------------------------------------------------
   Floating hearts
   --------------------------------------------------------- */

function initHearts() {
  if (reduceMotion) return;

  const layer = $('.floating-hearts');
  const glyphs = ['❤', '🌸', '💛', '🤍'];

  setInterval(() => {
    if (document.hidden) return;

    const heart = document.createElement('span');
    heart.className = 'heart';
    heart.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    heart.style.left = Math.random() * 100 + 'vw';
    heart.style.fontSize = (0.8 + Math.random() * 1.1).toFixed(2) + 'rem';

    const duration = 9 + Math.random() * 7;
    heart.style.animationDuration = duration + 's';

    layer.appendChild(heart);
    setTimeout(() => heart.remove(), duration * 1000);
  }, 1400);
}

/* ---------------------------------------------------------
   Boot
   --------------------------------------------------------- */

async function init() {
  initTheme();
  initGreeting();
  initModals();
  initHearts();
  initQuoteControls();

  loadFavourites();
  saveFavourites();

  /* Quote and photos load in parallel — neither should block the other. */
  const quotePromise = loadQuote();

  try {
    const photos = await fetchWithTimeout(PHOTOS_URL, 10000);
    state.photos = Array.isArray(photos) ? photos.filter((p) => typeof p === 'string') : [];
  } catch {
    state.photos = [];
  }

  if (state.photos.length) {
    initDailyPhoto();
    initGallery();
  } else {
    $('#photo-frame').classList.remove('is-loading');
    $('#photo-caption').textContent = 'não foi possível carregar as fotos';
    $('#gallery-empty').hidden = false;
    $('#gallery-empty').textContent = 'Não foi possível carregar o álbum.';
    $('#load-more').hidden = true;
  }

  await quotePromise;
}

document.addEventListener('DOMContentLoaded', init);
