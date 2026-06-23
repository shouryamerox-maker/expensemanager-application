const navItems = [
  ["dashboard", "Daily record"],
  ["analytics", "Analytics"],
  ["budgets", "Budgets"],
  ["goals", "Goals"],
  ["calendar", "Calendar"],
  ["debts", "Who owes me"],
  ["fees", "College & PG fees"],
  ["reports", "Reports"],
  ["assistant", "AI Assistant"],
  ["settings", "Settings"],
];

export default function Sidebar() {
  return (
    <aside id="sidebar" className="sidebar" aria-label="Main navigation">
      <div className="brand-block">
        <div className="brand-mark">SF</div>
        <div>
          <strong>Student Finance</strong>
          <span id="userMeta">AI money dashboard</span>
        </div>
      </div>
      <nav id="mainNav" className="nav-list">
        {navItems.map(([view, label]) => (
          <a key={view} href={`#${view}`} data-view={view}>
            {label}
          </a>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button id="themeCycleBtn" className="secondary-button" type="button">Theme: Dark</button>
        <button id="lockBtn" className="danger-button" type="button">Logout</button>
      </div>
    </aside>
  );
}
