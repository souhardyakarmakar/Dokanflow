import mockData from './mock-data.js';
import { toast } from '../app.js';

export function demoStateStorageKey() {
  const accountId = document.body?.dataset.accountId || 'guest';
  return `dokanflow.demo-state.v1.${accountId}`;
}

const STORAGE_KEY = demoStateStorageKey();
const DATE_MIGRATION_VERSION = 2;
const DATE_FIELDS = {
  customers: ['since'],
  orders: ['orderDate', 'expectedDate'],
  invoices: ['issueDate', 'dueDate'],
  payments: ['date'],
  expenses: ['date'],
  reminders: ['sentAt'],
};

function isoDateTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
    ? timestamp
    : null;
}

function shiftDateValue(value, days) {
  if (typeof value !== 'string') return value;
  const datePart = value.slice(0, 10);
  const timestamp = isoDateTimestamp(datePart);
  if (timestamp === null) return value;

  const shifted = new Date(timestamp);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return `${shifted.toISOString().slice(0, 10)}${value.slice(10)}`;
}

function migrateSavedDates(state, currentDate) {
  const previousDate = isoDateTimestamp(state.referenceDate);
  const targetDate = isoDateTimestamp(currentDate);
  const dayOffset = previousDate === null || targetDate === null
    ? 0
    : Math.round((targetDate - previousDate) / 86400000);
  const migrated = {
    ...state,
    referenceDate: currentDate,
    dateMigrationVersion: DATE_MIGRATION_VERSION,
  };

  if (dayOffset === 0) return migrated;

  Object.entries(DATE_FIELDS).forEach(([collection, fields]) => {
    migrated[collection] = state[collection].map((record) => {
      if (!record || typeof record !== 'object') return record;
      const shifted = { ...record };
      fields.forEach((field) => {
        shifted[field] = shiftDateValue(shifted[field], dayOffset);
      });
      return shifted;
    });
  });

  return migrated;
}

export function createInitialDemoState() {
  const account = document.body?.dataset || {};
  return {
    referenceDate: mockData.referenceDate,
    business: {
      ...mockData.business,
      name: account.businessName || mockData.business.name,
      owner: account.userName || mockData.business.owner,
      email: account.userEmail || mockData.business.email,
    },
    settings: { ...mockData.settings },
    customers: mockData.customers.map((item) => ({ ...item })),
    orders: mockData.orders.map((item) => ({ ...item })),
    invoices: mockData.invoices.map((item) => ({
      ...item,
      items: item.items.map((line) => ({ ...line })),
    })),
    payments: mockData.payments.map((item) => ({ ...item })),
    expenses: mockData.expenses.map((item) => ({ ...item })),
    reminders: mockData.reminders.map((item) => ({ ...item })),
  };
}

function isDemoState(value) {
  return value
    && typeof value === 'object'
    && typeof value.business === 'object'
    && typeof value.settings === 'object'
    && ['customers', 'orders', 'invoices', 'payments', 'expenses', 'reminders']
      .every((key) => Array.isArray(value[key]));
}

export function loadDemoState() {
  const initial = createInitialDemoState();
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return initial;
    const parsed = JSON.parse(saved);
    if (!isDemoState(parsed)) throw new TypeError('Saved demo data has an invalid shape.');
    if (parsed.dateMigrationVersion !== DATE_MIGRATION_VERSION) {
      const migrated = migrateSavedDates(parsed, initial.referenceDate);
      saveDemoState(migrated);
      return { ...initial, ...migrated };
    }
    return { ...initial, ...parsed, referenceDate: initial.referenceDate };
  } catch (error) {
    console.error('Unable to load DokanFlow demo state.', error);
    toast({
      title: 'Using sample data',
      message: 'Saved browser demo data was unavailable or invalid; the seeded examples are loaded instead.',
      variant: 'error',
    });
    return initial;
  }
}

export function saveDemoState(state) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      dateMigrationVersion: DATE_MIGRATION_VERSION,
    }));
  } catch (error) {
    console.error('Unable to save DokanFlow demo state.', error);
    toast({
      title: 'Demo changes are temporary',
      message: 'Browser storage is unavailable, so these changes will not carry between pages.',
      variant: 'error',
    });
  }
}
