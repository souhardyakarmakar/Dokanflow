/**
 * DokanFlow — mock-data.js
 * Deterministic demo dataset. Seeded values stay consistent while dates are
 * anchored to the current business-local day.
 * Plain data only: the exported object contains no functions.
 */

function currentBusinessDate() {
  const timezone = typeof document === 'undefined'
    ? 'Asia/Kolkata'
    : document.body?.dataset.userTimezone || 'Asia/Kolkata';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}

const REFERENCE_DATE = currentBusinessDate();
const SEED = 20250301;

/* ---------- Seeded helpers ---------- */

function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const round2 = (n) => Math.round(n * 100) / 100;
const round10 = (n) => Math.round(n / 10) * 10;
const pad = (n, width = 4) => String(n).padStart(width, '0');

/** Shift an ISO date by whole days using UTC so no timezone drift occurs. */
function shiftISO(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const clampToRef = (iso) => (iso > REFERENCE_DATE ? REFERENCE_DATE : iso);

/* ---------- Business & settings ---------- */

const business = {
  name: 'DokanFlow Demo Studio',
  owner: '',
  city: 'Jaipur',
  state: 'Rajasthan',
  gstin: '08ABCDE1234F1Z5',
  gstinIsDemo: true,
  phone: '+91 98290 11234',
  email: 'hello@dokanflowdemo.in',
  address: '14, Johari Bazaar Road, Jaipur 302003',
  logoInitials: 'DS',
};

const settings = {
  currency: 'INR',
  locale: 'en-IN',
  gstRegistered: true,
  defaultGstRate: 18,
  invoicePrefix: 'INV',
  invoiceStartNumber: 1,
  paymentTerms: 15,
};

/* ---------- Customers (40) ---------- */

const CUSTOMER_NAMES = [
  'Ananya Sharma', 'Rahul Agarwal', 'Sharma & Sons', 'Vikram Singh Rathore',
  'Meera Jain', 'Arjun Mehta', "D'Souza Interiors", 'Kavita Joshi',
  'Rohit Gupta', 'Sunita Devi', 'Faisal Khan', 'Nikhil Bansal',
  'Pooja Choudhary', 'Deepak Verma', 'Ritu Saxena', 'Manish Tiwari',
  'Neha Kulkarni', 'Pareek Tailors', 'Anjali Mishra', 'Karan Malhotra',
  'Shabnam Ansari', 'Harish Meena', 'Divya Nair', 'Mohit Goyal',
  'Sanjay Soni', 'Lakshmi Iyer', 'Abhishek Rawat', 'Tanvi Shah',
  'Imran Qureshi', 'Geeta Bhati', 'Vyas Print House', 'Kiran Patel',
  'Bhavna Chaudhary', 'Ravi Shankar Yadav', 'Pallavi Desai', 'Gurpreet Kaur',
  'Sameer Hussain', 'Megha Trivedi', 'Lohar Fabrication Works', 'Simran Arora',
];

const CITIES = ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Delhi', 'Mumbai', 'Pune', 'Ahmedabad', 'Surat'];
const isBusinessName = (name) => /&|Sons|Tailors|Interiors|House|Works/.test(name);

const customers = CUSTOMER_NAMES.map((name, i) => {
  const isBusiness = isBusinessName(name);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  return {
    id: `C${pad(i + 1, 3)}`,
    name,
    phone: `+91 9${String(int(0, 999999999)).padStart(9, '0')}`,
    email: `${slug}@example.in`,
    city: pick(CITIES),
    type: isBusiness ? 'Business' : 'Individual',
    creditLimit: isBusiness ? pick([50000, 75000, 100000]) : pick([5000, 10000, 15000, 25000]),
    since: shiftISO(REFERENCE_DATE, -int(1, 175)),
  };
});

/* ---------- Orders (30) ---------- */

const SERVICES = [
  'Saree blouse stitching', 'Laptop screen replacement', 'Website landing page design',
  'Kitchen cabinet polish', 'Wedding invitation printing', 'AC servicing',
  'Bike engine tune-up', 'Furniture upholstery', 'Logo design package', 'Phone battery replacement',
];
const ITEM_CATALOG = [
  'Blouse fabric stitching', 'Printed flex banner', 'Business cards (500 pcs)',
  'Laptop keyboard replacement', 'Website hosting (1 year)', 'AC gas refill',
  'Bike chain set', 'Cushion covers (set of 4)', 'Logo vector files',
  'Invoice book printing', 'Screen guard', 'Site visit charge', 'Labour charges', 'Spare parts',
];
const ORDER_NOTES = [
  'Customer wants delivery before Friday', 'Advance received in cash',
  'Fabric supplied by customer', 'Quote approved on WhatsApp',
  'Pickup and drop included', 'Rush job, extra care needed',
  'Two revisions included', 'Bring original bill at delivery',
];
const ORDER_STATUSES = ['Received', 'In Progress', 'Ready', 'Delivered'];

const orders = [];
for (let i = 0; i < 30; i += 1) {
  const orderDate = shiftISO(REFERENCE_DATE, -int(3, 170));
  orders.push({
    id: `ORD-${1001 + i}`,
    customerId: customers[int(0, customers.length - 1)].id,
    service: pick(SERVICES),
    estimate: Math.round(int(500, 120000) / 50) * 50,
    orderDate,
    expectedDate: shiftISO(orderDate, int(3, 21)),
    status: pick(ORDER_STATUSES),
    invoiceId: null,
    notes: pick(ORDER_NOTES),
  });
}

/* ---------- Invoice specs (before totals and payments) ---------- */

const specs = [];

// Ready or delivered orders each produce one invoice.
orders.forEach((order, orderIndex) => {
  if (order.status !== 'Ready' && order.status !== 'Delivered') return;
  const issueDate = clampToRef(order.expectedDate);
  specs.push({
    orderIndex,
    customerId: order.customerId,
    issueDate,
    dueDate: shiftISO(issueDate, pick([15, 30])),
    items: [{ description: order.service, qty: 1, unitPrice: order.estimate, gstRate: pick([5, 12, 18]) }],
    discountRate: 0,
    gstEnabled: true,
  });
});

// Standalone invoices fill the set to 45.
while (specs.length < 45) {
  const issueDate = shiftISO(REFERENCE_DATE, -int(0, 170));
  const itemCount = int(1, 3);
  const items = [];
  for (let k = 0; k < itemCount; k += 1) {
    items.push({
      description: pick([...SERVICES, ...ITEM_CATALOG]),
      qty: int(1, 6),
      unitPrice: round10(int(150, 8000)),
      gstRate: pick([0, 5, 12, 18]),
    });
  }
  specs.push({
    orderIndex: null,
    customerId: pick(customers).id,
    issueDate,
    dueDate: shiftISO(issueDate, pick([15, 30])),
    items,
    discountRate: rand() < 0.3 ? 0.05 : 0,
    gstEnabled: rand() < 0.85,
  });
}

specs.sort((a, b) => (a.issueDate < b.issueDate ? -1 : a.issueDate > b.issueDate ? 1 : 0));

/* ---------- Invoices & payments ---------- */

const METHODS = ['UPI', 'Cash', 'Bank transfer', 'Online payment'];
const invoices = [];
const payments = [];

specs.forEach((spec, idx) => {
  const id = `INV-${REFERENCE_DATE.slice(0, 4)}-${pad(idx + 1)}`;
  const items = spec.items.map((it) => ({
    description: it.description,
    qty: it.qty,
    unitPrice: it.unitPrice,
    gstRate: it.gstRate,
  }));

  // Totals rule: subtotal -> discount -> proportional GST per item -> total.
  const subtotal = round2(items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0));
  const discount = Math.round((subtotal * spec.discountRate) / 10) * 10;
  const discounted = round2(subtotal - discount);
  const taxTotal = round2(items.reduce((sum, it) => {
    if (!spec.gstEnabled || it.gstRate === 0 || subtotal === 0) return sum;
    const lineAfterDiscount = ((it.qty * it.unitPrice) * discounted) / subtotal;
    return sum + round2((lineAfterDiscount * it.gstRate) / 100);
  }, 0));
  const total = round2(discounted + taxTotal);

  // Payment behaviour: ~45% paid in full, ~15% partial, rest unpaid.
  const roll = rand();
  const pending = [];
  if (roll < 0.45) {
    if (rand() < 0.5) {
      pending.push(total);
    } else {
      const first = round2(total * 0.5);
      pending.push(first, round2(total - first));
    }
  } else if (roll < 0.6) {
    pending.push(round2(total * (0.2 + rand() * 0.5)));
  }

  pending.forEach((amount, p) => {
    const method = pick(METHODS);
    const offset = p === 0 ? int(0, 10) : int(11, 25);
    payments.push({
      id: `PAY-${pad(payments.length + 1)}`,
      invoiceId: id,
      customerId: spec.customerId,
      amount,
      method,
      date: clampToRef(shiftISO(spec.issueDate, offset)),
      reference:
        method === 'UPI' ? `UPI-${int(1000000, 9999999)}`
          : method === 'Bank transfer' ? `NEFT-${int(100000000, 999999999)}`
            : method === 'Online payment' ? `PG-${int(100000, 999999)}`
              : '',
    });
  });

  const paidAmount = round2(pending.reduce((sum, amt) => sum + amt, 0));
  let status = 'Unpaid';
  if (paidAmount >= total) status = 'Paid';
  else if (spec.dueDate < REFERENCE_DATE) status = 'Overdue';
  else if (paidAmount > 0) status = 'Partially Paid';

  const orderId = spec.orderIndex !== null ? orders[spec.orderIndex].id : null;
  if (spec.orderIndex !== null) orders[spec.orderIndex].invoiceId = id;

  invoices.push({
    id,
    number: id,
    customerId: spec.customerId,
    orderId,
    issueDate: spec.issueDate,
    dueDate: spec.dueDate,
    items,
    discount,
    gstEnabled: spec.gstEnabled,
    subtotal,
    taxTotal,
    total,
    paidAmount,
    status,
  });
});

/* ---------- Expenses (60, last 6 months) ---------- */

const EXPENSE_RULES = {
  Rent: { min: 18000, max: 35000, notes: ['Shop rent - Johari Bazaar', 'Godown rent'] },
  Utilities: { min: 800, max: 6000, notes: ['Electricity bill', 'Internet and phone'] },
  Salaries: { min: 8000, max: 25000, notes: ['Helper salary', 'Part-time staff'] },
  Supplies: { min: 500, max: 8000, notes: ['Thread and buttons', 'Printer ink and paper', 'Packaging material'] },
  Transport: { min: 500, max: 3000, notes: ['Delivery auto fare', 'Fuel for pickup run'] },
  Marketing: { min: 1000, max: 12000, notes: ['Flex board for shop', 'Instagram boost'] },
  Other: { min: 500, max: 5000, notes: ['Bank charges', 'Tea and water for visitors'] },
};
const EXPENSE_CATEGORIES = Object.keys(EXPENSE_RULES);
const EXPENSE_METHODS = ['UPI', 'Cash', 'Bank transfer', 'Card'];

const expenseRows = [];
for (let i = 0; i < 60; i += 1) {
  const category = pick(EXPENSE_CATEGORIES);
  const rule = EXPENSE_RULES[category];
  expenseRows.push({
    date: shiftISO(REFERENCE_DATE, -int(0, 179)),
    category,
    amount: round10(int(rule.min, rule.max)),
    method: pick(EXPENSE_METHODS),
    description: pick(rule.notes),
  });
}
expenseRows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
const expenses = expenseRows.map((row, i) => ({ id: `EXP-${pad(i + 1)}`, ...row }));

/* ---------- Reminder history (6) ---------- */

const overdueInvoices = invoices.filter((inv) => inv.status === 'Overdue');
const reminderTargets = (overdueInvoices.length >= 6 ? overdueInvoices : invoices).slice(0, 6);
const REMINDER_CHANNELS = ['WhatsApp', 'WhatsApp', 'SMS', 'WhatsApp', 'Email', 'SMS'];

const reminders = reminderTargets.map((inv, i) => ({
  id: `REM-${pad(i + 1, 3)}`,
  customerId: inv.customerId,
  invoiceId: inv.id,
  sentAt: `${shiftISO(REFERENCE_DATE, -(i * 4 + 2))}T10:30:00+05:30`,
  channel: REMINDER_CHANNELS[i % REMINDER_CHANNELS.length],
}));

/* ---------- Export ---------- */

export const mockData = {
  referenceDate: REFERENCE_DATE,
  business,
  settings,
  customers,
  orders,
  invoices,
  payments,
  expenses,
  reminders,
};

export default mockData;

export {
  REFERENCE_DATE as referenceDate,
  business,
  settings,
  customers,
  orders,
  invoices,
  payments,
  expenses,
  reminders,
};
