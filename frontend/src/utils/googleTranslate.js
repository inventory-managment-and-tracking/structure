const STORAGE_KEY = 'clothtrack_translate_amharic';
const GOOGTRANS_COOKIE = 'googtrans';
const TARGET_LANG = 'am';
const PAGE_LANG = 'en';
const TRANSLATE_VALUE = `/${PAGE_LANG}/${TARGET_LANG}`;

function isLocalhost() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export function isAmharicEnabled() {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

function getGoogTransCookie() {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function clearGoogTransCookie() {
  const expires = 'expires=Thu, 01 Jan 1970 00:00:00 UTC';
  document.cookie = `${GOOGTRANS_COOKIE}=; ${expires}; path=/`;

  if (!isLocalhost()) {
    const hostname = window.location.hostname;
    document.cookie = `${GOOGTRANS_COOKIE}=; ${expires}; path=/; domain=${hostname}`;
    document.cookie = `${GOOGTRANS_COOKIE}=; ${expires}; path=/; domain=.${hostname}`;
  }
}

export function setGoogTransCookie(value) {
  clearGoogTransCookie();
  if (!value) return;

  document.cookie = `${GOOGTRANS_COOKIE}=${value}; path=/`;

  if (!isLocalhost()) {
    const hostname = window.location.hostname;
    document.cookie = `${GOOGTRANS_COOKIE}=${value}; path=/; domain=${hostname}`;
    document.cookie = `${GOOGTRANS_COOKIE}=${value}; path=/; domain=.${hostname}`;
  }
}

function applyDocumentLanguage(enabled) {
  document.documentElement.classList.toggle('lang-am', enabled);
  document.documentElement.lang = enabled ? TARGET_LANG : PAGE_LANG;
}

/** Run before Google script loads so the cookie is ready on first paint. */
export function syncTranslateCookieFromStorage() {
  const enabled = isAmharicEnabled();
  setGoogTransCookie(enabled ? TRANSLATE_VALUE : '');
  applyDocumentLanguage(enabled);
}

export function toggleAmharicTranslation() {
  const next = !isAmharicEnabled();
  localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
  setGoogTransCookie(next ? TRANSLATE_VALUE : '');
  applyDocumentLanguage(next);
  window.location.reload();
}

function triggerTranslateSelect(lang) {
  const select = document.querySelector('.goog-te-combo');
  if (!select) return false;

  if (select.value !== lang) {
    select.value = lang;
    select.dispatchEvent(new Event('change'));
  }
  return true;
}

/** Re-translate after React renders new content (tab switches, modals, etc.). */
export function reapplyAmharicTranslation() {
  if (!isAmharicEnabled()) return;

  const attempt = (retriesLeft) => {
    if (triggerTranslateSelect(TARGET_LANG)) return;
    if (retriesLeft > 0) {
      setTimeout(() => attempt(retriesLeft - 1), 250);
    }
  };

  setTimeout(() => attempt(20), 300);
}

export function restoreEnglishTranslation() {
  if (isAmharicEnabled()) return;
  triggerTranslateSelect(PAGE_LANG);
}

/** Called from index.html when Google Translate finishes loading. */
export function onGoogleTranslateReady() {
  if (isAmharicEnabled()) {
    reapplyAmharicTranslation();
  }
}

// Expose for inline script in index.html
if (typeof window !== 'undefined') {
  window.__clothtrackOnGoogleTranslateReady = onGoogleTranslateReady;
  window.__clothtrackSyncTranslateCookie = syncTranslateCookieFromStorage;
}
