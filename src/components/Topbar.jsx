export default function Topbar() {
  return (
    <header className="topbar">
      <button id="menuBtn" className="menu-button" type="button" aria-expanded="false" aria-controls="sidebar">
        Menu
      </button>
      <div>
        <p className="eyebrow">Commercial-grade student fintech</p>
        <h1 id="viewTitle">Daily record</h1>
      </div>
      <label className="month-picker" htmlFor="monthFilter">
        <span>Month</span>
        <input id="monthFilter" type="month" />
      </label>
    </header>
  );
}
