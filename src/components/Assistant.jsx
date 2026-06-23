export default function Assistant() {
  return (
    <section id="assistant" className="view-section" hidden>
      <article className="glass-card">
        <div className="section-heading"><h2>AI Finance Assistant</h2><span>Prediction, categorization, recommendations</span></div>
        <form id="assistantForm" className="assistant-box">
          <input id="assistantInput" type="text" placeholder="Ask: how can I save money this month?" />
          <button type="submit">Ask AI</button>
        </form>
        <div id="assistantOutput" className="assistant-output" />
      </article>

      <section className="insight-grid assistant-insights">
        <article className="glass-card">
          <div className="section-heading"><h2>Smart insights</h2><span>AI rules engine</span></div>
          <div id="insightList" className="insight-list" />
        </article>
        <article className="glass-card">
          <div className="section-heading"><h2>Achievements</h2><span>Tracking streaks</span></div>
          <div id="achievementList" className="achievement-list" />
        </article>
      </section>
    </section>
  );
}
