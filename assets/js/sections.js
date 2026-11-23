/**
 * Frontend-only workspace modules. Mutable demo state is kept in memory and
 * derived from the deterministic seed data; no requests or backend writes.
 */
import { loadDemoState, saveDemoState } from './data/demo-state.js';
import { formatDate, formatINR, formatNumber, roundPaise, sumBy } from './utils/format.js';
import { closeModal, openModal, toast } from './app.js';

const root = document.getElementById('section-root');
if (root) {
  const data = loadDemoState();
  const persistDemoState = () => {
    saveDemoState(data);
    window.dispatchEvent(new Event('dokanflow:data-updated'));
  };
  const page = root.dataset.section;
  const referenceDate = data.referenceDate;
  let reportTab = 'reports';
  let reportPeriod = 'monthly';
  let reportMonth = referenceDate.slice(0, 7);
  let reportYear = referenceDate.slice(0, 4);
  let reportStart = '';
  let reportEnd = '';
  const trailingNumber = (value) => Number(String(value || '').match(/(\d+)$/)?.[1] || 0);
  let nextCustomer = Math.max(0, ...data.customers.map((item) => trailingNumber(item.id))) + 1;
  let nextOrder = Math.max(1000, ...data.orders.map((item) => trailingNumber(item.id))) + 1;
  let nextInvoice = Math.max(0, ...data.invoices.map((item) => trailingNumber(item.number || item.id))) + 1;
  let nextExpense = Math.max(0, ...data.expenses.map((item) => trailingNumber(item.id))) + 1;
  let nextPayment = Math.max(0, ...data.payments.map((item) => trailingNumber(item.id))) + 1;
  let hasInitialSectionRender = false;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const icon = (name) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `assets/img/icons.svg#${name}`);
    svg.append(use);
    return svg;
  };
  const node = (tag, attrs = {}, children = []) => {
    const item = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'text') item.textContent = value;
      else if (key === 'className') item.className = value;
      else if (key === 'dataset') Object.entries(value).forEach(([k, v]) => { item.dataset[k] = v; });
      else if (value !== null && value !== undefined) item.setAttribute(key, String(value));
    });
    children.filter((child) => child !== null && child !== undefined && child !== false)
      .forEach((child) => item.append(child instanceof Node ? child : document.createTextNode(String(child))));
    return item;
  };
  const money = (value) => {
    const amount = Number(value) || 0;
    return formatINR(amount, { decimals: Number.isInteger(amount) ? 0 : 2 });
  };
  const date = (value) => value ? formatDate(value) : '—';
  const addDays = (value, days) => {
    const result = new Date(`${value}T00:00:00Z`);
    result.setUTCDate(result.getUTCDate() + Number(days || 0));
    return result.toISOString().slice(0, 10);
  };
  const customerById = (id) => data.customers.find((item) => item.id === id);
  const customerName = (id) => customerById(id)?.name ?? 'Unknown customer';
  const invoiceBalance = (invoice) => roundPaise(Math.max(0, invoice.total - (invoice.paidAmount || 0)));
  const customerInvoices = (id) => data.invoices.filter((invoice) => invoice.customerId === id);
  const customerMetrics = (id) => {
    const invoices = customerInvoices(id);
    return {
      billed: roundPaise(sumBy(invoices, 'total')),
      paid: roundPaise(sumBy(invoices, 'paidAmount')),
      outstanding: roundPaise(invoices.reduce((total, invoice) => total + invoiceBalance(invoice), 0)),
      invoices,
    };
  };
  const statusClass = (status) => ({
    Paid: 'badge--paid',
    'Partially Paid': 'badge--partial',
    Unpaid: 'badge--pending',
    Overdue: 'badge--overdue',
    Received: 'badge--info',
    'In Progress': 'badge--pending',
    Ready: 'badge--paid',
    Delivered: 'badge--draft',
  }[status] || 'badge--draft');
  const statusBadge = (status) => node('span', { className: `badge ${statusClass(status)}`, text: status });
  const card = (title, body, subtitle = '') => node('article', { className: 'card section-card' }, [
    node('header', { className: 'card__header' }, [
      node('div', {}, [
        node('h3', { className: 'card__title', text: title }),
        subtitle ? node('p', { className: 'card__subtitle', text: subtitle }) : null,
      ]),
    ]),
    body,
  ]);
  const metricCard = (label, value, hint, iconName = 'i-bar-chart') => node('article', { className: 'card kpi-card' }, [
    node('div', { className: 'kpi-card__head' }, [
      node('span', { className: 'icon-tile' }, [icon(iconName)]),
      node('span', { className: 'kpi__label', text: label }),
    ]),
    node('div', { className: 'kpi' }, [
      node('p', { className: 'kpi__value', text: value }),
      node('p', { className: 'field__hint', text: hint }),
    ]),
  ]);
  const metrics = (items) => node('section', { className: 'section-metrics', 'aria-label': 'Summary' },
    items.map((item) => metricCard(...item)));
  const field = (label, name, value = '', type = 'text', options = {}) => {
    const id = `field-${name}-${Math.random().toString(36).slice(2, 8)}`;
    const labelNode = node('label', { className: 'field__label', for: id, text: label });
    let control;
    if (options.choices) {
      control = node('select', {
        className: 'select',
        id,
        name,
        required: options.required === false ? null : 'required',
      }, options.choices.map(([choice, caption]) =>
        node('option', { value: choice, selected: String(choice) === String(value) ? 'selected' : null, text: caption })));
    } else if (type === 'textarea') {
      control = node('textarea', {
        className: 'textarea',
        id,
        name,
        required: options.required ? 'required' : null,
        rows: options.rows || 3,
        placeholder: options.placeholder || null,
      }, [value || '']);
    } else {
      control = node('input', {
        className: 'input',
        id,
        name,
        type,
        value: value ?? '',
        required: options.required === false ? null : 'required',
        min: options.min,
        max: options.max,
        step: options.step,
        placeholder: options.placeholder || null,
      });
    }
    return node('div', { className: 'field' }, [labelNode, control,
      options.hint ? node('small', { className: 'field__hint', text: options.hint }) : null]);
  };
  const formGrid = (...children) => node('div', { className: 'form-grid' }, children);
  const button = (text, action, attrs = {}) => node('button', {
    className: attrs.className || 'btn btn--secondary btn--sm',
    type: 'button',
    'data-section-action': action,
    'data-id': attrs.id,
    'aria-label': attrs.label,
    text,
  });
  const empty = (message) => node('div', { className: 'empty-state section-empty' }, [
    icon('i-inbox'),
    node('p', { className: 'empty-state__text', text: message }),
  ]);
  const table = (headers, rows, emptyMessage) => {
    if (!rows.length) return empty(emptyMessage);
    const head = node('thead', {}, [node('tr', {}, headers.map((header) => node('th', {
      scope: 'col', text: header,
    })))]);
    const body = node('tbody', {}, rows.map((row) => node('tr', {}, row.map((cell, index) =>
      node('td', { 'data-label': headers[index] || '' }, [cell])))));
    return node('div', { className: 'table-wrap' }, [node('table', { className: 'table table--cards' }, [head, body])]);
  };
  const rowActions = (kind, id, { view = true, remove = true } = {}) => node('div', { className: 'row-actions' }, [
    view ? button('View', `${kind}-view`, { id, label: `View ${kind}` }) : null,
    button('Edit', `${kind}-edit`, { id, label: `Edit ${kind}` }),
    remove ? button('Delete', `${kind}-delete`, { id, label: `Delete ${kind}`, className: 'btn btn--ghost btn--sm text-danger' }) : null,
  ]);
  const toolbar = (placeholder, filters = []) => node('div', { className: 'section-toolbar' }, [
    node('label', { className: 'search-control' }, [
      icon('i-search'),
      node('input', {
        className: 'input section-search',
        type: 'search',
        placeholder,
        'aria-label': placeholder,
      }),
    ]),
    ...filters,
  ]);
  const filterSelect = (name, label, options) => node('label', { className: 'filter-control' }, [
    node('span', { className: 'sr-only', text: label }),
    node('select', { className: 'select section-filter', 'data-filter': name, 'aria-label': label },
      options.map(([value, caption]) => node('option', { value, text: caption }))),
  ]);
  const sortSelect = (label, options) => node('label', { className: 'filter-control' }, [
    node('span', { className: 'sr-only', text: label }),
    node('select', { className: 'select', 'data-sort': 'customers', 'aria-label': label },
      options.map(([value, caption]) => node('option', { value, text: caption }))),
  ]);
  const setRows = (content) => {
    if (!hasInitialSectionRender) {
      content.classList.add('motion-stagger');
      hasInitialSectionRender = true;
    }
    root.replaceChildren(content);
  };
  const openDialog = (title, content, submitLabel, onSubmit, { wide = false, drawer = false } = {}) => {
    const id = `dialog-${Date.now()}`;
    content.classList.add('motion-stagger');
    const form = node('form', { className: 'dialog-form', novalidate: null });
    const modal = node('div', {
      className: `modal${drawer ? ' modal--drawer' : ''}`,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': `${id}-title`,
      hidden: 'hidden',
    });
    const panel = node('div', { className: `modal__panel${wide ? ' modal__panel--wide' : ''}${drawer ? ' modal__panel--drawer' : ''}` }, [
      node('header', { className: 'modal__header' }, [
        node('h3', { id: `${id}-title`, text: title }),
        node('button', {
          className: 'btn btn--ghost btn--icon',
          type: 'button',
          'data-action': 'close-modal',
          'aria-label': 'Close dialog',
        }, [icon('i-x')]),
      ]),
      node('div', { className: 'modal__body' }, [content]),
      node('footer', { className: 'modal__footer' }, [
        node('button', { className: 'btn btn--secondary', type: 'button', 'data-action': 'close-modal', text: 'Cancel' }),
        node('button', { className: 'btn btn--primary', type: 'submit', text: submitLabel }),
      ]),
    ]);
    form.append(panel);
    modal.append(form);
    document.body.append(modal);
    modal.addEventListener('modal:closed', () => modal.remove(), { once: true });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const saved = onSubmit(new FormData(form), form);
      if (saved === false) return;
      persistDemoState();
      closeModal(modal);
      window.setTimeout(() => modal.remove(), 300);
      render();
    });
    openModal(modal, document.activeElement);
    return { modal, form };
  };
  const confirm = (title, message, onConfirm) => {
    const content = node('p', { text: message });
    const dialog = openDialog(title, content, 'Delete', () => {
      onConfirm();
      toast({ title: 'Deleted', message: 'The demo record was removed.', variant: 'success' });
    });
    dialog.modal.querySelector('.modal__footer .btn--primary')?.classList.add('btn--danger');
  };

  function renderCustomers(query = '', type = 'all', sort = activeSort) {
    const filtered = data.customers.filter((customer) => {
      const match = `${customer.name} ${customer.phone} ${customer.email} ${customer.city}`.toLowerCase().includes(query.toLowerCase());
      return match && (type === 'all' || customer.type === type);
    });
    filtered.sort((a, b) => {
      if (sort === 'balance-desc') return customerMetrics(b.id).outstanding - customerMetrics(a.id).outstanding;
      if (sort === 'newest') return b.since.localeCompare(a.since);
      return a.name.localeCompare(b.name);
    });
    const content = node('div', { className: 'section-stack' }, [
      metrics([
        ['Customers', formatNumber(data.customers.length), 'In your address book', 'i-users'],
        ['Business accounts', formatNumber(data.customers.filter((c) => c.type === 'Business').length), 'Shops and teams', 'i-package'],
        ['Outstanding', money(data.customers.reduce((sum, c) => sum + customerMetrics(c.id).outstanding, 0)), 'Across all customers', 'i-clock'],
      ]),
      card('Customer directory', node('div', {}, [
        toolbar('Search customers…', [filterSelect('type', 'Filter by customer type', [
          ['all', 'All customers'], ['Individual', 'Individuals'], ['Business', 'Businesses'],
        ]), sortSelect('Sort customers', [
          ['name-asc', 'Name A–Z'], ['balance-desc', 'Balance: high to low'], ['newest', 'Recently added'],
        ])]),
        table(['Customer', 'Contact', 'Type', 'Billed', 'Outstanding', 'Actions'], filtered.map((customer) => {
          const totals = customerMetrics(customer.id);
          return [
            node('div', { className: 'table-primary-cell' }, [
              node('strong', { text: customer.name }),
              node('small', { text: `${customer.city} · Since ${date(customer.since)}` }),
            ]),
            node('div', { className: 'table-primary-cell' }, [
              node('span', { text: customer.phone }),
              node('small', { text: customer.email }),
            ]),
            node('span', { className: 'badge badge--info', text: customer.type }),
            money(totals.billed),
            money(totals.outstanding),
            rowActions('customer', customer.id),
          ];
        }), 'No customers match your search.'),
      ])),
    ]);
    setRows(content);
    bindFilters(renderCustomers);
    const sortControl = root.querySelector('[data-sort="customers"]');
    if (sortControl) {
      sortControl.value = activeSort;
      sortControl.addEventListener('change', () => {
        const keepFocus = document.activeElement === sortControl;
        activeSort = sortControl.value;
        renderCustomers(activeQuery, activeFilter, activeSort);
        if (keepFocus) root.querySelector('[data-sort="customers"]')?.focus();
      });
    }
  }

  function customerForm(existing) {
    const isEdit = Boolean(existing);
    const content = formGrid(
      field('Customer name', 'name', existing?.name || ''),
      field('Type', 'type', existing?.type || 'Individual', 'select', {
        choices: [['Individual', 'Individual'], ['Business', 'Business']],
      }),
      field('Phone number', 'phone', existing?.phone || '', 'tel'),
      field('Email address', 'email', existing?.email || '', 'email', { required: false }),
      field('City', 'city', existing?.city || ''),
    );
    openDialog(isEdit ? 'Edit customer' : 'Add customer', content, isEdit ? 'Save changes' : 'Add customer', (form) => {
      const customer = Object.fromEntries(form.entries());
      if (isEdit) Object.assign(existing, customer);
      else data.customers.unshift({ id: `C${String(nextCustomer++).padStart(3, '0')}`, ...customer, since: referenceDate });
      toast({ title: isEdit ? 'Customer updated' : 'Customer added', message: 'Changes are in this browser demo only.', variant: 'success' });
    });
  }

  function customerDetail(customer) {
    const totals = customerMetrics(customer.id);
    const history = totals.invoices.map((invoice) =>
      node('li', { className: 'detail-list__item' }, [
        node('span', {}, [
          node('strong', { text: invoice.number }),
          node('small', { text: `${date(invoice.issueDate)} · ${invoice.status}` }),
        ]),
        node('strong', { text: money(invoice.total) }),
      ]));
    const detail = node('div', { className: 'section-stack' }, [
      node('div', { className: 'detail-identity' }, [
        node('span', { className: 'avatar avatar--large', text: customer.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('') }),
        node('div', {}, [node('h4', { text: customer.name }), node('p', { className: 'field__hint', text: `${customer.type} · ${customer.city}` })]),
      ]),
      metrics([
        ['Total billed', money(totals.billed), 'All invoices', 'i-file-text'],
        ['Paid', money(totals.paid), 'Recorded collections', 'i-check'],
        ['Outstanding', money(totals.outstanding), 'Balance due', 'i-clock'],
      ]),
      node('div', { className: 'detail-contact' }, [
        node('p', {}, [node('strong', { text: 'Phone ' }), customer.phone]),
        node('p', {}, [node('strong', { text: 'Email ' }), customer.email]),
        node('p', {}, [node('strong', { text: 'Customer since ' }), date(customer.since)]),
      ]),
      node('section', {}, [node('h4', { text: 'Invoice history' }),
        history.length ? node('ul', { className: 'detail-list' }, history) : empty('No invoices for this customer yet.')]),
    ]);
    openDialog(customer.name, detail, 'Done', () => {}, { drawer: true });
  }

  function renderOrders(query = '', status = 'all') {
    const filtered = data.orders.filter((order) => {
      const match = `${order.id} ${order.service} ${customerName(order.customerId)}`.toLowerCase().includes(query.toLowerCase());
      return match && (status === 'all' || order.status === status);
    }).sort((a, b) => b.orderDate.localeCompare(a.orderDate));
    setRows(node('div', { className: 'section-stack' }, [
      metrics([
        ['Active orders', formatNumber(data.orders.filter((o) => !['Delivered'].includes(o.status)).length), 'Received, in progress or ready', 'i-wrench'],
        ['Ready for pickup', formatNumber(data.orders.filter((o) => o.status === 'Ready').length), 'Awaiting customer collection', 'i-check'],
        ['Order value', money(sumBy(data.orders, 'estimate')), 'Estimated total value', 'i-trending-up'],
      ]),
      card('Orders & services', node('div', {}, [
        toolbar('Search orders or customers…', [filterSelect('status', 'Filter by order status', [
          ['all', 'All statuses'], ...['Received', 'In Progress', 'Ready', 'Delivered'].map((value) => [value, value]),
        ])]),
        table(['Order', 'Customer', 'Service', 'Expected', 'Estimate', 'Status', 'Actions'], filtered.map((order) => [
          node('strong', { text: order.id }),
          customerName(order.customerId),
          order.service,
          date(order.expectedDate),
          money(order.estimate),
          node('select', {
            className: 'select compact-select',
            'aria-label': `Update ${order.id} status`,
            'data-order-status': order.id,
          }, ['Received', 'In Progress', 'Ready', 'Delivered'].map((value) =>
            node('option', { value, selected: value === order.status ? 'selected' : null, text: value }))),
          rowActions('order', order.id),
        ]), 'No orders match your filters.'),
      ])),
    ]));
    bindFilters(renderOrders);
  }

  function orderForm(existing) {
    const content = formGrid(
      field('Customer', 'customerId', existing?.customerId || data.customers[0]?.id, 'select', {
        choices: data.customers.map((c) => [c.id, c.name]),
      }),
      field('Service description', 'service', existing?.service || ''),
      field('Estimated price (₹)', 'estimate', existing?.estimate ?? '', 'number', { min: '0.01', step: '0.01' }),
      field('Order date', 'orderDate', existing?.orderDate || referenceDate, 'date'),
      field('Expected delivery', 'expectedDate', existing?.expectedDate || referenceDate, 'date'),
      field('Status', 'status', existing?.status || 'Received', 'select', {
        choices: ['Received', 'In Progress', 'Ready', 'Delivered'].map((value) => [value, value]),
      }),
      field('Notes', 'notes', existing?.notes || '', 'textarea', { required: false }),
    );
    openDialog(existing ? 'Edit order' : 'Create order', content, existing ? 'Save order' : 'Create order', (form) => {
      const values = Object.fromEntries(form.entries());
      values.estimate = Number(values.estimate);
      if (values.expectedDate < values.orderDate) {
        toast({ title: 'Check the dates', message: 'Expected delivery cannot be before the order date.', variant: 'error' });
        return false;
      }
      if (existing) Object.assign(existing, values);
      else data.orders.unshift({ id: `ORD-${nextOrder++}`, invoiceId: null, ...values });
      if (existing?.invoiceId) {
        const linkedInvoice = data.invoices.find((invoice) => invoice.id === existing.invoiceId);
        if (linkedInvoice) linkedInvoice.customerId = values.customerId;
      }
      toast({ title: existing ? 'Order updated' : 'Order created', message: 'The order is saved in this browser demo.', variant: 'success' });
    }, { wide: true });
  }

  function orderDetail(order) {
    const events = [
      ['Order received', order.orderDate],
      [order.status === 'Received' ? 'Current status' : 'Work started', order.orderDate],
      ...(order.status === 'Ready' || order.status === 'Delivered' ? [['Ready for pickup', order.expectedDate]] : []),
      ...(order.status === 'Delivered' ? [['Delivered', order.expectedDate]] : []),
    ];
    const content = node('div', { className: 'section-stack' }, [
      node('div', { className: 'detail-identity' }, [
        node('span', { className: 'icon-tile' }, [icon('i-wrench')]),
        node('div', {}, [
          node('h4', { text: order.service }),
          node('p', { className: 'field__hint', text: `${order.id} · ${customerName(order.customerId)}` }),
        ]),
        statusBadge(order.status),
      ]),
      node('div', { className: 'detail-contact' }, [
        node('p', {}, [node('strong', { text: 'Estimate ' }), money(order.estimate)]),
        node('p', {}, [node('strong', { text: 'Expected delivery ' }), date(order.expectedDate)]),
        node('p', {}, [node('strong', { text: 'Notes ' }), order.notes || 'No notes added.']),
      ]),
      node('ol', { className: 'timeline' }, events.map(([label, at]) => node('li', {}, [
        node('strong', { text: label }), node('span', { text: date(at) }),
      ]))),
    ]);
    openDialog(`Order ${order.id}`, content, 'Done', () => {}, { drawer: true });
  }

  function calculateInvoice(items, discount, gstEnabled) {
    const subtotal = roundPaise(items.reduce((total, item) => total + item.qty * item.unitPrice, 0));
    const discountAmount = roundPaise(subtotal * (Number(discount) || 0) / 100);
    const taxable = subtotal - discountAmount;
    const tax = gstEnabled ? roundPaise(items.reduce((total, item) => {
      const lineTotal = item.qty * item.unitPrice;
      const discountedLine = subtotal ? lineTotal * taxable / subtotal : 0;
      return total + roundPaise(discountedLine * (Number(item.gstRate) || 0) / 100);
    }, 0)) : 0;
    return { subtotal, discountAmount, tax, total: roundPaise(taxable + tax) };
  }

  function invoiceForm(existing) {
    const items = existing
      ? existing.items.map((item) => ({ ...item }))
      : [{ description: '', qty: 1, unitPrice: 0, gstRate: data.settings.defaultGstRate ?? 18 }];
    const content = node('div', { className: 'section-stack' }, [
      formGrid(
        field('Customer', 'customerId', existing?.customerId || data.customers[0]?.id, 'select', {
          choices: data.customers.map((c) => [c.id, c.name]),
        }),
        field('Order (optional)', 'orderId', existing?.orderId || '', 'select', {
          choices: [['', 'No linked order'], ...data.orders.map((order) => [order.id, `${order.id} · ${order.service}`])],
          required: false,
        }),
        field('Due date', 'dueDate', existing?.dueDate || addDays(referenceDate, data.settings.paymentTerms || 15), 'date'),
        field('Discount (%)', 'discountRate', existing?.discountRate ?? (existing?.subtotal ? (existing.discount / existing.subtotal) * 100 : 0), 'number', { min: '0', max: '100', step: '0.01' }),
      ),
      node('label', { className: 'check-control' }, [
        node('input', { type: 'checkbox', name: 'gstEnabled', checked: existing?.gstEnabled === false ? null : 'checked' }),
        node('span', { text: 'Apply GST using each line item’s rate' }),
      ]),
      node('div', { className: 'invoice-lines-head' }, [
        node('h4', { text: 'Items' }),
        node('button', { className: 'btn btn--secondary btn--sm', type: 'button', 'data-section-action': 'invoice-add-line', text: '+ Add item' }),
      ]),
      node('div', { className: 'invoice-lines' }),
      node('div', { className: 'invoice-total-preview', 'aria-live': 'polite' }),
      existing ? node('p', { className: 'field__hint', text: 'Editing an invoice updates its line items and totals; existing payments remain recorded.' }) : null,
    ]);
    const formDialog = openDialog(existing ? `Edit ${existing.number}` : 'Create invoice', content,
      existing ? 'Save invoice' : 'Create invoice', (formData, formElement) => {
        const rows = [...formElement.querySelectorAll('.invoice-line')];
        const lineItems = rows.map((row) => ({
          description: row.querySelector('[name="description"]').value.trim(),
          qty: Number(row.querySelector('[name="qty"]').value),
          unitPrice: Number(row.querySelector('[name="unitPrice"]').value),
          gstRate: Number(row.querySelector('[name="gstRate"]').value),
        }));
        if (!lineItems.length || lineItems.some((item) => !item.description || item.qty <= 0 || item.unitPrice < 0)) {
          toast({ title: 'Check invoice items', message: 'Add a description, positive quantity and non-negative price for each item.', variant: 'error' });
          return false;
        }
        const customerId = formElement.elements.customerId.value;
        const orderId = formElement.elements.orderId.value || null;
        const linkedOrder = orderId ? data.orders.find((order) => order.id === orderId) : null;
        if (orderId && (!linkedOrder || linkedOrder.customerId !== customerId)) {
          toast({ title: 'Order and customer must match', message: 'Select the customer connected to this order before saving.', variant: 'error' });
          return false;
        }
        if (linkedOrder?.invoiceId && linkedOrder.invoiceId !== existing?.id) {
          toast({ title: 'Order already invoiced', message: 'Choose another order or edit its existing invoice.', variant: 'error' });
          return false;
        }
        const dueDate = formElement.elements.dueDate.value;
        const discountRate = Number(formElement.elements.discountRate.value) || 0;
        const gstEnabled = formElement.elements.gstEnabled.checked;
        const totals = calculateInvoice(lineItems, discountRate, gstEnabled);
        const issueDate = existing?.issueDate || referenceDate;
        const paidAmount = existing?.paidAmount || 0;
        if (paidAmount > totals.total) {
          toast({ title: 'Total is below the amount already paid', message: 'Keep the invoice total at or above its recorded payments.', variant: 'error' });
          return false;
        }
        const status = paidAmount >= totals.total ? 'Paid'
          : dueDate < referenceDate ? 'Overdue'
            : paidAmount > 0 ? 'Partially Paid' : 'Unpaid';
        const number = existing?.number
          || `${data.settings.invoicePrefix || 'INV'}-${issueDate.slice(0, 4)}-${String(nextInvoice++).padStart(4, '0')}`;
        const updated = {
          ...(existing || {}),
          id: existing?.id || number,
          number,
          customerId,
          orderId,
          issueDate,
          dueDate,
          items: lineItems,
          discount: totals.discountAmount,
          discountRate,
          gstEnabled,
          subtotal: totals.subtotal,
          taxTotal: totals.tax,
          total: totals.total,
          paidAmount,
          status,
        };
        if (existing?.orderId && existing.orderId !== orderId) {
          const previousOrder = data.orders.find((order) => order.id === existing.orderId);
          if (previousOrder?.invoiceId === existing.id) previousOrder.invoiceId = null;
        }
        if (existing) Object.assign(existing, updated);
        else data.invoices.unshift(updated);
        if (linkedOrder) linkedOrder.invoiceId = updated.id;
        toast({ title: existing ? 'Invoice updated' : 'Invoice created', message: 'Invoice calculations are saved in this browser demo.', variant: 'success' });
      }, { wide: true });

    const form = formDialog.form;
    const lineRoot = form.querySelector('.invoice-lines');
    const totalsRoot = form.querySelector('.invoice-total-preview');
    const updatePreview = () => {
      const values = [...lineRoot.querySelectorAll('.invoice-line')].map((row) => ({
        qty: Number(row.querySelector('[name="qty"]').value) || 0,
        unitPrice: Number(row.querySelector('[name="unitPrice"]').value) || 0,
        gstRate: Number(row.querySelector('[name="gstRate"]').value) || 0,
      }));
      const totals = calculateInvoice(values, form.elements.discountRate.value, form.elements.gstEnabled.checked);
      totalsRoot.replaceChildren(
        node('span', { text: `Subtotal ${money(totals.subtotal)}` }),
        node('span', { text: `Discount −${money(totals.discountAmount)}` }),
        node('span', { text: `GST ${money(totals.tax)}` }),
        node('strong', { text: `Total ${money(totals.total)}` }),
      );
    };
    form.elements.orderId.addEventListener('change', () => {
      const linkedOrder = data.orders.find((order) => order.id === form.elements.orderId.value);
      if (linkedOrder) form.elements.customerId.value = linkedOrder.customerId;
    });
    const addLine = (line = { description: '', qty: 1, unitPrice: 0, gstRate: data.settings.defaultGstRate ?? 18 }) => {
      const row = node('div', { className: 'invoice-line' }, [
        field('Item description', 'description', line.description || '', 'text', { placeholder: 'Service or product' }),
        field('Qty', 'qty', line.qty, 'number', { min: '0.01', step: '0.01' }),
        field('Unit price (₹)', 'unitPrice', line.unitPrice, 'number', { min: '0', step: '0.01' }),
        field('GST %', 'gstRate', line.gstRate, 'number', { min: '0', max: '100', step: '0.01' }),
        node('button', {
          className: 'btn btn--ghost btn--icon',
          type: 'button',
          'data-section-action': 'invoice-remove-line',
          'aria-label': 'Remove item',
          text: '×',
        }),
      ]);
      lineRoot.append(row);
    };
    items.forEach(addLine);
    form.addEventListener('input', updatePreview);
    form.addEventListener('change', updatePreview);
    updatePreview();
  }

  function invoicePreview(invoice) {
    const business = data.business;
    const customer = customerById(invoice.customerId);
    const invoiceNode = node('article', { className: 'printable-invoice' }, [
      node('div', { className: 'invoice-preview-head' }, [
        node('div', {}, [
          node('img', { src: 'assets/img/logo.svg', alt: '', width: '36', height: '36' }),
          node('h2', { text: business.name }),
          node('p', { text: business.address }),
          node('p', { text: `${business.city}, ${business.state} · ${business.phone}` }),
          node('p', { text: business.gstinIsDemo ? `GSTIN ${business.gstin} (demo)` : `GSTIN ${business.gstin}` }),
        ]),
        node('div', { className: 'invoice-preview-number' }, [
          node('span', { text: 'TAX INVOICE' }),
          node('strong', { text: invoice.number }),
          node('small', { text: `Issued ${date(invoice.issueDate)} · Due ${date(invoice.dueDate)}` }),
          statusBadge(invoice.status),
        ]),
      ]),
      node('div', { className: 'invoice-preview-customer' }, [
        node('span', { className: 'eyebrow', text: 'Billed to' }),
        node('strong', { text: customer?.name || 'Customer' }),
        node('p', { text: customer ? `${customer.phone} · ${customer.city}` : '' }),
      ]),
      table(['Description', 'Qty', 'Rate', 'GST', 'Amount'], invoice.items.map((item) => [
        item.description, formatNumber(item.qty), money(item.unitPrice), `${item.gstRate}%`,
        money(item.qty * item.unitPrice),
      ]), 'No invoice items.'),
      node('div', { className: 'invoice-preview-totals' }, [
        node('p', {}, [node('span', { text: 'Subtotal' }), node('strong', { text: money(invoice.subtotal) })]),
        node('p', {}, [node('span', { text: 'Discount' }), node('strong', { text: `−${money(invoice.discount)}` })]),
        node('p', {}, [node('span', { text: 'GST' }), node('strong', { text: money(invoice.taxTotal) })]),
        node('p', { className: 'invoice-grand-total' }, [node('span', { text: 'Grand total' }), node('strong', { text: money(invoice.total) })]),
        node('p', {}, [node('span', { text: 'Paid' }), node('strong', { text: money(invoice.paidAmount) })]),
        node('p', {}, [node('span', { text: 'Balance due' }), node('strong', { text: money(invoiceBalance(invoice)) })]),
      ]),
      node('div', { className: 'invoice-payment-info' }, [
        node('strong', { text: 'Payment information' }),
        node('p', { text: 'Accept UPI, cash or bank transfer as agreed with your customer. Payment gateway and collection links are not connected in this demo.' }),
      ]),
    ]);
    const dialog = openDialog(`Invoice ${invoice.number}`, invoiceNode, 'Print invoice', () => {
      document.body.classList.add('print-mode');
      window.print();
      window.setTimeout(() => document.body.classList.remove('print-mode'), 500);
      return false;
    }, { wide: true });
    dialog.modal.classList.add('invoice-modal');
  }

  function renderInvoices(query = '', status = 'all') {
    const filtered = data.invoices.filter((invoice) => {
      const match = `${invoice.number} ${customerName(invoice.customerId)}`.toLowerCase().includes(query.toLowerCase());
      return match && (status === 'all' || invoice.status === status);
    }).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
    setRows(node('div', { className: 'section-stack' }, [
      metrics([
        ['Invoiced', money(sumBy(data.invoices, 'total')), `${data.invoices.length} invoices`, 'i-file-text'],
        ['Collected', money(sumBy(data.invoices, 'paidAmount')), 'Recorded payments', 'i-check'],
        ['Outstanding', money(data.invoices.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0)), 'Remaining balance', 'i-clock'],
      ]),
      card('Invoice register', node('div', {}, [
        toolbar('Search invoices or customers…', [filterSelect('status', 'Filter invoices by status', [
          ['all', 'All statuses'], ...['Unpaid', 'Partially Paid', 'Paid', 'Overdue'].map((value) => [value, value]),
        ])]),
        table(['Invoice', 'Customer', 'Issued', 'Due date', 'Total', 'Balance', 'Status', 'Actions'], filtered.map((invoice) => [
          node('strong', { text: invoice.number }),
          customerName(invoice.customerId),
          date(invoice.issueDate),
          date(invoice.dueDate),
          money(invoice.total),
          money(invoiceBalance(invoice)),
          statusBadge(invoice.status),
          rowActions('invoice', invoice.id),
        ]), 'No invoices match your filters.'),
      ])),
    ]));
    bindFilters(renderInvoices);
  }

  function renderPayments(query = '') {
    const outstanding = data.invoices.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
    const overdue = data.invoices.filter((invoice) => invoice.status === 'Overdue').reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
    const payments = data.payments.filter((payment) =>
      `${payment.id} ${payment.method} ${payment.reference} ${customerName(payment.customerId)}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date));
    const outstandingInvoices = data.invoices.filter((invoice) => invoiceBalance(invoice) > 0);
    const payPanel = card('Online payment demo', node('div', { className: 'payment-demo' }, [
      node('span', { className: 'icon-tile' }, [icon('i-credit-card')]),
      node('div', { className: 'payment-demo__content' }, [
        node('strong', { text: 'Payment gateway not connected' }),
        node('p', { className: 'field__hint', text: 'This is a non-functional preview. No payment is initiated, confirmed or collected.' }),
        formGrid(
          field('Invoice', 'gatewayInvoice', outstandingInvoices[0]?.id || 'none', 'select', {
            choices: outstandingInvoices.length
              ? outstandingInvoices.map((invoice) => [invoice.id, `${invoice.number} · ${customerName(invoice.customerId)}`])
              : [['none', 'No outstanding invoices']],
          }),
          field('Payment method', 'gatewayMethod', 'UPI', 'select', {
            choices: ['UPI', 'Cash', 'Bank transfer', 'Online payment'].map((value) => [value, value]),
          }),
        ),
        node('label', { className: 'field' }, [
          node('span', { className: 'field__label', text: 'Transaction reference' }),
          node('input', { className: 'input', type: 'text', placeholder: 'Available after a real gateway response', disabled: 'disabled' }),
        ]),
        node('div', { className: 'inline-actions' }, [
          node('button', { className: 'btn btn--primary', type: 'button', disabled: 'disabled', text: 'Pay online · Not connected' }),
          node('span', { className: 'badge badge--pending', text: 'Status: not initiated' }),
        ]),
      ]),
    ]));
    setRows(node('div', { className: 'section-stack' }, [
      metrics([
        ['Total collected', money(sumBy(data.payments, 'amount')), `${data.payments.length} recorded transactions`, 'i-trending-up'],
        ['Pending balance', money(outstanding), 'Across unpaid invoices', 'i-clock'],
        ['Overdue balance', money(overdue), 'Needs a follow-up', 'i-alert-triangle'],
      ]),
      payPanel,
      card('Recent transactions', node('div', {}, [
        toolbar('Search payments or customers…'),
        table(['Reference', 'Customer', 'Invoice', 'Date', 'Method', 'Amount'], payments.map((payment) => {
          const invoice = data.invoices.find((item) => item.id === payment.invoiceId);
          return [
            node('strong', { text: payment.reference || payment.id }),
            customerName(payment.customerId),
            invoice?.number || '—',
            date(payment.date),
            payment.method,
            money(payment.amount),
          ];
        }), 'No payments match your search.'),
      ])),
    ]));
    bindFilters(renderPayments);
  }

  function paymentForm() {
    const openInvoices = data.invoices.filter((invoice) => invoiceBalance(invoice) > 0);
    if (!openInvoices.length) {
      toast({ title: 'All caught up', message: 'There are no outstanding invoices to record a payment against.', variant: 'info' });
      return;
    }
    const content = formGrid(
      field('Invoice', 'invoiceId', openInvoices[0].id, 'select', {
        choices: openInvoices.map((invoice) => [invoice.id, `${invoice.number} · ${customerName(invoice.customerId)} · ${money(invoiceBalance(invoice))} due`]),
      }),
      field('Amount received (₹)', 'amount', '', 'number', { min: '0.01', step: '0.01' }),
      field('Payment date', 'date', referenceDate, 'date'),
      field('Payment method', 'method', 'UPI', 'select', {
        choices: ['UPI', 'Cash', 'Bank transfer', 'Online payment'].map((value) => [value, value]),
      }),
      field('Transaction reference (optional)', 'reference', '', 'text', { required: false, placeholder: 'UPI / bank reference' }),
    );
    const dialog = openDialog('Record a payment', content, 'Record payment', (form) => {
      const values = Object.fromEntries(form.entries());
      const invoice = data.invoices.find((item) => item.id === values.invoiceId);
      const amount = roundPaise(Number(values.amount));
      if (!invoice || amount <= 0 || amount > invoiceBalance(invoice) + 0.001) {
        toast({ title: 'Check the amount', message: 'Enter an amount above zero and no greater than the invoice balance.', variant: 'error' });
        return false;
      }
      invoice.paidAmount = roundPaise(invoice.paidAmount + amount);
      invoice.status = invoiceBalance(invoice) === 0 ? 'Paid'
        : invoice.dueDate < referenceDate ? 'Overdue' : 'Partially Paid';
      data.payments.unshift({
        id: `PAY-${String(nextPayment++).padStart(4, '0')}`,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        amount,
        method: values.method,
        date: values.date,
        reference: values.reference.trim(),
      });
      toast({ title: 'Payment recorded', message: 'Invoice balance updated in this browser demo.', variant: 'success' });
    });
    const invoiceSelect = dialog.form.elements.invoiceId;
    const amountInput = dialog.form.elements.amount;
    invoiceSelect.addEventListener('change', () => {
      const invoice = data.invoices.find((item) => item.id === invoiceSelect.value);
      amountInput.max = invoice ? String(invoiceBalance(invoice)) : '';
      amountInput.placeholder = invoice ? `Up to ${money(invoiceBalance(invoice))}` : '';
    });
    invoiceSelect.dispatchEvent(new Event('change'));
  }

  function renderExpenses(query = '', category = 'all') {
    const filtered = data.expenses.filter((expense) => {
      const match = `${expense.category} ${expense.description} ${expense.method}`.toLowerCase().includes(query.toLowerCase());
      return match && (category === 'all' || expense.category === category);
    }).sort((a, b) => b.date.localeCompare(a.date));
    const monthTotal = data.expenses.filter((expense) => expense.date.slice(0, 7) === referenceDate.slice(0, 7))
      .reduce((sum, expense) => sum + expense.amount, 0);
    setRows(node('div', { className: 'section-stack' }, [
      metrics([
        ['Total expenses', money(sumBy(data.expenses, 'amount')), `${data.expenses.length} recorded entries`, 'i-wallet'],
        ['This month', money(monthTotal), 'In the demo reference month', 'i-calendar'],
        ['Top category', topExpenseCategory(), 'By recorded spend', 'i-bar-chart'],
      ]),
      card('Spend by category', node('div', { className: 'report-bars' }, expenseCategoryBars()), 'Based on recorded demo expenses'),
      card('Expense register', node('div', {}, [
        toolbar('Search expenses…', [filterSelect('category', 'Filter by expense category', [
          ['all', 'All categories'], ...expenseCategories().map((value) => [value, value]),
        ])]),
        table(['Date', 'Category', 'Description', 'Method', 'Amount', 'Actions'], filtered.map((expense) => [
          date(expense.date),
          node('span', { className: 'badge badge--info', text: expense.category }),
          expense.description,
          expense.method,
          money(expense.amount),
          rowActions('expense', expense.id, { view: false }),
        ]), 'No expenses match your search.'),
      ])),
    ]));
    bindFilters(renderExpenses);
  }

  function expenseCategories() {
    return ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Transport', 'Marketing', 'Other'];
  }

  function topExpenseCategory() {
    const totals = new Map();
    data.expenses.forEach((expense) => totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amount));
    const top = [...totals].sort((a, b) => b[1] - a[1])[0];
    return top ? `${top[0]} · ${money(top[1])}` : 'No entries';
  }

  function expenseCategoryBars() {
    const totals = new Map(expenseCategories().map((category) => [category, 0]));
    data.expenses.forEach((expense) => totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amount));
    const maximum = Math.max(...totals.values(), 1);
    return [...totals].sort((a, b) => b[1] - a[1]).map(([category, amount]) =>
      node('div', { className: 'report-bar-row' }, [
        node('span', { text: category }),
        node('span', { className: 'report-bar-track' }, [
          node('span', { className: 'report-bar-fill', style: `--bar-value:${Math.max(3, amount / maximum * 100)}%` }),
        ]),
        node('strong', { text: money(amount) }),
      ]));
  }

  function expenseForm(existing) {
    const content = formGrid(
      field('Category', 'category', existing?.category || 'Supplies', 'select', {
        choices: expenseCategories().map((value) => [value, value]),
      }),
      field('Amount (₹)', 'amount', existing?.amount ?? '', 'number', { min: '0.01', step: '0.01' }),
      field('Date', 'date', existing?.date || referenceDate, 'date'),
      field('Payment method', 'method', existing?.method || 'UPI', 'select', {
        choices: ['UPI', 'Cash', 'Bank transfer', 'Card'].map((value) => [value, value]),
      }),
      field('Description', 'description', existing?.description || '', 'text', { placeholder: 'What was this expense for?' }),
    );
    openDialog(existing ? 'Edit expense' : 'Add expense', content, existing ? 'Save expense' : 'Add expense', (form) => {
      const values = Object.fromEntries(form.entries());
      values.amount = roundPaise(Number(values.amount));
      if (existing) Object.assign(existing, values);
      else data.expenses.unshift({ id: `EXP-${String(nextExpense++).padStart(4, '0')}`, ...values });
      toast({ title: existing ? 'Expense updated' : 'Expense added', message: 'The change is in this browser demo only.', variant: 'success' });
    });
  }

  function renderCashflow() {
    const cashBalance = roundPaise(sumBy(data.payments, 'amount') - sumBy(data.expenses, 'amount'));
    const receivables = data.invoices.filter((invoice) => invoiceBalance(invoice) > 0);
    const receivableTotal = roundPaise(receivables.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0));
    const dueWithin = (days) => {
      const end = new Date(`${referenceDate}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + days);
      const endISO = end.toISOString().slice(0, 10);
      return roundPaise(receivables.filter((invoice) => invoice.dueDate >= referenceDate && invoice.dueDate <= endISO)
        .reduce((sum, invoice) => sum + invoiceBalance(invoice), 0));
    };
    const monthlyExpenses = data.expenses.filter((expense) => expense.date.slice(0, 7) === referenceDate.slice(0, 7));
    const dailySpend = monthlyExpenses.length ? sumBy(monthlyExpenses, 'amount') / 30
      : sumBy(data.expenses, 'amount') / 180;
    const expected7 = roundPaise(cashBalance + dueWithin(7) - dailySpend * 7);
    const expected30 = roundPaise(cashBalance + dueWithin(30) - dailySpend * 30);
    const upcomingExpenseEstimates = ['Rent', 'Utilities', 'Salaries'].map((category) => {
      const historical = data.expenses.filter((expense) => expense.category === category)
        .reduce((sum, expense) => sum + expense.amount, 0);
      return { category, amount: roundPaise(historical / 6) };
    }).filter((item) => item.amount > 0);
    const health = expected30 > 0 ? 'Stable outlook' : 'Plan for a tighter month';
    const upcoming = receivables.filter((invoice) => invoice.dueDate >= referenceDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 8);
    const timeline = upcoming.length
      ? node('ul', { className: 'detail-list' }, upcoming.map((invoice) => node('li', { className: 'detail-list__item' }, [
        node('span', {}, [
          node('strong', { text: customerName(invoice.customerId) }),
          node('small', { text: `${invoice.number} · Due ${date(invoice.dueDate)}` }),
        ]),
        node('strong', { text: `+${money(invoiceBalance(invoice))}` }),
      ])))
      : empty('No future-dated receivables in this demo.');
    const breakdown = node('div', { className: 'forecast-breakdown' }, [
      node('div', {}, [node('span', { text: 'Current cash (demo ledger)' }), node('strong', { text: money(cashBalance) })]),
      node('div', {}, [node('span', { text: 'Expected receivables' }), node('strong', { text: `+${money(receivableTotal)}` })]),
      node('div', {}, [node('span', { text: 'Estimated monthly expenses' }), node('strong', { text: `−${money(dailySpend * 30)}` })]),
    ]);
    setRows(node('div', { className: 'section-stack' }, [
      node('div', { className: 'forecast-banner' }, [
        node('span', { className: 'icon-tile' }, [icon('i-trending-up')]),
        node('div', {}, [
          node('strong', { text: health }),
          node('p', { className: 'field__hint', text: 'Forecasts are estimates from the sample ledger, not financial advice.' }),
        ]),
      ]),
      metrics([
        ['Current cash balance', money(cashBalance), 'Recorded collections less expenses', 'i-wallet'],
        ['Expected receivables', money(receivableTotal), 'Unpaid invoice balances', 'i-clock'],
        ['7-day projection', money(expected7), 'Estimated balance in 7 days', 'i-calendar'],
        ['30-day projection', money(expected30), 'Estimated balance in 30 days', 'i-bar-chart'],
      ]),
      node('div', { className: 'grid-main' }, [
        card('Projection assumptions', breakdown, 'A transparent estimate, updated from mock records'),
        card('Upcoming receivables', timeline, 'Open invoices with a future due date'),
        card('Upcoming expense estimates', node('ul', { className: 'detail-list' }, upcomingExpenseEstimates.map((item) =>
          node('li', { className: 'detail-list__item' }, [
            node('span', {}, [
              node('strong', { text: item.category }),
              node('small', { text: 'Monthly estimate · not a scheduled bill' }),
            ]),
            node('strong', { text: `−${money(item.amount)}` }),
          ]))), 'Estimated from the sample expense history'),
      ]),
    ]));
  }

  function renderReminders(query = '') {
    const overdue = data.invoices.filter((invoice) => invoiceBalance(invoice) > 0 && invoice.dueDate < referenceDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const filtered = overdue.filter((invoice) =>
      `${invoice.number} ${customerName(invoice.customerId)}`.toLowerCase().includes(query.toLowerCase()));
    setRows(node('div', { className: 'section-stack' }, [
      metrics([
        ['Overdue invoices', formatNumber(overdue.length), 'Need a follow-up', 'i-alert-triangle'],
        ['Amount overdue', money(overdue.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0)), 'Across overdue invoices', 'i-clock'],
        ['Reminder history', formatNumber(data.reminders.length), 'Seeded demo activity', 'i-message-circle'],
      ]),
      card('Payment follow-ups', node('div', {}, [
        toolbar('Search overdue customers…'),
        table(['Customer', 'Invoice', 'Due date', 'Balance', 'Last reminder', 'Actions'], filtered.map((invoice) => {
          const customer = customerById(invoice.customerId);
          const reminder = data.reminders.find((item) => item.invoiceId === invoice.id);
          return [
            node('div', { className: 'table-primary-cell' }, [
              node('strong', { text: customer?.name || 'Customer' }),
              node('small', { text: customer?.phone || '' }),
            ]),
            invoice.number,
            date(invoice.dueDate),
            money(invoiceBalance(invoice)),
            reminder ? `${date(reminder.sentAt.slice(0, 10))} · ${reminder.channel}` : 'Not sent',
            node('div', { className: 'row-actions' }, [
              button('Draft message', 'reminder-draft', { id: invoice.id }),
              button('WhatsApp', 'reminder-whatsapp', { id: invoice.id, className: 'btn btn--secondary btn--sm' }),
            ]),
          ];
        }), 'No overdue invoices. Your follow-up list is clear.'),
      ])),
      card('Reminder history', node('ul', { className: 'detail-list' }, data.reminders.slice(0, 6).map((item) => {
        const invoice = data.invoices.find((value) => value.id === item.invoiceId);
        return node('li', { className: 'detail-list__item' }, [
          node('span', {}, [
            node('strong', { text: customerName(item.customerId) }),
            node('small', { text: `${invoice?.number || item.invoiceId} · ${date(item.sentAt.slice(0, 10))}` }),
          ]),
          node('span', { className: 'badge badge--info', text: item.channel }),
        ]);
      })), 'Frontend activity only'),
      card('Upcoming payment dates', node('ul', { className: 'detail-list' }, data.invoices
        .filter((invoice) => invoiceBalance(invoice) > 0 && invoice.dueDate >= referenceDate)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 6)
        .map((invoice) => node('li', { className: 'detail-list__item' }, [
          node('span', {}, [
            node('strong', { text: customerName(invoice.customerId) }),
            node('small', { text: `${invoice.number} · Due ${date(invoice.dueDate)}` }),
          ]),
          node('strong', { text: money(invoiceBalance(invoice)) }),
        ]))), 'Invoices due on or after the demo reference date'),
    ]));
    bindFilters(renderReminders);
  }

  function reminderText(invoice) {
    const customer = customerById(invoice.customerId);
    const days = Math.max(0, Math.round((new Date(`${referenceDate}T00:00:00Z`) - new Date(`${invoice.dueDate}T00:00:00Z`)) / 86400000));
    return `Hi ${customer?.name || 'there'}, a gentle reminder that ${invoice.number} for ${money(invoiceBalance(invoice))} was due on ${date(invoice.dueDate)} (${days} days ago). Please let us know if you have any questions. Thank you — ${data.business.name}.`;
  }

  function showReminder(invoice, openWhatsApp = false) {
    const message = reminderText(invoice);
    if (openWhatsApp) {
      const phone = (customerById(invoice.customerId)?.phone || '').replace(/\D/g, '');
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      data.reminders.unshift({
        id: `REM-${String(data.reminders.length + 1).padStart(3, '0')}`,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        sentAt: `${referenceDate}T12:00:00+05:30`,
        channel: 'WhatsApp draft',
      });
      persistDemoState();
      toast({ title: 'WhatsApp draft opened', message: 'The message is prefilled; it has not been sent.', variant: 'info' });
      render();
      return;
    }
    const content = node('div', { className: 'section-stack' }, [
      node('p', { className: 'field__hint', text: 'Review the message, then copy it or open WhatsApp. Nothing is sent automatically.' }),
      node('textarea', { className: 'textarea reminder-message', readonly: 'readonly', rows: '6', 'aria-label': 'Reminder message' }, [message]),
      node('div', { className: 'inline-actions' }, [
        node('button', { className: 'btn btn--secondary', type: 'button', 'data-section-action': 'reminder-copy', 'data-id': invoice.id, text: 'Copy message' }),
        node('button', { className: 'btn btn--primary', type: 'button', 'data-section-action': 'reminder-whatsapp', 'data-id': invoice.id, text: 'Open WhatsApp' }),
      ]),
    ]);
    openDialog(`Reminder · ${invoice.number}`, content, 'Done', () => {});
  }

  function renderReports() {
    const tabBar = node('div', { className: 'tabs', role: 'tablist', 'aria-label': 'Reports and business profile' }, [
      ...[['reports', 'Reports'], ['settings', 'Business profile']].map(([value, label]) =>
        node('button', {
          className: 'tab',
          type: 'button',
          role: 'tab',
          'aria-selected': reportTab === value ? 'true' : 'false',
          'data-section-action': 'reports-tab',
          'data-tab': value,
          text: label,
        })),
    ]);
    let panel;
    if (reportTab === 'settings') {
      panel = businessSettings();
    } else {
      const start = reportPeriod === 'custom'
        ? reportStart
        : reportPeriod === 'monthly' ? `${reportMonth}-01` : `${reportYear}-01-01`;
      const end = reportPeriod === 'custom'
        ? reportEnd
        : reportPeriod === 'monthly'
          ? new Date(Date.UTC(Number(reportMonth.slice(0, 4)), Number(reportMonth.slice(5, 7)), 0)).toISOString().slice(0, 10)
          : `${reportYear}-12-31`;
      const inRange = (value) => value >= start && value <= end;
      const filteredExpenses = data.expenses.filter((expense) => inRange(expense.date));
      const filteredInvoices = data.invoices.filter((invoice) => inRange(invoice.issueDate));
      const categories = new Map();
      filteredExpenses.forEach((expense) => categories.set(expense.category, (categories.get(expense.category) || 0) + expense.amount));
      const maxCategory = Math.max(...categories.values(), 1);
      const bars = [...categories].sort((a, b) => b[1] - a[1]).map(([category, amount]) =>
        node('div', { className: 'report-bar-row' }, [
          node('span', { text: category }),
          node('span', { className: 'report-bar-track' }, [
            node('span', { className: 'report-bar-fill', style: `--bar-value:${Math.max(3, amount / maxCategory * 100)}%` }),
          ]),
          node('strong', { text: money(amount) }),
        ]));
      const monthly = new Map();
      const monthEntry = (month) => {
        if (!monthly.has(month)) monthly.set(month, { revenue: 0, expenses: 0 });
        return monthly.get(month);
      };
      filteredInvoices.forEach((invoice) => {
        const month = invoice.issueDate.slice(0, 7);
        monthEntry(month).revenue += invoice.total;
      });
      filteredExpenses.forEach((expense) => {
        monthEntry(expense.date.slice(0, 7)).expenses += expense.amount;
      });
      const monthlyTotals = [...monthly].sort((a, b) => a[0].localeCompare(b[0]));
      const monthRows = [...monthlyTotals].reverse().slice(0, 12)
        .map(([month, totals]) => node('li', { className: 'detail-list__item' }, [
          node('span', {}, [
            node('strong', { text: new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)) }),
            node('small', { text: `Revenue ${money(totals.revenue)} · Expenses ${money(totals.expenses)}` }),
          ]),
          node('strong', { text: money(totals.revenue - totals.expenses) }),
        ]));
      const outstandingByStatus = ['Overdue', 'Unpaid', 'Partially Paid'].map((status) => ({
        status,
        amount: roundPaise(filteredInvoices.filter((invoice) => invoice.status === status)
          .reduce((sum, invoice) => sum + invoiceBalance(invoice), 0)),
      }));
      const maxOutstanding = Math.max(...outstandingByStatus.map((item) => item.amount), 1);
      const outstandingBars = outstandingByStatus.map((item) => node('div', { className: 'report-bar-row' }, [
        node('span', { text: item.status }),
        node('span', { className: 'report-bar-track' }, [
          node('span', { className: 'report-bar-fill', style: `--bar-value:${Math.max(3, item.amount / maxOutstanding * 100)}%` }),
        ]),
        node('strong', { text: money(item.amount) }),
      ]));
      const customerRows = data.customers.map((customer) => ({
        name: customer.name,
        billed: roundPaise(filteredInvoices.filter((invoice) => invoice.customerId === customer.id)
          .reduce((sum, invoice) => sum + invoice.total, 0)),
      })).filter((customer) => customer.billed > 0)
        .sort((a, b) => b.billed - a.billed)
        .slice(0, 6)
        .map((customer) => node('li', { className: 'detail-list__item' }, [
          node('span', { text: customer.name }),
          node('strong', { text: money(customer.billed) }),
        ]));
      const years = [...new Set([
        ...data.invoices.map((invoice) => invoice.issueDate.slice(0, 4)),
        ...data.expenses.map((expense) => expense.date.slice(0, 4)),
      ])].sort();
      const dateControls = node('div', { className: 'report-controls' }, [
        node('label', { className: 'field' }, [
          node('span', { className: 'field__label', text: 'Report period' }),
          node('select', { className: 'select', 'data-report-period': 'true', 'aria-label': 'Report period' }, [
            ...[['monthly', 'Monthly'], ['yearly', 'Yearly'], ['custom', 'Custom date range']].map(([value, label]) =>
              node('option', { value, selected: value === reportPeriod ? 'selected' : null, text: label })),
          ]),
        ]),
        node('label', { className: 'field', hidden: reportPeriod !== 'monthly' ? 'hidden' : null }, [
          node('span', { className: 'field__label', text: 'Month' }),
          node('input', { className: 'input', type: 'month', value: reportMonth, 'data-report-month': 'true', 'aria-label': 'Report month' }),
        ]),
        node('label', { className: 'field', hidden: reportPeriod !== 'yearly' ? 'hidden' : null }, [
          node('span', { className: 'field__label', text: 'Year' }),
          node('select', { className: 'select', 'data-report-year': 'true', 'aria-label': 'Report year' },
            years.map((year) => node('option', { value: year, selected: year === reportYear ? 'selected' : null, text: year }))),
        ]),
        node('label', { className: 'field', hidden: reportPeriod !== 'custom' ? 'hidden' : null }, [
          node('span', { className: 'field__label', text: 'From' }),
          node('input', { className: 'input', type: 'date', value: reportStart, max: reportEnd || null, 'data-report-start': 'true', 'aria-label': 'Report start date' }),
        ]),
        node('label', { className: 'field', hidden: reportPeriod !== 'custom' ? 'hidden' : null }, [
          node('span', { className: 'field__label', text: 'To' }),
          node('input', { className: 'input', type: 'date', value: reportEnd, min: reportStart || null, 'data-report-end': 'true', 'aria-label': 'Report end date' }),
        ]),
        node('button', { className: 'btn btn--secondary', type: 'button', 'data-section-action': 'reports-download', text: 'Download CSV demo' }),
      ]);
      panel = node('div', { className: 'section-stack' }, [
        dateControls,
        metrics([
          ['Revenue billed', money(sumBy(filteredInvoices, 'total')), `${filteredInvoices.length} invoices in range`, 'i-trending-up'],
          ['Expenses', money(sumBy(filteredExpenses, 'amount')), `${filteredExpenses.length} entries in range`, 'i-wallet'],
          ['Outstanding', money(filteredInvoices.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0)), 'Unpaid balances in range', 'i-clock'],
          ['Customers', formatNumber(data.customers.length), 'Active directory', 'i-users'],
        ]),
        node('div', { className: 'grid-main' }, [
          card('Revenue by month', node('div', { className: 'report-bars' }, monthlyTotals.length
            ? monthlyTotals.map(([month, totals]) => node('div', { className: 'report-bar-row' }, [
              node('span', { text: new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)) }),
              node('span', { className: 'report-bar-track' }, [
                node('span', { className: 'report-bar-fill', style: `--bar-value:${Math.max(3, totals.revenue / Math.max(...monthlyTotals.map(([, value]) => value.revenue), 1) * 100)}%` }),
              ]),
              node('strong', { text: money(totals.revenue) }),
            ]))
            : [empty('No revenue in this date range.')]), 'Billed invoice totals · demo data'),
          card('Expense breakdown', node('div', { className: 'report-bars' }, bars.length ? bars : [empty('No expenses in this date range.')]), 'Recorded spend by category'),
          card('Outstanding payment analytics', node('div', { className: 'report-bars' }, outstandingBars), 'Remaining balance by invoice status'),
          card('Monthly summary', node('ul', { className: 'detail-list' }, monthRows.length ? monthRows : [node('li', { className: 'detail-list__item' }, [empty('No activity in this date range.')])]), 'Billed revenue less recorded expenses (not net profit)'),
          card('Top customers', customerRows.length ? node('ul', { className: 'detail-list' }, customerRows) : empty('No customer invoices yet.'), 'By total billed'),
        ]),
        node('p', { className: 'field__hint', text: 'All figures are derived from sample data and local browser edits.' }),
      ]);
    }
    setRows(node('div', { className: 'section-stack' }, [tabBar, panel]));
    if (reportTab === 'reports') {
      root.querySelector('[data-report-period]')?.addEventListener('change', (event) => {
        reportPeriod = event.currentTarget.value;
        if (reportPeriod === 'custom' && (!reportStart || !reportEnd)) {
          reportStart = `${referenceDate.slice(0, 4)}-01-01`;
          reportEnd = referenceDate;
        }
        renderReports();
      });
      root.querySelector('[data-report-month]')?.addEventListener('change', (event) => {
        reportMonth = event.currentTarget.value || reportMonth;
        renderReports();
      });
      root.querySelector('[data-report-year]')?.addEventListener('change', (event) => {
        reportYear = event.currentTarget.value || reportYear;
        renderReports();
      });
      root.querySelector('[data-report-start]')?.addEventListener('change', (event) => {
        reportStart = event.currentTarget.value;
        if (reportEnd && reportStart > reportEnd) {
          toast({ title: 'Choose a valid date range', message: 'The start date must be on or before the end date.', variant: 'error' });
          reportStart = reportEnd;
        }
        renderReports();
      });
      root.querySelector('[data-report-end]')?.addEventListener('change', (event) => {
        reportEnd = event.currentTarget.value;
        if (reportStart && reportEnd < reportStart) {
          toast({ title: 'Choose a valid date range', message: 'The end date must be on or after the start date.', variant: 'error' });
          reportEnd = reportStart;
        }
        renderReports();
      });
    }
  }

  function businessSettings() {
    const form = node('form', { className: 'settings-form section-stack' }, [
      card('Business profile', node('div', {}, [
        node('div', { className: 'business-logo-preview' }, [
          node('img', { src: 'assets/img/logo.svg', alt: 'DokanFlow logo preview', width: '48', height: '48' }),
          node('div', {}, [
            node('strong', { text: data.business.name }),
            node('p', { className: 'field__hint', text: 'Logo preview · demo brand' }),
          ]),
        ]),
        formGrid(
          field('Business name', 'businessName', data.business.name),
          field('Owner name', 'owner', data.business.owner),
          field('Phone', 'phone', data.business.phone, 'tel'),
          field('Email', 'email', data.business.email, 'email'),
          field('City', 'city', data.business.city),
          field('State', 'state', data.business.state),
          field('Business address', 'address', data.business.address, 'text'),
          field('GSTIN', 'gstin', data.business.gstin, 'text', { required: false }),
        ),
      ])),
      card('Preferences', node('div', {}, [
        formGrid(
          field('Currency', 'currency', data.settings.currency, 'select', { choices: [['INR', 'Indian Rupee (₹)']] }),
          field('Default GST rate', 'defaultGstRate', data.settings.defaultGstRate, 'select', {
            choices: [['0', '0%'], ['5', '5%'], ['12', '12%'], ['18', '18%'], ['28', '28%']],
          }),
          field('Payment terms (days)', 'paymentTerms', data.settings.paymentTerms, 'number', { min: '0', step: '1' }),
          field('Invoice number prefix', 'invoicePrefix', data.settings.invoicePrefix || 'INV'),
          field('Invoice footer note', 'invoiceFooter', data.settings.invoiceFooter || 'Thank you for your business.', 'textarea', { required: false }),
          field('Display language', 'locale', data.settings.locale || 'en-IN', 'select', {
            choices: [['en-IN', 'English (India)']],
          }),
        ),
        node('label', { className: 'check-control' }, [
          node('input', { type: 'checkbox', name: 'notificationsEnabled', checked: data.settings.notificationsEnabled === false ? null : 'checked' }),
          node('span', { text: 'Show payment and business reminders' }),
        ]),
        node('p', { className: 'field__hint', text: 'These preferences are saved in this tab’s browser demo and affect new invoices and reports.' }),
      ])),
      node('div', { className: 'inline-actions' }, [
        node('button', { className: 'btn btn--primary', type: 'submit', text: 'Save preferences' }),
      ]),
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form).entries());
      data.business = {
        ...data.business,
        name: values.businessName,
        owner: values.owner,
        phone: values.phone,
        email: values.email,
        city: values.city,
        state: values.state,
        address: values.address,
        gstin: values.gstin,
        gstinIsDemo: true,
      };
      data.settings = {
        ...data.settings,
        currency: values.currency,
        defaultGstRate: Number(values.defaultGstRate),
        paymentTerms: Number(values.paymentTerms),
        invoicePrefix: values.invoicePrefix,
        invoiceFooter: values.invoiceFooter,
        locale: values.locale,
        notificationsEnabled: form.elements.notificationsEnabled.checked,
      };
      persistDemoState();
      window.dispatchEvent(new Event('dokanflow:profile-updated'));
      toast({ title: 'Preferences saved', message: 'Updates are held in memory for this demo session.', variant: 'success' });
      renderReports();
    });
    return form;
  }

  function downloadReport() {
    let start;
    let end;
    if (reportPeriod === 'custom') {
      start = reportStart;
      end = reportEnd;
      if (!start || !end || start > end) {
        toast({ title: 'Choose a valid date range', message: 'Select both a start date and an end date for the report.', variant: 'error' });
        return;
      }
    } else {
      start = reportPeriod === 'monthly' ? `${reportMonth}-01` : `${reportYear}-01-01`;
      end = reportPeriod === 'monthly'
        ? new Date(Date.UTC(Number(reportMonth.slice(0, 4)), Number(reportMonth.slice(5, 7)), 0)).toISOString().slice(0, 10)
        : `${reportYear}-12-31`;
    }
    const invoices = data.invoices.filter((invoice) => invoice.issueDate >= start && invoice.issueDate <= end);
    const expenses = data.expenses.filter((expense) => expense.date >= start && expense.date <= end);
    const monthly = new Map();
    invoices.forEach((invoice) => {
      const month = invoice.issueDate.slice(0, 7);
      if (!monthly.has(month)) monthly.set(month, { revenue: 0, expenses: 0, outstanding: 0 });
      monthly.get(month).revenue += invoice.total;
      monthly.get(month).outstanding += invoiceBalance(invoice);
    });
    expenses.forEach((expense) => {
      const month = expense.date.slice(0, 7);
      if (!monthly.has(month)) monthly.set(month, { revenue: 0, expenses: 0, outstanding: 0 });
      monthly.get(month).expenses += expense.amount;
    });
    const csv = [
      ['Month', 'Revenue billed (INR)', 'Expenses (INR)', 'Outstanding (INR)', 'Billed less expenses (INR)'],
      ...[...monthly].sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => [
        month,
        roundPaise(values.revenue),
        roundPaise(values.expenses),
        roundPaise(values.outstanding),
        roundPaise(values.revenue - values.expenses),
      ]),
    ].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = node('a', { href: url, download: `dokanflow-report-${start}-to-${end}.csv` });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ title: 'Report downloaded', message: 'A CSV export of the selected demo date range was created.', variant: 'success' });
  }

  function bindFilters(renderPage) {
    const search = root.querySelector('.section-search');
    if (!search) return;
    search.value = activeQuery;
    search.addEventListener('input', () => {
      const keepFocus = document.activeElement === search;
      const caret = keepFocus ? search.selectionStart : null;
      activeQuery = search.value;
      renderPage(activeQuery, activeFilter);
      if (keepFocus) {
        const nextSearch = root.querySelector('.section-search');
        nextSearch?.focus();
        if (caret !== null) nextSearch?.setSelectionRange(caret, caret);
      }
    });
    const filter = root.querySelector('.section-filter');
    if (filter) {
      filter.dataset.filter = filter.dataset.filter || 'status';
      filter.value = activeFilter;
      filter.addEventListener('change', () => {
        const keepFocus = document.activeElement === filter;
        activeFilter = filter.value;
        renderPage(activeQuery, activeFilter);
        if (keepFocus) root.querySelector('.section-filter')?.focus();
      });
    }
  }

  let activeQuery = new URLSearchParams(window.location.search).get('search') || '';
  let activeFilter = 'all';
  let activeSort = 'name-asc';
  function render() {
    activeFilter = 'all';
    activeSort = 'name-asc';
    if (page === 'customers') renderCustomers();
    else if (page === 'orders') renderOrders();
    else if (page === 'invoices') renderInvoices();
    else if (page === 'payments') renderPayments();
    else if (page === 'expenses') renderExpenses();
    else if (page === 'cashflow') renderCashflow();
    else if (page === 'reminders') renderReminders();
    else if (page === 'reports') renderReports();
  }

  function removeRecord(kind, id) {
    const collections = { customer: 'customers', order: 'orders', invoice: 'invoices', expense: 'expenses' };
    const collection = data[collections[kind]];
    const record = collection.find((item) => item.id === id);
    if (!record) return;
    const linkedWarning = kind === 'customer' ? ' Linked demo invoices, payments and orders will also be removed.' : '';
    confirm(`Delete ${kind}?`, `Remove ${kind === 'customer' ? record.name : (record.number || record.id)} from the local demo?${linkedWarning} This cannot be undone.`, () => {
      const index = collection.indexOf(record);
      collection.splice(index, 1);
      if (kind === 'invoice') {
        data.payments = data.payments.filter((payment) => payment.invoiceId !== id);
        data.reminders = data.reminders.filter((reminder) => reminder.invoiceId !== id);
        const order = data.orders.find((item) => item.id === record.orderId);
        if (order?.invoiceId === id) order.invoiceId = null;
      }
      if (kind === 'order') {
        const invoice = data.invoices.find((item) => item.id === record.invoiceId);
        if (invoice?.orderId === id) invoice.orderId = null;
      }
      if (kind === 'customer') {
        const customerInvoiceIds = new Set(data.invoices.filter((invoice) => invoice.customerId === id).map((invoice) => invoice.id));
        data.invoices = data.invoices.filter((invoice) => invoice.customerId !== id);
        data.payments = data.payments.filter((payment) => payment.customerId !== id);
        data.reminders = data.reminders.filter((reminder) => reminder.customerId !== id && !customerInvoiceIds.has(reminder.invoiceId));
        data.orders = data.orders.filter((order) => order.customerId !== id);
      }
    });
  }

  function runSectionAction(action, id, trigger) {
    if (action === 'add-customer') customerForm();
    else if (action === 'add-order') orderForm();
    else if (action === 'add-invoice') invoiceForm();
    else if (action === 'record-payment') paymentForm();
    else if (action === 'add-expense') expenseForm();
    else if (action === 'invoice-add-line') {
      const form = trigger.closest('form');
      const lineRoot = form?.querySelector('.invoice-lines');
      if (lineRoot) {
        const row = node('div', { className: 'invoice-line' }, [
          field('Item description', 'description', '', 'text', { placeholder: 'Service or product' }),
          field('Qty', 'qty', 1, 'number', { min: '0.01', step: '0.01' }),
          field('Unit price (₹)', 'unitPrice', 0, 'number', { min: '0', step: '0.01' }),
          field('GST %', 'gstRate', data.settings.defaultGstRate ?? 18, 'number', { min: '0', max: '100', step: '0.01' }),
          node('button', { className: 'btn btn--ghost btn--icon', type: 'button', 'data-section-action': 'invoice-remove-line', 'aria-label': 'Remove item', text: '×' }),
        ]);
        lineRoot.append(row);
        form.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (action === 'invoice-remove-line') {
      const form = trigger.closest('form');
      const rows = form?.querySelectorAll('.invoice-line') || [];
      if (rows.length <= 1) {
        toast({ title: 'At least one item is required', message: 'An invoice must include one line item.', variant: 'info' });
        return;
      }
      trigger.closest('.invoice-line')?.remove();
      form.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (action === 'reports-download') {
      downloadReport();
    } else if (action === 'reports-tab') {
      reportTab = trigger.dataset.tab;
      renderReports();
    } else if (action.startsWith('customer-')) {
      const customer = data.customers.find((item) => item.id === id);
      if (!customer) return;
      if (action === 'customer-view') customerDetail(customer);
      else if (action === 'customer-edit') customerForm(customer);
      else if (action === 'customer-delete') removeRecord('customer', id);
    } else if (action.startsWith('order-')) {
      const order = data.orders.find((item) => item.id === id);
      if (!order) return;
      if (action === 'order-view') orderDetail(order);
      else if (action === 'order-edit') orderForm(order);
      else if (action === 'order-delete') removeRecord('order', id);
    } else if (action.startsWith('invoice-')) {
      const invoice = data.invoices.find((item) => item.id === id);
      if (!invoice) return;
      if (action === 'invoice-view') invoicePreview(invoice);
      else if (action === 'invoice-edit') invoiceForm(invoice);
      else if (action === 'invoice-delete') removeRecord('invoice', id);
    } else if (action.startsWith('expense-')) {
      const expense = data.expenses.find((item) => item.id === id);
      if (!expense) return;
      if (action === 'expense-edit') expenseForm(expense);
      else if (action === 'expense-delete') removeRecord('expense', id);
    } else if (action === 'reminder-draft' || action === 'reminder-copy' || action === 'reminder-whatsapp') {
      const invoice = data.invoices.find((item) => item.id === id);
      if (!invoice) return;
      if (action === 'reminder-draft') showReminder(invoice);
      else if (action === 'reminder-whatsapp') showReminder(invoice, true);
      else {
        const text = reminderText(invoice);
        if (!navigator.clipboard?.writeText) {
          toast({ title: 'Could not copy', message: 'Clipboard access was unavailable. Select and copy the message manually.', variant: 'error' });
          return;
        }
        navigator.clipboard.writeText(text).then(
          () => toast({ title: 'Message copied', message: 'Paste it into WhatsApp or your preferred channel.', variant: 'success' }),
          () => toast({ title: 'Could not copy', message: 'Clipboard access was unavailable. Select and copy the message manually.', variant: 'error' }),
        ).catch(() => toast({ title: 'Could not copy', message: 'Clipboard access was unavailable. Select and copy the message manually.', variant: 'error' }));
      }
    }
  }

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-section-action]') : null;
    if (!target) return;
    runSectionAction(target.dataset.sectionAction, target.dataset.id, target);
  });
  root.addEventListener('change', (event) => {
    const select = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!select?.dataset.orderStatus) return;
    const order = data.orders.find((item) => item.id === select.dataset.orderStatus);
    if (!order) return;
    order.status = select.value;
    if (order.invoiceId) {
      const linkedInvoice = data.invoices.find((invoice) => invoice.id === order.invoiceId);
      if (linkedInvoice) linkedInvoice.customerId = order.customerId;
    }
    persistDemoState();
    toast({ title: 'Order status updated', message: `${order.id} is now ${order.status}.`, variant: 'success' });
    render();
  });
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-section-action]') : null;
    if (!target || root.contains(target)) return;
    runSectionAction(target.dataset.sectionAction, target.dataset.id, target);
  });
  const globalSearch = document.getElementById('global-search');
  globalSearch?.addEventListener('input', () => {
    const localSearch = root.querySelector('.section-search');
    if (!localSearch) return;
    localSearch.value = globalSearch.value;
    localSearch.dispatchEvent(new Event('input', { bubbles: true }));
  });

  render();
}
