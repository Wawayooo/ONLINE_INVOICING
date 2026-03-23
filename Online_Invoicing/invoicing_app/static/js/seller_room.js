//const API_BASE = "http://127.0.0.1:8000";
const API_BASE = "https://nontaxinvoiceproof.pythonanywhere.com";
const WS_BASE  = API_BASE.replace(/^http/, "ws");

const pathParts = window.location.pathname.split("/").filter(Boolean);
const roomHash  = pathParts[1]; 

let socket            = null;
let reconnectAttempts = 0;
const MAX_RECONNECT   = 5;
let reconnectTimer    = null;

function connectWebSocket() {
  if (socket && socket.readyState === WebSocket.OPEN) return;

  socket = new WebSocket(`${WS_BASE}/ws/room/${roomHash}/`);

  socket.addEventListener("open", () => {
    console.log("[WS] Connected");
    reconnectAttempts = 0;
    clearTimeout(reconnectTimer);
  });

  socket.addEventListener("message", (event) => {
    let msg;
    try { msg = JSON.parse(event.data); }
    catch (e) { console.warn("[WS] Non-JSON message:", event.data); return; }
    handleSocketMessage(msg);
  });

  socket.addEventListener("close", (e) => {
    console.warn(`[WS] Closed (code ${e.code}). Attempt ${reconnectAttempts + 1}/${MAX_RECONNECT}`);
    if (reconnectAttempts < MAX_RECONNECT) {
      reconnectAttempts++;
      reconnectTimer = setTimeout(connectWebSocket, 3000 * reconnectAttempts);
    }
  });

  socket.addEventListener("error", (err) => {
    console.error("[WS] Error:", err);
    socket.close();
  });
}

function handleSocketMessage(msg) {
  console.log("[WS] Received:", msg.type, msg.data);

  switch (msg.type) {

    case "room_state":
    case "room_update": {
      const data = msg.data;
      if (!data) break;

      if (data.seller) populateSellerFields(data.seller);

      if (data.invoice) {
        populateInvoiceFields(data);
        applyInvoiceStatusToSellerRoom(data.invoice.status, data);
      }

      if (data.is_buyer_assigned || data.has_buyer) {
        showBuyerNotifModal("joined");
      }

      if (data.invoice?.status === "unconfirmed_payment" && data.buyer) {
        showBuyerPaidInfo(data.buyer);
      }

      if (data.invoice?.status === "finalized") {
        redirectToProof();
      }
      break;
    }

    case "disapproved": {
      showNotification("Buyer disapproved the invoice. You may now edit it.", "warning");
      showBuyerNotifModal("disapproved");
      unlockSellerForm();
      showNegotiationModal();
      break;
    }

    case "edited":
    case "created": {
      showNotification("Invoice updated. Awaiting buyer review.", "info");
      lockSellerForm();
      break;
    }

    case "approved": {
      showNotification("Buyer approved the invoice!", "success");
      showBuyerNotifModal("approved");
      lockSellerForm();
      showInvoiceApprovedLabel();
      break;
    }

    case "paid": {
      showNotification("Buyer marked invoice as paid. Please confirm payment.", "info");
      showBuyerNotifModal("paid");
      loadRoomData();
      break;
    }

    case "confirmed": {
      showNotification("Payment confirmed! Finalizing...", "success");
      redirectToProof();
      break;
    }

    case "invoice_update": {
      if (msg.data?.invoice) {
        populateInvoiceFields(msg.data);
        applyInvoiceStatusToSellerRoom(msg.data.invoice.status, msg.data);
      }
      break;
    }

    case "buyer_joined": {
      showBuyerNotifModal("joined");
      break;
    }

    case "payment_confirmed": {
      if (msg.data?.invoice_status === "finalized") {
        redirectToProof();
      }
      break;
    }

    default:
      console.log("[WS] Unhandled message type:", msg.type);
  }
}

function applyInvoiceStatusToSellerRoom(status, data = {}) {
  switch (status) {
    case "draft":
      lockSellerForm();
      hideConfirmPaymentBtn();
      break;

    case "negotiating":
      unlockSellerForm();
      showNegotiationModal();
      hideConfirmPaymentBtn();
      break;

    case "pending":
      lockSellerForm();
      hideConfirmPaymentBtn();
      showInvoiceApprovedLabel();
      break;

    case "unconfirmed_payment":
      lockSellerForm();
      showConfirmPaymentBtn();
      showInvoiceApprovedLabel();
      if (data.buyer) showBuyerPaidInfo(data.buyer);
      break;

    case "finalized":
      redirectToProof();
      break;

    default:
      break;
  }
}

function lockSellerForm() {
  const notice        = document.getElementById("formLockNotice");
  const updateBtn     = document.getElementById("updateInvoiceBtn");
  const approvedLabel = document.getElementById("invoiceApprovedLabel");

  if (notice)        notice.style.display        = "block";
  if (updateBtn)     updateBtn.style.display      = "none";
  if (approvedLabel) approvedLabel.style.display  = "none";

  _setFormFieldsReadonly(document.getElementById("sellerForm"),  true);
  _setFormFieldsReadonly(document.getElementById("invoiceForm"), true);
}

function unlockSellerForm() {
  const notice        = document.getElementById("formLockNotice");
  const updateBtn     = document.getElementById("updateInvoiceBtn");
  const approvedLabel = document.getElementById("invoiceApprovedLabel");

  if (notice)        notice.style.display        = "none";
  if (updateBtn)     updateBtn.style.display      = "block";
  if (approvedLabel) approvedLabel.style.display  = "none";

  _setFormFieldsReadonly(document.getElementById("sellerForm"),  false);
  _setFormFieldsReadonly(document.getElementById("invoiceForm"), false);
}

function _setFormFieldsReadonly(form, readonly) {
  if (!form) return;
  form.querySelectorAll("input, textarea, select, button").forEach((el) => {
    if (el.tagName === "BUTTON") {
      el.disabled = readonly;
    } else if (readonly) {
      if (el.tagName === "SELECT" || el.type === "file") {
        el.disabled = true;
      } else {
        el.setAttribute("readonly", true);
      }
    } else {
      el.removeAttribute("readonly");
      el.removeAttribute("disabled");
      el.disabled = false;
    }
  });
}

function showInvoiceApprovedLabel() {
  const approvedLabel = document.getElementById("invoiceApprovedLabel");
  if (approvedLabel) approvedLabel.style.display = "block";
}

function showConfirmPaymentBtn() {
  const btn = document.getElementById("confirmPaymentBtn");
  if (btn) btn.style.display = "block";
}

function hideConfirmPaymentBtn() {
  const btn = document.getElementById("confirmPaymentBtn");
  if (btn) btn.style.display = "none";
}

const BUYER_NOTIF_MESSAGES = {
  joined:      "👤 Buyer Joins the Room",
  approved:    "✅ Buyer Approved the Invoice",
  disapproved: "❌ Buyer Disapproved the Invoice",
  paid:        "💸 Buyer Marked the Invoice as Paid",
};

let _buyerNotifDismissTimer = null;

function showBuyerNotifModal(type = "joined") {
  const modal = document.getElementById("BuyerNotifModal");
  if (!modal) return;

  const h2 = modal.querySelector("h2");
  if (h2) h2.textContent = BUYER_NOTIF_MESSAGES[type] ?? BUYER_NOTIF_MESSAGES.joined;

  modal.style.display = "flex";

  clearTimeout(_buyerNotifDismissTimer);
  _buyerNotifDismissTimer = setTimeout(() => closeBuyerJoinedModal(), 5000);
}

function showBuyerJoinedModal() { showBuyerNotifModal("joined"); }

function closeBuyerJoinedModal() {
  const modal = document.getElementById("BuyerNotifModal");
  if (modal) modal.style.display = "none";
  clearTimeout(_buyerNotifDismissTimer);
}

function showNegotiationModal() {
  const modal = document.getElementById("negotiationModal");
  if (modal) modal.style.display = "flex";
}

function closeNegotiationModal() {
  const negotiationModal = document.getElementById("negotiationModal");
  const buyerNotifModal  = document.getElementById("BuyerNotifModal");
  if (negotiationModal) negotiationModal.style.display = "none";
  if (buyerNotifModal)  buyerNotifModal.style.display  = "none";
}

function showNotification(message, type = "success") {
  const notif = document.getElementById("notification");
  if (!notif) return;
  notif.textContent   = message;
  notif.className     = `notification ${type}`;
  notif.style.display = "block";
  setTimeout(() => (notif.style.display = "none"), 3000);
}

function redirectToProof() {
  const modal = document.getElementById("loadingModal");
  if (modal) modal.style.display = "flex";
  setTimeout(() => {
    window.location.href = `${API_BASE}/proof_transaction/${roomHash}/`;
  }, 2000);
}

function populateSellerFields(seller) {
  if (!seller) return;
  document.getElementById("sellerFullname").value = seller.fullname     || "";
  document.getElementById("sellerEmail").value    = seller.email        || "";
  document.getElementById("sellerPhone").value    = seller.phone        || "";
  document.getElementById("sellerSocial").value   = seller.social_media || "";

  if (seller.profile_picture) {
    const preview = document.getElementById("sellerPreview");
    if (preview) {
      preview.src = seller.profile_picture.startsWith("http")
        ? seller.profile_picture
        : `${API_BASE}${seller.profile_picture}`;
      preview.classList.add("active");
    }
  }
}

function createItemBlock(itemData = null) {
  const block = document.createElement("div");
  block.classList.add("item-block");

  const productValue     = itemData?.product_name || "";
  const descriptionValue = itemData?.description  || "";
  const quantityValue    = itemData?.quantity      ?? 1;
  const unitPriceValue   = itemData?.unit_price    ?? 0;
  let   lineTotal        = itemData?.line_total != null
    ? parseFloat(itemData.line_total)
    : quantityValue * unitPriceValue;
  if (isNaN(lineTotal)) lineTotal = 0;

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

function recalcTotals() {
  let grandTotal = 0;
  document.querySelectorAll("#itemsContainer .item-block").forEach((block) => {
    const qty   = parseFloat(block.querySelector('[name="quantity[]"]').value)   || 0;
    const price = parseFloat(block.querySelector('[name="unit_price[]"]').value) || 0;
    const line  = qty * price;
    block.querySelector(".line-total").textContent = "₱" + line.toFixed(2);
    grandTotal += line;
  });
  const el = document.getElementById("grandTotal");
  if (el) el.textContent = "₱" + grandTotal.toFixed(2);
}

function collectItems() {
  const items = [];
  document.querySelectorAll("#itemsContainer .item-block").forEach((block) => {
    const product     = block.querySelector('[name="product_name[]"]').value.trim();
    const description = block.querySelector('[name="description[]"]').value.trim();
    const quantity    = parseFloat(block.querySelector('[name="quantity[]"]').value)   || 0;
    const unit_price  = parseFloat(block.querySelector('[name="unit_price[]"]').value) || 0;

    if (product && quantity > 0 && unit_price > 0) {
      items.push({ product_name: product, description, quantity, unit_price });
    }
  });
  return items;
}

function populateInvoiceFields(data) {
  const invoice = data.invoice;
  document.getElementById("invoiceDate").value   = invoice.invoice_date   || "";
  document.getElementById("dueDate").value       = invoice.due_date       || "";
  document.getElementById("paymentMethod").value = invoice.payment_method || "";

  const itemsContainer = document.getElementById("itemsContainer");
  itemsContainer.innerHTML = "";
  let grandTotal = 0;

  const isMultiItem  = invoice.description?.trim().toLowerCase() === "multi-item invoice";
  const isSingleItem = !isMultiItem && invoice.description;

  if (isMultiItem && Array.isArray(invoice.items) && invoice.items.length) {
    invoice.items.forEach((item) => {
      itemsContainer.appendChild(createItemBlock(item));
      grandTotal += parseFloat(item.line_total || 0);
    });
    toggleInvoiceDivs("multi");
  } else if (isSingleItem) {
    const singleItem = {
      product_name: "Product/Service",
      description:  invoice.description || "",
      quantity:     invoice.quantity     || 1,
      unit_price:   parseFloat(invoice.unit_price  || 0),
      line_total:   parseFloat(invoice.line_total  || 0),
    };
    const block = createItemBlock(singleItem);
    itemsContainer.appendChild(block);
    grandTotal = singleItem.line_total;
    hideSingleItemButtons(block);
    toggleInvoiceDivs("single");
  } else {
    itemsContainer.appendChild(createItemBlock());
  }

  const el = document.getElementById("grandTotal");
  if (el) el.textContent = "₱" + grandTotal.toFixed(2);
  setTimeout(recalcTotals, 100);
}

function hideSingleItemButtons(block) {
  const addBtn = document.getElementById("addItemBtn");
  if (addBtn) addBtn.style.display = "none";
  const removeBtn = block.querySelector(".btn-remove-item");
  if (removeBtn) removeBtn.style.display = "none";
}

function toggleInvoiceDivs(type) {
  const singleDiv = document.getElementById("singleItemDiv");
  const multiDiv  = document.getElementById("multiItemDiv");
  if (type === "multi") {
    if (multiDiv)  multiDiv.style.display  = "block";
    if (singleDiv) singleDiv.style.display = "none";
  } else {
    if (singleDiv) singleDiv.style.display = "block";
    if (multiDiv)  multiDiv.style.display  = "none";
  }
}

function showBuyerPaidInfo(buyer) {
  const buyerPaidInfo = document.getElementById("buyerPaidInfo");
  const notice        = document.getElementById("formLockNotice");
  const approvedLabel = document.getElementById("invoiceApprovedLabel");

  if (!buyerPaidInfo) return;
  buyerPaidInfo.style.display = "block";
  if (approvedLabel) approvedLabel.style.display = "block";
  if (notice)        notice.style.display        = "none";

  document.getElementById("buyerName").textContent   = buyer.fullname     || "N/A";
  document.getElementById("buyerEmail").textContent  = buyer.email        || "N/A";
  document.getElementById("buyerPhone").textContent  = buyer.phone        || "N/A";
  document.getElementById("buyerSocial").textContent = buyer.social_media || "N/A";

  if (buyer.profile_picture) {
    const buyerPic = document.getElementById("buyerProfilePic");
    if (buyerPic) {
      buyerPic.src = buyer.profile_picture.startsWith("http")
        ? buyer.profile_picture
        : `${API_BASE}${buyer.profile_picture}`;
    }
  }
}

async function submitInvoiceForm() {
  if (!window.confirm("Are you sure you want to update this invoice?")) return;

  const items = collectItems();
  if (items.length === 0) {
    alert("Please add at least one valid item with product name, quantity, and unit price.");
    return;
  }

  const updateBtn    = document.getElementById("updateInvoiceBtn");
  const loadingModal = document.getElementById("loadingModal");

  if (loadingModal) loadingModal.style.display = "flex";
  if (updateBtn)    updateBtn.disabled = true;

  const invoiceDate   = document.getElementById("invoiceDate").value;
  const dueDate       = document.getElementById("dueDate").value;
  const paymentMethod = document.getElementById("paymentMethod").value;

  let url, payload;

  if (items.length > 1) {
    url     = `${API_BASE}/api/seller/${roomHash}/edit-invoice/`;
    payload = { invoice_date: invoiceDate, due_date: dueDate, payment_method: paymentMethod, items };
  } else {
    const item = items[0];
    url     = `${API_BASE}/api/seller/${roomHash}/edit-single-invoice/`;
    payload = {
      invoice_date:   invoiceDate,
      due_date:       dueDate,
      payment_method: paymentMethod,
      description:    item.description,
      quantity:       item.quantity,
      unit_price:     item.unit_price,
    };
  }

  try {
    const response = await fetch(url, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const data = await response.json();

    if (response.ok) {
      showNotification("Invoice updated successfully!", "success");

      lockSellerForm();

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "edited" }));
      }
    } else {
      alert(data.error || "Failed to update invoice.");
    }
  } catch (err) {
    console.error("[submitInvoiceForm]", err);
    alert("Network error while updating invoice.");
  } finally {
    if (loadingModal) loadingModal.style.display = "none";
    if (updateBtn)    updateBtn.disabled = false;
  }
}

async function confirmPayment() {
  if (!window.confirm("Are you sure you want to confirm this payment?")) return;

  const loadingModal = document.getElementById("loadingModal");
  const confirmBtn   = document.getElementById("confirmPaymentBtn");

  if (loadingModal) loadingModal.style.display = "flex";
  if (confirmBtn)   confirmBtn.disabled = true;

  try {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
    const res = await fetch(`${API_BASE}/api/seller/${roomHash}/confirm-payment/`, {
      method:  "POST",
      headers: { "X-CSRFToken": csrfToken || "" },
    });

    const result = await res.json();

    if (res.ok && result.invoice_status === "finalized") {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "confirmed" }));
      }

      try {
        const encryptRes    = await fetch(`${API_BASE}/invoice/${roomHash}/encrypt/`, { method: "POST" });
        const encryptResult = await encryptRes.json();
        if (!encryptRes.ok) alert(encryptResult.error || "Failed to encrypt invoice.");
      } catch (encErr) {
        console.warn("[encrypt]", encErr);
      }

      const proofUrl = result.redirect_url?.startsWith("http")
        ? result.redirect_url
        : `${window.location.origin}${result.redirect_url}`;
      window.location.href = proofUrl;
    } else {
      alert(result.error || "Failed to confirm payment.");
    }
  } catch (err) {
    console.error("[confirmPayment]", err);
    alert("Network error while confirming payment.");
  } finally {
    if (loadingModal) loadingModal.style.display = "none";
    if (confirmBtn)   confirmBtn.disabled = false;
  }
}

async function loadRoomData() {
  try {
    const response = await fetch(`${API_BASE}/api/room/${roomHash}/`);
    if (!response.ok) throw new Error("Room not found");

    const data = await response.json();

    if (data.invoice?.status === "finalized") {
      redirectToProof();
      return;
    }

    populateSellerFields(data.seller);

    if (data.invoice) {
      populateInvoiceFields(data);
      applyInvoiceStatusToSellerRoom(data.invoice.status, data);
    }

    if (data.is_buyer_assigned || data.has_buyer) {
      showBuyerJoinedModal();
    }

  } catch (err) {
    console.error("[loadRoomData]", err);
    alert(err.message === "Room not found" ? "Room not found." : "Failed to load room data.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const shareableInput = document.getElementById("shareableLink");
  if (shareableInput) shareableInput.value = `${window.location.origin}/buyer_room/${roomHash}/`;

  const roomHashEl = document.getElementById("roomHash");
  if (roomHashEl) roomHashEl.textContent = roomHash;

  document.getElementById("confirmPaymentBtn")
    ?.addEventListener("click", confirmPayment);

  document.getElementById("copyBtn")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(shareableInput?.value || "");
      alert("Link copied to clipboard!");
    } catch {
      alert("Failed to copy link. Please copy manually.");
    }
  });

  document.getElementById("invoiceForm")
    ?.addEventListener("submit", (e) => { e.preventDefault(); submitInvoiceForm(); });

  document.getElementById("sellerForm")
    ?.addEventListener("submit", (e) => { e.preventDefault(); submitInvoiceForm(); });

  document.getElementById("addItemBtn")?.addEventListener("click", () => {
    document.getElementById("itemsContainer").appendChild(createItemBlock());
    recalcTotals();
  });

  document.getElementById("itemsContainer")?.addEventListener("click", (e) => {
    if (!e.target.classList.contains("btn-remove-item")) return;
    const blocks = document.querySelectorAll("#itemsContainer .item-block");
    if (blocks.length <= 1) {
      alert("You must have at least one item in the invoice.");
      return;
    }
    e.target.closest(".item-block").remove();
    recalcTotals();
  });

  document.getElementById("itemsContainer")?.addEventListener("input", (e) => {
    if (e.target.matches('[name="quantity[]"], [name="unit_price[]"]')) recalcTotals();
  });

  loadRoomData();
  connectWebSocket();
});