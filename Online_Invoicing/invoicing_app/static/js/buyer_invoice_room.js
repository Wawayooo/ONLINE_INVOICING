//const API_BASE = 'http://localhost:8000';
const API_BASE = "https://kt2980zx-8000.asse.devtunnels.ms";
const pathParts = window.location.pathname.split('/');
const roomHash = pathParts[2];   // /buyer_invoice_room/<room_hash>/<buyer_hash>/
const buyerHash = pathParts[3];

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

function renderSellerInfo(seller) {
  if (!seller) return;
  document.getElementById('sellerProfile').src = seller.profile_picture || '';
  document.getElementById('sellerName').textContent = seller.fullname;
  document.getElementById('sellerEmail').textContent = seller.email || 'N/A';
  document.getElementById('sellerPhone').textContent = seller.phone || 'N/A';
  document.getElementById('sellerSocial').textContent = seller.social_media || 'N/A';
}

function showInvoice(invoice) {
  const container = document.getElementById('invoiceDetailsContainer');
  container.innerHTML = `
    <p><strong>Description:</strong> ${invoice.description}</p>
    <p><strong>Quantity:</strong> ${invoice.quantity}</p>
    <p><strong>Unit Price:</strong> ₱${invoice.unit_price}</p>
    <p><strong>Line Total:</strong> ₱${invoice.line_total}</p>
    <p><strong>Payment Method:</strong> ${invoice.payment_method}</p>
    <p><strong>Status:</strong> ${invoice.status}</p>
  `;

  const approveBtn = document.getElementById('approveBtn');
  const disapproveBtn = document.getElementById('disapproveBtn');
  const markPaidForm = document.getElementById('markPaidForm');
  const paymentField = document.getElementById('paymentMethod');
  const statusLabel = document.getElementById('invoiceActionStatus');

  // Reset UI
  approveBtn.style.display = 'inline-block';
  disapproveBtn.style.display = 'inline-block';
  markPaidForm.style.display = 'none';
  statusLabel.style.display = 'none';

  if (invoice.status === 'draft') {
    // Show Approve/Disapprove buttons
    approveBtn.style.display = 'inline-block';
    disapproveBtn.style.display = 'inline-block';
  } else if (invoice.status === 'negotiating') {
    approveBtn.style.display = 'none';
    disapproveBtn.style.display = 'none';
    statusLabel.textContent = 'DISAPPROVED';
    statusLabel.className = 'disapproved-label';
    statusLabel.style.display = 'block';
  } else if (invoice.status === 'pending') {
    approveBtn.style.display = 'none';
    disapproveBtn.style.display = 'none';
    statusLabel.textContent = 'APPROVED';
    statusLabel.className = 'approved-label';
    statusLabel.style.display = 'block';
    // Show Mark Paid form
    paymentField.value = invoice.payment_method;
    markPaidForm.style.display = 'block';
  } else if (invoice.status === 'unconfirmed_payment') {
    approveBtn.style.display = 'none';
    disapproveBtn.style.display = 'none';
    markPaidForm.style.display = 'none';
    statusLabel.textContent = 'PAID (Awaiting Seller Confirmation)';
    statusLabel.className = 'paid-label';
    statusLabel.style.display = 'block';
  }
}

// Approve / Disapprove / Mark Paid
document.getElementById('approveBtn').addEventListener('click', () => updateInvoiceStatus('approve'));
document.getElementById('disapproveBtn').addEventListener('click', () => updateInvoiceStatus('disapprove'));
document.getElementById('markPaidBtn').addEventListener('click', () => updateInvoiceStatus('mark-paid'));

async function updateInvoiceStatus(action) {
  let endpoint = '';
  if (action === 'approve') {
    endpoint = `${API_BASE}/api/buyer/${roomHash}/approve/`;
  } else if (action === 'disapprove') {
    endpoint = `${API_BASE}/api/buyer/${roomHash}/disapprove/`;
  } else if (action === 'mark-paid') {
    endpoint = `${API_BASE}/api/buyer/${roomHash}/mark-paid/`;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyer_hash: buyerHash })
    });

    const data = await response.json();

    if (response.ok) {
      alert(`Invoice ${action}d successfully!`);
      showInvoice(data.invoice); // refresh invoice state
    } else {
      alert(data.error || `Failed to ${action} invoice`);
    }
  } catch (err) {
    console.error(err);
    alert("Network error");
  }
}

// Initial load
loadRoom();
