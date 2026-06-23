import { useEffect } from "react";
import AuthScreens from "./components/AuthScreens.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Analytics from "./components/Analytics.jsx";
import Transactions from "./components/Transactions.jsx";
import Budgets from "./components/Budgets.jsx";
import Goals from "./components/Goals.jsx";
import CalendarView from "./components/CalendarView.jsx";
import Debts from "./components/Debts.jsx";
import Fees from "./components/Fees.jsx";
import Reports from "./components/Reports.jsx";
import Assistant from "./components/Assistant.jsx";
import Settings from "./components/Settings.jsx";

export default function App() {
  useEffect(() => {
    import("./legacyApp.js");
  }, []);

  return (
    <>
      <AuthScreens />
      <a className="skip-link" href="#quickText">
        Skip to quick expense
      </a>
      <main id="appShell" className="app-shell" hidden>
        <Sidebar />
        <div id="sidebarOverlay" className="sidebar-overlay" hidden />
        <section className="workspace">
          <Topbar />
          <Dashboard />
          <Analytics />
          <Transactions />
          <Budgets />
          <Goals />
          <CalendarView />
          <Debts />
          <Fees />
          <Reports />
          <Assistant />
          <Settings />
        </section>
      </main>
      <div id="toastStack" className="toast-stack" aria-live="polite" />
    </>
  );
}
