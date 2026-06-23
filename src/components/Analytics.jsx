const charts = [
  ["lineChart", "Monthly spending", "Daily trend"],
  ["barChart", "Weekly expenses", "Bar view"],
  ["donutChart", "Categories", "Donut chart"],
  ["gaugeChart", "Budget utilization", "Gauge"],
  ["incomeExpenseChart", "Income vs expense", "Wallet flow"],
];

export default function Analytics() {
  return (
    <section id="analytics" className="view-section" hidden>
      <section className="analytics-grid">
        {charts.slice(0, 4).map(([id, title, subtitle]) => (
          <article key={id} className="glass-card chart-card">
            <div className="section-heading"><h2>{title}</h2><span>{subtitle}</span></div>
            <canvas id={id} height="190" />
          </article>
        ))}
        <article className="glass-card chart-card wide-card">
          <div className="section-heading"><h2>Spending heatmap</h2><span>Calendar intensity</span></div>
          <div id="heatmap" className="heatmap" aria-label="Spending heatmap" />
        </article>
        <article className="glass-card chart-card">
          <div className="section-heading"><h2>{charts[4][1]}</h2><span>{charts[4][2]}</span></div>
          <canvas id={charts[4][0]} height="190" />
        </article>
      </section>
    </section>
  );
}
