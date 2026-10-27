const STORAGE_KEY = "myFinanceTransactionsV1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const today = new Date();

function localDate(date) {
    const d = new Date(date);

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const currentMonth =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

function loadTransactions() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "[]"
        );

        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

let transactions = loadTransactions();

// Receipt image variables
let selectedReceipt = null;

const receiptInput = $("#receipt-input");
const receiptPreview = $("#receipt-preview");
const receiptPreviewContainer = $("#receipt-preview-container");
const removeReceiptBtn = $("#remove-receipt-btn");

let editingId = null;
let deletingId = null;
let toastTimer;

// Preview the selected receipt image
receiptInput.addEventListener("change", (event) => {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showToast("Please select an image file.");
        receiptInput.value = "";
        return;
    }

    if (file.size > 1024 * 1024) {
        showToast("Please choose an image smaller than 1 MB.");
        receiptInput.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = () => {
        selectedReceipt = reader.result;
        receiptPreview.src = selectedReceipt;
        receiptPreviewContainer.hidden = false;
    };

    reader.readAsDataURL(file);
});

// Remove the selected receipt
removeReceiptBtn.addEventListener("click", () => {
    selectedReceipt = null;
    receiptInput.value = "";
    receiptPreview.src = "";
    receiptPreviewContainer.hidden = true;
});

function money(amount) {
    return `${Number(amount || 0).toLocaleString("en-US")} MMK`;
}

function sum(items, type) {
    return items
        .filter((item) => item.type === type)
        .reduce((total, item) => total + Number(item.amount), 0);
}

function saveTransactions() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(transactions)
        );

        return true;
    } catch (error) {
        console.error("Unable to save transactions:", error);

        showToast(
            "Storage is full. Please use a smaller receipt image."
        );

        return false;
    }
}

function showToast(message) {
    const toast = $("#toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2600);
}

function emptyState(title, message) {
    return `
    <div class="empty-state">
      <div class="empty-icon">✦</div>
      <strong>${title}</strong>
      <p>${message}</p>
    </div>
  `;
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function transactionRows(items, showActions = false) {
    if (!items.length) {
        return emptyState(
            "No transactions yet",
            "Add your first transaction to see it listed here."
        );
    }

    return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Date</th>
            <th>Category</th>
            <th>Type</th>
            <th>Amount</th>
            ${showActions ? "<th>Actions</th>" : ""}
          </tr>
        </thead>

        <tbody>
          ${items.map((item) => `
            <tr>
              <td>${escapeHTML(item.title)}</td>
              <td>${escapeHTML(item.date)}</td>
              <td>${escapeHTML(item.category)}</td>

              <td>
                <span class="type-pill ${item.type === "Expense" ? "expense" : ""}">
                  ${item.type}
                </span>
              </td>

              <td class="amount ${item.type.toLowerCase()}">
                ${item.type === "Expense" ? "−" : "+"}${money(item.amount)}
              </td>

              ${showActions ? `
                <td>
                  <div class="actions">
                    <button class="edit-btn" data-edit="${item.id}">
                      Edit
                    </button>

                    <button class="delete-btn" data-delete="${item.id}">
                      Delete
                    </button>
                  </div>
                </td>
              ` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// Dashboard totals
function renderDashboard() {
  const income = sum(transactions, "Income");
  const expenses = sum(transactions, "Expense");

  $("#total-income").textContent = money(income);
  $("#total-expenses").textContent = money(expenses);
  $("#remaining-balance").textContent = money(income - expenses);

  const recent = [...transactions]
    .sort((a, b) =>
      b.date.localeCompare(a.date) ||
      b.createdAt - a.createdAt
    )
    .slice(0, 5);

  $("#recent-transactions").innerHTML =
    transactionRows(recent);
}

// All transactions and filter
function renderTransactions() {
  const filter = $("#type-filter").value;

  const filtered = [...transactions]
    .filter((item) =>
      filter === "All" || item.type === filter
    )
    .sort((a, b) =>
      b.date.localeCompare(a.date) ||
      b.createdAt - a.createdAt
    );

  $("#all-transactions").innerHTML =
    transactionRows(filtered, true);
}


let monthlyChart = null;

// Monthly income, expenses and balance
function renderMonthlySummary() {
  const month = $("#month-picker").value || currentMonth;

  const monthItems = transactions.filter((item) =>
    item.date.startsWith(month)
  );

  const income = sum(monthItems, "Income");
  const expenses = sum(monthItems, "Expense");

  $("#month-income").textContent = money(income);
  $("#month-expenses").textContent = money(expenses);
  $("#month-balance").textContent = money(income - expenses);

  $("#monthly-note").textContent = monthItems.length
    ? `${monthItems.length} transaction${monthItems.length === 1 ? "" : "s"} recorded for ${month}.`
    : `No transactions for ${month} yet.`;

  // Update the monthly bar chart
  const canvas = $("#monthly-chart");

  if (!canvas || typeof Chart === "undefined") {
    return;
  }

  if (monthlyChart) {
    monthlyChart.destroy();
  }

  monthlyChart = new Chart(canvas, {
    type: "bar",

    data: {
      labels: ["Income", "Expenses"],

      datasets: [{
        label: "Amount (MMK)",
        data: [income, expenses],
        backgroundColor: [
          "#23866b",
          "#c74b68"
        ],
        borderRadius: 8,
        maxBarThickness: 90
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          display: false
        },

        tooltip: {
          callbacks: {
            label: function(context) {
              return context.parsed.y.toLocaleString("en-US") + " MMK";
            }
          }
        }
      },

      scales: {
        y: {
          beginAtZero: true,

          ticks: {
            callback: function(value) {
              return Number(value).toLocaleString("en-US");
            }
          }
        }
      }
    }
  });
}

function renderAll() {
  renderDashboard();
  renderTransactions();
  renderMonthlySummary();
}

// Switch between pages
function setPage(page) {
  const titles = {
    dashboard: [
      "Dashboard",
      "A simple overview of your money."
    ],
    transactions: [
      "Transactions",
      "Add and manage your income and expenses."
    ],
    summary: [
      "Monthly Summary",
      "Review your money month by month."
    ]
  };

  $$(".page").forEach((section) => {
    section.classList.toggle(
      "active",
      section.id === `${page}-page`
    );
  });

  $$(".nav-link").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  $("#page-title").textContent = titles[page][0];
  $("#page-subtitle").textContent = titles[page][1];
}

// Open Add or Edit form
function openTransactionModal(item = null) {
  editingId = item ? item.id : null;

  $("#modal-title").textContent = item
    ? "Edit Transaction"
    : "Add Transaction";

  $("#save-btn").textContent = item
    ? "Update Transaction"
    : "Save Transaction";

  $("#title-input").value = item?.title || "";
  $("#amount-input").value = item?.amount ?? "";
  $("#type-input").value = item?.type || "Expense";

  // Category is a text input, so type anything you want.
  $("#category-input").value = item?.category || "";

  $("#date-input").value =
    item?.date || localDate(new Date());

// Load receipt image when adding or editing
selectedReceipt = item?.receipt || null;

receiptInput.value = "";

if (selectedReceipt) {
    receiptPreview.src = selectedReceipt;
    receiptPreviewContainer.hidden = false;
} else {
    receiptPreview.src = "";
    receiptPreviewContainer.hidden = true;
}

  $("#form-error").textContent = "";

  $("#transaction-modal").classList.add("show");
  $("#transaction-modal").setAttribute("aria-hidden", "false");

  setTimeout(() => $("#title-input").focus(), 50);
}

function closeTransactionModal() {
    $("#transaction-modal").classList.remove("show");
    $("#transaction-modal").setAttribute("aria-hidden", "true");

    $("#transaction-form").reset();

    selectedReceipt = null;
    receiptInput.value = "";
    receiptPreview.src = "";
    receiptPreviewContainer.hidden = true;

    editingId = null;
}

// Delete confirmation popup
function openDeleteModal(id) {
  deletingId = id;

  $("#delete-modal").classList.add("show");
  $("#delete-modal").setAttribute("aria-hidden", "false");
}

function closeDeleteModal() {
  $("#delete-modal").classList.remove("show");
  $("#delete-modal").setAttribute("aria-hidden", "true");

  deletingId = null;
}

// Open Add Transaction
$("#add-transaction-btn").addEventListener("click", () => {
  openTransactionModal();
});

// Close Add/Edit form
$("#close-modal").addEventListener("click", closeTransactionModal);
$("#cancel-modal").addEventListener("click", closeTransactionModal);

// Filter transactions
$("#type-filter").addEventListener("change", renderTransactions);

// Change selected month
$("#month-picker").addEventListener("change", renderMonthlySummary);

// Cancel deletion
$("#cancel-delete").addEventListener("click", closeDeleteModal);

// Add or Update transaction
$("#transaction-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const title = $("#title-input").value.trim();
    const amount = Number($("#amount-input").value);
    const type = $("#type-input").value;
    const category = $("#category-input").value.trim();
    const date = $("#date-input").value;

    if (
        !title ||
        title.length > 70 ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !category ||
        !date
    ) {
        $("#form-error").textContent =
            "Please enter a title, a valid amount, a category, and a date.";
        return;
    }

    const existingItem = transactions.find(
        (item) => item.id === editingId
    );

    const record = {
        id: editingId ||
            `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        amount,
        type,
        category,
        date,
        receipt: selectedReceipt,
        createdAt: existingItem
            ? existingItem.createdAt
            : Date.now()
    };

    const previousTransactions = transactions;

    if (editingId) {
        transactions = transactions.map((item) =>
            item.id === editingId ? record : item
        );
    } else {
        transactions = [...transactions, record];
    }

    if (!saveTransactions()) {
        transactions = previousTransactions;
        renderAll();
        return;
    }

    renderAll();

    closeTransactionModal();

    showToast(
        editingId
            ? "Transaction updated successfully."
            : "Transaction added successfully."
    );
});

// Confirm Delete
$("#confirm-delete").addEventListener("click", () => {
  if (!deletingId) return;

  transactions = transactions.filter(
    (item) => item.id !== deletingId
  );

  saveTransactions();
  renderAll();
  closeDeleteModal();

  showToast("Transaction deleted successfully.");
});

// Navigation, Edit and Delete buttons
document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-page]");

  if (nav) {
    setPage(nav.dataset.page);
  }

  const go = event.target.closest("[data-go]");

  if (go) {
    setPage(go.dataset.go);
  }

  const edit = event.target.closest("[data-edit]");

  if (edit) {
    const item = transactions.find(
      (transaction) => transaction.id === edit.dataset.edit
    );

    if (item) {
      openTransactionModal(item);
    }
  }

  const del = event.target.closest("[data-delete]");

  if (del) {
    openDeleteModal(del.dataset.delete);
  }
});

// Close modals by clicking outside
$("#transaction-modal").addEventListener("click", (event) => {
  if (event.target === $("#transaction-modal")) {
    closeTransactionModal();
  }
});

$("#delete-modal").addEventListener("click", (event) => {
  if (event.target === $("#delete-modal")) {
    closeDeleteModal();
  }
});

// Close modals using Escape key
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeTransactionModal();
    closeDeleteModal();
  }
});

// Initialize the application
$("#month-picker").value = currentMonth;

renderAll();