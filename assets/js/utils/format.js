/**
 * DokanFlow — format.js
 * Pure formatting and date helpers. No DOM access, no side effects.
 */

/* ---------- Money & numbers ---------- */

/**
 * Format an amount in Indian rupees with lakh/crore grouping (₹1,23,45,678).
 * @param {number} amount
 * @param {{decimals?: number, sign?: boolean}} [opts]
 */
export function formatINR(amount, { decimals = 0, sign = false } = {}) {
  const n = Number(amount) || 0;
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const body = formatter.format(Math.abs(n));
  if (n < 0) return `-${body}`;
  if (sign && n > 0) return `+${body}`;
  return body;
}

/** Grouped number in en-IN style (12,34,567). */
export function formatNumber(n) {
  return new Intl.NumberFormat('en-IN').format(Number(n) || 0);
}

/**
 * Format a percentage value. Input is the percent itself (12.5 -> "12.5%").
 * @param {number} n
 * @param {number} [digits=1]
 */
export function formatPercent(n, digits = 1) {
  return new Intl.NumberFormat('en-IN', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format((Number(n) || 0) / 100);
}

/** Round to paise (2 decimals). */
export function roundPaise(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Sum a numeric property across an array of objects. */
export function sumBy(arr, key) {
  return (arr || []).reduce((total, item) => total + (Number(item?.[key]) || 0), 0);
}

/* ---------- Dates ---------- */

/**
 * Parse an ISO "YYYY-MM-DD" string as a LOCAL date (avoids UTC shift),
 * or return a copy of a Date instance.
 */
function toDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

/**
 * Format a date as "14 Mar 2025".
 * @param {string|Date} isoOrDate
 * @param {Intl.DateTimeFormatOptions} [opts]
 */
export function formatDate(isoOrDate, opts = {}) {
  const options = { day: '2-digit', month: 'short', year: 'numeric', ...opts };
  return new Intl.DateTimeFormat('en-IN', options).format(toDate(isoOrDate));
}

/** Format a date and time as "14 Mar 2025, 10:30 am". */
export function formatDateTime(isoOrDate, opts = {}) {
  return formatDate(isoOrDate, {
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  });
}

/** Local-time YYYY-MM-DD for a Date. */
export function toISODate(date) {
  const d = toDate(date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Add n days (may be negative) and return a new Date. */
export function addDays(date, n) {
  const d = toDate(date);
  d.setDate(d.getDate() + Number(n || 0));
  return d;
}

/** Whole days from a to b (b - a). */
export function daysBetween(a, b) {
  const start = new Date(toDate(a).setHours(0, 0, 0, 0));
  const end = new Date(toDate(b).setHours(0, 0, 0, 0));
  return Math.round((end - start) / 86400000);
}

/** First day of the month containing date, at local midnight. */
export function startOfMonth(date) {
  const d = toDate(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * True when the due date is strictly before today.
 * Both arguments are ISO YYYY-MM-DD strings (lexical compare is safe).
 */
export function isOverdue(dueISO, todayISO) {
  return Boolean(dueISO && todayISO && dueISO < todayISO);
}

/* ---------- Strings & timing ---------- */

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape a string for safe use inside HTML templates. */
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Debounce: runs fn after ms of silence. */
export function debounce(fn, ms = 200) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/** Throttle: runs fn at most once every ms milliseconds. */
export function throttle(fn, ms = 200) {
  let last = 0;
  let timer = null;
  return function throttled(...args) {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      clearTimeout(timer);
      timer = null;
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}
