export default function Fees() {
  return (
    <section id="fees" className="view-section glass-card" hidden>
      <div className="section-heading"><h2>College and PG/Hostel fees</h2><span>Managed separately from daily expenses</span></div>
      <form id="feeForm" className="simple-grid">
        <label htmlFor="feeType"><span>Fee type</span><select id="feeType"><option>College fees</option><option>PG/Hostel fees</option></select></label>
        <label htmlFor="feeAmount"><span>Amount</span><input id="feeAmount" type="number" min="1" required /></label>
        <label htmlFor="feeDate"><span>Date</span><input id="feeDate" type="date" required /></label>
        <label htmlFor="feeStatus"><span>Status</span><select id="feeStatus"><option>Pending</option><option>Paid</option></select></label>
        <label htmlFor="feeNote"><span>Note</span><input id="feeNote" type="text" placeholder="Semester fee, room rent, deposit" /></label>
        <button type="submit">Add fee record</button>
      </form>
      <div id="feeList" className="record-list" />
    </section>
  );
}
