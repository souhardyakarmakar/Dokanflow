import { loadDemoState } from './data/demo-state.js';

const input = document.getElementById('global-search');
const results = document.getElementById('global-search-results');
if (input && results) {
  let data = loadDemoState();
  const routeFor = {
    Customer: 'customers',
    Order: 'orders',
    Invoice: 'invoices',
    Payment: 'payments',
    Expense: 'expenses',
  };
  const customerName = (id) => data.customers.find((customer) => customer.id === id)?.name || 'Unknown customer';
  const makeRecords = () => [
    ...data.customers.map((item) => ({
      type: 'Customer',
      title: item.name,
      detail: [item.id, item.phone, item.email, item.city].filter(Boolean).join(' · '),
      fields: [item.id, item.name, item.phone, item.email, item.city, item.type],
    })),
    ...data.orders.map((item) => ({
      type: 'Order',
      title: item.service,
      detail: [item.id, customerName(item.customerId), item.status].join(' · '),
      fields: [item.id, item.service, customerName(item.customerId), item.status],
    })),
    ...data.invoices.map((item) => ({
      type: 'Invoice',
      title: item.number,
      detail: [customerName(item.customerId), item.status].join(' · '),
      fields: [item.id, item.number, customerName(item.customerId), item.status, ...item.items.map((line) => line.description)],
    })),
    ...data.payments.map((item) => ({
      type: 'Payment',
      title: item.id,
      detail: [customerName(item.customerId), item.reference, item.method].filter(Boolean).join(' · '),
      fields: [item.id, item.reference, item.method, customerName(item.customerId), item.invoiceId],
    })),
    ...data.expenses.map((item) => ({
      type: 'Expense',
      title: item.description,
      detail: [item.id, item.category, item.date].join(' · '),
      fields: [item.id, item.description, item.category, item.method, item.date],
    })),
  ];

  const closeResults = () => {
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  };
  const renderResults = () => {
    const query = input.value.trim().toLocaleLowerCase();
    results.replaceChildren();
    if (query.length < 2) {
      closeResults();
      return;
    }

    const matches = makeRecords()
      .filter((record) => record.fields.some((value) => String(value || '').toLocaleLowerCase().includes(query)))
      .slice(0, 7);
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'global-search-results__empty';
      empty.setAttribute('role', 'option');
      empty.setAttribute('aria-disabled', 'true');
      empty.textContent = 'No matching demo records.';
      results.append(empty);
    } else {
      const encodedQuery = encodeURIComponent(input.value.trim());
      matches.forEach((record) => {
        const link = document.createElement('a');
        link.className = 'global-search-results__item';
        link.setAttribute('role', 'option');
        link.href = `index.php?page=${routeFor[record.type]}&search=${encodedQuery}`;

        const primary = document.createElement('span');
        primary.className = 'global-search-results__title';
        primary.textContent = `${record.type} - ${record.title}`;
        const secondary = document.createElement('span');
        secondary.className = 'global-search-results__detail';
        secondary.textContent = record.detail;
        link.append(primary, secondary);
        results.append(link);
      });
    }
    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  input.addEventListener('input', renderResults);
  input.addEventListener('focus', renderResults);
  input.addEventListener('blur', () => window.setTimeout(() => {
    if (!input.form?.contains(document.activeElement)) closeResults();
  }, 120));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && !results.hidden) {
      event.preventDefault();
      results.querySelector('a[href]')?.focus();
    }
  });
  results.addEventListener('keydown', (event) => {
    const options = [...results.querySelectorAll('a[href]')];
    const index = options.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' && index < options.length - 1) {
      event.preventDefault();
      options[index + 1]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index <= 0) input.focus();
      else options[index - 1]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeResults();
      input.focus();
    }
  });
  input.form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const firstResult = results.querySelector('a[href]');
    if (!firstResult) return;
    window.location.assign(firstResult.href);
  });
  window.addEventListener('dokanflow:data-updated', () => {
    data = loadDemoState();
    renderResults();
  });
}
