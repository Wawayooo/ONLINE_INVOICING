//const API_BASE = 'http://localhost:8000';
const API_BASE = "https://kt2980zx-8000.asse.devtunnels.ms";

// Extract roomHash from URL path: /seller_room/<room_hash>/
const pathParts = window.location.pathname.split('/').filter(Boolean);
const roomHash = pathParts[1];  // this is the room hash

// Display room hash and shareable link
document.getElementById('roomHash').textContent = roomHash;
const shareableInput = document.getElementById('shareableLink');

// Confirm Payment
document.getElementById('confirmPaymentBtn').addEventListener('click', async () => {
  // Extra confirmation layer
  const confirmed = window.confirm("Are you sure you want to confirm this payment?");
  if (!confirmed) return; // stop if user cancels

  const loadingModal = document.getElementById('loadingModal');
  const confirmBtn = document.getElementById('confirmPaymentBtn');

  // Show loading modal + disable button
  if (loadingModal) loadingModal.style.display = 'flex';
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const apiUrl = `${API_BASE}/api/seller/${roomHash}/confirm-payment/`;
    const res = await fetch(apiUrl, { method: 'POST' });
    const result = await res.json();

    if (res.ok && result.invoice_status === 'finalized') {
      alert("Payment confirmed! Invoice finalized.");
      await loadRoomData();

      // Redirect to proof of transaction
      const proofUrl = result.redirect_url?.startsWith('http')
        ? result.redirect_url
        : `${window.location.origin}${result.redirect_url}`;
      window.location.href = proofUrl;
    } else {
      alert(result.error || "Failed to confirm payment.");
    }
  } catch (err) {
    console.error(err);
    alert("Network error while confirming payment.");
  } finally {
    // Hide loading modal + re-enable button
    if (loadingModal) loadingModal.style.display = 'none';
    if (confirmBtn) confirmBtn.disabled = false;
  }
});

// Generate correct shareable link (seller only shares room link, not buyer hash)
shareableInput.value = `${window.location.origin}/buyer_room/${roomHash}/`;

// Clipboard copy
document.getElementById('copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareableInput.value);
    alert("Link copied to clipboard!");
  } catch (err) {
    console.error("Clipboard copy failed", err);
    alert("Failed to copy link. Please copy manually.");
  }
});

/**
 * Toggle seller/invoice form editability based on invoice status
 */
// Attach handler once at startup

async function submitInvoiceForm(formElement) {
  const confirmed = window.confirm("Are you sure you want to update this invoice?");
  if (!confirmed) return;

  const items = collectItems();

  if (items.length === 0) {
    alert("Please add at least one valid item with product name, quantity, and unit price.");
    return;
  }

  const updateBtn = document.getElementById('updateInvoiceBtn');
  const loadingModal = document.getElementById('loadingModal');

  // Show loading + disable button before request
  if (loadingModal) loadingModal.style.display = 'flex';
  if (updateBtn) updateBtn.disabled = true;

  // Decide endpoint + payload
  let url, payload;
  if (items.length > 1) {
    // Multi-item invoice
    url = `${API_BASE}/api/seller/${roomHash}/edit-invoice/`;
    payload = {
      invoice_date: document.getElementById('invoiceDate').value,
      due_date: document.getElementById('dueDate').value,
      payment_method: document.getElementById('paymentMethod').value,
      items: items
    };
  } else {
    // Single-item invoice
    const item = items[0];
    url = `${API_BASE}/api/seller/${roomHash}/edit-single-invoice/`;
    payload = {
      invoice_date: document.getElementById('invoiceDate').value,
      due_date: document.getElementById('dueDate').value,
      payment_method: document.getElementById('paymentMethod').value,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price
    };
  }

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (response.ok) {
      alert("Invoice updated successfully!");
      if (data.invoice) toggleSellerFormEditable(data.invoice.status);
      await loadRoomData();
    } else {
      console.error(data);
      alert(data.error || "Failed to update invoice");
    }
  } catch (err) {
    console.error(err);
    alert("Network error while updating invoice");
  } finally {
    if (loadingModal) loadingModal.style.display = 'none';
    if (updateBtn) updateBtn.disabled = false;
  }
}

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

  // 🚨 Show modal notification if status is negotiating
  if (invoiceStatus === 'negotiating') {
    showNegotiationModal();
  }
}

// Helper function to show modal
function showNegotiationModal() {
  const modal = document.getElementById('negotiationModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}


function closeNegotiationModal() {
  const modal = document.getElementById('negotiationModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Collect items from form fields
 */
function collectItems() {
  const items = [];
  document.querySelectorAll('#itemsContainer .item-block').forEach(block => {
    const product = block.querySelector('[name="product_name[]"]').value.trim();
    const description = block.querySelector('[name="description[]"]').value.trim();
    const quantity = parseFloat(block.querySelector('[name="quantity[]"]').value) || 0;
    const unit_price = parseFloat(block.querySelector('[name="unit_price[]"]').value) || 0;
    
    // Only add items with valid data
    if (product && quantity > 0 && unit_price > 0) {
      items.push({
        product_name: product,
        description: description,
        quantity: quantity,
        unit_price: unit_price
      });
    }
  });
  return items;
}

/**
 * Submit invoice form with items
 */


/**
 * Handle form submissions
 */
document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await submitInvoiceForm(e.target);
});

document.getElementById('sellerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await submitInvoiceForm(e.target);
});

/**
 * Recalculate totals for all items
 */
function recalcTotals() {
  let grandTotal = 0;
  document.querySelectorAll('#itemsContainer .item-block').forEach(block => {
    const qty = parseFloat(block.querySelector('[name="quantity[]"]').value) || 0;
    const price = parseFloat(block.querySelector('[name="unit_price[]"]').value) || 0;
    const lineTotal = qty * price;
    block.querySelector('.line-total').textContent = '₱' + lineTotal.toFixed(2);
    grandTotal += lineTotal;
  });
  document.getElementById('grandTotal').textContent = '₱' + grandTotal.toFixed(2);
}

/**
 * Create a new item block
 */
function createItemBlock(itemData = null) {
  const block = document.createElement("div");
  block.classList.add("item-block");
  
  const productValue = itemData?.product_name || '';
  const descriptionValue = itemData?.description || '';
  const quantityValue = itemData?.quantity || 1;
  const unitPriceValue = itemData?.unit_price || 0;
  
  // Calculate line total and ensure it's a number
  let lineTotal = 0;
  if (itemData?.line_total !== undefined && itemData?.line_total !== null) {
    lineTotal = parseFloat(itemData.line_total);
  } else {
    lineTotal = quantityValue * unitPriceValue;
  }
  
  // Ensure lineTotal is a valid number
  if (isNaN(lineTotal)) {
    lineTotal = 0;
  }
  
  block.innerHTML = `
    <div class="form-group">
      <label>Product</label>
      <input type="text" name="product_name[]" value="${productValue}" required>
    </div>
    <div class="form-group">
      <label>Description</label>
      <input type="text" name="description[]" value="${descriptionValue}">
    </div>
    <div class="form-group inline">
      <div>
        <label>Quantity</label>
        <input type="number" name="quantity[]" value="${quantityValue}" min="1" step="1" required>
      </div>
      <div>
        <label>Unit Price</label>
        <input type="number" name="unit_price[]" value="${unitPriceValue}" step="0.01" min="0" required>
      </div>
    </div>
    <div class="form-group">
      <label>Line Total</label>
      <div class="line-total">₱${lineTotal.toFixed(2)}</div>
    </div>
    <button type="button" class="btn btn-remove-item">✖ Remove</button>
  `;
  
  return block;
}

/**
 * Add item button handler
 */
document.getElementById('addItemBtn').addEventListener('click', () => {
  const itemsContainer = document.getElementById('itemsContainer');
  const newBlock = createItemBlock();
  itemsContainer.appendChild(newBlock);
  recalcTotals();
});

/**
 * Delegate remove buttons and input changes
 */
const itemsContainer = document.getElementById('itemsContainer');

itemsContainer.addEventListener('click', e => {
  if (e.target.classList.contains('btn-remove-item')) {
    const itemBlocks = document.querySelectorAll('#itemsContainer .item-block');
    
    // Prevent removing the last item
    if (itemBlocks.length <= 1) {
      alert("You must have at least one item in the invoice.");
      return;
    }
    
    e.target.closest('.item-block').remove();
    recalcTotals();
  }
});

itemsContainer.addEventListener('input', e => {
  if (e.target.matches('[name="quantity[]"], [name="unit_price[]"]')) {
    recalcTotals();
  }
});

/**
 * Fetch room data and populate forms
 */
async function loadRoomData() {
  try {
    const response = await fetch(`${API_BASE}/api/room/${roomHash}/`);
    if (!response.ok) throw new Error("Room not found");

    const data = await response.json();
    console.log("Room data loaded:", data);

    // Redirect if invoice finalized
    if (data.invoice?.status === 'finalized') {
      const modal = document.getElementById('loadingModal');
      if (modal) modal.style.display = 'flex';
      setTimeout(() => {
        window.location.href = `${API_BASE}/proof_transaction/${roomHash}/`;
      }, 2000);
      return;
    }

    populateSellerFields(data.seller);
    if (data.invoice) populateInvoiceFields(data);

  } catch (err) {
    console.error("Load room data error:", err);
    alert(err.message === "Room not found" ? "Room not found" : "Failed to load room data");
  }
}

function populateSellerFields(seller) {
  if (!seller) return;
  document.getElementById('sellerFullname').value = seller.fullname || '';
  document.getElementById('sellerEmail').value = seller.email || '';
  document.getElementById('sellerPhone').value = seller.phone || '';
  document.getElementById('sellerSocial').value = seller.social_media || '';

  if (seller.profile_picture) {
    const preview = document.getElementById('sellerPreview');
    if (preview) {
      const pic = seller.profile_picture;
      preview.src = pic.startsWith('http') ? pic : `${API_BASE}${pic}`;
      preview.classList.add('active');
    }
  }
}

function populateInvoiceFields(data) {
  const invoice = data.invoice;
  document.getElementById('invoiceDate').value = invoice.invoice_date || '';
  document.getElementById('dueDate').value = invoice.due_date || '';
  document.getElementById('paymentMethod').value = invoice.payment_method || '';

  const itemsContainer = document.getElementById("itemsContainer");
  itemsContainer.innerHTML = "";
  let grandTotal = 0;

  // Decide invoice type based on description
  const isMultiItem = invoice.description?.trim().toLowerCase() === 'multi-item invoice';
  const isSingleItem = !isMultiItem && invoice.description;

  if (isMultiItem) {
    console.log("Loading multi-item invoice with", invoice.items.length, "items");
    invoice.items.forEach((item, index) => {
      console.log(`Item ${index + 1}:`, item);
      const block = createItemBlock(item);
      itemsContainer.appendChild(block);
      grandTotal += parseFloat(item.line_total || 0);
    });
    toggleInvoiceDivs('multi');
  } else if (isSingleItem) {
    console.log("Loading single-item invoice");
    const singleItem = {
      product_name: 'Product/Service',
      description: invoice.description || '',
      quantity: invoice.quantity || 1,
      unit_price: parseFloat(invoice.unit_price || 0),
      line_total: parseFloat(invoice.line_total || 0)
    };
    const block = createItemBlock(singleItem);
    itemsContainer.appendChild(block);
    grandTotal = singleItem.line_total;

    hideSingleItemButtons(block);
    toggleInvoiceDivs('single');
  } else {
    console.log("No items found, creating empty block");
    const emptyBlock = createItemBlock();
    itemsContainer.appendChild(emptyBlock);
  }

  document.getElementById("grandTotal").textContent = "₱" + grandTotal.toFixed(2);
  setTimeout(() => recalcTotals(), 100);

  if (invoice.status) toggleSellerFormEditable(invoice.status);
  if (invoice.status === 'unconfirmed_payment' && data.buyer) showBuyerPaidInfo(data.buyer);
}

function hideSingleItemButtons(block) {
  const addItemBtn = document.getElementById('addItemBtn');
  if (addItemBtn) addItemBtn.style.display = 'none';
  const removeBtn = block.querySelector('.btn-remove-item');
  if (removeBtn) removeBtn.style.display = 'none';
}

function toggleInvoiceDivs(type) {
  const singleDiv = document.getElementById('singleItemDiv');
  const multiDiv = document.getElementById('multiItemDiv');
  if (type === 'multi') {
    if (multiDiv) multiDiv.style.display = 'block';
    if (singleDiv) singleDiv.style.display = 'none';
  } else {
    if (singleDiv) singleDiv.style.display = 'block';
    if (multiDiv) multiDiv.style.display = 'none';
  }
}

function showBuyerPaidInfo(buyer) {
  const buyerPaidInfo = document.getElementById('buyerPaidInfo');
  const notice = document.getElementById('formLockNotice');
  const approvedLabel = document.getElementById('invoiceApprovedLabel');

  if (buyerPaidInfo) {
    buyerPaidInfo.style.display = 'block';
    if (approvedLabel) approvedLabel.style.display = 'block';
    if (notice) notice.style.display = 'none';

    document.getElementById('buyerName').textContent = buyer.fullname || 'N/A';
    document.getElementById('buyerEmail').textContent = buyer.email || 'N/A';
    document.getElementById('buyerPhone').textContent = buyer.phone || 'N/A';
    document.getElementById('buyerSocial').textContent = buyer.social_media || 'N/A';

    if (buyer.profile_picture) {
      const buyerPic = document.getElementById('buyerProfilePic');
      if (buyerPic) {
        const pic = buyer.profile_picture;
        buyerPic.src = pic.startsWith('http') ? pic : `${API_BASE}${pic}`;
      }
    }
  }
}

// Initial load
document.addEventListener('DOMContentLoaded', loadRoomData);






