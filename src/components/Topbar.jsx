export default function Topbar() {
  return (
    <header className="topbar">
      <button id="menuBtn" className="menu-button" type="button" aria-expanded="false" aria-controls="sidebar">
        <span className="menu-icon" aria-hidden="true"><span /><span /><span /></span>
        <span>Menu</span>
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
