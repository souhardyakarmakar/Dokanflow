/**
 * DokanFlow — app.js
 * Single module entry point for the shell: store, toasts, modal/drawer
 * focus management, dropdowns, sidebar collapse, search shortcut, active
 * nav indicator, action router and reveal animations.
 *
 * Rules followed: no innerHTML, no inline handlers, all behaviour delegated
 * from document, every element lookup null-safe.
 */
import { debounce } from './utils/format.js';

/* ==========================================================================
   1. Store
   ========================================================================== */

export function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

const SIDEBAR_KEY = 'dokanflow.sidebarCollapsed';
const readSidebarPref = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false; // storage blocked: fall back to expanded
  }
};
const writeSidebarPref = (collapsed) => {
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  } catch {
    /* storage blocked: preference simply isn't persisted */
  }
};

/** Page resolution order: ?page= query, then body[data-page], then active nav item. */
const resolvePage = () =>
  new URLSearchParams(window.location.search).get('page')
  || document.body.dataset.page
  || document.querySelector('[data-nav].is-active')?.dataset.nav
  || null;

export const store = createStore({
  sidebarCollapsed: readSidebarPref(),
  activePage: resolvePage(),
  notificationsUnread: 3,
  theme: 'light',
});

/* ==========================================================================
   2. Helpers
   ========================================================================== */

const $ = (selector, root = document) => root.querySelector(selector);
const isSmallViewport = () => window.matchMedia('(max-width: 767px)').matches;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
const isTypingTarget = (t) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/* ==========================================================================
   3. Toasts (max 4 visible)
   ========================================================================== */

const MAX_TOASTS = 4;

export function toast({ title = '', message = '', variant = 'info', duration = 3600 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return null;

  while (root.children.length >= MAX_TOASTS) root.firstElementChild.remove();

  const el = document.createElement('div');
  el.className = `toast toast--${variant}`;
  el.setAttribute('role', variant === 'error' ? 'alert' : 'status');

  const strong = document.createElement('strong');
  strong.textContent = title;
  const span = document.createElement('span');
  span.textContent = message;
  el.append(strong, span);
  root.appendChild(el);

  const remove = () => el.remove();
  const dismiss = () => {
    if (el.classList.contains('is-leaving')) return;
    el.classList.add('is-leaving');
    el.addEventListener('animationend', remove, { once: true });
    el.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 400); // fallback if no animation fires
  };
  setTimeout(dismiss, duration);
  return el;
}

/* ==========================================================================
   4. Layers: modals and the mobile drawer share one focus/scroll stack
   ========================================================================== */

const layers = [];              // open modal/drawer elements, top = last
const triggers = new WeakMap(); // element -> element that should regain focus
const scrollLocks = new Set();

function lockScroll(key, on) {
  if (on) scrollLocks.add(key);
  else scrollLocks.delete(key);
  document.body.style.overflow = scrollLocks.size ? 'hidden' : '';
}

const getPanel = (el) => el.querySelector('[role="dialog"]') || el;

function trapFocus(e, root) {
  const items = Array.from(root.querySelectorAll(FOCUSABLE));
  if (!items.length) {
    e.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const outside = !root.contains(active);
  if (e.shiftKey && (active === first || outside)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || outside)) {
    e.preventDefault();
    first.focus();
  }
}

export function openModal(el, trigger = document.activeElement) {
  if (!el || layers.includes(el)) return;
  triggers.set(el, trigger);
  el.classList.add('is-open');
  el.classList.remove('is-closing');
  el.hidden = false;
  layers.push(el);
  lockScroll('modal', true);

  const panel = getPanel(el);
  if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
  (panel.querySelector(FOCUSABLE) || panel).focus();
}

export function closeModal(el) {
  if (!el || el.hidden || el.classList.contains('is-closing')) return;
  el.classList.add('is-closing');
  const index = layers.indexOf(el);
  if (index !== -1) layers.splice(index, 1);

  let finished = false;
  const finish = (e) => {
    if (finished || (e && e.target !== el)) return;
    finished = true;
    el.removeEventListener('animationend', finish);
    el.hidden = true;
    el.classList.remove('is-open', 'is-closing');
    lockScroll('modal', false);
    const target = triggers.get(el);
    if (target && target.isConnected) target.focus();
    triggers.delete(el);
    el.dispatchEvent(new CustomEvent('modal:closed'));
  };
  el.addEventListener('animationend', finish);
  setTimeout(finish, 250); // fallback if no animation runs
}

/* ---------- Mobile sidebar drawer ---------- */

function setDrawerExpanded(on) {
  document.querySelectorAll('[data-action="open-drawer"]')
    .forEach((btn) => btn.setAttribute('aria-expanded', String(on)));
}

export function openDrawer() {
  const side = document.getElementById('sidebar');
  if (!side || layers.includes(side)) return;
  triggers.set(side, document.activeElement);
  side.classList.add('is-open');
  const overlay = $('.drawer-overlay');
  if (overlay) {
    overlay.hidden = false;
    overlay.classList.add('is-open');
  }
  setDrawerExpanded(true);
  layers.push(side);
  lockScroll('drawer', true);
  (side.querySelector(FOCUSABLE) || side).focus();
}

export function closeDrawer() {
  const side = document.getElementById('sidebar');
  if (!side || !layers.includes(side)) return;
  layers.splice(layers.indexOf(side), 1);
  side.classList.remove('is-open');
  const overlay = $('.drawer-overlay');
  if (overlay) {
    overlay.classList.remove('is-open');
    overlay.hidden = true;
  }
  setDrawerExpanded(false);
  lockScroll('drawer', false);
  const target = triggers.get(side);
  if (target && target.isConnected) target.focus();
  triggers.delete(side);
}

const closeLayer = (el) => (el.id === 'sidebar' ? closeDrawer() : closeModal(el));

/* ==========================================================================
   5. Dropdowns: one open at a time, [data-dropdown="id"] -> #id-menu
   ========================================================================== */

let openDropdown = null; // { btn, menu }

function closeDropdowns(returnFocus = false) {
  if (!openDropdown) return;
  const { btn, menu } = openDropdown;
  menu.classList.remove('is-open');
  menu.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
  openDropdown = null;
  if (returnFocus) btn.focus();
}

function toggleDropdown(btn) {
  const menu = document.getElementById(`${btn.dataset.dropdown}-menu`);
  if (!menu) return;
  const wasSame = openDropdown && openDropdown.btn === btn;
  closeDropdowns();
  if (wasSame) return;
  menu.hidden = false;
  menu.classList.add('is-open');
  btn.setAttribute('aria-expanded', 'true');
  openDropdown = { btn, menu };
}

/* ==========================================================================
   6. Sidebar collapse (desktop), persisted
   ========================================================================== */

function applySidebar(collapsed) {
  const body = $('.app-body');
  if (body) {
    if (collapsed) body.dataset.sidebar = 'collapsed';
    else delete body.dataset.sidebar;
  }
  document.querySelectorAll('[data-action="toggle-sidebar"]')
    .forEach((btn) => btn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar'));
}

function toggleSidebar() {
  const next = !store.get().sidebarCollapsed;
  store.set({ sidebarCollapsed: next });
  writeSidebarPref(next);
}

/* ==========================================================================
   7. Global search shortcut
   ========================================================================== */

function focusSearch() {
  const input = document.getElementById('global-search');
  if (!input) return;
  input.focus();
  input.select();
}

/* ==========================================================================
   8. Active nav + sliding indicator
   ========================================================================== */

function markActiveNav(page) {
  document.querySelectorAll('[data-nav]').forEach((el) => {
    const on = el.dataset.nav === page;
    el.classList.toggle('is-active', on);
    if (on) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
}

function positionIndicator() {
  const indicator = $('.nav-indicator');
  const active = $('.nav-link.is-active, [data-nav].is-active');
  if (!indicator || !active) return;
  indicator.style.top = `${active.offsetTop}px`;
  indicator.style.height = `${active.offsetHeight}px`;
}

/* ==========================================================================
   9. Action router (data-action)
   ========================================================================== */

const demoNotice = (title, message) => toast({ title, message, variant: 'info' });

const actions = {
  'open-drawer': () => openDrawer(),
  'close-drawer': () => closeDrawer(),
  'open-modal': (el) => openModal(document.getElementById(el.dataset.modal), el),
  'close-modal': (el) => closeModal(el.closest('[data-modal-root], .modal')),
  'toggle-sidebar': () => toggleSidebar(),
  'demo-toast': () => toast({
    title: 'No reminder sent',
    message: 'Reminder delivery requires a configured WhatsApp or SMS provider.',
    variant: 'info',
  }),
  'show-help': () => demoNotice('Help', 'Help centre is coming in a later stage.'),
  'show-legal': () => demoNotice('Legal', 'Help centre is coming in a later stage.'),
};

/* ==========================================================================
   10. Reveal observer
   ========================================================================== */

function initReveal() {
  const els = Array.from(document.querySelectorAll('.reveal'));
  els.forEach((el) => {
    const siblings = el.parentElement ? Array.from(el.parentElement.children) : [el];
    el.style.setProperty('--reveal-index', String(Math.min(siblings.indexOf(el), 7)));
  });
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  els.forEach((el) => io.observe(el));
}

/* ==========================================================================
   11. Global delegated listeners
   ========================================================================== */

function onClick(e) {
  if (!(e.target instanceof Element)) return;

  // Dropdowns: close others when clicking outside, then toggle the trigger.
  const trigger = e.target.closest('[data-dropdown]');
  const inMenu = e.target.closest('.dropdown__menu');
  const menuItem = e.target.closest('.dropdown__menu a, .dropdown__menu button');
  if (openDropdown && ((!trigger && !inMenu) || menuItem)) closeDropdowns();
  if (trigger) toggleDropdown(trigger);

  // Mobile drawer: nav link click closes it on small viewports.
  if (e.target.closest('#sidebar [data-nav]') && isSmallViewport()) closeDrawer();

  // Action router.
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const run = actions[actionEl.dataset.action];
  if (!run) return;
  if (actionEl.tagName === 'A') e.preventDefault();
  run(actionEl);
}

function onSubmit(e) {
  if (e.target instanceof HTMLFormElement && e.target.matches('[role="search"]')) {
    e.preventDefault();
  }
}

function updateFieldMotion(target) {
  if (!(target instanceof HTMLInputElement
    || target instanceof HTMLSelectElement
    || target instanceof HTMLTextAreaElement)) return;
  const field = target.closest('.field');
  if (!field) return;
  const valid = target.validity.valid;
  field.dataset.validation = valid ? 'valid' : 'invalid';
  if (valid) target.removeAttribute('aria-invalid');
  else target.setAttribute('aria-invalid', 'true');
}

function onFieldInput(e) {
  updateFieldMotion(e.target);
}

function onFieldInvalid(e) {
  updateFieldMotion(e.target);
}

function onKeydown(e) {
  const search = document.getElementById('global-search');

  if (e.key === 'Escape') {
    if (search && e.target === search) {
      search.value = '';
      search.blur();
      return;
    }
    if (openDropdown) {
      closeDropdowns(true);
      return;
    }
    const top = layers[layers.length - 1];
    if (top) closeLayer(top);
    return;
  }

  if (e.key === 'Tab' && layers.length) {
    trapFocus(e, getPanel(layers[layers.length - 1]));
    return;
  }

  if (!isTypingTarget(e.target) && e.key === '/') {
    e.preventDefault();
    focusSearch();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    focusSearch();
  }
}

function onResize() {
  positionIndicator();
  if (!isSmallViewport()) closeDrawer();
}

/* ==========================================================================
   12. Init
   ========================================================================== */

function init() {
  applySidebar(store.get().sidebarCollapsed);
  store.subscribe((state) => applySidebar(state.sidebarCollapsed));
  markActiveNav(store.get().activePage);
  positionIndicator();
  initReveal();

  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('input', onFieldInput);
  document.addEventListener('change', onFieldInput);
  document.addEventListener('invalid', onFieldInvalid, true);
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', debounce(onResize, 120));
  window.addEventListener('load', positionIndicator);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
