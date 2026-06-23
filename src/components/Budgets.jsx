export default function Budgets() {
  return (
    <section id="budgets" className="view-section glass-card" hidden>
      <div className="section-heading"><h2>Budget management</h2><span>Monthly and category limits</span></div>
      <form id="budgetForm" className="simple-grid">
        <label htmlFor="monthlyBudget"><span>Monthly budget</span><input id="monthlyBudget" type="number" min="0" step="100" /></label>
        <label htmlFor="categoryBudgetName"><span>Category</span><select id="categoryBudgetName" /></label>
        <label htmlFor="categoryBudgetAmount"><span>Category budget</span><input id="categoryBudgetAmount" type="number" min="0" step="50" /></label>
        <button type="submit">Save budget</button>
      </form>
      <div id="budgetList" className="progress-list" />
    </section>
  );
}
