//const API_BASE = 'https://kt2980zx-8000.asse.devtunnels.ms';
const API_BASE = "https://nontaxinvoiceproof.pythonanywhere.com";

const pathParts = window.location.pathname.split('/').filter(Boolean);
const roomHash = pathParts[1];

document.getElementById('roomHash').textContent = roomHash;
const shareableInput = document.getElementById('shareableLink');

const buyerHash = localStorage.getItem('buyer_hash');

document.getElementById('confirmPaymentBtn').addEventListener('click', async () => {
  try {
    const apiUrl = `${window.location.origin}/api/seller/${roomHash}/confirm-payment/`;

    const res = await fetch(apiUrl, { method: 'POST' });
    const result = await res.json();

    if (res.ok && result.invoice_status === 'finalized') {
      alert("Payment confirmed! Invoice finalized.");

      loadRoom();

      const proofUrl = result.redirect_url?.startsWith('http')
        ? result.redirect_url
        : `${window.location.origin}${result.redirect_url}`;

      window.location.href = proofUrl;

    } else {
      alert(result.error || "Failed to confirm payment.");
    }
  } catch (err) {
    console.error(err);
    alert("Network error.");
  }
});


if (buyerHash) {
  shareableInput.value = `${window.location.origin}/buyer_invoice_room/${roomHash}/${buyerHash}/`;
} else {
  shareableInput.value = `${window.location.origin}/buyer_room/${roomHash}/`;
}

document.getElementById('copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareableInput.value);
    alert("Link copied to clipboard!");
  } catch (err) {
    console.error("Clipboard copy failed", err);
    alert("Failed to copy link. Please copy manually.");
  }
});

function toggleSellerFormEditable(invoiceStatus) {
  const notice = document.getElementById('formLockNotice');
  const updateBtn = document.getElementById('updateInvoiceBtn');
  const approvedLabel = document.getElementById('invoiceApprovedLabel');

  if (invoiceStatus === 'pending') {
    if (updateBtn) updateBtn.style.display = 'none';
    if (notice) notice.style.display = 'none';
    if (approvedLabel) approvedLabel.style.display = 'block';
    return;
  }

  const editable = invoiceStatus === 'negotiating';

  if (notice) notice.style.display = editable ? 'none' : 'block';
  if (updateBtn) updateBtn.style.display = editable ? 'block' : 'none';
  if (approvedLabel) approvedLabel.style.display = 'none';

  const lockForm = (form, editable) => {
    form.querySelectorAll('input, textarea, select, button').forEach(el => {
      if (el.tagName === 'BUTTON') {
        el.disabled = !editable;
      } else if (editable) {
        el.removeAttribute('readonly');
        el.removeAttribute('disabled');
      } else {
        if (el.tagName === 'SELECT' || el.type === 'file') {
          el.disabled = true;
        } else {
          el.setAttribute('readonly', true);
        }
      }
    });
  };

  const sellerForm = document.getElementById('sellerForm');
  const invoiceForm = document.getElementById('invoiceForm');
  if (sellerForm) lockForm(sellerForm, editable);
  if (invoiceForm) lockForm(invoiceForm, editable);
}

document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await submitInvoiceForm(e.target);
});

document.getElementById('sellerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await submitInvoiceForm(e.target);
});

async function submitInvoiceForm(formElement) {
  const formData = new FormData(formElement);

  try {
    const response = await fetch(`${API_BASE}/api/seller/${roomHash}/edit-invoice/`, {
      method: 'PUT',
      body: formData
    });


    const data = await response.json();

    if (response.ok) {
      alert("Invoice updated successfully!");
      calculateTotal();
      if (data.invoice) toggleSellerFormEditable(data.invoice.status);
    } else {
      console.error(data);
      alert(data.error || "Failed to update invoice");
    }
  } catch (err) {
    console.error(err);
    alert("Network error while updating invoice");
  }
}

async function loadRoomData() {
  try {
    const response = await fetch(`${API_BASE}/api/room/${roomHash}/`);
    if (!response.ok) throw new Error("Room not found");

    const data = await response.json();

    if (data.seller) {
      document.getElementById('sellerFullname').value = data.seller.fullname || '';
      document.getElementById('sellerEmail').value = data.seller.email || '';
      document.getElementById('sellerPhone').value = data.seller.phone || '';
      document.getElementById('sellerSocial').value = data.seller.social_media || '';

      if (data.seller.profile_picture) {
        const preview = document.getElementById('sellerPreview');
        if (preview) {
          const pic = data.seller.profile_picture;
          preview.src = pic.startsWith('http') ? pic : `${API_BASE}${pic}`;
          preview.classList.add('active');
        }
      }
    }

    if (data.invoice) {
      document.getElementById('invoiceDate').value = data.invoice.invoice_date.slice(0,10);
      document.getElementById('dueDate').value = data.invoice.due_date ? data.invoice.due_date.slice(0,10) : '';
      document.getElementById('description').value = data.invoice.description || '';
      document.getElementById('quantity').value = data.invoice.quantity || 0;
      document.getElementById('unitPrice').value = data.invoice.unit_price || 0;
      document.getElementById('paymentMethod').value = data.invoice.payment_method || '';

      calculateTotal();
      showInvoice(data.invoice);
      toggleSellerFormEditable(data.invoice.status);
    }
  } catch (err) {
    console.error(err);
    alert(err.message === "Room not found" ? "Room not found" : "Failed to load room data");
  }
}

function showInvoice(invoice) {
  const container = document.getElementById('invoiceDetailsContainer');
  if (container) {
    container.innerHTML = `
      <p><strong>Invoice Date:</strong> ${invoice.invoice_date}</p>
      <p><strong>Due Date:</strong> ${invoice.due_date || 'N/A'}</p>
      <p><strong>Description:</strong> ${invoice.description}</p>
      <p><strong>Quantity:</strong> ${invoice.quantity}</p>
      <p><strong>Unit Price:</strong> ₱${invoice.unit_price}</p>
      <p><strong>Line Total:</strong> ₱${invoice.total_amount || invoice.line_total}</p>
      <p><strong>Payment Method:</strong> ${invoice.payment_method}</p>
      <p><strong>Status:</strong> ${invoice.status}</p>
    `;
  }

  if (invoice.status === 'draft') {
  } else if (invoice.status === 'negotiating') {
  } else if (invoice.status === 'pending') {
  } else if (invoice.status === 'unconfirmed_payment') {
  } else if (invoice.status === 'finalized') {
    window.location.href = `/proof_transaction/${roomHash}/`;
  }
}


function calculateTotal() {
  const qty = parseFloat(document.getElementById('quantity').value) || 0;
  const price = parseFloat(document.getElementById('unitPrice').value) || 0;
  document.getElementById('lineTotal').textContent = '₱' + (qty * price).toFixed(2);
}

document.getElementById('quantity').addEventListener('input', calculateTotal);
document.getElementById('unitPrice').addEventListener('input', calculateTotal);

loadRoomData();