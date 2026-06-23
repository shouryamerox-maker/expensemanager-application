const STORAGE_KEY = "student-finance-platform-v1";
const OLD_STORAGE_KEY = "monthly-expense-manager-v2";
const SESSION_EMAIL_KEY = "monthly-expense-manager-session-email";

const baseCategories = [
  "Tea/Snacks",
  "Meals",
  "Fast food",
  "Transport",
  "Groceries",
  "Printouts",
  "Bills",
  "Rent",
  "Shopping",
  "Health",
  "Other",
];

const currencyMap = {
  INR: { symbol: "₹", locale: "en-IN" },
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "€", locale: "de-DE" },
};

const views = {
  dashboard: "Daily Record",
  analytics: "Analytics",
  budgets: "Budgets",
  goals: "Savings Goals",
  calendar: "Calendar",
  debts: "Who Owes Me",
  fees: "College & PG Fees",
  reports: "Reports",
  assistant: "AI Assistant",
  settings: "Settings",
};

let state = normalizeState(loadState());
let currentEmail = sessionStorage.getItem(SESSION_EMAIL_KEY) || "";
let currentView = "dashboard";
let currentPage = 1;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const el = {
  appShell: $("#appShell"),
  lockScreen: $("#lockScreen"),
  lockForm: $("#lockForm"),
  recoveryForm: $("#recoveryForm"),
  loginEmail: $("#loginEmailInput"),
  password: $("#passwordInput"),
  lockStatus: $("#lockStatus"),
  lockHint: $("#lockHint"),
  lockSubmit: $("#lockSubmit"),
  createAccountBtn: $("#createAccountBtn"),
  forgotBtn: $("#forgotBtn"),
  recoveryEmail: $("#recoveryEmailInput"),
  recoveryCode: $("#recoveryCodeInput"),
  newPassword: $("#newPasswordInput"),
  recoveryStatus: $("#recoveryStatus"),
  sendCodeBtn: $("#sendCodeBtn"),
  backToLoginBtn: $("#backToLoginBtn"),
  sidebar: $("#sidebar"),
  sidebarOverlay: $("#sidebarOverlay"),
  menuBtn: $("#menuBtn"),
  mainNav: $("#mainNav"),
  lockBtn: $("#lockBtn"),
  themeCycleBtn: $("#themeCycleBtn"),
  viewTitle: $("#viewTitle"),
  userMeta: $("#userMeta"),
  monthFilter: $("#monthFilter"),
  quickExpenseForm: $("#quickExpenseForm"),
  quickText: $("#quickText"),
  expenseForm: $("#expenseForm"),
  expenseAmount: $("#expenseAmount"),
  expenseCategory: $("#expenseCategory"),
  expenseNote: $("#expenseNote"),
  paymentMethod: $("#paymentMethod"),
  expenseDate: $("#expenseDate"),
  expenseTime: $("#expenseTime"),
  transactionTable: $("#transactionTable"),
  transactionSearch: $("#transactionSearch"),
  transactionFilter: $("#transactionFilter"),
  transactionSort: $("#transactionSort"),
  prevPageBtn: $("#prevPageBtn"),
  nextPageBtn: $("#nextPageBtn"),
  pageInfo: $("#pageInfo"),
  budgetForm: $("#budgetForm"),
  monthlyBudget: $("#monthlyBudget"),
  categoryBudgetName: $("#categoryBudgetName"),
  categoryBudgetAmount: $("#categoryBudgetAmount"),
  budgetList: $("#budgetList"),
  goalForm: $("#goalForm"),
  goalName: $("#goalName"),
  goalTarget: $("#goalTarget"),
  goalSaved: $("#goalSaved"),
  goalDate: $("#goalDate"),
  goalList: $("#goalList"),
  calendarGrid: $("#calendarGrid"),
  selectedDayPanel: $("#selectedDayPanel"),
  debtForm: $("#debtForm"),
  debtPerson: $("#debtPerson"),
  debtAmount: $("#debtAmount"),
  debtDue: $("#debtDue"),
  debtNote: $("#debtNote"),
  debtList: $("#debtList"),
  feeForm: $("#feeForm"),
  feeType: $("#feeType"),
  feeAmount: $("#feeAmount"),
  feeDate: $("#feeDate"),
  feeStatus: $("#feeStatus"),
  feeNote: $("#feeNote"),
  feeList: $("#feeList"),
  reportBtn: $("#reportBtn"),
  pdfReportBtn: $("#pdfReportBtn"),
  exportCsvBtn: $("#exportCsvBtn"),
  exportExcelBtn: $("#exportExcelBtn"),
  reportText: $("#reportText"),
  assistantForm: $("#assistantForm"),
  assistantInput: $("#assistantInput"),
  assistantOutput: $("#assistantOutput"),
  settingsForm: $("#settingsForm"),
  profileName: $("#profileName"),
  profileAge: $("#profileAge"),
  profileEmail: $("#profileEmail"),
  currencySelect: $("#currencySelect"),
  themeSelect: $("#themeSelect"),
  backupBtn: $("#backupBtn"),
  restoreInput: $("#restoreInput"),
  toastStack: $("#toastStack"),
};

const today = new Date();
el.monthFilter.value = toMonthInput(today);
el.expenseDate.value = toDateInput(today);
el.expenseTime.value = toTimeInput(today);
el.debtDue.value = toDateInput(today);
el.feeDate.value = toDateInput(today);
el.goalDate.value = toDateInput(new Date(today.getFullYear(), today.getMonth() + 6, today.getDate()));
buildSelectOptions();
mergeTransactionsIntoOverview();
applyTheme(state.settings.theme || "dark");
showView("dashboard");
initAuth();

el.lockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await loginAccount();
});

el.createAccountBtn.addEventListener("click", async () => {
  const email = normalizeEmail(el.loginEmail.value);
  const password = el.password.value;
  if (!email || !password || password.length < 4) {
    el.lockStatus.textContent = "Enter Gmail and a password with at least 4 characters.";
    return;
  }
  try {
    const result = await apiRequest("/api/register", { method: "POST", body: { email, password } });
    startSession(result.email, result.state);
    toast("Account created", "success");
  } catch (error) {
    el.lockStatus.textContent = error.message;
  }
});

el.forgotBtn.addEventListener("click", () => {
  el.lockForm.hidden = true;
  el.recoveryForm.hidden = false;
  el.recoveryEmail.value = el.loginEmail.value || state.profile.email || "";
  el.recoveryEmail.focus();
});

el.backToLoginBtn.addEventListener("click", () => {
  el.recoveryForm.hidden = true;
  el.lockForm.hidden = false;
  el.recoveryStatus.textContent = "";
  el.password.focus();
});

el.sendCodeBtn.addEventListener("click", requestResetCode);

el.recoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await apiRequest("/api/reset-password", {
      method: "POST",
      body: {
        email: normalizeEmail(el.recoveryEmail.value),
        code: el.recoveryCode.value.trim(),
        password: el.newPassword.value,
      },
    });
    el.recoveryStatus.textContent = "Password reset. You can login now.";
    el.recoveryForm.hidden = true;
    el.lockForm.hidden = false;
  } catch (error) {
    el.recoveryStatus.textContent = error.message;
  }
});

el.mainNav.addEventListener("click", (event) => {
  const link = event.target.closest("[data-view]");
  if (!link) return;
  event.preventDefault();
  showView(link.dataset.view);
  closeSidebar();
});

el.menuBtn.addEventListener("click", () => {
  const isOpen = el.sidebar.classList.toggle("is-open");
  el.sidebarOverlay.hidden = !isOpen;
  el.menuBtn.setAttribute("aria-expanded", String(isOpen));
});

el.sidebarOverlay.addEventListener("click", closeSidebar);
el.lockBtn.addEventListener("click", lockApp);
el.themeCycleBtn.addEventListener("click", () => {
  const next = state.settings.theme === "dark" ? "light" : state.settings.theme === "light" ? "system" : "dark";
  state.settings.theme = next;
  applyTheme(next);
  saveState();
});

el.monthFilter.addEventListener("change", () => {
  currentPage = 1;
  render();
});

el.quickExpenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const parsed = parseSmartExpense(el.quickText.value);
  if (!parsed.amount) {
    toast("Type something like: Tea 20 cash", "warning");
    return;
  }
  addExpense(parsed);
  el.quickText.value = "";
  toast(`Expense added: ${parsed.category} ${money(parsed.amount)}`, "success");
});

el.expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addExpense({
    amount: Number(el.expenseAmount.value),
    category: el.expenseCategory.value,
    note: el.expenseNote.value.trim() || el.expenseCategory.value,
    paymentMethod: el.paymentMethod.value,
    date: el.expenseDate.value,
    time: el.expenseTime.value,
  });
  el.expenseForm.reset();
  el.expenseDate.value = toDateInput(new Date());
  el.expenseTime.value = toTimeInput(new Date());
  toast("Expense added successfully", "success");
});

el.transactionSearch.addEventListener("input", () => {
  currentPage = 1;
  renderTransactions();
});
el.transactionFilter.addEventListener("change", () => {
  currentPage = 1;
  renderTransactions();
});
el.transactionSort.addEventListener("change", renderTransactions);
el.prevPageBtn.addEventListener("click", () => {
  currentPage = Math.max(1, currentPage - 1);
  renderTransactions();
});
el.nextPageBtn.addEventListener("click", () => {
  currentPage += 1;
  renderTransactions();
});
el.transactionTable.addEventListener("click", handleTransactionAction);

el.budgetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.budgets.monthly = Number(el.monthlyBudget.value || state.budgets.monthly || 0);
  if (el.categoryBudgetName.value && el.categoryBudgetAmount.value) {
    state.budgets.categories[el.categoryBudgetName.value] = Number(el.categoryBudgetAmount.value);
  }
  saveAndRender("Budget saved", "success");
});

el.goalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.goals.push({
    id: crypto.randomUUID(),
    name: el.goalName.value.trim(),
    targetAmount: Number(el.goalTarget.value),
    savedAmount: Number(el.goalSaved.value || 0),
    targetDate: el.goalDate.value,
    createdAt: new Date().toISOString(),
  });
  el.goalForm.reset();
  saveAndRender("Savings goal added", "success");
});
el.goalList.addEventListener("click", (event) => {
  const id = event.target.closest("[data-delete-goal]")?.dataset.deleteGoal;
  if (!id) return;
  state.goals = state.goals.filter((goal) => goal.id !== id);
  saveAndRender("Goal deleted", "danger");
});

el.debtForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.debts.push({
    id: crypto.randomUUID(),
    person: el.debtPerson.value.trim(),
    amount: Number(el.debtAmount.value),
    dueDate: el.debtDue.value,
    note: el.debtNote.value.trim() || "Money owed",
    status: "Pending",
    createdAt: new Date().toISOString(),
  });
  el.debtForm.reset();
  saveAndRender("Debt reminder added", "success");
});
el.debtList.addEventListener("click", (event) => {
  const paidId = event.target.closest("[data-paid-debt]")?.dataset.paidDebt;
  const deleteId = event.target.closest("[data-delete-debt]")?.dataset.deleteDebt;
  if (paidId) {
    state.debts = state.debts.map((debt) => (debt.id === paidId ? { ...debt, status: debt.status === "Paid" ? "Pending" : "Paid" } : debt));
    saveAndRender("Debt status updated", "success");
  }
  if (deleteId) {
    state.debts = state.debts.filter((debt) => debt.id !== deleteId);
    saveAndRender("Debt deleted", "danger");
  }
});

el.feeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.feeEntries.push({
    id: crypto.randomUUID(),
    type: el.feeType.value,
    amount: Number(el.feeAmount.value),
    date: el.feeDate.value,
    status: el.feeStatus.value,
    note: el.feeNote.value.trim() || el.feeType.value,
    createdAt: new Date().toISOString(),
  });
  el.feeForm.reset();
  el.feeDate.value = toDateInput(new Date());
  saveAndRender("Fee record added", "success");
});

el.feeList.addEventListener("click", (event) => {
  const paidId = event.target.closest("[data-paid-fee]")?.dataset.paidFee;
  const deleteId = event.target.closest("[data-delete-fee]")?.dataset.deleteFee;
  if (paidId) {
    state.feeEntries = state.feeEntries.map((fee) => (fee.id === paidId ? { ...fee, status: fee.status === "Paid" ? "Pending" : "Paid" } : fee));
    saveAndRender("Fee status updated", "success");
  }
  if (deleteId) {
    state.feeEntries = state.feeEntries.filter((fee) => fee.id !== deleteId);
    saveAndRender("Fee record deleted", "danger");
  }
});

el.reportBtn.addEventListener("click", () => {
  el.reportText.value = buildReport();
  toast("Report generated", "success");
});
el.pdfReportBtn.addEventListener("click", printReport);
el.exportCsvBtn.addEventListener("click", () => exportRows("csv"));
el.exportExcelBtn.addEventListener("click", () => exportRows("xls"));

el.assistantForm.addEventListener("submit", (event) => {
  event.preventDefault();
  el.assistantOutput.innerHTML = answerAssistant(el.assistantInput.value);
});

el.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.profile = {
    name: el.profileName.value.trim(),
    age: el.profileAge.value,
    email: el.profileEmail.value.trim() || currentEmail,
  };
  state.settings.currency = el.currencySelect.value;
  state.settings.theme = el.themeSelect.value;
  applyTheme(state.settings.theme);
  saveAndRender("Settings saved", "success");
});
el.backupBtn.addEventListener("click", downloadBackup);
el.restoreInput.addEventListener("change", restoreBackup);

window.addEventListener("resize", renderCharts);

function showView(view) {
  currentView = view;
  $$(".view-section").forEach((section) => {
    section.hidden = section.id !== view;
  });
  $$("#mainNav a").forEach((link) => link.classList.toggle("is-active", link.dataset.view === view));
  el.viewTitle.textContent = views[view] || "Daily Record";
  if (view === "reports" && !el.reportText.value) el.reportText.value = buildReport();
  render();
}

function closeSidebar() {
  el.sidebar.classList.remove("is-open");
  el.sidebarOverlay.hidden = true;
  el.menuBtn.setAttribute("aria-expanded", "false");
}

function mergeTransactionsIntoOverview() {
  const transactions = $("#transactions");
  const dashboard = $("#dashboard");
  const quickCommand = $(".quick-command");
  if (!transactions || !dashboard) return;
  transactions.hidden = false;
  transactions.classList.remove("view-section");
  transactions.classList.add("dashboard-transactions");
  if (quickCommand) {
    quickCommand.insertAdjacentElement("afterend", transactions);
    return;
  }
  dashboard.prepend(transactions);
}

function render() {
  normalizeStateInPlace();
  renderMeta();
  renderKpis();
  renderCharts();
  renderInsights();
  renderAchievements();
  renderTransactions();
  renderBudgets();
  renderGoals();
  renderDebts();
  renderFees();
  renderCalendar();
  renderSettings();
  checkBudgetWarning();
}

function renderMeta() {
  const name = state.profile.name || "Student";
  el.userMeta.textContent = `${name} · ${state.settings.currency}`;
}

function renderKpis() {
  const monthly = monthExpenses();
  const previous = previousMonthExpenses();
  const totalSpent = sum(monthly);
  const prevSpent = sum(previous);
  const budget = Number(state.budgets.monthly || 0);
  const todaySpent = sum(state.expenses.filter((expense) => expense.date === toDateInput(new Date())));
  const remaining = budget - totalSpent;
  const savings = Math.max(0, remaining);
  const change = percentChange(totalSpent, prevSpent);
  const dailyTotals = dailyTotalsForMonth(el.monthFilter.value);

  const cards = [
    ["spent", "Total Spent", money(totalSpent), "↘", `${change}% vs last month`, change <= 0, dailyTotals],
    ["budget", "Monthly Budget", money(budget), "◎", "Editable in Budgets", true, [budget * 0.2, budget * 0.5, budget * 0.8, budget]],
    ["remaining", "Remaining Budget", money(remaining), "◌", `${Math.max(0, Math.round((remaining / Math.max(budget, 1)) * 100))}% left`, remaining >= 0, dailyTotals.map((x) => budget - x)],
    ["today", "Today's Spending", money(todaySpent), "◍", "Live daily total", todaySpent <= budget / 30, [0, todaySpent / 2, todaySpent]],
    ["savings", "Savings This Month", money(savings), "◆", "Budget minus spend", savings > 0, [0, savings * 0.3, savings * 0.7, savings]],
    ["transactions", "Total Transactions", String(monthly.length), "▣", `${state.expenses.length} all-time`, true, dailyTotals.map((x, i) => (x ? i + 1 : 0))],
  ];

  cards.forEach(([key, title, value, icon, trend, good, spark]) => {
    const card = document.querySelector(`[data-kpi="${key}"]`);
    card.innerHTML = `
      <div class="kpi-top">
        <span class="kpi-icon">${icon}</span>
        <span class="trend ${good ? "good" : "warn"}">${escapeHtml(trend)}</span>
      </div>
      <small>${escapeHtml(title)}</small>
      <strong>${escapeHtml(value)}</strong>
      ${sparkline(spark)}
    `;
  });
}

function renderCharts() {
  if (currentView !== "analytics") return;
  drawLineChart($("#lineChart"), dailyTotalsForMonth(el.monthFilter.value));
  drawBarChart($("#barChart"), weeklyTotals());
  drawDonutChart($("#donutChart"), categoryTotals());
  drawGauge($("#gaugeChart"), budgetUsage());
  drawIncomeExpense($("#incomeExpenseChart"));
  renderHeatmap();
}

function renderInsights() {
  const insights = computeInsights();
  $("#insightList").innerHTML = insights.map((item) => `<div class="insight-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p></div>`).join("");
}

function renderAchievements() {
  const achievements = computeAchievements();
  $("#achievementList").innerHTML = achievements.map((item) => `<div class="achievement-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p></div>`).join("");
}

function renderTransactions() {
  const rows = filteredExpenses();
  const pageSize = 8;
  const maxPage = Math.max(1, Math.ceil(rows.length / pageSize));
  currentPage = Math.min(currentPage, maxPage);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  el.transactionTable.innerHTML = pageRows
    .map(
      (expense) => `
        <tr>
          <td>${formatDate(expense.date)}<br><small>${formatTime(expense.time)}</small></td>
          <td>${escapeHtml(expense.category)}</td>
          <td>${money(expense.amount)}</td>
          <td>${escapeHtml(expense.note)}</td>
          <td>${escapeHtml(expense.paymentMethod || "Cash")}</td>
          <td>
            <button class="secondary-button" type="button" data-edit-expense="${expense.id}">Edit</button>
            <button class="danger-button" type="button" data-delete-expense="${expense.id}">Delete</button>
          </td>
        </tr>
      `
    )
    .join("");
  el.pageInfo.textContent = `Page ${currentPage} of ${maxPage} · ${rows.length} rows`;
  el.prevPageBtn.disabled = currentPage <= 1;
  el.nextPageBtn.disabled = currentPage >= maxPage;
}

function renderBudgets() {
  el.monthlyBudget.value = state.budgets.monthly || 0;
  const monthlySpend = sum(monthExpenses());
  const monthlyPercent = percent(monthlySpend, state.budgets.monthly);
  const categoryCards = baseCategories
    .filter((category) => state.budgets.categories[category])
    .map((category) => {
      const spent = sum(monthExpenses().filter((expense) => expense.category === category));
      const budget = state.budgets.categories[category];
      return progressCard(category, `${money(spent)} of ${money(budget)}`, percent(spent, budget));
    });
  el.budgetList.innerHTML = [
    progressCard("Monthly budget", `${money(monthlySpend)} of ${money(state.budgets.monthly || 0)}`, monthlyPercent),
    ...categoryCards,
  ].join("");
}

function renderGoals() {
  if (!state.goals.length) {
    el.goalList.innerHTML = `<div class="record-card">No savings goals yet. Add one like New Laptop ${money(60000)}.</div>`;
    return;
  }
  el.goalList.innerHTML = state.goals
    .map((goal) => {
      const done = percent(goal.savedAmount, goal.targetAmount);
      return `
        <div class="progress-card">
          <strong>${escapeHtml(goal.name)}</strong>
          <p>${money(goal.savedAmount)} saved · ${money(goal.targetAmount - goal.savedAmount)} remaining · ${goal.targetDate || "No date"}</p>
          <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(done, 100)}%"></div></div>
          <button class="danger-button" type="button" data-delete-goal="${goal.id}">Delete</button>
        </div>
      `;
    })
    .join("");
}

function renderDebts() {
  if (!state.debts.length) {
    el.debtList.innerHTML = `<div class="record-card">No pending debt records.</div>`;
    return;
  }
  el.debtList.innerHTML = state.debts
    .map((debt) => {
      const dueSoon = debt.status !== "Paid" && debt.dueDate && daysBetween(new Date(), new Date(`${debt.dueDate}T00:00:00`)) <= 1;
      return `
        <div class="record-card">
          <strong>${escapeHtml(debt.person)} · ${money(debt.amount)}</strong>
          <p>${escapeHtml(debt.note)} · Due: ${debt.dueDate ? formatDate(debt.dueDate) : "No due date"} · ${escapeHtml(debt.status)}${dueSoon ? " · Reminder due soon" : ""}</p>
          <button class="secondary-button" type="button" data-paid-debt="${debt.id}">${debt.status === "Paid" ? "Mark pending" : "Mark paid"}</button>
          <button class="danger-button" type="button" data-delete-debt="${debt.id}">Delete</button>
        </div>
      `;
    })
    .join("");
}

function renderFees() {
  const sorted = [...state.feeEntries].sort((a, b) => Number(a.status === "Paid") - Number(b.status === "Paid") || b.date.localeCompare(a.date));
  const collegeTotal = sum(sorted.filter((fee) => fee.type === "College fees"));
  const hostelTotal = sum(sorted.filter((fee) => fee.type === "PG/Hostel fees" || fee.type === "Hostel/PG fees"));

  if (!sorted.length) {
    el.feeList.innerHTML = `<div class="record-card">No college or PG/Hostel fee records yet.</div>`;
    return;
  }

  el.feeList.innerHTML = `
    <div class="record-card">
      <strong>Fee summary</strong>
      <p>College: ${money(collegeTotal)} · PG/Hostel: ${money(hostelTotal)}</p>
    </div>
    ${sorted
      .map(
        (fee) => `
          <div class="record-card">
            <strong>${escapeHtml(fee.type)} · ${money(fee.amount)}</strong>
            <p>${escapeHtml(fee.note)} · ${formatDate(fee.date)} · ${escapeHtml(fee.status || "Pending")}</p>
            <button class="secondary-button" type="button" data-paid-fee="${fee.id}">${fee.status === "Paid" ? "Mark pending" : "Mark paid"}</button>
            <button class="danger-button" type="button" data-delete-fee="${fee.id}">Delete</button>
          </div>
        `
      )
      .join("")}
  `;
}

function renderCalendar() {
  const [year, month] = el.monthFilter.value.split("-").map(Number);
  const days = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const cells = Array.from({ length: firstDay }, () => `<div></div>`);
  for (let day = 1; day <= days; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const total = sum(state.expenses.filter((expense) => expense.date === date));
    cells.push(`<button class="calendar-day" type="button" data-calendar-date="${date}"><strong>${day}</strong><br><small>${total ? money(total) : ""}</small></button>`);
  }
  el.calendarGrid.innerHTML = cells.join("");
  el.calendarGrid.querySelectorAll("[data-calendar-date]").forEach((button) => {
    button.addEventListener("click", () => showDay(button.dataset.calendarDate));
  });
}

function showDay(date) {
  const rows = state.expenses.filter((expense) => expense.date === date);
  el.selectedDayPanel.innerHTML = `
    <div class="record-card">
      <strong>${formatDate(date)} · ${money(sum(rows))}</strong>
      ${rows.map((expense) => `<p>${formatTime(expense.time)} · ${escapeHtml(expense.category)} · ${escapeHtml(expense.note)} · ${money(expense.amount)}</p>`).join("") || "<p>No expenses for this day.</p>"}
    </div>
  `;
}

function renderSettings() {
  el.profileName.value = state.profile.name || "";
  el.profileAge.value = state.profile.age || "";
  el.profileEmail.value = state.profile.email || currentEmail || "";
  el.currencySelect.value = state.settings.currency || "INR";
  el.themeSelect.value = state.settings.theme || "dark";
}

function renderHeatmap() {
  const totals = dailyTotalsForMonth(el.monthFilter.value);
  const max = Math.max(...totals, 1);
  $("#heatmap").innerHTML = totals
    .map((amount, index) => {
      const level = amount / max;
      return `<div class="heat-cell" style="--level:${level.toFixed(2)}" title="Day ${index + 1}: ${money(amount)}">${index + 1}<br><small>${amount ? money(amount) : ""}</small></div>`;
    })
    .join("");
}

function handleTransactionAction(event) {
  const deleteButton = event.target.closest("[data-delete-expense]");
  const editButton = event.target.closest("[data-edit-expense]");
  if (deleteButton) {
    state.expenses = state.expenses.filter((expense) => expense.id !== deleteButton.dataset.deleteExpense);
    saveAndRender("Transaction deleted", "danger");
    return;
  }
  if (editButton) {
    const expense = state.expenses.find((item) => item.id === editButton.dataset.editExpense);
    const nextAmount = Number(prompt("Amount", expense.amount));
    const nextNote = prompt("Note", expense.note);
    if (nextAmount > 0) {
      expense.amount = nextAmount;
      expense.note = nextNote || expense.note;
      saveAndRender("Transaction updated", "success");
    }
  }
}

function addExpense(data) {
  if (!data.amount || data.amount <= 0) return;
  state.expenses.push({
    id: crypto.randomUUID(),
    amount: Number(data.amount),
    category: data.category || "Other",
    note: data.note || data.category || "Expense",
    paymentMethod: data.paymentMethod || "Cash",
    date: data.date || toDateInput(new Date()),
    time: data.time || toTimeInput(new Date()),
    createdAt: new Date().toISOString(),
  });
  currentPage = 1;
  saveState();
  render();
}

function parseSmartExpense(text) {
  const amountMatch = String(text).match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
  const amount = amountMatch ? Number(amountMatch[1]) : 0;
  const lower = String(text).toLowerCase();
  const paymentMethod = lower.includes("upi") ? "UPI" : lower.includes("card") ? "Card" : lower.includes("wallet") ? "Wallet" : "Cash";
  return {
    amount,
    category: categorizeText(lower),
    paymentMethod,
    note: text.replace(amountMatch?.[0] || "", "").replace(/\b(upi|cash|card|wallet)\b/gi, "").trim() || categorizeText(lower),
  };
}

function categorizeText(text) {
  const rules = [
    ["Tea/Snacks", /tea|coffee|snack|samosa|chai/],
    ["Fast food", /burger|pizza|momo|roll|fast|zomato|swiggy/],
    ["Meals", /lunch|dinner|breakfast|meal|mess/],
    ["Transport", /bus|metro|auto|cab|uber|ola|train|fuel/],
    ["Groceries", /grocery|milk|bread|fruit|vegetable/],
    ["Printouts", /print|xerox|copy|notes/],
    ["Bills", /bill|recharge|electricity|wifi|internet/],
    ["Rent", /rent|hostel|pg/],
    ["Shopping", /shirt|shoe|shopping|amazon|flipkart/],
    ["Health", /medicine|doctor|health|clinic/],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || "Other";
}

function filteredExpenses() {
  const q = el.transactionSearch.value.toLowerCase();
  const category = el.transactionFilter.value;
  const sorted = [...monthExpenses()]
    .filter((expense) => !category || expense.category === category)
    .filter((expense) => [expense.note, expense.category, expense.paymentMethod].join(" ").toLowerCase().includes(q));
  const sort = el.transactionSort.value;
  sorted.sort((a, b) => {
    if (sort === "oldest") return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
    if (sort === "amountDesc") return b.amount - a.amount;
    if (sort === "amountAsc") return a.amount - b.amount;
    return `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`);
  });
  return sorted;
}

function computeInsights() {
  const monthly = monthExpenses();
  const predicted = predictMonthSpend();
  const fastFood = sum(monthly.filter((expense) => expense.category === "Fast food"));
  const transport = sum(monthly.filter((expense) => expense.category === "Transport"));
  const budget = Number(state.budgets.monthly || 0);
  return [
    { title: "End-of-month prediction", body: `At your current pace, you may spend ${money(predicted)} this month.` },
    { title: "Budget recommendation", body: `Suggested budget: ${money(Math.ceil(Math.max(predicted, budget || predicted) / 500) * 500)}.` },
    { title: "Fast food watch", body: fastFood ? `Fast food is at ${money(fastFood)}. Reducing by ${money(Math.min(300, fastFood * 0.2))} can improve savings.` : "Fast food spending is clean this month." },
    { title: "Transport check", body: transport ? `Transport expenses are ${money(transport)}, compare this with your commute average.` : "Transport expenses are below average or empty." },
  ];
}

function computeAchievements() {
  const total = state.expenses.length;
  const saved = Math.max(0, (state.budgets.monthly || 0) - sum(monthExpenses()));
  return [
    { title: total >= 100 ? "First 100 Entries unlocked" : "First 100 Entries", body: `${Math.min(total, 100)}/100 entries tracked.` },
    { title: saved >= 1000 ? "Saved ₹1000 unlocked" : "Save ₹1000", body: `${money(saved)} saved against budget this month.` },
    { title: sum(monthExpenses()) <= (state.budgets.monthly || 0) ? "Stayed under budget" : "Budget challenge", body: sum(monthExpenses()) <= (state.budgets.monthly || 0) ? "You are currently under budget." : "Try reducing non-essential spending." },
    { title: "Tracking streak", body: `${trackingStreak()} day tracking streak.` },
  ];
}

function answerAssistant(question) {
  const q = String(question).toLowerCase();
  const insights = computeInsights();
  if (q.includes("save") || q.includes("reduce")) {
    const top = categoryTotals()[0];
    return `<strong>Best saving move:</strong><p>Reduce ${escapeHtml(top?.category || "non-essential")} spending by 15-20%. That could save around ${money((top?.amount || 0) * 0.2)}.</p>`;
  }
  if (q.includes("predict") || q.includes("month")) {
    return `<strong>Prediction:</strong><p>Your projected end-of-month spend is ${money(predictMonthSpend())}.</p>`;
  }
  return insights.map((item) => `<p><strong>${escapeHtml(item.title)}:</strong> ${escapeHtml(item.body)}</p>`).join("");
}

function buildReport() {
  const totals = categoryTotals();
  const monthlyFees = state.feeEntries.filter((fee) => fee.date?.startsWith(el.monthFilter.value));
  return [
    `Student Finance Report - ${formatMonthLabel(el.monthFilter.value)}`,
    "",
    `Total spent: ${money(sum(monthExpenses()))}`,
    `Monthly budget: ${money(state.budgets.monthly || 0)}`,
    `Predicted end-of-month spend: ${money(predictMonthSpend())}`,
    `Transactions: ${monthExpenses().length}`,
    "",
    "Category details:",
    totals.length ? totals.map((item) => `- ${item.category}: ${money(item.amount)}`).join("\n") : "- No expenses",
    "",
    "College and PG/Hostel fees:",
    monthlyFees.length ? monthlyFees.map((fee) => `- ${fee.type}: ${money(fee.amount)} | ${fee.status || "Pending"} | ${fee.note}`).join("\n") : "- No fee records",
    "",
    "Smart insights:",
    computeInsights().map((item) => `- ${item.title}: ${item.body}`).join("\n"),
  ].join("\n");
}

function printReport() {
  el.reportText.value = el.reportText.value || buildReport();
  const win = window.open("", "_blank");
  if (!win) return toast("Allow popups to print reports", "warning");
  win.document.write(`<pre style="font:14px/1.6 Inter,Arial;padding:28px;white-space:pre-wrap">${escapeHtml(el.reportText.value)}</pre>`);
  win.document.close();
  win.print();
}

function exportRows(type) {
  const rows = [["Date", "Time", "Category", "Amount", "Note", "Payment Method"], ...monthExpenses().map((e) => [e.date, e.time, e.category, e.amount, e.note, e.paymentMethod || "Cash"])];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  downloadFile(`student-finance-${el.monthFilter.value}.${type}`, csv, type === "xls" ? "application/vnd.ms-excel" : "text/csv");
}

function downloadBackup() {
  downloadFile("student-finance-backup.json", JSON.stringify(state, null, 2), "application/json");
}

function restoreBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = normalizeState(JSON.parse(reader.result));
      saveAndRender("Backup restored", "success");
    } catch {
      toast("Backup file is invalid", "danger");
    }
  };
  reader.readAsText(file);
}

function saveAndRender(message, type) {
  saveState();
  render();
  toast(message, type);
}

function checkBudgetWarning() {
  const budget = Number(state.budgets.monthly || 0);
  if (budget && sum(monthExpenses()) > budget) toast("Monthly budget exceeded", "warning", true);
  state.debts.forEach((debt) => {
    if (debt.status !== "Paid" && debt.dueDate && daysBetween(new Date(), new Date(`${debt.dueDate}T00:00:00`)) === 1) {
      toast(`Reminder: ${debt.person} payment due tomorrow`, "warning", true);
    }
  });
}

const shownToasts = new Set();
function toast(message, type = "success", once = false) {
  if (once && shownToasts.has(message)) return;
  shownToasts.add(message);
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  el.toastStack.appendChild(node);
  window.setTimeout(() => node.remove(), 3200);
}

function buildSelectOptions() {
  const options = baseCategories.map((category) => `<option>${category}</option>`).join("");
  el.expenseCategory.innerHTML = options;
  el.transactionFilter.innerHTML = `<option value="">All categories</option>${options}`;
  el.categoryBudgetName.innerHTML = options;
}

function applyTheme(theme) {
  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  document.body.dataset.theme = resolved || "dark";
  el.themeCycleBtn.textContent = `Theme: ${capitalize(theme || "dark")}`;
}

function normalizeStateInPlace() {
  state = normalizeState(state);
}

function normalizeState(raw) {
  const clean = raw && typeof raw === "object" ? raw : {};
  const oldDebts = Array.isArray(clean.owedEntries)
    ? clean.owedEntries.map((entry) => ({
        id: entry.id || crypto.randomUUID(),
        person: entry.name || "Friend",
        amount: Number(entry.amount || 0),
        dueDate: entry.date || "",
        note: entry.note || "Money owed",
        status: entry.paid ? "Paid" : "Pending",
        createdAt: entry.createdAt || new Date().toISOString(),
      }))
    : [];
  return {
    walletEntries: Array.isArray(clean.walletEntries) ? clean.walletEntries : [],
    expenses: Array.isArray(clean.expenses) ? clean.expenses.map(normalizeExpense) : [],
    feeEntries: Array.isArray(clean.feeEntries) ? clean.feeEntries.map(normalizeFee) : [],
    owedEntries: Array.isArray(clean.owedEntries) ? clean.owedEntries : [],
    budgets: {
      monthly: Number(clean.budgets?.monthly || 5000),
      categories: clean.budgets?.categories && typeof clean.budgets.categories === "object" ? clean.budgets.categories : {},
    },
    goals: Array.isArray(clean.goals) ? clean.goals : [],
    debts: Array.isArray(clean.debts) && clean.debts.length ? clean.debts : oldDebts,
    reports: Array.isArray(clean.reports) ? clean.reports : [],
    settings: {
      currency: clean.settings?.currency || "INR",
      theme: clean.settings?.theme || "dark",
    },
    achievements: Array.isArray(clean.achievements) ? clean.achievements : [],
    profile: clean.profile && typeof clean.profile === "object" ? clean.profile : {},
  };
}

function normalizeExpense(expense) {
  return {
    id: expense.id || crypto.randomUUID(),
    amount: Number(expense.amount || 0),
    category: expense.category || categorizeText(`${expense.note || ""}`),
    note: expense.note || expense.category || "Expense",
    paymentMethod: expense.paymentMethod || expense.payment_method || "Cash",
    date: expense.date || toDateInput(new Date()),
    time: expense.time || timeFromCreatedAt(expense.createdAt),
    createdAt: expense.createdAt || new Date().toISOString(),
  };
}

function normalizeFee(fee) {
  return {
    id: fee.id || crypto.randomUUID(),
    type: fee.type === "Hostel/PG fees" ? "PG/Hostel fees" : fee.type || "College fees",
    amount: Number(fee.amount || 0),
    date: fee.date || toDateInput(new Date()),
    status: fee.status || "Pending",
    note: fee.note || fee.type || "Fee record",
    createdAt: fee.createdAt || new Date().toISOString(),
  };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
  if (!saved) return emptyState("");
  try {
    return JSON.parse(saved);
  } catch {
    return emptyState("");
  }
}

function emptyState(email) {
  return {
    walletEntries: [],
    expenses: [],
    feeEntries: [],
    owedEntries: [],
    budgets: { monthly: 5000, categories: {} },
    goals: [],
    debts: [],
    reports: [],
    settings: { currency: "INR", theme: "dark" },
    achievements: [],
    profile: { email },
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  syncStateToServer();
}

async function loginAccount() {
  const email = normalizeEmail(el.loginEmail.value);
  const password = el.password.value;
  if (!email || !password) {
    el.lockStatus.textContent = "Enter Gmail and password.";
    return;
  }
  try {
    const result = await apiRequest("/api/login", { method: "POST", body: { email, password } });
    startSession(result.email, result.state);
  } catch (error) {
    el.lockStatus.textContent = error.message;
    el.password.select();
  }
}

async function requestResetCode() {
  const email = normalizeEmail(el.recoveryEmail.value);
  if (!email) {
    el.recoveryStatus.textContent = "Enter your registered Gmail.";
    return;
  }
  try {
    const result = await apiRequest("/api/request-reset", { method: "POST", body: { email } });
    el.recoveryStatus.textContent = `Reset code sent to ${result.email}.`;
  } catch (error) {
    el.recoveryStatus.textContent = error.message;
  }
}

function startSession(email, serverState) {
  currentEmail = email;
  sessionStorage.setItem(SESSION_EMAIL_KEY, email);
  state = normalizeState(serverState || emptyState(email));
  state.profile.email = state.profile.email || email;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  el.loginEmail.value = email;
  unlockApp();
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload;
}

let syncTimer = 0;
function syncStateToServer() {
  if (!currentEmail) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    apiRequest("/api/state", { method: "PUT", body: { email: currentEmail, state } }).catch((error) => toast(`Saved locally. Server sync failed: ${error.message}`, "warning", true));
  }, 250);
}

function unlockApp() {
  el.password.value = "";
  el.lockScreen.hidden = true;
  el.appShell.hidden = false;
  render();
  el.quickText.focus();
}

function lockApp() {
  el.appShell.hidden = true;
  el.lockScreen.hidden = false;
  sessionStorage.removeItem(SESSION_EMAIL_KEY);
  currentEmail = "";
  el.password.value = "";
  el.password.focus();
}

function initAuth() {
  el.appShell.hidden = true;
  el.lockScreen.hidden = false;
  el.recoveryForm.hidden = true;
  el.lockForm.hidden = false;
  if (currentEmail) el.loginEmail.value = currentEmail;
  el.password.focus();
}

function monthExpenses(month = el.monthFilter.value) {
  return state.expenses.filter((expense) => expense.date.startsWith(month));
}

function previousMonthExpenses() {
  const date = new Date(`${el.monthFilter.value}-01T00:00:00`);
  date.setMonth(date.getMonth() - 1);
  return monthExpenses(toMonthInput(date));
}

function dailyTotalsForMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: days }, (_, index) => {
    const date = `${year}-${String(monthNumber).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
    return sum(state.expenses.filter((expense) => expense.date === date));
  });
}

function weeklyTotals() {
  const totals = [0, 0, 0, 0, 0];
  monthExpenses().forEach((expense) => {
    const day = Number(expense.date.slice(-2));
    totals[Math.min(4, Math.floor((day - 1) / 7))] += expense.amount;
  });
  return totals;
}

function categoryTotals() {
  return baseCategories
    .map((category) => ({ category, amount: sum(monthExpenses().filter((expense) => expense.category === category)) }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

function budgetUsage() {
  return percent(sum(monthExpenses()), state.budgets.monthly || 1);
}

function predictMonthSpend() {
  const date = new Date();
  const selected = el.monthFilter.value;
  const [year, month] = selected.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = selected === toMonthInput(date) ? date.getDate() : daysInMonth;
  return (sum(monthExpenses()) / Math.max(day, 1)) * daysInMonth;
}

function trackingStreak() {
  let streak = 0;
  const dates = new Set(state.expenses.map((expense) => expense.date));
  const cursor = new Date();
  while (dates.has(toDateInput(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function drawLineChart(canvas, values) {
  const ctx = setupCanvas(canvas);
  const w = canvas.width;
  const h = canvas.height;
  const max = Math.max(...values, 1);
  ctx.strokeStyle = "#22C55E";
  ctx.lineWidth = 4;
  ctx.beginPath();
  values.forEach((value, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * (w - 24) + 12;
    const y = h - 18 - (value / max) * (h - 38);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawBarChart(canvas, values) {
  const ctx = setupCanvas(canvas);
  const w = canvas.width;
  const h = canvas.height;
  const max = Math.max(...values, 1);
  const gap = 12;
  const barW = (w - gap * (values.length + 1)) / values.length;
  values.forEach((value, i) => {
    const barH = (value / max) * (h - 36);
    ctx.fillStyle = i % 2 ? "#14B8A6" : "#22C55E";
    ctx.fillRect(gap + i * (barW + gap), h - barH - 18, barW, barH);
  });
}

function drawDonutChart(canvas, values) {
  const ctx = setupCanvas(canvas);
  const total = sum(values);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) - 18;
  let start = -Math.PI / 2;
  const colors = ["#22C55E", "#14B8A6", "#F59E0B", "#EF4444", "#8B5CF6", "#38BDF8"];
  values.forEach((item, index) => {
    const angle = (item.amount / Math.max(total, 1)) * Math.PI * 2;
    ctx.beginPath();
    ctx.strokeStyle = colors[index % colors.length];
    ctx.lineWidth = 24;
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.stroke();
    start += angle;
  });
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--text");
  ctx.font = "700 16px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText(money(total), cx, cy + 5);
}

function drawGauge(canvas, value) {
  const ctx = setupCanvas(canvas);
  const cx = canvas.width / 2;
  const cy = canvas.height * 0.75;
  const radius = Math.min(canvas.width / 2 - 22, canvas.height - 32);
  ctx.lineWidth = 18;
  ctx.strokeStyle = "rgba(148,163,184,.2)";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, 0);
  ctx.stroke();
  ctx.strokeStyle = value > 100 ? "#EF4444" : value > 80 ? "#F59E0B" : "#22C55E";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, Math.PI + Math.min(value, 100) / 100 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--text");
  ctx.font = "800 22px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(value)}%`, cx, cy - 18);
}

function drawIncomeExpense(canvas) {
  const income = sum(state.walletEntries.filter((entry) => entry.date?.startsWith(el.monthFilter.value)));
  const expense = sum(monthExpenses());
  drawBarChart(canvas, [income, expense]);
}

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(240, Math.floor(rect.width));
  canvas.height = Math.max(120, Math.floor(rect.height || Number(canvas.getAttribute("height"))));
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

function sparkline(values) {
  const max = Math.max(...values.map((x) => Math.abs(x)), 1);
  const points = values.map((value, i) => `${(i / Math.max(values.length - 1, 1)) * 100},${32 - (value / max) * 28}`).join(" ");
  return `<svg class="sparkline" viewBox="0 0 100 34" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="#22C55E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function progressCard(title, body, value) {
  return `<div class="progress-card"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)} · ${Math.round(value)}%</p><div class="progress-bar"><div class="progress-fill" style="width:${Math.min(value, 100)}%"></div></div></div>`;
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.amount || item.savedAmount || 0), 0);
}

function percent(value, total) {
  return total ? (Number(value) / Number(total)) * 100 : 0;
}

function percentChange(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function money(value) {
  const config = currencyMap[state.settings.currency || "INR"] || currencyMap.INR;
  return `${config.symbol}${Number(value || 0).toLocaleString(config.locale, { maximumFractionDigits: 2 })}`;
}

function formatDate(dateText) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${dateText}T00:00:00`));
}

function formatTime(timeText) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(`2026-01-01T${normalizeTime(timeText)}`));
}

function formatMonthLabel(monthText) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(`${monthText}-01T00:00:00`));
}

function toDateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toMonthInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toTimeInput(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function timeFromCreatedAt(createdAt) {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? "12:00" : toTimeInput(date);
}

function normalizeTime(timeText) {
  return timeText || "12:00";
}

function daysBetween(a, b) {
  return Math.ceil((b - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
