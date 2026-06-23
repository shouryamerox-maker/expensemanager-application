export default function Debts() {
  return (
    <section id="debts" className="view-section glass-card" hidden>
      <div className="section-heading"><h2>Who owes me</h2><span>Debt and reminder tracking</span></div>
      <form id="debtForm" className="simple-grid">
        <label htmlFor="debtPerson"><span>Person</span><input id="debtPerson" type="text" required /></label>
        <label htmlFor="debtAmount"><span>Amount</span><input id="debtAmount" type="number" min="1" required /></label>
        <label htmlFor="debtDue"><span>Due date</span><input id="debtDue" type="date" /></label>
        <label htmlFor="debtNote"><span>Note</span><input id="debtNote" type="text" placeholder="Lunch split" /></label>
        <button type="submit">Add debt</button>
      </form>
      <div id="debtList" className="record-list" />
    </section>
  );
}
