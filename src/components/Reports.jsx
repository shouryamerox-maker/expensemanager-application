export default function Reports() {
  return (
    <section id="reports" className="view-section glass-card" hidden>
      <div className="section-heading">
        <div><h2>Reports and exports</h2><span>PDF, CSV, Excel-compatible export, print</span></div>
        <div className="toolbar">
          <button id="reportBtn" className="secondary-button" type="button">Generate</button>
          <button id="pdfReportBtn" className="secondary-button" type="button">PDF / Print</button>
          <button id="exportCsvBtn" className="secondary-button" type="button">CSV</button>
          <button id="exportExcelBtn" className="secondary-button" type="button">Excel</button>
        </div>
      </div>
      <textarea id="reportText" className="report-text" readOnly />
    </section>
  );
}
