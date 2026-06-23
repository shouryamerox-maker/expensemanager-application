export default function CalendarView() {
  return (
    <section id="calendar" className="view-section glass-card" hidden>
      <div className="section-heading"><h2>Calendar</h2><span>Click a day to inspect expenses</span></div>
      <div id="calendarGrid" className="calendar-grid" />
      <div id="selectedDayPanel" className="day-panel" />
    </section>
  );
}
