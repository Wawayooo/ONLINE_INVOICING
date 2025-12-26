const API_BASE = "https://kt2980zx-8000.asse.devtunnels.ms";
const pathParts = window.location.pathname.split('/');
const roomHash = pathParts[2];   // /buyer_invoice_room/<room_hash>/<buyer_hash>/
const buyerHash = pathParts[3];

/* ===============================
   Notifications
   =============================== */
function showNotification(message, type = 'success') {
  const notif = document.getElementById('notification');
  notif.textContent = message;
  notif.className = `notification ${type}`;
  notif.style.display = 'block';
  setTimeout(() => notif.style.display = 'none', 3000);
}

/* ===============================
   Invoice Rendering
   =============================== */
function renderInvoiceItems(invoice) {
  const table = document.getElementById("itemsTable");
  const body = document.getElementById("itemsBody");
  const card = document.getElementById("singleItemCard");
  const grandTotalEl = document.getElementById("grandTotal");

  body.innerHTML = "";
  let grandTotal = 0;

  const isMultiItemDesc = invoice.description?.trim().toLowerCase() === 'multi-item invoice';
  const hasItemsArray = Array.isArray(invoice.items) && invoice.items.length > 0;

  if (isMultiItemDesc && hasItemsArray) {
    // Multi-item invoice
    table.style.display = "table";
    card.style.display = "none";

    invoice.items.forEach(item => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.product_name || 'Product/Service'}</td>
        <td>${item.description || '-'}</td>
        <td>${item.quantity ?? ''}</td>
        <td>₱${parseFloat(item.unit_price ?? 0).toFixed(2)}</td>
        <td>₱${parseFloat(item.line_total ?? 0).toFixed(2)}</td>
      `;
      body.appendChild(row);
      grandTotal += parseFloat(item.line_total ?? 0);
    });

  } else {
    // Single-item invoice (no items array; use flat fields)
    table.style.display = "none";
    card.style.display = "block";

    const qty = Number(invoice.quantity ?? 1);
    const unit = Number(invoice.unit_price ?? 0);
    // SingleInvoiceSerializer does NOT include line_total; use total_amount or compute
    const line = invoice.total_amount != null ? Number(invoice.total_amount) : qty * unit;

    document.getElementById("singleDescription").textContent = invoice.description || '-';
    document.getElementById("singleQuantity").textContent = qty;
    document.getElementById("singleUnitPrice").textContent = unit.toFixed(2);
    document.getElementById("singleLineTotal").textContent = line.toFixed(2);

    grandTotal = line;
  }

  if (grandTotalEl) {
    grandTotalEl.textContent = "₱" + grandTotal.toFixed(2);
  }
}

function showInvoice(invoice) {
  // Header
  const header = document.getElementById('invoiceHeader');
  header.innerHTML = `
    <p><strong>Invoice Date:</strong> ${invoice.invoice_date}</p>
    <p><strong>Due Date:</strong> ${invoice.due_date || 'N/A'}</p>
    <p><strong>Payment Method:</strong> ${invoice.payment_method}</p>
    <p><strong>Status:</strong> ${invoice.status}</p>
  `;

  // Items (handles both shapes)
  renderInvoiceItems(invoice);

  // Status
  handleInvoiceStatus(invoice);
}


/* ===============================
   Seller Rendering
   =============================== */
function renderSellerInfo(seller) {
  if (!seller) return;
  document.getElementById('sellerProfile').src = seller.profile_picture || '';
  document.getElementById('sellerName').textContent = seller.fullname;
  document.getElementById('sellerEmail').textContent = seller.email || 'N/A';
  document.getElementById('sellerPhone').textContent = seller.phone || 'N/A';
  document.getElementById('sellerSocial').textContent = seller.social_media || 'N/A';
}

/* ===============================
   Invoice Status Handling
   =============================== */
function handleInvoiceStatus(invoice) {
  const approveBtn = document.getElementById('approveBtn');
  const disapproveBtn = document.getElementById('disapproveBtn');
  const markPaidForm = document.getElementById('markPaidForm');
  const paymentField = document.getElementById('paymentMethod');
  const statusLabel = document.getElementById('invoiceActionStatus');

  // Reset
  [approveBtn, disapproveBtn, markPaidForm, statusLabel].forEach(el => el.style.display = 'none');

  switch (invoice.status) {
    case 'draft':
      approveBtn.style.display = 'inline-block';
      disapproveBtn.style.display = 'inline-block';
      break;
    case 'negotiating':
      statusLabel.textContent = 'DISAPPROVED';
      statusLabel.className = 'disapproved-label';
      statusLabel.style.display = 'block';
      break;
    case 'pending':
      statusLabel.textContent = 'APPROVED';
      statusLabel.className = 'approved-label';
      statusLabel.style.display = 'block';
      paymentField.value = invoice.payment_method;
      markPaidForm.style.display = 'block';
      break;
    case 'unconfirmed_payment':
      statusLabel.textContent = 'PAID (Awaiting Seller Confirmation)';
      statusLabel.className = 'paid-label';
      statusLabel.style.display = 'block';
      break;
  }
}

/* ===============================
   API Calls
   =============================== */
async function loadRoom() {
  try {
    const res = await fetch(`${API_BASE}/api/room/${roomHash}/`);
    if (!res.ok) throw new Error("Room not found");

    const data = await res.json();

    if (data.buyer && data.buyer.buyer_hash === buyerHash) {
      renderSellerInfo(data.seller);
      if (data.invoice) showInvoice(data.invoice);
    } else {
      document.querySelector('.unauthorized').style.display = 'block';
    }
  } catch (err) {
    console.error(err);
    alert("Failed to load room data");
  }
}

async function updateInvoiceStatus(action) {
  const endpoints = {
    approve: `${API_BASE}/api/buyer/${roomHash}/approve/`,
    disapprove: `${API_BASE}/api/buyer/${roomHash}/disapprove/`,
    'mark-paid': `${API_BASE}/api/buyer/${roomHash}/mark-paid/`
  };

  // Confirmation dialog
  let confirmMessage = '';
  if (action === 'approve') confirmMessage = "Are you sure you want to APPROVE this invoice?";
  if (action === 'disapprove') confirmMessage = "Are you sure you want to DISAPPROVE this invoice?";
  if (action === 'mark-paid') confirmMessage = "Are you sure you want to MARK this invoice as PAID?";

  const confirmed = window.confirm(confirmMessage);
  if (!confirmed) return;

  // Show loading screen
  const loadingModal = document.getElementById('loadingModal');
  if (loadingModal) loadingModal.style.display = 'flex';

  // Disable buttons while processing
  const approveBtn = document.getElementById('approveBtn');
  const disapproveBtn = document.getElementById('disapproveBtn');
  const markPaidBtn = document.getElementById('markPaidBtn');
  [approveBtn, disapproveBtn, markPaidBtn].forEach(btn => {
    if (btn) btn.disabled = true;
  });

  try {
    const response = await fetch(endpoints[action], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyer_hash: buyerHash })
    });

    const data = await response.json();

    if (response.ok) {
      showNotification(`Invoice ${action}d successfully!`, 'success');
      showInvoice(data.invoice);
    } else {
      showNotification(data.error || `Failed to ${action} invoice`, 'error');
    }
  } catch (err) {
    console.error(err);
    alert("Network error");
  } finally {
    // Hide loading screen
    if (loadingModal) loadingModal.style.display = 'none';

    // Re-enable buttons
    [approveBtn, disapproveBtn, markPaidBtn].forEach(btn => {
      if (btn) btn.disabled = false;
    });
  }
}

/* ===============================
   Event Listeners
   =============================== */
document.getElementById('approveBtn').addEventListener('click', () => updateInvoiceStatus('approve'));
document.getElementById('disapproveBtn').addEventListener('click', () => updateInvoiceStatus('disapprove'));
document.getElementById('markPaidBtn').addEventListener('click', () => updateInvoiceStatus('mark-paid'));


/* ===============================
   Initial Load
   =============================== */
loadRoom();
