/**
 * DokanFlow — dashboard.js
 * Overview dashboard: KPIs, charts and widgets computed from mock data.
 * Acts only when #overview-root exists. Dynamic content uses textContent and
 * createElement only (customer names contain apostrophes and ampersands).
 * Frontend only: no fetch, no storage, no auth.
 */
import { loadDemoState } from './data/demo-state.js';
import {
  formatINR,
  formatNumber,
  formatPercent,
  formatDate,
  daysBetween,
  roundPaise,
  sumBy,
} from './utils/format.js';

/* ==========================================================================
   1. Constants
   ========================================================================== */

const SVG_NS = 'http://www.w3.org/2000/svg';
const SPRITE = 'assets/img/icons.svg';
const SKELETON_MS = 350;
const COUNT_MS = 900;
const CHART_MS = 800;

const BRAND = {
  green: '#77785C',
  forest: '#282C28',
  lavender: '#E5E0D4',
  muted: '#73736A',
  grid: '#DAD7CB',
};

const STATUS_BADGE = {
  Received: 'badge--info',
  'In Progress': 'badge--pending',
  Ready: 'badge--paid',
  Delivered: 'badge--draft',
};

const QUICK_ACTIONS = [
  { label: 'Invoices', page: 'invoices', icon: 'i-file-text' },
  { label: 'Customers', page: 'customers', icon: 'i-users' },
  { label: 'Orders', page: 'orders', icon: 'i-wrench' },
  { label: 'Expenses', page: 'expenses', icon: 'i-wallet' },
  { label: 'Payments', page: 'payments', icon: 'i-credit-card' },
];

const { customers, orders, invoices, payments, expenses, referenceDate: REF } = loadDemoState();

/* ==========================================================================
   2. Small helpers
   ========================================================================== */

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clampPct = (n) => Math.min(100, Math.max(0, Number(n) || 0));
const monthOf = (iso) => String(iso).slice(0, 7);

/** DOM builder: text goes through textContent; children are nodes or safe strings. */
function h(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  Object.entries(options.attrs ?? {}).forEach(([k, v]) => node.setAttribute(k, v));
  node.append(...children.filter(Boolean));
  return node;
}

function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `${SPRITE}#${name}`);
  svg.append(use);
  return svg;
}

function progress(pct, label) {
  const bar = h('div', { className: 'progress__bar' });
  bar.style.setProperty('--value', `${clampPct(pct)}%`);
  return h('div', {
    className: 'progress',
    attrs: {
      role: 'progressbar',
      'aria-label': label,
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': String(Math.round(clampPct(pct))),
    },
  }, [bar]);
}

const emptyState = (text) =>
  h('div', { className: 'empty-state dash-empty' }, [h('p', { className: 'empty-state__text', text })]);

/* ==========================================================================
   3. Month and date helpers (UTC keys so there is no timezone drift)
   ========================================================================== */

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

const CURRENT = monthOf(REF);
const PREVIOUS = shiftMonth(CURRENT, -1);
const LAST_6 = [-5, -4, -3, -2, -1, 0].map((d) => shiftMonth(CURRENT, d));
const LAST_6_SET = new Set(LAST_6);
const PREV_END = (() => {
  const [y, m] = CURRENT.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10); // last day of previous month
})();

/** Format a year-month key as a localized month and year. */
const monthLabel = (key) => formatDate(`${key}-01`, { day: undefined });

/** Month name in en-IN, e.g. "May" (short) or "May" (long). */
function monthName(key, style = 'short') {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: style, timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, 1)));
}

/* ==========================================================================
   4. Data model (all values derived from mock data)
   ========================================================================== */

const customerById = new Map(customers.map((c) => [c.id, c]));
const customerName = (id) => customerById.get(id)?.name ?? 'Unknown customer';

const paymentsByInvoice = new Map();
payments.forEach((p) => {
  const list = paymentsByInvoice.get(p.invoiceId) ?? [];
  list.push(p);
  paymentsByInvoice.set(p.invoiceId, list);
});

/** Balance left on an invoice, optionally counting only payments on or before asOf. */
function balanceOf(inv, asOf = null) {
  const paid = (paymentsByInvoice.get(inv.id) ?? [])
    .filter((p) => asOf === null || p.date <= asOf)
    .reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, roundPaise(inv.total - paid));
}

/** Sum of balances on invoices issued by asOf (unpaid and partly paid). */
function outstandingAsOf(asOf) {
  return roundPaise(
    invoices
      .filter((inv) => inv.issueDate <= asOf)
      .reduce((sum, inv) => sum + balanceOf(inv, asOf), 0),
  );
}

function monthTotals(key) {
  return {
    revenue: roundPaise(sumBy(invoices.filter((i) => monthOf(i.issueDate) === key), 'total')),
    expenses: roundPaise(sumBy(expenses.filter((e) => monthOf(e.date) === key), 'amount')),
    collected: roundPaise(sumBy(payments.filter((p) => monthOf(p.date) === key), 'amount')),
    orders: orders.filter((o) => monthOf(o.orderDate) === key).length,
  };
}

function buildModel() {
  const series = LAST_6.map((key) => ({ key, ...monthTotals(key) }));
  const cur = monthTotals(CURRENT);
  const prev = monthTotals(PREVIOUS);

  const windowInvoices = invoices.filter((i) => LAST_6_SET.has(monthOf(i.issueDate)));
  const windowIds = new Set(windowInvoices.map((i) => i.id));
  const revenue6 = roundPaise(sumBy(series, 'revenue'));
  const billed6 = roundPaise(sumBy(windowInvoices, 'total'));
  const collected6 = roundPaise(sumBy(payments.filter((p) => windowIds.has(p.invoiceId)), 'amount'));
  const expenses6 = roundPaise(sumBy(series, 'expenses'));

  const overdueInvoices = invoices
    .filter((i) => i.status === 'Overdue')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
  const overdueBalance = roundPaise(overdueInvoices.reduce((s, i) => s + balanceOf(i), 0));

  const byCustomer = new Map();
  windowInvoices.forEach((inv) => {
    byCustomer.set(inv.customerId, (byCustomer.get(inv.customerId) ?? 0) + inv.total);
  });
  const topCustomers = [...byCustomer]
    .map(([id, total]) => ({ id, name: customerName(id), total: roundPaise(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const upcoming = invoices
    .filter((i) => i.status !== 'Paid' && i.dueDate >= REF && balanceOf(i) > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id))
    .slice(0, 5);

  const recentPayments = [...payments]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 6);

  const recentOrders = [...orders]
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.id.localeCompare(a.id))
    .slice(0, 5);

  return {
    series,
    cur,
    prev,
    revenue6,
    billed6,
    collected6,
    expenses6,
    overdueBalance,
    overdueInvoices: overdueInvoices.slice(0, 5),
    overdueCount: overdueInvoices.length,
    upcoming,
    recentPayments,
    recentOrders,
    topCustomers,
    outstandingNow: outstandingAsOf(REF),
    outstandingBefore: outstandingAsOf(PREV_END),
    netCur: roundPaise(cur.collected - cur.expenses),
    netPrev: roundPaise(prev.collected - prev.expenses),
    collectionRate: billed6 ? (collected6 / billed6) * 100 : 0,
    expenseRatio: revenue6 ? (expenses6 / revenue6) * 100 : 0,
    overdueShare: billed6 ? (overdueBalance / billed6) * 100 : 0,
  };
}

/**
 * Describe a month-over-month change. Percent when the previous value is
 * non-zero, otherwise the absolute change.
 */
function describeDelta(cur, prev, { goodWhenUp = true, money = true, vs }) {
  const diff = roundPaise(cur - prev);
  if (diff === 0) return { text: `No change vs ${vs}`, tone: 'flat' };
  const up = diff > 0;
  const tone = up === goodWhenUp ? 'good' : 'bad';
  const magnitude = prev === 0
    ? (money ? formatINR(Math.abs(diff)) : formatNumber(Math.abs(diff)))
    : formatPercent((Math.abs(diff) / Math.abs(prev)) * 100, 1);
  return { text: `${up ? '↑' : '↓'} ${magnitude} vs ${vs}`, tone };
}

/* ==========================================================================
   5. Layout: built once with skeleton placeholders
   ========================================================================== */

function skeletonLines(count = 3) {
  return h('div', { className: 'dash-skeleton' },
    Array.from({ length: count }, () => h('div', { className: 'skeleton skeleton--line' })));
}

function panel({ title, subtitle = '', placeholder = 'lines', extraClass = '' }) {
  let body;
  if (placeholder === 'chart') body = h('div', { className: 'dash-chart skeleton' });
  else if (placeholder === 'lines') body = h('div', { className: 'dash-body' }, [skeletonLines()]);
  else body = h('div', { className: 'dash-body' });
  const header = h('div', { className: 'card__header' }, [
    h('div', {}, [
      h('h3', { className: 'card__title', text: title }),
      subtitle ? h('p', { className: 'card__subtitle', text: subtitle }) : null,
    ]),
  ]);
  const card = h('article', { className: `card dash-card ${extraClass}`.trim() }, [header, body]);
  return { card, body };
}

function kpiCard(label, iconName) {
  const value = h('p', { className: 'kpi__value skeleton' });
  const delta = h('span', { className: 'kpi__delta' });
  delta.hidden = true;
  const hint = h('p', { className: 'field__hint' });
  hint.hidden = true;
  const card = h('article', { className: 'card kpi-card' }, [
    h('div', { className: 'kpi-card__head' }, [
      h('span', { className: 'icon-tile' }, [icon(iconName)]),
      h('span', { className: 'kpi__label', text: label }),
    ]),
    h('div', { className: 'kpi' }, [value, delta, hint]),
  ]);
  return { card, value, delta, hint };
}

function buildLayout(root) {
  const kpis = [
    kpiCard('Total Revenue', 'i-trending-up'),
    kpiCard('Outstanding Payments', 'i-clock'),
    kpiCard('Total Orders', 'i-wrench'),
    kpiCard('Monthly Expenses', 'i-wallet'),
    kpiCard('Net Business Income', 'i-bar-chart'),
  ];
  const kpiGrid = h('section', {
    className: 'grid-kpi',
    attrs: { 'aria-label': 'Key figures' },
  }, kpis.map((k) => k.card));

  const bar = panel({ title: 'Revenue vs expenses', subtitle: 'Last 6 months', placeholder: 'chart' });
  const line = panel({ title: 'Payment collection trend', subtitle: 'Collected per month', placeholder: 'chart' });
  const top = panel({ title: 'Sales by top customers', subtitle: 'Last 6 months' });
  const chartsGrid = h('section', {
    className: 'grid-main',
    attrs: { 'aria-label': 'Charts' },
  }, [bar.card, h('div', { className: 'dash-stack' }, [line.card, top.card])]);

  const transactions = panel({ title: 'Recent transactions', subtitle: 'Last 6 payments' });
  const upcoming = panel({ title: 'Upcoming payments', subtitle: 'Unpaid invoices, soonest due' });
  const overdue = panel({ title: 'Overdue invoices', subtitle: 'Most overdue first' });
  const recentOrders = panel({ title: 'Recent orders', subtitle: 'Latest 5' });
  const health = panel({ title: 'Business health', subtitle: 'Last 6 months' });
  const actions = panel({ title: 'Quick actions', subtitle: 'Jump to a section', placeholder: 'none' });
  const widgetGrid = h('section', {
    className: 'dash-widgets',
    attrs: { 'aria-label': 'Activity and actions' },
  }, [transactions, upcoming, overdue, recentOrders, health, actions].map((p) => p.card));

  root.replaceChildren(kpiGrid, chartsGrid, widgetGrid);

  return {
    kpis,
    chart: { bar: bar.body, line: line.body },
    top: top.body,
    widgets: {
      transactions: transactions.body,
      upcoming: upcoming.body,
      overdue: overdue.body,
      recentOrders: recentOrders.body,
      health: health.body,
      actions: actions.body,
    },
  };
}

/* ==========================================================================
   6. Renderers
   ========================================================================== */

/** Count up from 0 to target over COUNT_MS, or set the final value at once. */
function countUp(el, target, format, animate) {
  if (!animate) {
    el.textContent = format(target);
    return;
  }
  const start = performance.now();
  el.textContent = format(0);
  const step = (now) => {
    const t = Math.min(1, (now - start) / COUNT_MS);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = format(target * eased);
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = format(target);
  };
  requestAnimationFrame(step);
}

function renderKpis(kpis, m, state) {
  const animate = !state.counted && !reducedMotion();
  state.counted = true;
  const vsPrev = monthName(PREVIOUS);
  const hintPeriod = `${monthLabel(LAST_6[0])} – ${monthLabel(CURRENT)}`;

  const specs = [
    {
      value: m.revenue6,
      format: formatINR,
      hint: `Invoices issued ${hintPeriod}`,
      delta: describeDelta(m.cur.revenue, m.prev.revenue, { vs: vsPrev }),
    },
    {
      value: m.outstandingNow,
      format: formatINR,
      hint: 'Unpaid and partly paid invoices',
      delta: describeDelta(m.outstandingNow, m.outstandingBefore, { goodWhenUp: false, vs: vsPrev }),
    },
    {
      value: orders.length,
      format: (value) => formatNumber(Math.round(value)),
      hint: 'All orders logged',
      delta: describeDelta(m.cur.orders, m.prev.orders, { money: false, vs: vsPrev }),
    },
    {
      value: m.cur.expenses,
      format: formatINR,
      hint: `Expenses in ${monthLabel(CURRENT)}`,
      delta: describeDelta(m.cur.expenses, m.prev.expenses, { goodWhenUp: false, vs: vsPrev }),
    },
    {
      value: m.netCur,
      format: formatINR,
      hint: `Collected minus expenses, ${monthLabel(CURRENT)}`,
      delta: describeDelta(m.netCur, m.netPrev, { vs: vsPrev }),
    },
  ];

  specs.forEach((spec, i) => {
    const ref = kpis[i];
    ref.value.classList.remove('skeleton');
    countUp(ref.value, spec.value, spec.format, animate);
    ref.delta.className = `kpi__delta is-${spec.delta.tone}`;
    ref.delta.textContent = spec.delta.text;
    ref.delta.hidden = false;
    ref.hint.textContent = spec.hint;
    ref.hint.hidden = false;
  });
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: reducedMotion() ? false : { duration: CHART_MS, easing: 'easeOutQuart' },
    plugins: {
      legend: { labels: { color: BRAND.forest, usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatINR(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: BRAND.muted } },
      y: {
        beginAtZero: true,
        grid: { color: BRAND.grid },
        ticks: { color: BRAND.muted, callback: (v) => formatINR(v) },
      },
    },
  };
}

/**
 * Mount a Chart.js chart into a fixed-height wrapper. Shows an inline
 * empty state when window.Chart is missing or construction fails.
 */
function mountChart(wrapper, state, config, aria) {
  wrapper.classList.remove('skeleton');
  const fail = () => wrapper.replaceChildren(emptyState(
    'Chart unavailable: the chart library did not load. Reload the page to try again.',
  ));
  if (!window.Chart) {
    fail();
    return;
  }
  try {
    const canvas = h('canvas', { attrs: { role: 'img', 'aria-label': aria } });
    wrapper.replaceChildren(canvas);
    state.charts.push(new window.Chart(canvas, config));
  } catch {
    fail();
  }
}

function renderCharts(refs, m, state) {
  const labels = LAST_6.map(monthLabel);

  mountChart(refs.chart.bar, state, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenue',
          data: m.series.map((s) => s.revenue),
          backgroundColor: BRAND.green,
          borderRadius: 6,
          maxBarThickness: 36,
        },
        {
          label: 'Expenses',
          data: m.series.map((s) => s.expenses),
          backgroundColor: BRAND.lavender,
          borderColor: BRAND.forest,
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 36,
        },
      ],
    },
    options: chartOptions(),
  }, 'Bar chart of revenue and expenses for the last six months');

  mountChart(refs.chart.line, state, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Collected',
        data: m.series.map((s) => s.collected),
        borderColor: BRAND.green,
        backgroundColor: 'rgba(119, 120, 92, 0.14)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: BRAND.green,
        pointRadius: 4,
      }],
    },
    options: { ...chartOptions(), plugins: { ...chartOptions().plugins, legend: { display: false } } },
  }, 'Line chart of payments collected per month for the last six months');
}

function renderTopCustomers(body, m) {
  if (!m.topCustomers.length) {
    body.replaceChildren(emptyState('No sales in the last 6 months yet.'));
    return;
  }
  const max = m.topCustomers[0].total || 1;
  body.replaceChildren(h('ul', { className: 'dash-list' }, m.topCustomers.map((c) => h('li', {
    className: 'dash-list__item dash-list__item--stack',
  }, [
    h('div', { className: 'dash-list__row' }, [
      h('span', { className: 'dash-list__title', text: c.name }),
      h('span', { className: 'dash-list__amount', text: formatINR(c.total) }),
    ]),
    progress((c.total / max) * 100, `${c.name} share of top sales`),
  ]))));
}

function listItem({ title, meta, side, badge = null }) {
  return h('li', { className: 'dash-list__item' }, [
    h('div', { className: 'dash-list__main' }, [
      h('span', { className: 'dash-list__title', text: title }),
      h('span', { className: 'dash-list__meta', text: meta }),
    ]),
    h('div', { className: 'dash-list__side' }, [
      h('span', { className: 'dash-list__amount', text: side }),
      badge,
    ]),
  ]);
}

const listOrEmpty = (items, text, makeItem) =>
  (items.length ? h('ul', { className: 'dash-list' }, items.map(makeItem)) : emptyState(text));

function renderWidgets(w, m) {
  w.transactions.replaceChildren(listOrEmpty(m.recentPayments, 'No payments recorded yet.', (p) => listItem({
    title: customerName(p.customerId),
    meta: `${p.method} · ${formatDate(p.date)}`,
    side: formatINR(p.amount),
  })));

  w.upcoming.replaceChildren(listOrEmpty(m.upcoming, 'No upcoming payments right now.', (inv) => listItem({
    title: customerName(inv.customerId),
    meta: `${inv.number} · Due ${formatDate(inv.dueDate)}`,
    side: formatINR(balanceOf(inv)),
  })));

  w.overdue.replaceChildren(listOrEmpty(m.overdueInvoices, 'No overdue invoices. Nice work.', (inv) => {
    const days = Math.max(0, daysBetween(inv.dueDate, REF));
    return listItem({
      title: customerName(inv.customerId),
      meta: `${inv.number} · Due ${formatDate(inv.dueDate)}`,
      side: formatINR(balanceOf(inv)),
      badge: h('span', {
        className: 'badge badge--overdue',
        text: `${days} ${days === 1 ? 'day' : 'days'} overdue`,
      }),
    });
  }));

  w.recentOrders.replaceChildren(listOrEmpty(m.recentOrders, 'No orders yet.', (o) => listItem({
    title: o.service,
    meta: `${customerName(o.customerId)} · ${formatDate(o.orderDate)}`,
    side: formatINR(o.estimate),
    badge: h('span', {
      className: `badge ${STATUS_BADGE[o.status] ?? 'badge--draft'}`,
      text: o.status,
    }),
  })));

  const healthRows = [
    {
      label: 'Collection rate',
      value: m.collectionRate,
      note: `${formatINR(m.collected6)} collected of ${formatINR(m.billed6)} billed`,
    },
    {
      label: 'Expense ratio',
      value: m.expenseRatio,
      note: `${formatINR(m.expenses6)} spent against ${formatINR(m.revenue6)} revenue`,
    },
    {
      label: 'Overdue share',
      value: m.overdueShare,
      note: `${formatINR(m.overdueBalance)} overdue of ${formatINR(m.billed6)} billed`,
    },
  ];
  w.health.replaceChildren(h('div', { className: 'dash-health' }, healthRows.map((row) => h('div', {
    className: 'dash-health__row',
  }, [
    h('div', { className: 'dash-health__head' }, [
      h('span', { className: 'dash-list__title', text: row.label }),
      h('strong', { text: formatPercent(row.value, 0) }),
    ]),
    progress(row.value, row.label),
    h('p', { className: 'field__hint', text: row.note }),
  ]))));

  w.actions.replaceChildren(h('div', { className: 'dash-actions' }, QUICK_ACTIONS.map((a) => h('a', {
    className: 'btn btn--secondary',
    attrs: { href: `index.php?page=${a.page}` },
  }, [icon(a.icon), a.label]))));
}

function destroyCharts(state) {
  state.charts.forEach((chart) => chart.destroy());
  state.charts = [];
}

function renderAll(refs, state) {
  destroyCharts(state);
  const m = buildModel();
  renderKpis(refs.kpis, m, state);
  renderCharts(refs, m, state);
  renderTopCustomers(refs.top, m);
  renderWidgets(refs.widgets, m);
  document.getElementById('overview-root')?.classList.add('motion-stagger');
}

/* ==========================================================================
   7. Init: only when #overview-root exists
   ========================================================================== */

function initDashboard() {
  const root = document.getElementById('overview-root');
  if (!root) return;

  const firstName = (document.body.dataset.userName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0] || 'there';
  const timezone = document.body.dataset.userTimezone || 'Asia/Kolkata';
  const greeting = document.getElementById('overview-greeting');
  const liveClock = document.getElementById('overview-live-clock');
  const updateGreetingAndClock = () => {
    const now = new Date();
    let hour;
    try {
      const parts = new Intl.DateTimeFormat('en-IN', {
        timeZone: timezone,
        hour: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(now);
      hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
    } catch {
      hour = now.getHours();
    }

    const phrase = hour >= 5 && hour < 12
      ? 'Good morning'
      : hour >= 12 && hour < 17
        ? 'Good afternoon'
        : hour >= 17 && hour < 21
          ? 'Good evening'
          : 'Welcome back';
    if (greeting) greeting.textContent = `${phrase}, ${firstName}`;

    if (liveClock) {
      let timeText;
      try {
        timeText = new Intl.DateTimeFormat('en-IN', {
          timeZone: timezone,
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(now);
      } catch {
        timeText = now.toLocaleString('en-IN');
      }
      liveClock.textContent = timeText;
    }
  };
  updateGreetingAndClock();
  window.setInterval(updateGreetingAndClock, 1000);

  const subtitle = document.getElementById('overview-subtitle');
  if (subtitle) {
    subtitle.textContent = `Here is where your business stands today, ${new Intl.DateTimeFormat('en-IN', {
      timeZone: timezone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date())}.`;
  }

  const refs = buildLayout(root);
  const state = { charts: [], counted: false };
  window.setTimeout(() => renderAll(refs, state), reducedMotion() ? 0 : SKELETON_MS);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}
