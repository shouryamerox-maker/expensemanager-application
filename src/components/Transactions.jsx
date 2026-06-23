export default function Transactions() {
  return (
    <section id="transactions" className="view-section glass-card" hidden>
      <div className="section-heading">
        <div><h2>Transactions</h2><span>Search, filter, sort, edit, delete</span></div>
      </div>
      <form id="expenseForm" className="expense-form">
        <label htmlFor="expenseAmount"><span>Amount</span><input id="expenseAmount" type="number" min="1" step="0.01" placeholder="120" required /></label>
        <label htmlFor="expenseCategory"><span>Category</span><select id="expenseCategory" required /></label>
        <label htmlFor="expenseNote"><span>Note</span><input id="expenseNote" type="text" placeholder="Lunch" maxLength="60" /></label>
        <label htmlFor="paymentMethod"><span>Payment</span><select id="paymentMethod"><option>UPI</option><option>Cash</option><option>Card</option><option>Wallet</option></select></label>
        <label htmlFor="expenseDate"><span>Date</span><input id="expenseDate" type="date" required /></label>
        <label htmlFor="expenseTime"><span>Time</span><input id="expenseTime" type="time" required /></label>
        <button type="submit">Add expense</button>
      </form>
      <div className="table-toolbar">
        <input id="transactionSearch" type="search" placeholder="Search note, category, payment" />
        <select id="transactionFilter"><option value="">All categories</option></select>
        <select id="transactionSort"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="amountDesc">Amount high</option><option value="amountAsc">Amount low</option></select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Note</th><th>Payment</th><th>Actions</th></tr></thead>
          <tbody id="transactionTable" />
        </table>
      </div>
      <div className="pagination">
        <button id="prevPageBtn" className="secondary-button" type="button">Previous</button>
        <span id="pageInfo" />
        <button id="nextPageBtn" className="secondary-button" type="button">Next</button>
      </div>
    </section>
  );
}
