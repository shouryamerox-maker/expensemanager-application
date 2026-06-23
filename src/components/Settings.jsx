export default function Settings() {
  return (
    <section id="settings" className="view-section glass-card" hidden>
      <div className="section-heading"><h2>Settings</h2><span>Profile, theme, currency, backup</span></div>
      <form id="settingsForm" className="simple-grid">
        <label htmlFor="profileName"><span>Name</span><input id="profileName" type="text" placeholder="Your name" /></label>
        <label htmlFor="profileAge"><span>Age</span><input id="profileAge" type="number" min="10" max="99" /></label>
        <label htmlFor="profileEmail"><span>Gmail</span><input id="profileEmail" type="email" /></label>
        <label htmlFor="currencySelect"><span>Currency</span><select id="currencySelect"><option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
        <label htmlFor="themeSelect"><span>Theme</span><select id="themeSelect"><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label>
        <button type="submit">Save settings</button>
      </form>
      <div className="toolbar backup-toolbar">
        <button id="backupBtn" className="secondary-button" type="button">Download backup</button>
        <label className="file-button" htmlFor="restoreInput">Restore backup</label>
        <input id="restoreInput" className="sr-only" type="file" accept="application/json" />
      </div>
    </section>
  );
}
