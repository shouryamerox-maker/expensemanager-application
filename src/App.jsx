import { useEffect, useMemo, useRef, useState } from "react";

const APP_NAME = "MeroxIO Expense Manager";
const APP_VERSION = "1.0.0";
const APP_KEY = "simple-expense-mobile-v1";
const LEGACY_KEY = "student-finance-platform-v1";
const LOCK_TIMEOUT_MS = 60_000;
const PASSWORD_ITERATIONS = 120_000;

const categories = ["Food", "Travel", "Bills", "Shopping", "Health", "Entertainment", "Rent", "Education", "Transfer", "Income", "Debit Card", "Credit Card", "Other"];
const paymentModes = ["Cash", "UPI", "Debit Card", "Credit Card", "Card", "Bank Transfer", "Unknown", "Other"];
const transactionKinds = ["Expense", "Income", "Lending", "Borrowing", "Repayment", "Transfer"];
const categoryIconNames = {
  Food: "utensils",
  Travel: "bus",
  Bills: "receipt",
  Shopping: "bag",
  Health: "health",
  Entertainment: "game",
  Rent: "home",
  Education: "book",
  Transfer: "trendingUp",
  Income: "rupee",
  "Debit Card": "card",
  "Credit Card": "card",
  Other: "spark",
};
const currencies = {
  INR: { symbol: "\u20b9", locale: "en-IN" },
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "\u20ac", locale: "de-DE" },
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
  const backupInputRef = useRef(null);
  const lastHiddenAtRef = useRef(0);
  const [isLocked, setIsLocked] = useState(() => isLockEnabled(loadSettings()));
  const [showSplash, setShowSplash] = useState(true);
  const [syncStatus, setSyncStatus] = useState("Local testing mode");
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState("");
  const [historyMonth, setHistoryMonth] = useState(currentMonth());
  const [historyCategory, setHistoryCategory] = useState("");
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [pdfPreviewRows, setPdfPreviewRows] = useState(null);
  const [navSuppressed, setNavSuppressed] = useState(false);
  const [credentialReady, setCredentialReady] = useState(() => !loadSettings().passwordLock || Boolean(loadSettings().passwordCredential));

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 3400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(APP_KEY, JSON.stringify({ transactions, settings: sanitizeSettingsForStorage(settings) }));
  }, [transactions, settings]);

  useEffect(() => {
    document.body.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    if (!isLockEnabled(settings)) setIsLocked(false);
  }, [settings]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        lastHiddenAtRef.current = Date.now();
        return;
      }
      if (isLockEnabled(settings) && Date.now() - lastHiddenAtRef.current > LOCK_TIMEOUT_MS) {
        setIsLocked(true);
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [settings]);

  useEffect(() => {
    if (!showSplash && !settings.onboardingCompleted) {
      setHelpOpen(true);
      updateSettings({ ...settings, onboardingCompleted: true });
    }
  }, [showSplash, settings.onboardingCompleted]);

  useEffect(() => {
    let active = true;
    async function loadSecureCredential() {
      if (!settings.passwordLock || settings.passwordCredential) {
        setCredentialReady(true);
        return;
      }
      const credential = await loadStoredPasswordCredential();
      if (active && credential) {
        setSettings((current) => ({ ...current, passwordCredential: credential }));
      }
      if (active) setCredentialReady(true);
    }
    loadSecureCredential();
    return () => {
      active = false;
    };
  }, [settings.passwordLock, settings.passwordCredential]);

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

  function showToast(message) {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 2600);
  }

  function tapFeedback() {
    if ("vibrate" in navigator) navigator.vibrate(12);
  }

  async function saveTransaction(event) {
    event.preventDefault();
    tapFeedback();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      showToast("Enter a valid amount");
      return;
    }
    const payload = {
      id: editingId || crypto.randomUUID(),
      ...form,
      amount,
      note: form.note.trim(),
      createdAt: editingId ? transactions.find((item) => item.id === editingId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTransactions((items) => (editingId ? items.map((item) => (item.id === editingId ? payload : item)) : [payload, ...items]));
    setSyncStatus("Saved locally");
    showToast(editingId ? "Expense updated" : "Expense added successfully");
    setForm(blankForm());
    setEditingId("");
    setActiveTab("home");
  }

  function saveTransactions(rows) {
    const now = new Date().toISOString();
    const payload = rows
      .map((item) => normalizeTransaction({ ...item, id: crypto.randomUUID(), createdAt: now, updatedAt: now }))
      .filter((item) => item.amount > 0);
    if (!payload.length) {
      showToast("No valid transactions to save");
      return false;
    }
    tapFeedback();
    setTransactions((items) => [...payload, ...items]);
    setSyncStatus("Saved locally");
    showToast(payload.length > 1 ? `${payload.length} transactions added` : "Transaction added");
    setForm(blankForm());
    setEditingId("");
    return true;
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

  async function deleteTransaction(id) {
    if (!confirm("Delete this transaction?")) return;
    tapFeedback();
    setTransactions((items) => items.filter((item) => item.id !== id));
    setSyncStatus("Deleted locally");
    showToast("Expense deleted");
  }

  async function clearAllData() {
    if (!confirm("Clear all app data from this device?")) return;
    setTransactions([]);
    setForm(blankForm());
    setEditingId("");
    localStorage.removeItem(APP_KEY);
    setSyncStatus("Local data cleared");
    showToast("Local data cleared");
  }

  async function resetAppAfterFailedRecovery() {
    await removeStoredPasswordCredential();
    localStorage.removeItem(APP_KEY);
    setTransactions([]);
    setSettings(normalizeSettings());
    setForm(blankForm());
    setEditingId("");
    setIsLocked(false);
    setActiveTab("home");
  }

  function updateSettings(nextSettings) {
    setSettings(nextSettings);
    setSyncStatus("Settings saved locally");
  }

  function backupData() {
    tapFeedback();
    const blob = new Blob([JSON.stringify({
      app: APP_NAME,
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      transactions,
      settings: sanitizeSettingsForStorage(settings),
    }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `meroxio-expense-backup-${today()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("Backup file created");
  }

  function restoreBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = readJson(String(reader.result || ""));
      if (!Array.isArray(data?.transactions)) {
        showToast("Invalid backup file");
        event.target.value = "";
        return;
      }
      const restoredRows = data.transactions.map(normalizeTransaction).sort(sortNewest);
      const restoredSettings = {
        ...loadSettings(),
        ...(data.settings || {}),
      };
      setTransactions(restoredRows);
      updateSettings(normalizeSettings(restoredSettings));
      setSyncStatus("Backup restored locally");
      showToast("Backup restored");
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  if (showSplash) return <SplashScreen />;

  if (isLocked) {
    return <SecurityLockScreen settings={settings} credentialReady={credentialReady} onUnlock={() => setIsLocked(false)} onResetData={resetAppAfterFailedRecovery} />;
  }

  return (
    <main className="mobile-app-shell">
      <AppHeader activeTab={activeTab} settings={settings} syncStatus={syncStatus} onProfile={() => setProfileOpen(true)} />

      {activeTab === "home" && (
        <HomeScreen
          money={money}
          totals={totals}
          transactions={transactions}
          recentRows={recentRows}
          balanceHidden={balanceHidden}
          setBalanceHidden={setBalanceHidden}
          onAdd={() => {
            setForm(blankForm());
            setEditingId("");
            setActiveTab("add");
          }}
          onHistory={() => setActiveTab("history")}
        />
      )}

      {activeTab === "add" && <AddScreen form={form} setForm={setForm} editingId={editingId} onSubmit={saveTransaction} onBatchSave={saveTransactions} onCancel={() => setActiveTab("home")} showToast={showToast} onSmartActiveChange={setNavSuppressed} recentRows={recentRows} money={money} />}

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
          onExport={() => setPdfPreviewRows(filteredHistory)}
        />
      )}

      {activeTab === "insights" && <InsightsScreen money={money} rows={currentMonthRows} />}

      {activeTab === "settings" && (
        <SettingsScreen settings={settings} setSettings={updateSettings} onClear={clearAllData} syncStatus={syncStatus} transactions={transactions} onBackup={backupData} onRestore={() => backupInputRef.current?.click()} onHelp={() => setHelpOpen(true)} showToast={showToast} />
      )}

      <input ref={backupInputRef} className="hidden-file-input" type="file" accept="application/json" onChange={restoreBackup} />
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} hidden={navSuppressed} />
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} settings={settings} setSettings={updateSettings} transactions={transactions} syncStatus={syncStatus} onBackup={backupData} onNavigate={(tab) => { setProfileOpen(false); setActiveTab(tab); }} />
      <PdfPreview open={pdfPreviewRows !== null} rows={pdfPreviewRows || []} settings={settings} money={money} onClose={() => setPdfPreviewRows(null)} onDownload={() => exportTransactionsPdf(pdfPreviewRows || [], settings, showToast)} />
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
      {toast && <Toast message={toast} />}
    </main>
  );
}

function SplashScreen() {
  return (
    <main className="splash-shell">
      <div className="splash-particles" aria-hidden="true" />
      <section className="splash-content" aria-label="Loading MeroxIO Expense Manager">
        <BrandMark />
        <div className="splash-wordmark">
          <h1>MEROXIO</h1>
          <p>Expense Manager</p>
        </div>
        <p className="splash-tagline">
          <span>Manage Smarter.</span>
          <span>Live Better.</span>
        </p>
      </section>
      <section className="splash-market" aria-hidden="true">
        <svg viewBox="0 0 420 170" role="img" focusable="false">
          <defs>
            <linearGradient id="splashLine" x1="0" y1="138" x2="420" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#1fbf59" />
              <stop offset="0.55" stopColor="#7dff5c" />
              <stop offset="1" stopColor="#d8ff76" />
            </linearGradient>
            <filter id="lineGlow" x="-12%" y="-40%" width="124%" height="180%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.30 0 0 0 0 1 0 0 0 0 0.36 0 0 0 0.75 0" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g className="splash-grid">
            <path d="M0 142H420M0 112H420M0 82H420M0 52H420" />
            <path d="M36 26V164M92 26V164M148 26V164M204 26V164M260 26V164M316 26V164M372 26V164" />
          </g>
          <path className="splash-chart-fill" d="M2 136C34 130 48 108 78 114C110 120 123 136 154 118C186 99 193 76 226 82C258 88 270 121 300 104C326 89 325 64 354 63C382 62 394 42 418 28V170H2Z" />
          <path className="splash-chart-line splash-chart-blur" d="M2 136C34 130 48 108 78 114C110 120 123 136 154 118C186 99 193 76 226 82C258 88 270 121 300 104C326 89 325 64 354 63C382 62 394 42 418 28" />
          <path className="splash-chart-line" d="M2 136C34 130 48 108 78 114C110 120 123 136 154 118C186 99 193 76 226 82C258 88 270 121 300 104C326 89 325 64 354 63C382 62 394 42 418 28" />
        </svg>
      </section>
      <div className="splash-loader" aria-hidden="true">
        <span>M</span>
      </div>
    </main>
  );
}

function SecurityLockScreen({ settings, credentialReady, onUnlock, onResetData }) {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState(settings.biometricLock ? "Checking fingerprint..." : "Enter your password/PIN.");
  const [recovering, setRecovering] = useState(false);
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    let active = true;
    async function unlockWithBiometric() {
      if (!settings.biometricLock) return;
      const result = await requestBiometricUnlock();
      if (!active) return;
      if (result.ok) {
        onUnlock();
      } else {
        setStatus(settings.passwordLock ? "Fingerprint unavailable. Enter your password/PIN." : "Fingerprint is unavailable on this build.");
      }
    }
    unlockWithBiometric();
    return () => {
      active = false;
    };
  }, [settings.biometricLock, settings.passwordLock, onUnlock]);

  async function unlockWithPassword(event) {
    event.preventDefault();
    if (!settings.passwordLock) {
      onUnlock();
      return;
    }
    if (!credentialReady) {
      setStatus("Loading your secure password. Please wait a moment.");
      return;
    }
    const valid = await verifyPassword(pin, settings.passwordCredential);
    if (valid) {
      setPin("");
      onUnlock();
    } else {
      setStatus("Incorrect password/PIN. Try again.");
    }
  }

  async function recoverPassword(event) {
    event.preventDefault();
    if (!settings.recoveryCredential) {
      setStatus("No recovery question was set. You can reset local app data below.");
      return;
    }
    if (!(await verifyPassword(normalizeSecret(recoveryAnswer), settings.recoveryCredential))) {
      setStatus("That security answer does not match.");
      return;
    }
    if (newPassword.trim().length < 4) {
      setStatus("Use at least 4 characters for the new password.");
      return;
    }
    const credential = await createPasswordCredential(normalizeSecret(newPassword));
    await saveStoredPasswordCredential(credential);
    localStorage.setItem(APP_KEY, JSON.stringify({ ...readJson(localStorage.getItem(APP_KEY)), settings: { ...sanitizeSettingsForStorage(settings), passwordCredential: credential } }));
    onUnlock();
  }

  return (
    <main className="mobile-app-shell lock-shell">
      <form className="lock-card" onSubmit={recovering ? recoverPassword : unlockWithPassword}>
        <BrandMark />
        <Icon name="shield" />
        <h1>MeroxIO is locked</h1>
        <p>{recovering ? settings.recoveryQuestion || "Password recovery" : status}</p>
        {!recovering && settings.passwordLock && <input type="password" autoComplete="current-password" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Password or PIN" autoFocus />}
        {recovering && <>
          <input value={recoveryAnswer} onChange={(event) => setRecoveryAnswer(event.target.value)} placeholder="Security answer" />
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password or PIN" />
        </>}
        <button className="primary-action" type="submit" disabled={!credentialReady && !recovering}><Icon name="lock" /> {recovering ? "Reset password" : "Unlock app"}</button>
        {settings.passwordLock && <button className="text-action" type="button" onClick={() => { setRecovering(!recovering); setStatus("Enter your password/PIN."); }}>{recovering ? "Back to unlock" : "Forgot Password?"}</button>}
        {recovering && <button className="danger-text-action" type="button" onClick={() => { if (confirm("This permanently removes all local transactions and settings. Continue?")) onResetData(); }}>Reset local app data</button>}
      </form>
    </main>
  );
}

function AppHeader({ activeTab, settings, syncStatus, onProfile }) {
  const titles = {
    home: "MeroxIO",
    add: "Smart Add",
    history: "History",
    insights: "Insights",
    settings: "Settings",
  };
  const profile = getProfile();
  return (
    <header className="app-header">
      <div>
        <span>{settings.currency} - {APP_NAME}</span>
        <h1>{titles[activeTab]}</h1>
        <small>{syncStatus}</small>
      </div>
      <button className="profile-button" type="button" onClick={onProfile} aria-label="Open profile menu">
        {profile.avatar ? <img src={profile.avatar} alt="" /> : <Icon name="user" />}
      </button>
    </header>
  );
}

function HomeScreen({ money, totals, transactions, recentRows, balanceHidden, setBalanceHidden, onAdd, onHistory }) {
  const weekBars = getWeekSpending(transactions);
  const maxWeek = Math.max(...weekBars.map((item) => item.amount), 1);
  return (
    <section className="screen-stack page-enter">
      <button className="ai-hero" type="button" onClick={onAdd}>
        <span><Icon name="spark" /></span>
        <div>
          <strong>Smart Add</strong>
          <p>Type or speak naturally and review before saving.</p>
        </div>
        <Icon name="plus" />
      </button>

      <article className="balance-card">
        <div className="balance-topline">
          <span>Available balance</span>
          <button type="button" className="icon-button ghost" onClick={() => setBalanceHidden(!balanceHidden)} aria-label={balanceHidden ? "Show balance" : "Hide balance"}>
            <Icon name={balanceHidden ? "eye" : "eyeOff"} />
          </button>
        </div>
        <strong className="balance-amount">{balanceHidden ? "******" : money(totals.balance)}</strong>
        <div className="balance-indicators">
          <small><Icon name="trendingUp" /> Income {money(totals.monthIncome)}</small>
          <small><Icon name="trendingDown" /> Expense {money(totals.monthExpense)}</small>
        </div>
      </article>

      <section className="dashboard-grid">
        <MetricCard label="Today's Spending" value={money(totals.todayExpense)} tone="warn" icon="calendar" />
        <MetricCard label="Budget Left" value={money(totals.budgetLeft)} tone={totals.budgetLeft >= 0 ? "good" : "danger"} icon="wallet" />
        <MetricCard label="This Week" value={money(totals.weekExpense)} tone="danger" icon="chart" />
        <MetricCard label="This Month" value={money(totals.monthExpense)} tone="danger" icon="trendingDown" />
      </section>

      <article className="panel weekly-panel">
        <div className="panel-heading">
          <h2>Weekly Spending</h2>
          <span>{money(totals.weekExpense)}</span>
        </div>
        <div className="week-chart" aria-label="Weekly spending chart">
          {weekBars.map((item) => (
            <div className="week-column" key={item.label}>
              <span style={{ height: `${Math.max(10, (item.amount / maxWeek) * 100)}%` }} />
              <small>{item.label}</small>
            </div>
          ))}
        </div>
      </article>

      <section className="panel recent-panel">
        <div className="panel-heading">
          <h2>Recent</h2>
          <button type="button" onClick={onHistory}>View all</button>
        </div>
        <TransactionList rows={recentRows} money={money} emptyText="Start tracking today." compact />
      </section>
    </section>
  );
}

function AddScreen({ form, setForm, editingId, onSubmit, onBatchSave, onCancel, showToast, onSmartActiveChange, recentRows, money }) {
  const [addMode, setAddMode] = useState(editingId ? "manual" : "quick");
  const [quickText, setQuickText] = useState("");
  const [batchDrafts, setBatchDrafts] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [deletedDraft, setDeletedDraft] = useState(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const smartPlaceholders = [
    "Type: spent ₹250 on food",
    "Say: petrol ₹500",
    "Try: received ₹2000 salary",
    "Add naturally…",
    "Lunch ₹180 with friends",
    "Auto-detect amount & category",
  ];

  useEffect(() => {
    if (quickText) return undefined;
    const timer = window.setInterval(() => setPlaceholderIndex((index) => (index + 1) % smartPlaceholders.length), 3200);
    return () => window.clearInterval(timer);
  }, [quickText]);

  useEffect(() => () => onSmartActiveChange(false), [onSmartActiveChange]);

  async function startVoiceInput() {
    setIsListening(true);
    try {
      const transcript = await listenForExpenseSpeech();
      if (!transcript) {
        showToast("I couldn't hear anything clearly");
        return;
      }
      setQuickText(transcript);
      setBatchDrafts([]);
      showToast("Voice captured. Tap Analyze");
    } catch (error) {
      showToast(error.message || "Mic permission denied or unavailable");
    } finally {
      setIsListening(false);
    }
  }

  function analyzeSmartText() {
    const parsedRows = parseQuickAddEntries(quickText);
    if (!parsedRows.length) {
      showToast("Add an amount, then try Analyze again");
      return;
    }
    setBatchDrafts(parsedRows.map((item) => item.form));
    setDeletedDraft(null);
    showToast(parsedRows.some((item) => item.needsReview) ? "Preview ready - check highlighted fields" : "Preview ready");
  }

  function saveSmartDrafts() {
    if (!onBatchSave(batchDrafts)) return;
    setQuickText("");
    setBatchDrafts([]);
    setDeletedDraft(null);
    onSmartActiveChange(false);
  }

  function updateBatchDraft(index, patch) {
    setBatchDrafts((items) => items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, ...patch };
      const resolved = Number(next.amount) > 0 && next.category !== "Other" && next.paymentMode !== "Unknown" && next.paymentMode !== "Other" && Boolean(next.date);
      return { ...next, needsReview: resolved ? false : next.needsReview };
    }));
  }

  function removeBatchDraft(index) {
    setBatchDrafts((items) => {
      const item = items[index];
      if (item) setDeletedDraft({ item, index });
      return items.filter((_, itemIndex) => itemIndex !== index);
    });
    showToast("Removed from preview");
  }

  function undoDelete() {
    if (!deletedDraft) return;
    setBatchDrafts((items) => {
      const next = [...items];
      next.splice(Math.min(deletedDraft.index, next.length), 0, deletedDraft.item);
      return next;
    });
    setDeletedDraft(null);
  }

  return (
    <form className="screen-stack transaction-form page-enter" onSubmit={onSubmit}>
      {!editingId && <div className="add-mode-switch" role="tablist" aria-label="Add transaction mode">
        <button type="button" className={addMode === "quick" ? "is-active" : ""} onClick={() => setAddMode("quick")}><Icon name="spark" /> Smart Add</button>
        <button type="button" className={addMode === "manual" ? "is-active" : ""} onClick={() => setAddMode("manual")}><Icon name="edit" /> Manual Add</button>
      </div>}

      {!editingId && addMode === "quick" && (
        <>
        <article
          className="ai-card add-panel"
          onFocusCapture={() => onSmartActiveChange(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) onSmartActiveChange(false);
          }}
        >
          <div className="ai-card-heading">
            <span className="smart-brand-mark"><BrandMark small /></span>
            <div>
              <h2>Smart Add</h2>
            </div>
          </div>
          <label className="quick-input-wrap">
            {!quickText && <span className="rotating-placeholder" key={placeholderIndex}>{smartPlaceholders[placeholderIndex]}</span>}
            <textarea value={quickText} onChange={(event) => { setQuickText(event.target.value); setBatchDrafts([]); setDeletedDraft(null); }} placeholder="" rows="6" aria-label="Smart Add input" />
          </label>
          <div className="quick-tools">
            <button className={isListening ? "mic-action is-listening" : "mic-action"} type="button" onClick={startVoiceInput} disabled={isListening}><Icon name="mic" /> {isListening ? "Listening..." : "Speak"}</button>
            <button className="analyze-smart-action" type="button" onClick={analyzeSmartText} disabled={!quickText.trim()}><Icon name="spark" /> Analyze</button>
          </div>
          {batchDrafts.length > 0 && (
            <section className="batch-review" aria-label="Detected transactions">
              <div className="batch-heading">
                <strong>{batchDrafts.length} ready to confirm</strong>
              </div>
              {batchDrafts.map((item, index) => (
                <QuickPreviewCard key={`${item.note}-${index}`} item={item} index={index} onChange={updateBatchDraft} onDelete={removeBatchDraft} />
              ))}
              {deletedDraft && <button className="undo-action" type="button" onClick={undoDelete}>Undo delete</button>}
              <button className="primary-action smart-save-action" type="button" onClick={saveSmartDrafts}><Icon name="plus" /> {batchDrafts.length > 1 ? `Save ${batchDrafts.length} transactions` : "Save transaction"}</button>
            </section>
          )}
        </article>
        <SmartRecentTransactions rows={recentRows} money={money} />
        </>
      )}

      {(editingId || addMode === "manual") && <section className="manual-add-panel add-panel">
        {!editingId && (
          <div className="manual-heading">
            <span><Icon name="edit" /></span>
            <div>
              <h2>Manual Add Transaction</h2>
              <p>Full control for exact entries.</p>
            </div>
          </div>
        )}
      <div className="segmented">
        <button type="button" className={form.type === "expense" ? "is-active expense" : ""} onClick={() => setForm({ ...form, type: "expense" })}>Expense</button>
        <button type="button" className={form.type === "income" ? "is-active income" : ""} onClick={() => setForm({ ...form, type: "income" })}>Income</button>
      </div>

      <label className="amount-input">
        <span>Amount</span>
        <input inputMode="decimal" type="number" min="1" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0" />
      </label>

      <fieldset className="category-grid">
        <legend>Category</legend>
        {categories.map((category) => (
          <button type="button" key={category} className={form.category === category ? "is-active" : ""} onClick={() => setForm({ ...form, category })}>
            <CategoryBadge category={category} compact />
            {category}
          </button>
        ))}
      </fieldset>

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
        <button className="primary-action" type="submit">{editingId ? "Update" : "Add transaction"}</button>
      </div>
      </section>}
    </form>
  );
}

function QuickPreviewCard({ item, index, onChange, onDelete }) {
  const [dragX, setDragX] = useState(0);
  const [startX, setStartX] = useState(null);
  const confidence = Math.round((item.confidence || 0.72) * 100);
  const needsReview = item.needsReview || confidence < 70;

  function finishSwipe() {
    if (dragX < -82) onDelete(index);
    setDragX(0);
    setStartX(null);
  }

  return (
    <article className="swipe-shell">
      <span className="swipe-delete">Delete</span>
      <div
        className="batch-row"
        style={{ transform: `translateX(${dragX}px)` }}
        onPointerDown={(event) => setStartX(event.clientX)}
        onPointerMove={(event) => {
          if (startX === null) return;
          setDragX(Math.min(0, Math.max(-120, event.clientX - startX)));
        }}
        onPointerUp={finishSwipe}
        onPointerCancel={finishSwipe}
      >
        <CategoryBadge category={item.category} />
        <div className="batch-row-main">
          <input inputMode="decimal" type="number" min="1" step="0.01" value={item.amount} onChange={(event) => onChange(index, { amount: event.target.value })} aria-label="Amount" />
          <select value={item.transactionKind || titleCase(item.type)} onChange={(event) => onChange(index, { transactionKind: event.target.value, type: transactionKindToType(event.target.value, item.type) })} aria-label="Transaction type">
            {transactionKinds.map((kind) => <option key={kind}>{kind}</option>)}
          </select>
          <select className={item.category === "Other" ? "needs-review-field" : ""} value={item.category} onChange={(event) => onChange(index, { category: event.target.value })} aria-label="Category">
            {categories.map((category) => <option key={category}>{category}</option>)}
          </select>
          <select className={item.paymentMode === "Unknown" || item.paymentMode === "Other" ? "needs-review-field" : ""} value={item.paymentMode} onChange={(event) => onChange(index, { paymentMode: event.target.value })} aria-label="Payment mode">
            {paymentModes.map((mode) => <option key={mode}>{mode}</option>)}
          </select>
          <input type="date" value={item.date} onChange={(event) => onChange(index, { date: event.target.value })} aria-label="Date" />
          <input value={item.note} onChange={(event) => onChange(index, { note: event.target.value })} aria-label="Notes" />
          <span className={needsReview ? "confidence low" : "confidence"}>{needsReview ? "Needs review" : `${confidence}% confidence`}</span>
        </div>
      </div>
    </article>
  );
}

function SmartRecentTransactions({ rows, money }) {
  return (
    <section className="smart-recent-panel">
      <div className="panel-heading"><div><h2>Recent transactions</h2><span>Updated instantly</span></div></div>
      {!rows.length ? <div className="smart-recent-empty"><Icon name="receipt" /><span>No recent Smart Add transactions yet.</span></div> : (
        <div className="smart-recent-list">
          {rows.slice(0, 5).map((item) => (
            <article key={item.id}>
              <CategoryBadge category={item.category} />
              <div><strong>{item.note || item.category}</strong><span>{item.category} · {formatRecentDateTime(item)}</span></div>
              <div className="smart-recent-value"><strong className={item.type}>{item.type === "income" ? "+" : "-"}{money(item.amount)}</strong><span>{item.transactionKind || titleCase(item.type)}</span></div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function HistoryScreen({ money, rows, month, category, search, setMonth, setCategory, setSearch, onEdit, onDelete, onExport }) {
  const groups = groupTransactionsByDate(rows);
  const [openDates, setOpenDates] = useState(() => new Set());
  function toggleDate(date) {
    setOpenDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  }
  return (
    <section className="screen-stack page-enter">
      <div className="filter-panel">
        <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">All categories</option>
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" />
        <button className="secondary-action" type="button" onClick={onExport}><Icon name="eye" /> Preview PDF</button>
      </div>
      {!rows.length ? <EmptyState text="No transactions found." /> : (
        <div className="history-groups">
          {groups.map(([date, dateRows]) => (
            <section className={`history-group ${openDates.has(date) ? "is-open" : ""}`} key={date}>
              <button className="date-section-heading" type="button" onClick={() => toggleDate(date)} aria-expanded={openDates.has(date)}>
                <span className="date-icon"><Icon name="calendar" /></span>
                <div><strong>{formatHistoryDate(date)}</strong><span>{dateRows.length} transaction{dateRows.length === 1 ? "" : "s"}</span></div>
                <span className="date-total">{money(sumAllRows(dateRows))}</span>
                <Icon name="chevron" />
              </button>
              {openDates.has(date) && <TransactionList rows={dateRows} money={money} onEdit={onEdit} onDelete={onDelete} emptyText="" />}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function InsightsScreen({ money, rows }) {
  const income = sumRows(rows, "income");
  const expense = sumRows(rows, "expense");
  const monthBars = getMonthSpending(rows);
  const weekBars = getWeekSpending(rows);
  const categoryTotals = categories
    .map((category) => ({ category, amount: sumRows(rows.filter((item) => item.category === category), "expense") }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const max = Math.max(...categoryTotals.map((item) => item.amount), 1);
  const maxMonth = Math.max(...monthBars.map((item) => item.amount), 1);
  const maxWeek = Math.max(...weekBars.map((item) => item.amount), 1);
  const topCategory = categoryTotals[0];
  const biggest = rows.filter((item) => item.type === "expense").sort((a, b) => b.amount - a.amount)[0];

  return (
    <section className="screen-stack page-enter">
      <section className="mini-grid">
        <MetricCard label="Income" value={money(income)} tone="good" icon="trendingUp" />
        <MetricCard label="Expense" value={money(expense)} tone="danger" icon="trendingDown" />
      </section>

      <article className="panel chart-panel">
        <div className="panel-heading">
          <h2>Monthly Spending</h2>
          <span>{money(expense)}</span>
        </div>
        <div className="month-chart" aria-label="Monthly spending chart">
          {monthBars.map((item) => (
            <span key={item.day} style={{ height: `${Math.max(8, (item.amount / maxMonth) * 100)}%` }} title={`${item.day}: ${money(item.amount)}`} />
          ))}
        </div>
      </article>

      <article className="panel weekly-panel">
        <div className="panel-heading">
          <h2>Weekly Spending</h2>
          <span>{money(sumRows(rows.filter((item) => isThisWeek(item.date)), "expense"))}</span>
        </div>
        <div className="week-chart" aria-label="Weekly spending chart">
          {weekBars.map((item) => (
            <div className="week-column" key={item.label}>
              <span style={{ height: `${Math.max(10, (item.amount / maxWeek) * 100)}%` }} />
              <small>{item.label}</small>
            </div>
          ))}
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <h2>Category Breakdown</h2>
          {topCategory && <span>{topCategory.category}</span>}
        </div>
        <div className="bar-list">
          {categoryTotals.length ? categoryTotals.map((item) => (
            <div className="bar-row" key={item.category}>
              <div><span><CategoryBadge category={item.category} compact /> {item.category}</span><strong>{money(item.amount)}</strong></div>
              <div className="bar-track"><span style={{ width: `${Math.max(8, (item.amount / max) * 100)}%` }} /></div>
            </div>
          )) : <EmptyState text="No expenses this month." />}
        </div>
      </article>

      <article className="panel highlight-panel">
        <h2>Highest Spending Category</h2>
        {topCategory ? (
          <div className="category-highlight">
            <CategoryBadge category={topCategory.category} />
            <div>
              <strong>{topCategory.category}</strong>
              <span>{money(topCategory.amount)} this month</span>
            </div>
          </div>
        ) : <EmptyState text="No category data yet." />}
      </article>

      <article className="panel">
        <h2>Biggest expense</h2>
        {biggest ? <TransactionCard item={biggest} money={money} compact /> : <EmptyState text="Add an expense to see insights." />}
      </article>
    </section>
  );
}

function SettingsScreen({ settings, setSettings, onClear, syncStatus, transactions, onBackup, onRestore, onHelp, showToast }) {
  const profile = getProfile();
  const [securityMode, setSecurityMode] = useState("");

  async function submitSecurityForm(values) {
    if (securityMode !== "setup" && !(await verifyPassword(normalizeSecret(values.current), settings.passwordCredential))) {
      showToast("Current password is incorrect");
      return;
    }
    if (securityMode === "remove") {
      await removeStoredPasswordCredential();
      setSettings({ ...settings, passwordLock: false, passwordCredential: null, recoveryQuestion: "", recoveryCredential: null });
      setSecurityMode("");
      showToast("Password lock removed");
      return;
    }
    if (values.password.trim().length < 4) {
      showToast("Use at least 4 characters");
      return;
    }
    if (values.password !== values.confirmPassword) {
      showToast("Passwords do not match");
      return;
    }
    if (securityMode === "setup" && (!values.question.trim() || !values.answer.trim())) {
      showToast("Complete the recovery question");
      return;
    }
    const passwordCredential = await createPasswordCredential(normalizeSecret(values.password));
    await saveStoredPasswordCredential(passwordCredential);
    const recoveryCredential = securityMode === "setup" ? await createPasswordCredential(normalizeSecret(values.answer)) : settings.recoveryCredential;
    setSettings({ ...settings, passwordLock: true, passwordCredential, recoveryQuestion: securityMode === "setup" ? values.question.trim() : settings.recoveryQuestion, recoveryCredential });
    setSecurityMode("");
    showToast(securityMode === "setup" ? "Password lock enabled" : "Password changed");
  }

  return (
    <section className="screen-stack page-enter">
      <article className="panel profile-summary">
        <ProfileAvatar profile={profile} />
        <div>
          <h2>{profile.name}</h2>
          <p>{profile.email}</p>
          <small className="status-pill online">No login required</small>
        </div>
      </article>
      <article className="panel settings-panel">
        <div className="settings-section-title"><span>Preferences</span><small>Display and currency</small></div>
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
        <section className="security-block">
          <div className="settings-section-title"><span>App security</span><small>Protect your local financial data</small></div>
          <ToggleRow icon="lock" title="Biometric Lock" description="Use your fingerprint or device security." checked={settings.biometricLock} onChange={(checked) => setSettings({ ...settings, biometricLock: checked })} />
          <ToggleRow icon="shield" title="Password Lock" description="Use a password when biometric unlock is unavailable." checked={settings.passwordLock} onChange={(checked) => setSecurityMode(checked ? "setup" : "remove")} />
          {settings.passwordLock && <button className="password-action" type="button" onClick={() => setSecurityMode("change")}><span><Icon name="lock" /></span><div><strong>Change password</strong><small>Update your password or PIN</small></div><Icon name="chevron" /></button>}
        </section>
        <div className="settings-section-title"><span>Data & support</span><small>Backup, help and privacy</small></div>
        <div className="backup-grid">
          <button className="secondary-action" type="button" onClick={onBackup}><Icon name="download" /> Backup data</button>
          <button className="secondary-action" type="button" onClick={onRestore}><Icon name="cloud" /> Restore data</button>
        </div>
        <button className="secondary-action" type="button" onClick={onHelp}><Icon name="help" /> View App Guide</button>
        <button className="secondary-action" type="button" onClick={() => alert("This testing build keeps data on your device. Use Backup before clearing data or reinstalling.")}><Icon name="shield" /> Privacy info</button>
        <button className="danger-action" type="button" onClick={onClear}><Icon name="trash" /> Clear all data</button>
      </article>
      <article className="panel">
        <h2>About MeroxIO</h2>
        <p className="empty-copy">Version {APP_VERSION}. {transactions.length} transactions tracked. {syncStatus}</p>
      </article>
      <SecurityPasswordSheet mode={securityMode} onClose={() => setSecurityMode("")} onSubmit={submitSecurityForm} />
    </section>
  );
}

function SecurityPasswordSheet({ mode, onClose, onSubmit }) {
  const [values, setValues] = useState({ current: "", password: "", confirmPassword: "", question: "What is your birth city?", answer: "" });
  if (!mode) return null;
  const title = mode === "setup" ? "Set app password" : mode === "change" ? "Change password" : "Turn off password lock";
  return (
    <div className="sheet-backdrop security-backdrop" role="presentation" onClick={onClose}>
      <form className="security-sheet" onSubmit={(event) => { event.preventDefault(); onSubmit(values); }} onClick={(event) => event.stopPropagation()}>
        <button className="sheet-grabber" type="button" onClick={onClose} aria-label="Close" />
        <div className="security-sheet-heading"><span><Icon name="shield" /></span><div><h2>{title}</h2><p>Your password stays on this device.</p></div></div>
        {mode !== "setup" && <label><span>Current password</span><input type="password" value={values.current} onChange={(event) => setValues({ ...values, current: event.target.value })} placeholder="Enter current password" /></label>}
        {mode !== "remove" && <>
          <label><span>{mode === "setup" ? "New password or PIN" : "New password"}</span><input type="password" value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} placeholder="At least 4 characters" /></label>
          <label><span>Confirm password</span><input type="password" value={values.confirmPassword} onChange={(event) => setValues({ ...values, confirmPassword: event.target.value })} placeholder="Enter it again" /></label>
        </>}
        {mode === "setup" && <>
          <label><span>Recovery question</span><select value={values.question} onChange={(event) => setValues({ ...values, question: event.target.value })}><option>What is your birth city?</option><option>What is your favorite food?</option><option>What is your favorite color?</option><option>What was your first school?</option></select></label>
          <label><span>Security answer</span><input value={values.answer} onChange={(event) => setValues({ ...values, answer: event.target.value })} placeholder="Your private answer" /></label>
        </>}
        <div className="security-sheet-actions"><button className="secondary-action" type="button" onClick={onClose}>Cancel</button><button className={mode === "remove" ? "danger-action" : "primary-action"} type="submit">{mode === "remove" ? "Turn off" : "Save password"}</button></div>
      </form>
    </div>
  );
}

function ToggleRow({ icon, title, description, checked, onChange }) {
  return (
    <label className="toggle-row">
      <span className="toggle-icon"><Icon name={icon} /></span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function TransactionList({ rows, money, onEdit, onDelete, emptyText, compact = false }) {
  if (!rows.length) return <EmptyState text={emptyText} />;
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
      <CategoryBadge category={item.category} />
      <div>
        <strong>{item.note || item.category}</strong>
        <span>{formatDisplayDate(item.date)} - {item.category} - {item.paymentMode}</span>
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

function CategoryBadge({ category, compact = false }) {
  return <span className={compact ? "category-badge compact" : "category-badge"} aria-hidden="true"><Icon name={categoryIconNames[category] || categoryIconNames.Other} /></span>;
}

function MetricCard({ label, value, tone, icon }) {
  return (
    <article className={`metric-card ${tone}`}>
      <i aria-hidden="true"><Icon name={icon} /></i>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function BottomNav({ activeTab, setActiveTab, hidden = false }) {
  const tabs = [
    ["home", "Home"],
    ["history", "History"],
    ["add", "Add"],
    ["insights", "Insights"],
    ["settings", "Settings"],
  ];
  return (
    <nav className={`bottom-nav ${hidden ? "is-suppressed" : ""}`} aria-label="Primary navigation" aria-hidden={hidden}>
      {tabs.map(([id, label]) => (
        <button key={id} className={`${activeTab === id ? "is-active" : ""} ${id === "add" ? "add-tab" : ""}`} type="button" onClick={() => setActiveTab(id)} aria-label={label}>
          <i aria-hidden="true"><Icon name={navIcon(id)} /></i>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function ProfileSheet({ open, onClose, settings, setSettings, transactions, syncStatus, onBackup, onNavigate }) {
  if (!open) return null;
  const profile = getProfile();
  const joined = "Local testing";
  const expenseCount = transactions.filter((item) => item.type === "expense").length;
  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="profile-sheet" role="dialog" aria-modal="true" aria-label="Profile menu" onClick={(event) => event.stopPropagation()}>
        <button className="sheet-grabber" type="button" onClick={onClose} aria-label="Close profile menu" />
        <div className="profile-hero">
          <ProfileAvatar profile={profile} />
          <div>
            <h2>{profile.name}</h2>
            <p>{profile.email}</p>
            <small className="status-pill online">Local app mode</small>
          </div>
        </div>
        <div className="profile-stats">
          <span>Mode <strong>{joined}</strong></span>
          <span>Expenses <strong>{expenseCount}</strong></span>
        </div>
        <div className="profile-menu">
          <button type="button" onClick={() => setSettings({ ...settings, theme: settings.theme === "dark" ? "light" : "dark" })}><span><Icon name={settings.theme === "dark" ? "eye" : "eyeOff"} /></span><div><strong>Appearance</strong><small>{settings.theme === "dark" ? "Dark theme" : "Light theme"}</small></div><Icon name="chevron" /></button>
          <button type="button" onClick={onBackup}><span><Icon name="download" /></span><div><strong>Backup data</strong><small>Export a local copy</small></div><Icon name="chevron" /></button>
          <button type="button" onClick={() => onNavigate("settings")}><span><Icon name="shield" /></span><div><strong>Security & settings</strong><small>Password, biometric and privacy</small></div><Icon name="chevron" /></button>
        </div>
        <p className="profile-footnote">Version {APP_VERSION} · {syncStatus}</p>
      </section>
    </div>
  );
}

function HelpSheet({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="profile-sheet help-sheet" role="dialog" aria-modal="true" aria-label="How to use MeroxIO" onClick={(event) => event.stopPropagation()}>
        <button className="sheet-grabber" type="button" onClick={onClose} aria-label="Close help" />
        <div className="profile-hero">
          <BrandMark small />
          <div>
            <h2>How to use MeroxIO</h2>
            <p>Track expenses fast, review details, and keep a backup file.</p>
          </div>
        </div>
        <HelpBlock icon="spark" title="Smart Add" text="Open the center + button, type naturally, then review the filled form before saving." />
        <HelpBlock icon="download" title="Backup & Restore" text="Backup downloads a JSON file. Restore imports that file and replaces the current local data after validation." />
        <HelpBlock icon="shield" title="Security" text="Use Biometric Lock and Password Lock to hide local data when the app opens or resumes." />
      </section>
    </div>
  );
}

function HelpBlock({ icon, title, text }) {
  return (
    <article className="help-block">
      <span><Icon name={icon} /></span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </article>
  );
}

function ProfileAvatar({ profile }) {
  return <div className="profile-avatar">{profile.avatar ? <img src={profile.avatar} alt="" /> : <Icon name="user" />}</div>;
}

function BrandMark({ small = false }) {
  return <img className={small ? "brand-mark small" : "brand-mark"} src="/meroxio-mark.svg" alt="MeroxIO" />;
}

function EmptyState({ text }) {
  return (
    <div className="empty-state">
      <div aria-hidden="true">{currencies.INR.symbol}</div>
      <strong>No expenses yet</strong>
      <p>{text || "Start tracking today."}</p>
    </div>
  );
}

function Toast({ message }) {
  return <div className="toast" role="status">{message}</div>;
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
  return normalizeSettings({
    currency: saved?.settings?.currency || legacy?.settings?.currency || "INR",
    theme: saved?.settings?.theme || legacy?.settings?.theme || "dark",
    biometricLock: saved?.settings?.biometricLock || false,
    passwordLock: saved?.settings?.passwordLock || false,
    passwordCredential: saved?.settings?.passwordCredential || null,
    recoveryQuestion: saved?.settings?.recoveryQuestion || "",
    recoveryCredential: saved?.settings?.recoveryCredential || null,
    onboardingCompleted: saved?.settings?.onboardingCompleted || false,
  });
}

function normalizeSettings(value = {}) {
  return {
    currency: currencies[value.currency] ? value.currency : "INR",
    theme: value.theme === "light" ? "light" : "dark",
    biometricLock: Boolean(value.biometricLock),
    passwordLock: Boolean(value.passwordLock),
    passwordCredential: value.passwordCredential || null,
    recoveryQuestion: String(value.recoveryQuestion || ""),
    recoveryCredential: value.recoveryCredential || null,
    onboardingCompleted: Boolean(value.onboardingCompleted),
  };
}

function sanitizeSettingsForStorage(settings) {
  return { ...settings };
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
    transactionKind: transactionKinds.includes(item.transactionKind) ? item.transactionKind : titleCase(item.type === "income" ? "income" : "expense"),
    person: item.person || "",
    merchant: item.merchant || "",
    source: item.source || "manual",
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
  };
}

function calculateTotals(allRows, monthRows) {
  const monthIncome = sumRows(monthRows, "income");
  const monthExpense = sumRows(monthRows, "expense");
  return {
    balance: sumRows(allRows, "income") - sumRows(allRows, "expense"),
    monthIncome,
    monthExpense,
    budgetLeft: monthIncome - monthExpense,
    weekExpense: sumRows(allRows.filter((item) => isThisWeek(item.date)), "expense"),
    todayExpense: sumRows(allRows.filter((item) => item.date === today()), "expense"),
  };
}

function sumRows(rows, type) {
  return rows.filter((item) => item.type === type).reduce((total, item) => total + Number(item.amount || 0), 0);
}

function sumAllRows(rows) {
  return rows.reduce((total, item) => total + Number(item.amount || 0), 0);
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

function isThisWeek(value) {
  const date = new Date(`${value}T00:00:00`);
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

function getWeekSpending(rows) {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return labels.map((label, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = formatDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
    return { label, amount: sumRows(rows.filter((item) => item.date === key), "expense") };
  });
}

function getMonthSpending(rows) {
  const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  return Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    const key = `${currentMonth()}-${String(day).padStart(2, "0")}`;
    return { day, amount: sumRows(rows.filter((item) => item.date === key), "expense") };
  });
}

function formatDisplayDate(value) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatRecentDateTime(item) {
  const date = new Date(item.createdAt || `${item.date}T00:00:00`);
  const time = Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return `${formatDisplayDate(item.date)}${time ? ` · ${time}` : ""}`;
}

function formatLongDate(value) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function mapCategory(category = "") {
  const lower = String(category).toLowerCase();
  if (/food|meal|tea|snack|grocery|fast/.test(lower)) return "Food";
  if (/travel|transport|bus|fuel|train|cab/.test(lower)) return "Travel";
  if (/transfer|friend|dost|mummy|mom|maa|papa|dad|bhej|diye|lent/.test(lower)) return "Transfer";
  if (/income|salary|credited|received/.test(lower)) return "Income";
  if (/rent|hostel|pg/.test(lower)) return "Rent";
  if (/bill|recharge|electric|wifi/.test(lower)) return "Bills";
  if (/health|medicine|doctor/.test(lower)) return "Health";
  if (/school|college|book|print|education/.test(lower)) return "Education";
  if (/movie|game|entertainment/.test(lower)) return "Entertainment";
  if (/shopping|amazon|flipkart|shirt|shoe/.test(lower)) return "Shopping";
  if (/debit card/.test(lower)) return "Debit Card";
  if (/credit card/.test(lower)) return "Credit Card";
  return "Other";
}

function parseQuickAddEntries(rawText) {
  return splitQuickAddEntries(rawText).map(parseQuickAddText).filter((item) => item.amount);
}

function splitQuickAddEntries(rawText) {
  const normalized = String(rawText || "").replace(/\r/g, "\n").replace(/[;|]+/g, "\n");
  const lines = normalized.split("\n").map((item) => item.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  const amountStarts = normalized.match(/(?:^|\s)(?:rs\.?|inr|rupees?|rupay|₹)?\s*(?<![/-])\d+(?:\.\d+)?\s*k?(?![/-])\s*(?:rs\.?|inr|rupees?|rupay|₹)?/gi) || [];
  if (amountStarts.length <= 1) return lines;
  return normalized
    .split(/(?=\b(?:rs\.?|inr|rupees?|rupay|₹)?\s*(?<![/-])\d+(?:\.\d+)?\s*k?(?![/-])\s*(?:rs\.?|inr|rupees?|rupay|₹)?\b)/i)
    .map((item) => item.trim().replace(/^[,.-]\s*/, ""))
    .filter(Boolean);
}

function parseQuickAddText(rawText) {
  const original = String(rawText || "").trim();
  const text = original.toLowerCase();
  const amountMatch = text.match(/(?:rs\.?|inr|rupees?|rupay|₹)\s*(\d+(?:\.\d+)?)\s*(k)?/i) || text.match(/(\d+(?:\.\d+)?)\s*(k)?\s*(?:rs\.?|inr|rupees?|rupay|₹)?/i);
  const amount = amountMatch ? String(Number(amountMatch[1]) * (amountMatch[2] ? 1000 : 1)) : "";
  const transactionInfo = detectTransactionKind(text);
  const type = transactionInfo.type;
  const paymentMode = detectPaymentMode(text);
  const category = transactionInfo.kind === "Lending" || transactionInfo.kind === "Borrowing" || transactionInfo.kind === "Repayment" || transactionInfo.kind === "Transfer" ? "Transfer" : type === "income" ? "Income" : detectCategory(text);
  const dateInfo = detectDateInfo(text);
  const person = detectPerson(original);
  const merchant = detectMerchant(text);
  const cleanNote = original.replace(amountMatch?.[0] || "", "").replace(/\s+/g, " ").trim();
  const noteParts = [cleanNote || category];
  if (person && !noteParts.join(" ").toLowerCase().includes(person.toLowerCase())) noteParts.push(`for ${person}`);
  if (merchant && !noteParts.join(" ").toLowerCase().includes(merchant.toLowerCase())) noteParts.push(merchant);
  const confidence = calculateParseConfidence({ amount, category, paymentMode, dateInfo, person, merchant, text });
  const form = { type, transactionKind: transactionInfo.kind, amount, category, paymentMode, date: dateInfo.date, note: original, person, merchant, confidence, source: "smart-add" };
  const missing = [];
  if (!amount) missing.push("amount");
  if (category === "Other" && type === "expense") missing.push("category");
  if (paymentMode === "Unknown" || paymentMode === "Other") missing.push("payment");
  form.needsReview = missing.length > 0 || dateInfo.confidence < 0.65 || transactionInfo.confidence < 0.75;
  return {
    amount,
    form,
    needsReview: form.needsReview,
    summary: `${transactionInfo.kind} ${amount ? `₹${amount}` : ""} ${category !== "Other" ? `as ${category}` : ""}${person ? ` with ${person}` : ""}`.replace(/\s+/g, " ").trim(),
  };
}

function detectTransactionKind(text) {
  if (/\b(wapas mila|wapas mile|returned to me|repayment received|refund mila)\b/i.test(text)) return { kind: "Repayment", type: "income", confidence: 0.96 };
  if (/\b(wapas diya|wapas diye|repaid|repayment paid|loan chukaya)\b/i.test(text)) return { kind: "Repayment", type: "expense", confidence: 0.96 };
  if (/\b(udhar diya|udhar diye|lend|lent|loan diya)\b/i.test(text) || /\b\w+\s+ko\s+.*\b(diya|diye|pay kiya|bheja)\b/i.test(text)) return { kind: "Lending", type: "expense", confidence: 0.94 };
  if (/\b(udhar liya|udhar liye|borrowed|loan liya)\b/i.test(text) || /\b\w+\s+se\s+.*\b(liya|liye)\b/i.test(text)) return { kind: "Borrowing", type: "income", confidence: 0.94 };
  if (/\b(transfer|bheja|bheje|sent money)\b/i.test(text)) return { kind: "Transfer", type: "expense", confidence: 0.86 };
  if (/\b(salary|received|receive|credited|income|payment received|client payment|mila|mile|aayi|aaya|aaye|deposit|milegi|milega|aayegi|aayega)\b/i.test(text) || /\b(mummy|mom|maa|papa|dad|friend|dost)\s+(ne|se)\b/i.test(text)) return { kind: "Income", type: "income", confidence: 0.9 };
  if (/\b(kharch|spent|gaya|paid|pay kiya|diya|diye|recharge|bill|emi)\b/i.test(text)) return { kind: "Expense", type: "expense", confidence: 0.9 };
  return { kind: "Expense", type: "expense", confidence: 0.62 };
}

function detectPaymentMode(text) {
  if (/\b(upi|gpay|google pay|phonepe|paytm|bhim)\b/.test(text)) return "UPI";
  if (/\b(cash|nagad|paise diye|cash diya)\b/.test(text)) return "Cash";
  if (/\b(debit card)\b/.test(text)) return "Debit Card";
  if (/\b(credit card)\b/.test(text)) return "Credit Card";
  if (/\b(card)\b/.test(text)) return "Card";
  if (/\b(bank|transfer|neft|imps|rtgs|bheje|bheja|sent)\b/.test(text)) return "Bank Transfer";
  return "Unknown";
}

function detectCategory(text) {
  if (/\b(chai|nashta|tea|coffee|swiggy|zomato|food|lunch|dinner|breakfast|snack|snacks|restaurant|momo|pizza|burger|sabzi|grocery|kirana)\b/.test(text)) return "Food";
  if (/\b(auto|rickshaw|cab|ola|uber|bus|metro|train|petrol|fuel|diesel|travel|parking)\b/.test(text)) return "Travel";
  if (/\b(friend|dost|mummy|mom|maa|papa|dad|bhai|behen|didi|ko diye|ko diya|bheje|bheja|sent|transfer|udhar|lend|lent)\b/.test(text)) return "Transfer";
  if (/\b(electricity|bijli|bill|recharge|wifi|internet|mobile|gas|water|emi)\b/.test(text)) return "Bills";
  if (/\b(rent|kiraya|room|pg|hostel)\b/.test(text)) return "Rent";
  if (/\b(medicine|doctor|hospital|health|clinic|medical)\b/.test(text)) return "Health";
  if (/\b(book|school|college|fees|course|tuition|print|education)\b/.test(text)) return "Education";
  if (/\b(movie|netflix|prime|game|entertainment|ticket|bookmyshow)\b/.test(text)) return "Entertainment";
  if (/\b(shopping|amazon|flipkart|shirt|shoe|clothes|mall|market)\b/.test(text)) return "Shopping";
  return "Other";
}

function detectMerchant(text) {
  const match = text.match(/\b(swiggy|zomato|blinkit|zepto|bigbasket|amazon|flipkart|uber|ola|metro|bookmyshow|paytm|phonepe|gpay)\b/i);
  return match ? match[1][0].toUpperCase() + match[1].slice(1).toLowerCase() : "";
}

function detectDateInfo(text) {
  const lower = String(text || "").toLowerCase();
  const explicitDate = detectExplicitDate(lower);
  if (explicitDate) return { date: explicitDate, confidence: 0.98 };
  const past = isPastPhrase(lower);
  const future = isFuturePhrase(lower);
  let offset = 0;
  let confidence = 0.56;
  if (/\b(aaj|today)\b/.test(lower)) {
    offset = 0;
    confidence = 0.96;
  } else if (/\b(day before yesterday|last night)\b/.test(lower)) {
    offset = -2;
    confidence = 0.94;
  } else if (/\b(day after tomorrow)\b/.test(lower)) {
    offset = 2;
    confidence = 0.94;
  } else if (/\b(yesterday)\b/.test(lower)) {
    offset = -1;
    confidence = 0.96;
  } else if (/\b(tomorrow)\b/.test(lower)) {
    offset = 1;
    confidence = 0.96;
  } else if (/\bparso\b/.test(lower)) {
    offset = future && !past ? 2 : -2;
    confidence = past || future ? 0.86 : 0.62;
  } else if (/\bkal\b/.test(lower)) {
    offset = future && !past ? 1 : -1;
    confidence = past || future ? 0.86 : 0.62;
  } else if (/\blast week|pichle hafte\b/.test(lower)) {
    offset = -7;
    confidence = 0.74;
  } else if (/\bis hafte|this week\b/.test(lower)) {
    offset = 0;
    confidence = 0.68;
  } else if (/\blast month|pichle mahine\b/.test(lower)) {
    offset = -30;
    confidence = 0.7;
  }
  return { date: dateWithOffset(offset), confidence };
}

function detectExplicitDate(text) {
  const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]);
    if (isValidDateParts(year, month, day)) return formatDateParts(year, month, day);
  }
  const iso = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (isValidDateParts(year, month, day)) return formatDateParts(year, month, day);
  }
  return "";
}

function isValidDateParts(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatDateParts(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isPastPhrase(text) {
  return /\b(diye the|diya tha|dala tha|kiya tha|li thi|liya tha|kharch kiya|paid|spent|received|mila|aayi|aaya|yesterday|last)\b/.test(text);
}

function isFuturePhrase(text) {
  return /\b(dena hai|milegi|milega|aayegi|aayega|lagenge|lagega|karna hai|pay karna|tomorrow|will|due)\b/.test(text);
}

function dateWithOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function calculateParseConfidence({ amount, category, paymentMode, dateInfo, person, merchant, text }) {
  let score = 0.38;
  if (amount) score += 0.22;
  if (category && category !== "Other") score += 0.16;
  if (paymentMode && paymentMode !== "Other" && paymentMode !== "Unknown") score += 0.08;
  if (dateInfo?.confidence) score += Math.min(0.1, dateInfo.confidence * 0.1);
  if (person || merchant) score += 0.04;
  if (/\b(kal|parso|aaj|today|yesterday|tomorrow|subah|shaam|raat|morning|evening)\b/.test(text)) score += 0.02;
  return Math.min(0.98, Number(score.toFixed(2)));
}

function detectPerson(original) {
  const text = original.replace(/[,.]/g, " ");
  const relation = text.match(/\b(mummy|mom|maa|papa|dad|bhai|behen|didi|friend|dost)\b/i);
  const namedFriend = text.match(/\b(?:dost|friend)\s+([a-z][a-zA-Z]+)/i);
  const beforeKo = text.match(/\b([a-z][a-zA-Z]+)\s+ko\b/i);
  const beforeSe = text.match(/\b([a-z][a-zA-Z]+)\s+se\b/i);
  if (namedFriend?.[1]) return titleCase(namedFriend[1]);
  if (beforeKo?.[1]) return titleCase(beforeKo[1]);
  if (beforeSe?.[1]) return titleCase(beforeSe[1]);
  if (relation?.[1]) return relation[1][0].toUpperCase() + relation[1].slice(1).toLowerCase();
  return "";
}

function transactionKindToType(kind, fallback = "expense") {
  if (kind === "Income" || kind === "Borrowing") return "income";
  if (kind === "Expense" || kind === "Lending" || kind === "Transfer") return "expense";
  return fallback;
}

function titleCase(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1).toLowerCase() : "Expense";
}

async function listenForExpenseSpeech() {
  const nativeSpeech = window.Capacitor?.Plugins?.SpeechInput;
  if (nativeSpeech?.listen) {
    const result = await nativeSpeech.listen({ language: "auto" });
    return result?.transcript || "";
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) throw new Error("Speech input is not available on this device");
  return new Promise((resolve, reject) => {
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => resolve(event.results?.[0]?.[0]?.transcript || "");
    recognition.onerror = () => reject(new Error("Mic permission denied or speech was unclear"));
    recognition.onend = () => {};
    recognition.start();
  });
}

function isLockEnabled(settings) {
  return Boolean(settings.biometricLock || settings.passwordLock);
}

async function requestBiometricUnlock() {
  try {
    const nativeAuth = window.Capacitor?.Plugins?.BiometricAuth;
    if (nativeAuth?.authenticate) {
      return await nativeAuth.authenticate();
    }
    if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
      return { ok: false, reason: "unsupported" };
    }
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return { ok: false, reason: available ? "not_configured" : "unsupported" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

async function createPasswordCredential(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);
  return {
    algorithm: "PBKDF2-SHA256",
    iterations: PASSWORD_ITERATIONS,
    salt: bytesToBase64(salt),
    hash: bytesToBase64(hash),
  };
}

async function saveStoredPasswordCredential(credential) {
  const store = window.Capacitor?.Plugins?.SecureCredentialStore;
  if (store?.savePasswordCredential) {
    await store.savePasswordCredential({ credential: JSON.stringify(credential) });
  }
}

async function loadStoredPasswordCredential() {
  const store = window.Capacitor?.Plugins?.SecureCredentialStore;
  if (!store?.loadPasswordCredential) return null;
  const result = await store.loadPasswordCredential();
  return readJson(result?.credential);
}

async function removeStoredPasswordCredential() {
  const store = window.Capacitor?.Plugins?.SecureCredentialStore;
  if (store?.removePasswordCredential) {
    await store.removePasswordCredential();
  }
}

async function verifyPassword(password, credential) {
  if (!password || !credential?.salt || !credential?.hash) return false;
  const salt = base64ToBytes(credential.salt);
  const hash = await hashPassword(password, salt, credential.iterations || PASSWORD_ITERATIONS);
  if (constantTimeEqual(bytesToBase64(hash), credential.hash)) return true;
  const normalized = normalizeSecret(password);
  if (!normalized || normalized === password) return false;
  const normalizedHash = await hashPassword(normalized, salt, credential.iterations || PASSWORD_ITERATIONS);
  return constantTimeEqual(bytesToBase64(normalizedHash), credential.hash);
}

function normalizeSecret(value) {
  return String(value || "").normalize("NFKC").trim();
}

async function hashPassword(password, salt, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function getProfile() {
  const name = "MeroxIO User";
  const email = "Local testing mode";
  return {
    name,
    email,
    avatar: "",
    initials: name.slice(0, 1).toUpperCase() || "M",
  };
}

function navIcon(id) {
  return { home: "home", add: "plus", history: "list", insights: "chart", settings: "settings" }[id] || "spark";
}

function Icon({ name }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2" };
  const icons = {
    home: <><path {...common} d="M3 11.5 12 4l9 7.5" /><path {...common} d="M5.5 10.5V20h13v-9.5" /><path {...common} d="M9.5 20v-6h5v6" /></>,
    plus: <><path {...common} d="M12 5v14" /><path {...common} d="M5 12h14" /></>,
    list: <><path {...common} d="M8 6h13" /><path {...common} d="M8 12h13" /><path {...common} d="M8 18h13" /><path {...common} d="M3.5 6h.01" /><path {...common} d="M3.5 12h.01" /><path {...common} d="M3.5 18h.01" /></>,
    chart: <><path {...common} d="M4 19V5" /><path {...common} d="M4 19h16" /><path {...common} d="M8 16v-5" /><path {...common} d="M12 16V8" /><path {...common} d="M16 16v-3" /></>,
    settings: <><path {...common} d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /><path {...common} d="M4 12h2" /><path {...common} d="M18 12h2" /><path {...common} d="M12 4v2" /><path {...common} d="M12 18v2" /></>,
    utensils: <><path {...common} d="M7 3v8" /><path {...common} d="M4 3v5a3 3 0 0 0 6 0V3" /><path {...common} d="M7 11v10" /><path {...common} d="M17 3v18" /><path {...common} d="M14 3h6v8h-6Z" /></>,
    bus: <><rect {...common} x="5" y="4" width="14" height="13" rx="3" /><path {...common} d="M5 10h14" /><path {...common} d="M8 20h.01" /><path {...common} d="M16 20h.01" /></>,
    bag: <><path {...common} d="M6 8h12l-1 12H7Z" /><path {...common} d="M9 8a3 3 0 0 1 6 0" /></>,
    receipt: <><path {...common} d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1Z" /><path {...common} d="M9 8h6" /><path {...common} d="M9 12h6" /><path {...common} d="M9 16h4" /></>,
    rupee: <><path {...common} d="M7 5h10" /><path {...common} d="M7 9h10" /><path {...common} d="M9 5h3.5a4 4 0 0 1 0 8H8l7 6" /></>,
    wallet: <><path {...common} d="M4 7a3 3 0 0 1 3-3h11v4" /><path {...common} d="M4 7v11a3 3 0 0 0 3 3h13V9H7a3 3 0 0 1-3-2Z" /><path {...common} d="M16 15h.01" /></>,
    health: <><path {...common} d="M12 5v14" /><path {...common} d="M5 12h14" /></>,
    book: <><path {...common} d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4-4Z" /><path {...common} d="M5 4v12" /></>,
    game: <><path {...common} d="M7 10h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.3 1.9L14.5 15h-5l-1.2 1.9A3 3 0 0 1 3 15v-1a4 4 0 0 1 4-4Z" /><path {...common} d="M8 13h3" /><path {...common} d="M9.5 11.5v3" /><path {...common} d="M16 13h.01" /></>,
    spark: <><path {...common} d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5Z" /></>,
    calendar: <><rect {...common} x="4" y="5" width="16" height="15" rx="2" /><path {...common} d="M8 3v4" /><path {...common} d="M16 3v4" /><path {...common} d="M4 10h16" /></>,
    trendingUp: <><path {...common} d="m4 16 6-6 4 4 6-7" /><path {...common} d="M15 7h5v5" /></>,
    trendingDown: <><path {...common} d="m4 8 6 6 4-4 6 7" /><path {...common} d="M15 17h5v-5" /></>,
    eye: <><path {...common} d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle {...common} cx="12" cy="12" r="3" /></>,
    eyeOff: <><path {...common} d="M3 3l18 18" /><path {...common} d="M10.6 10.6A2 2 0 0 0 13.4 13.4" /><path {...common} d="M9.5 5.5A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8" /><path {...common} d="M6.5 6.8C3.6 8.7 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.8" /></>,
    download: <><path {...common} d="M12 3v12" /><path {...common} d="m7 10 5 5 5-5" /><path {...common} d="M5 21h14" /></>,
    edit: <><path {...common} d="M12 20h9" /><path {...common} d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    cloud: <><path {...common} d="M17.5 18H8a5 5 0 1 1 1.4-9.8A6 6 0 0 1 21 11a3.5 3.5 0 0 1-3.5 7Z" /></>,
    mic: <><rect {...common} x="9" y="3" width="6" height="11" rx="3" /><path {...common} d="M5 11a7 7 0 0 0 14 0" /><path {...common} d="M12 18v3" /></>,
    shield: <><path {...common} d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6Z" /><path {...common} d="m9 12 2 2 4-5" /></>,
    lock: <><rect {...common} x="5" y="10" width="14" height="10" rx="2" /><path {...common} d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    help: <><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="M9.5 9a2.7 2.7 0 0 1 5.1 1.3c0 2-2.6 2.2-2.6 4" /><path {...common} d="M12 18h.01" /></>,
    trash: <><path {...common} d="M4 7h16" /><path {...common} d="M10 11v6" /><path {...common} d="M14 11v6" /><path {...common} d="M6 7l1 14h10l1-14" /><path {...common} d="M9 7V4h6v3" /></>,
    logout: <><path {...common} d="M10 5H5v14h5" /><path {...common} d="M14 8l4 4-4 4" /><path {...common} d="M18 12H9" /></>,
    user: <><path {...common} d="M20 21a8 8 0 0 0-16 0" /><circle {...common} cx="12" cy="8" r="4" /></>,
    card: <><rect {...common} x="3" y="5" width="18" height="14" rx="2" /><path {...common} d="M3 10h18" /><path {...common} d="M7 15h3" /></>,
    chevron: <path {...common} d="m9 18 6-6-6-6" />,
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">{icons[name] || icons.spark}</svg>;
}

function PdfPreview({ open, rows, settings, money, onClose, onDownload }) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop pdf-backdrop" role="presentation" onClick={onClose}>
      <section className="pdf-preview-sheet" role="dialog" aria-modal="true" aria-label="PDF preview" onClick={(event) => event.stopPropagation()}>
        <header><div><span>PDF PREVIEW</span><h2>Transaction report</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close preview">×</button></header>
        <div className="pdf-paper">
          <div className="pdf-brand"><BrandMark /><div><strong>MeroxIO</strong><span>Expense Manager</span></div></div>
          <div className="pdf-summary"><span>Transactions<strong>{rows.length}</strong></span><span>Income<strong>{money(sumRows(rows, "income"))}</strong></span><span>Expense<strong>{money(sumRows(rows, "expense"))}</strong></span></div>
          <div className="pdf-table">
            {rows.slice(0, 12).map((item) => <div key={item.id}><span>{formatDisplayDate(item.date)}<small>{item.category} · {item.paymentMode}</small></span><strong>{item.type === "income" ? "+" : "-"}{money(item.amount)}</strong></div>)}
            {!rows.length && <p>No transactions in this report.</p>}
            {rows.length > 12 && <p>+ {rows.length - 12} more transactions in the downloaded PDF</p>}
          </div>
        </div>
        <div className="pdf-actions"><button className="secondary-action" type="button" onClick={onClose}>Cancel</button><button className="primary-action" type="button" onClick={onDownload}><Icon name="download" /> Download PDF</button></div>
      </section>
    </div>
  );
}

async function exportTransactionsPdf(rows, settings, showToast) {
  const nativePdf = window.Capacitor?.Plugins?.PdfExport;
  if (nativePdf?.save) {
    try {
      const result = await nativePdf.save({
        fileName: `MeroxIO-Transactions-${today()}.pdf`,
        currency: settings.currency || "INR",
        rows: rows.map(({ date, type, category, paymentMode, note, amount }) => ({ date, type, category, paymentMode, note, amount })),
      });
      showToast(`PDF saved to ${result?.location || "Downloads"}`);
    } catch (error) {
      showToast(error.message || "PDF download failed");
    }
    return;
  }
  const currency = settings.currency || "INR";
  const totalIncome = sumRows(rows, "income");
  const totalExpense = sumRows(rows, "expense");
  const htmlRows = rows.map((item) => `
    <tr>
      <td>${escapeHtml(formatDisplayDate(item.date))}</td>
      <td>${escapeHtml(item.type)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.paymentMode)}</td>
      <td>${escapeHtml(item.note || "-")}</td>
      <td>${escapeHtml(formatMoney(item.amount, currency))}</td>
    </tr>
  `).join("");
  const report = `<!doctype html>
    <html>
      <head>
        <title>MeroxIO Expense Manager - Transaction History</title>
        <style>
          body { color: #0f172a; font-family: Arial, sans-serif; padding: 28px; }
          h1 { margin: 0; }
          p { color: #475569; }
          table { border-collapse: collapse; margin-top: 20px; width: 100%; }
          th, td { border-bottom: 1px solid #e2e8f0; font-size: 12px; padding: 10px; text-align: left; }
          th { background: #f8fafc; color: #0f172a; }
          .summary { display: flex; gap: 12px; margin-top: 18px; }
          .summary div { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
          @media print { button { display: none; } body { padding: 12px; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()">Save as PDF</button>
        <h1>MeroxIO Expense Manager</h1>
        <p>Transaction history exported on ${escapeHtml(new Date().toLocaleString("en-IN"))}</p>
        <div class="summary">
          <div><strong>Income</strong><br>${escapeHtml(formatMoney(totalIncome, currency))}</div>
          <div><strong>Expense</strong><br>${escapeHtml(formatMoney(totalExpense, currency))}</div>
          <div><strong>Rows</strong><br>${rows.length}</div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Payment</th><th>Note</th><th>Amount</th></tr></thead>
          <tbody>${htmlRows || `<tr><td colspan="6">No transactions found.</td></tr>`}</tbody>
        </table>
        <script>setTimeout(() => window.print(), 400);</script>
      </body>
    </html>`;
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    showToast("PDF window was blocked");
    return;
  }
  reportWindow.document.open();
  reportWindow.document.write(report);
  reportWindow.document.close();
  showToast("PDF report opened");
}

function groupTransactionsByDate(rows) {
  const groups = new Map();
  rows.forEach((item) => groups.set(item.date, [...(groups.get(item.date) || []), item]));
  return [...groups.entries()].sort(([left], [right]) => right.localeCompare(left));
}

function formatHistoryDate(date) {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function readJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
