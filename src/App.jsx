import { useEffect, useMemo, useState } from "react";

const APP_KEY = "simple-expense-mobile-v1";
const LEGACY_KEY = "student-finance-platform-v1";

const categories = ["Food", "Travel", "Shopping", "Bills", "Rent", "Health", "Education", "Entertainment", "Other"];
const paymentModes = ["Cash", "UPI", "Card", "Bank Transfer", "Other"];
const currencies = {
  INR: { symbol: "₹", locale: "en-IN" },
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "€", locale: "de-DE" },
};

const blankForm = () => ({
  type: "expense",
  amount: "",
  category: "Food",
  date: today(),
  paymentMode: "UPI",
  note: "",
});

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [transactions, setTransactions] = useState(() => loadInitialData());
  const [settings, setSettings] = useState(() => loadSettings());
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState("");
  const [historyMonth, setHistoryMonth] = useState(currentMonth());
  const [historyCategory, setHistoryCategory] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    localStorage.setItem(APP_KEY, JSON.stringify({ transactions, settings }));
  }, [transactions, settings]);

  useEffect(() => {
    document.body.dataset.theme = settings.theme;
  }, [settings.theme]);

  const money = (value) => formatMoney(value, settings.currency);
  const monthRows = useMemo(() => transactions.filter((item) => item.date.startsWith(historyMonth)), [transactions, historyMonth]);
  const currentMonthRows = useMemo(() => transactions.filter((item) => item.date.startsWith(currentMonth())), [transactions]);
  const totals = useMemo(() => calculateTotals(transactions, currentMonthRows), [transactions, currentMonthRows]);
  const recentRows = useMemo(() => [...transactions].sort(sortNewest).slice(0, 4), [transactions]);
  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monthRows
      .filter((item) => !historyCategory || item.category === historyCategory)
      .filter((item) => !q || [item.note, item.category, item.paymentMode].join(" ").toLowerCase().includes(q))
      .sort(sortNewest);
  }, [monthRows, historyCategory, search]);

  function saveTransaction(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return;
    const payload = {
      id: editingId || crypto.randomUUID(),
      ...form,
      amount,
      note: form.note.trim(),
      createdAt: editingId ? transactions.find((item) => item.id === editingId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTransactions((items) => (editingId ? items.map((item) => (item.id === editingId ? payload : item)) : [payload, ...items]));
    setForm(blankForm());
    setEditingId("");
    setActiveTab("home");
  }

  function editTransaction(item) {
    setForm({
      type: item.type,
      amount: String(item.amount),
      category: item.category,
      date: item.date,
      paymentMode: item.paymentMode,
      note: item.note || "",
    });
    setEditingId(item.id);
    setActiveTab("add");
  }

  function deleteTransaction(id) {
    if (!confirm("Delete this transaction?")) return;
    setTransactions((items) => items.filter((item) => item.id !== id));
  }

  function clearAllData() {
    if (!confirm("Clear all app data from this device?")) return;
    setTransactions([]);
    setForm(blankForm());
    setEditingId("");
    localStorage.removeItem(APP_KEY);
  }

  return (
    <main className="mobile-app-shell">
      <AppHeader activeTab={activeTab} settings={settings} />

      {activeTab === "home" && (
        <HomeScreen
          money={money}
          totals={totals}
          recentRows={recentRows}
          onAdd={() => {
            setForm(blankForm());
            setEditingId("");
            setActiveTab("add");
          }}
          onHistory={() => setActiveTab("history")}
        />
      )}

      {activeTab === "add" && (
        <AddScreen
          form={form}
          setForm={setForm}
          editingId={editingId}
          onSubmit={saveTransaction}
          onCancel={() => {
            setForm(blankForm());
            setEditingId("");
            setActiveTab("home");
          }}
        />
      )}

      {activeTab === "history" && (
        <HistoryScreen
          money={money}
          rows={filteredHistory}
          month={historyMonth}
          category={historyCategory}
          search={search}
          setMonth={setHistoryMonth}
          setCategory={setHistoryCategory}
          setSearch={setSearch}
          onEdit={editTransaction}
          onDelete={deleteTransaction}
        />
      )}

      {activeTab === "insights" && <InsightsScreen money={money} rows={currentMonthRows} />}

      {activeTab === "settings" && (
        <SettingsScreen settings={settings} setSettings={setSettings} onClear={clearAllData} />
      )}

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </main>
  );
}

function AppHeader({ activeTab, settings }) {
  const titles = {
    home: "Expense Manager",
    add: "Add Transaction",
    history: "History",
    insights: "Insights",
    settings: "Settings",
  };
  return (
    <header className="app-header">
      <div>
        <span>{settings.currency}</span>
        <h1>{titles[activeTab]}</h1>
      </div>
      <div className="app-dot" aria-hidden="true" />
    </header>
  );
}

function HomeScreen({ money, totals, recentRows, onAdd, onHistory }) {
  return (
    <section className="screen-stack">
      <article className="balance-card">
        <span>Current balance</span>
        <strong>{money(totals.balance)}</strong>
        <div>
          <small>Income {money(totals.monthIncome)}</small>
          <small>Expense {money(totals.monthExpense)}</small>
        </div>
      </article>

      <section className="mini-grid">
        <MetricCard label="Today" value={money(totals.todayExpense)} tone="warn" />
        <MetricCard label="This month" value={money(totals.monthExpense)} tone="danger" />
      </section>

      <button className="primary-action" type="button" onClick={onAdd}>+ Quick Add Expense</button>

      <section className="panel">
        <div className="panel-heading">
          <h2>Recent</h2>
          <button type="button" onClick={onHistory}>View all</button>
        </div>
        <TransactionList rows={recentRows} money={money} emptyText="No transactions yet." compact />
      </section>
    </section>
  );
}

function AddScreen({ form, setForm, editingId, onSubmit, onCancel }) {
  return (
    <form className="screen-stack transaction-form" onSubmit={onSubmit}>
      <div className="segmented">
        <button type="button" className={form.type === "expense" ? "is-active expense" : ""} onClick={() => setForm({ ...form, type: "expense" })}>Expense</button>
        <button type="button" className={form.type === "income" ? "is-active income" : ""} onClick={() => setForm({ ...form, type: "income" })}>Income</button>
      </div>

      <label className="amount-input">
        <span>Amount</span>
        <input inputMode="decimal" type="number" min="1" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0" autoFocus />
      </label>

      <label>
        <span>Category</span>
        <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
          {categories.map((category) => <option key={category}>{category}</option>)}
        </select>
      </label>

      <div className="two-fields">
        <label>
          <span>Date</span>
          <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
        </label>
        <label>
          <span>Payment</span>
          <select value={form.paymentMode} onChange={(event) => setForm({ ...form, paymentMode: event.target.value })}>
            {paymentModes.map((mode) => <option key={mode}>{mode}</option>)}
          </select>
        </label>
      </div>

      <label>
        <span>Note</span>
        <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Tea, rent, salary..." />
      </label>

      <div className="form-actions">
        <button className="secondary-action" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-action" type="submit">{editingId ? "Update" : "Save"}</button>
      </div>
    </form>
  );
}

function HistoryScreen({ money, rows, month, category, search, setMonth, setCategory, setSearch, onEdit, onDelete }) {
  return (
    <section className="screen-stack">
      <div className="filter-panel">
        <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">All categories</option>
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" />
      </div>
      <TransactionList rows={rows} money={money} onEdit={onEdit} onDelete={onDelete} emptyText="No transactions found." />
    </section>
  );
}

function InsightsScreen({ money, rows }) {
  const income = sumRows(rows, "income");
  const expense = sumRows(rows, "expense");
  const categoryTotals = categories
    .map((category) => ({ category, amount: sumRows(rows.filter((item) => item.category === category), "expense") }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const max = Math.max(...categoryTotals.map((item) => item.amount), 1);
  const biggest = rows.filter((item) => item.type === "expense").sort((a, b) => b.amount - a.amount)[0];

  return (
    <section className="screen-stack">
      <section className="mini-grid">
        <MetricCard label="Income" value={money(income)} tone="good" />
        <MetricCard label="Expense" value={money(expense)} tone="danger" />
      </section>

      <article className="panel">
        <h2>Category spending</h2>
        <div className="bar-list">
          {categoryTotals.length ? categoryTotals.map((item) => (
            <div className="bar-row" key={item.category}>
              <div><span>{item.category}</span><strong>{money(item.amount)}</strong></div>
              <div className="bar-track"><span style={{ width: `${Math.max(8, (item.amount / max) * 100)}%` }} /></div>
            </div>
          )) : <p className="empty-copy">No expenses this month.</p>}
        </div>
      </article>

      <article className="panel">
        <h2>Biggest expense</h2>
        {biggest ? <TransactionCard item={biggest} money={money} compact /> : <p className="empty-copy">No expense yet.</p>}
      </article>
    </section>
  );
}

function SettingsScreen({ settings, setSettings, onClear }) {
  return (
    <section className="screen-stack">
      <article className="panel settings-panel">
        <label>
          <span>Currency</span>
          <select value={settings.currency} onChange={(event) => setSettings({ ...settings, currency: event.target.value })}>
            {Object.keys(currencies).map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Theme</span>
          <select value={settings.theme} onChange={(event) => setSettings({ ...settings, theme: event.target.value })}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <button className="danger-action" type="button" onClick={onClear}>Clear all data</button>
      </article>
      <article className="panel">
        <h2>App info</h2>
        <p className="empty-copy">Your data is stored on this device using localStorage in this test version. No backend login is used here.</p>
      </article>
    </section>
  );
}

function TransactionList({ rows, money, onEdit, onDelete, emptyText, compact = false }) {
  if (!rows.length) return <p className="empty-copy">{emptyText}</p>;
  return (
    <div className="transaction-list">
      {rows.map((item) => (
        <TransactionCard key={item.id} item={item} money={money} onEdit={onEdit} onDelete={onDelete} compact={compact} />
      ))}
    </div>
  );
}

function TransactionCard({ item, money, onEdit, onDelete, compact }) {
  return (
    <article className={`transaction-card ${item.type}`}>
      <div>
        <strong>{item.note || item.category}</strong>
        <span>{formatDisplayDate(item.date)} · {item.category} · {item.paymentMode}</span>
      </div>
      <strong className="transaction-amount">{item.type === "income" ? "+" : "-"}{money(item.amount)}</strong>
      {!compact && (
        <div className="card-actions">
          <button type="button" onClick={() => onEdit(item)}>Edit</button>
          <button type="button" onClick={() => onDelete(item.id)}>Delete</button>
        </div>
      )}
    </article>
  );
}

function MetricCard({ label, value, tone }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function BottomNav({ activeTab, setActiveTab }) {
  const tabs = [
    ["home", "Home"],
    ["add", "Add"],
    ["history", "History"],
    ["insights", "Insights"],
    ["settings", "Settings"],
  ];
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {tabs.map(([id, label]) => (
        <button key={id} className={activeTab === id ? "is-active" : ""} type="button" onClick={() => setActiveTab(id)}>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function loadInitialData() {
  const saved = readJson(localStorage.getItem(APP_KEY));
  if (saved?.transactions?.length) return saved.transactions.map(normalizeTransaction);
  const legacy = readJson(localStorage.getItem(LEGACY_KEY));
  if (!legacy) return [];
  const expenses = Array.isArray(legacy.expenses) ? legacy.expenses.map((item) => normalizeTransaction({ ...item, type: "expense", paymentMode: item.paymentMethod })) : [];
  const incomes = Array.isArray(legacy.walletEntries) ? legacy.walletEntries.map((item) => normalizeTransaction({ ...item, type: "income", category: "Other", paymentMode: "Bank Transfer", note: item.note || "Income" })) : [];
  return [...expenses, ...incomes].sort(sortNewest);
}

function loadSettings() {
  const saved = readJson(localStorage.getItem(APP_KEY));
  const legacy = readJson(localStorage.getItem(LEGACY_KEY));
  return {
    currency: saved?.settings?.currency || legacy?.settings?.currency || "INR",
    theme: saved?.settings?.theme || legacy?.settings?.theme || "dark",
  };
}

function normalizeTransaction(item) {
  return {
    id: item.id || crypto.randomUUID(),
    type: item.type === "income" ? "income" : "expense",
    amount: Number(item.amount || 0),
    category: categories.includes(item.category) ? item.category : mapCategory(item.category),
    date: item.date || today(),
    paymentMode: paymentModes.includes(item.paymentMode) ? item.paymentMode : paymentModes.includes(item.paymentMethod) ? item.paymentMethod : "Other",
    note: item.note || "",
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
  };
}

function calculateTotals(allRows, monthRows) {
  return {
    balance: sumRows(allRows, "income") - sumRows(allRows, "expense"),
    monthIncome: sumRows(monthRows, "income"),
    monthExpense: sumRows(monthRows, "expense"),
    todayExpense: sumRows(allRows.filter((item) => item.date === today()), "expense"),
  };
}

function sumRows(rows, type) {
  return rows.filter((item) => item.type === type).reduce((total, item) => total + Number(item.amount || 0), 0);
}

function formatMoney(value, currency) {
  const config = currencies[currency] || currencies.INR;
  return `${config.symbol}${Number(value || 0).toLocaleString(config.locale, { maximumFractionDigits: 0 })}`;
}

function sortNewest(a, b) {
  return `${b.date}T${b.updatedAt || b.createdAt}`.localeCompare(`${a.date}T${a.updatedAt || a.createdAt}`);
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function currentMonth() {
  return today().slice(0, 7);
}

function formatDisplayDate(value) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(`${value}T00:00:00`));
}

function mapCategory(category = "") {
  const lower = String(category).toLowerCase();
  if (/food|meal|tea|snack|grocery|fast/.test(lower)) return "Food";
  if (/travel|transport|bus|fuel|train|cab/.test(lower)) return "Travel";
  if (/rent|hostel|pg/.test(lower)) return "Rent";
  if (/bill|recharge|electric|wifi/.test(lower)) return "Bills";
  if (/health|medicine|doctor/.test(lower)) return "Health";
  if (/school|college|book|print|education/.test(lower)) return "Education";
  if (/movie|game|entertainment/.test(lower)) return "Entertainment";
  if (/shopping|amazon|flipkart|shirt|shoe/.test(lower)) return "Shopping";
  return "Other";
}

function readJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
