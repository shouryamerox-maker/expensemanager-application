export default function Dashboard() {
  return (
    <section id="dashboard" className="view-section">
      <form id="quickExpenseForm" className="quick-command glass-card">
        <label htmlFor="quickText">
          <span>AI quick add</span>
          <input id="quickText" type="text" placeholder="Tea 20 cash, Bus 30, Fast food 180 UPI" autoComplete="off" />
        </label>
        <button type="submit">Smart add</button>
      </form>

      <section className="kpi-grid" aria-label="Finance KPIs">
        {["spent", "budget", "remaining", "today", "savings", "transactions"].map((kpi) => (
          <article key={kpi} className="kpi-card glass-card" data-kpi={kpi} />
        ))}
      </section>
    </section>
  );
}
