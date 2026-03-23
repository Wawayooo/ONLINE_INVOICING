//const API_BASE = "http://127.0.0.1:8000";
const API_BASE = "https://nontaxinvoiceproof.pythonanywhere.com";
const WS_BASE  = API_BASE.replace(/^http/, "ws");

const pathParts = window.location.pathname.split("/").filter(Boolean);
const roomHash  = pathParts[1]; 
const buyerHash = pathParts[2];

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
    console.warn(`[WS] Closed (code ${e.code}). Attempts: ${reconnectAttempts}`);
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
      if (data.seller)  renderSellerInfo(data.seller);
      if (data.invoice) showInvoice(data.invoice);
      break;
    }

    case "edited":
    case "created": {
      showNotification("The seller has updated the invoice. Please review.", "info");
      loadRoom();
      break;
    }

    case "approved": {
      showNotification("Invoice approved!", "success");
      loadRoom();
      break;
    }

    case "disapproved": {
      showNotification("Invoice disapproved. Awaiting seller revision.", "warning");
      loadRoom();
      break;
    }

    case "paid": {
      showNotification("Invoice marked as paid. Awaiting seller confirmation.", "info");
      loadRoom();
      break;
    }

    case "confirmed": {
      showNotification("Seller confirmed payment! Redirecting...", "success");
      redirectToProof();
      break;
    }

    case "invoice_update": {
      if (msg.data?.invoice) showInvoice(msg.data.invoice);
      break;
    }

    case "payment_confirmed": {
      showNotification("Seller confirmed payment! Redirecting...", "success");
      redirectToProof();
      break;
    }

    default:
      console.log("[WS] Unhandled message type:", msg.type);
  }
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

function renderSellerInfo(seller) {
  if (!seller) return;
  document.getElementById("sellerName").textContent   = seller.fullname     || "N/A";
  document.getElementById("sellerEmail").textContent  = seller.email        || "N/A";
  document.getElementById("sellerPhone").textContent  = seller.phone        || "N/A";
  document.getElementById("sellerSocial").textContent = seller.social_media || "N/A";

  if (seller.profile_picture) {
    const preview = document.getElementById("sellerProfile");
    if (preview) {
      preview.src = seller.profile_picture.startsWith("http")
        ? seller.profile_picture
        : `${API_BASE}${seller.profile_picture}`;
      preview.classList.add("active");
    }
  }
}

function renderInvoiceItems(invoice) {
  const table        = document.getElementById("itemsTable");
  const body         = document.getElementById("itemsBody");
  const card         = document.getElementById("singleItemCard");
  const grandTotalEl = document.getElementById("grandTotal");

  if (!table || !body || !card) return;
  body.innerHTML = "";
  let grandTotal = 0;

  const isMultiItem   = invoice.description?.trim().toLowerCase() === "multi-item invoice";
  const hasItemsArray = Array.isArray(invoice.items) && invoice.items.length > 0;

  if (isMultiItem && hasItemsArray) {
    table.style.display = "table";
    card.style.display  = "none";

    invoice.items.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.product_name || "Product/Service"}</td>
        <td>${item.description || '-'}</td>
        <td>${item.quantity ?? ""}</td>
        <td>₱${parseFloat(item.unit_price ?? 0).toFixed(2)}</td>
        <td>₱${parseFloat(item.line_total ?? 0).toFixed(2)}</td>
      `;
      body.appendChild(row);
      grandTotal += parseFloat(item.line_total ?? 0);
    });
  } else {
    table.style.display = "none";
    card.style.display  = "block";

    const qty  = Number(invoice.quantity ?? 1);
    const unit = Number(invoice.unit_price ?? 0);
    const line = invoice.total_amount != null ? Number(invoice.total_amount) : qty * unit;

    document.getElementById("singleDescription").textContent = invoice.description || "-";
    document.getElementById("singleQuantity").textContent    = qty;
    document.getElementById("singleUnitPrice").textContent   = unit.toFixed(2);
    document.getElementById("singleLineTotal").textContent   = line.toFixed(2);

    grandTotal = line;
  }

  if (grandTotalEl) grandTotalEl.textContent = "₱" + grandTotal.toFixed(2);
}

function showInvoice(invoice) {
  const header = document.getElementById("invoiceHeader");
  if (header) {
    header.innerHTML = `
      <p><strong>Invoice Date:</strong> ${invoice.invoice_date}</p>
      <p><strong>Due Date:</strong> ${invoice.due_date || "N/A"}</p>
      <p><strong>Payment Method:</strong> ${invoice.payment_method}</p>
      <p><strong>Status:</strong> ${invoice.status}</p>
    `;
  }

  renderInvoiceItems(invoice);
  handleInvoiceStatus(invoice);
}

function handleInvoiceStatus(invoice) {
  const approveBtn    = document.getElementById("approveBtn");
  const disapproveBtn = document.getElementById("disapproveBtn");
  const markPaidForm  = document.getElementById("markPaidForm");
  const paymentField  = document.getElementById("paymentMethod");
  const statusLabel   = document.getElementById("invoiceActionStatus");

  [approveBtn, disapproveBtn, markPaidForm, statusLabel].forEach((el) => {
    if (el) el.style.display = "none";
  });

  switch (invoice.status) {

    case "draft":
      if (approveBtn)    approveBtn.style.display    = "inline-block";
      if (disapproveBtn) disapproveBtn.style.display = "inline-block";
      showDraftNotification();
      break;

    case "negotiating":
      if (statusLabel) {
        statusLabel.style.display    = "block";
        statusLabel.style.background = "red";
        statusLabel.style.color      = "white";
        statusLabel.textContent      = "DISAPPROVED — Awaiting Seller Revision";
        statusLabel.className        = "disapproved-label";
      }
      break;

    case "pending":
      if (statusLabel) {
        statusLabel.style.display    = "block";
        statusLabel.style.background = "green";
        statusLabel.style.color      = "white";
        statusLabel.textContent      = "APPROVED";
        statusLabel.className        = "approved-label";
      }
      if (paymentField) paymentField.value         = invoice.payment_method;
      if (markPaidForm) markPaidForm.style.display = "block";
      break;

    case "unconfirmed_payment":
      if (statusLabel) {
        statusLabel.style.display    = "block";
        statusLabel.style.background = "black";
        statusLabel.style.color      = "white";
        statusLabel.textContent      = "PAID — Awaiting Seller Confirmation";
        statusLabel.className        = "paid-label";
      }
      break;

    case "finalized":
      if (statusLabel) {
        statusLabel.style.display    = "block";
        statusLabel.style.background = "#4caf50";
        statusLabel.style.color      = "white";
        statusLabel.textContent      = "FINALIZED — Redirecting...";
        statusLabel.className        = "finalized-label";
      }
      redirectToProof();
      break;
  }
}

function showDraftNotification() {
  const modal = document.getElementById("draftModal");
  if (modal) modal.style.display = "flex";
}

function closeDraftNotification() {
  const modal = document.getElementById("draftModal");
  if (modal) modal.style.display = "none";
}

async function updateInvoiceStatus(action) {
  const messages = {
    approve:      "Are you sure you want to APPROVE this invoice?",
    disapprove:   "Are you sure you want to DISAPPROVE this invoice?",
    "mark-paid":  "Are you sure you want to MARK this invoice as PAID?",
  };

  if (!window.confirm(messages[action])) return;

  const endpoints = {
    approve:     `${API_BASE}/api/buyer/${roomHash}/approve/`,
    disapprove:  `${API_BASE}/api/buyer/${roomHash}/disapprove/`,
    "mark-paid": `${API_BASE}/api/buyer/${roomHash}/mark-paid/`,
  };

  const wsActions = {
    approve:     "approved",
    disapprove:  "disapproved",
    "mark-paid": "paid",
  };

  const loadingModal = document.getElementById("loadingModal");
  const buttons      = ["approveBtn", "disapproveBtn", "markPaidBtn"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (loadingModal) loadingModal.style.display = "flex";
  buttons.forEach((btn) => (btn.disabled = true));

  try {
    const response = await fetch(endpoints[action], {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ buyer_hash: buyerHash }),
    });

    const data = await response.json();

    if (response.ok) {
      showNotification(`Invoice ${action}d successfully!`, "success");

      if (data.invoice) showInvoice(data.invoice);

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: wsActions[action] }));
      }
    } else {
      showNotification(data.error || `Failed to ${action} invoice`, "error");
    }
  } catch (err) {
    console.error("[API] Error:", err);
    alert("Network error. Please try again.");
  } finally {
    if (loadingModal) loadingModal.style.display = "none";
    buttons.forEach((btn) => (btn.disabled = false));
  }
}

async function loadRoom() {
  try {
    const res = await fetch(`${API_BASE}/api/room/${roomHash}/`);
    if (!res.ok) throw new Error("Room not found");

    const data = await res.json();

    if (data.buyer?.buyer_hash === buyerHash) {
      renderSellerInfo(data.seller);
      if (data.invoice) {
        if (data.invoice.status === "finalized") {
          redirectToProof();
          return;
        }
        showInvoice(data.invoice);
      }
    } else {
      const unauth = document.querySelector(".unauthorized");
      if (unauth) unauth.style.display = "block";
    }
  } catch (err) {
    console.error("[loadRoom]", err);
    alert(err.message === "Room not found" ? "Room not found." : "Failed to load room data.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("approveBtn")?.addEventListener("click", () => updateInvoiceStatus("approve"));
  document.getElementById("disapproveBtn")?.addEventListener("click", () => updateInvoiceStatus("disapprove"));
  document.getElementById("markPaidBtn")?.addEventListener("click", () => updateInvoiceStatus("mark-paid"));

  loadRoom();
  connectWebSocket();
});