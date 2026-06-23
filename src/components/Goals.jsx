export default function Goals() {
  return (
    <section id="goals" className="view-section glass-card" hidden>
      <div className="section-heading"><h2>Savings goals</h2><span>Target based progress</span></div>
      <form id="goalForm" className="simple-grid">
        <label htmlFor="goalName"><span>Goal</span><input id="goalName" type="text" placeholder="New laptop" required /></label>
        <label htmlFor="goalTarget"><span>Target amount</span><input id="goalTarget" type="number" min="1" step="100" required /></label>
        <label htmlFor="goalSaved"><span>Saved now</span><input id="goalSaved" type="number" min="0" step="100" /></label>
        <label htmlFor="goalDate"><span>Target date</span><input id="goalDate" type="date" /></label>
        <button type="submit">Add goal</button>
      </form>
      <div id="goalList" className="progress-list" />
    </section>
  );
}
