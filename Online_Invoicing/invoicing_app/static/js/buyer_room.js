//const API_BASE = "http://127.0.0.1:8000";
const API_BASE = "https://nontaxinvoiceproof.pythonanywhere.com";

const roomHash = window.location.pathname.split('/').filter(Boolean).pop();

let attempts = 0;
let locked = false;
let countdownTimer = null;

// Single submit handler — tries to join first
document.getElementById('buyerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);

  try {
    const response = await fetch(`${API_BASE}/api/buyer/join/${roomHash}/`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      // Successful first-time join — no occupied modal, just redirect
      localStorage.setItem('buyer_hash', data.buyer_hash);
      window.location.href = data.redirect_url;
    } else if (response.status === 403) {
      // Room is occupied — verify if this is the existing buyer trying to re-enter
      await verifyBuyerInfo();
    } else {
      alert(data.error || "Failed to join the room.");
    }
  } catch (err) {
    console.error(err);
    alert("Network error. Please try again.");
  }
});

// Only called when 403 is returned — checks if user is the existing buyer
async function verifyBuyerInfo() {
  try {
    const res = await fetch(`${API_BASE}/api/room/${roomHash}/`);
    if (!res.ok) throw new Error("Room not found");
    const data = await res.json();

    if (data.buyer) {
      const fullname = document.getElementById('buyerFullname').value.trim();
      const email = document.getElementById('buyerEmail').value.trim();
      const phone = document.getElementById('buyerPhone').value.trim();
      const social = document.getElementById('buyerSocial').value.trim();

      const isExistingBuyer =
        fullname === data.buyer.fullname &&
        email === (data.buyer.email || '') &&
        phone === (data.buyer.phone || '') &&
        social === (data.buyer.social_media || '');

      if (isExistingBuyer) {
        // Buyer recognizes themselves — prompt for hash to re-enter
        showHashModal();
      } else {
        // Someone else trying to join an occupied room
        showOccupiedModal();
      }
    } else {
      showOccupiedModal();
    }
  } catch (err) {
    console.error(err);
    alert("Failed to verify buyer info.");
  }
}

function showOccupiedModal() {
  document.getElementById('buyerForm').style.pointerEvents = 'none';
  document.getElementById('buyerForm').style.opacity = 0.5;
  document.getElementById('occupiedModal').style.display = 'block';
}

function showHashModal() {
  document.getElementById('hashModal').style.display = 'block';
}

document.getElementById('verifyHashBtn').addEventListener('click', () => {
  if (locked) return;

  const enteredHash = document.getElementById('buyerHashInput').value.trim();
  const storedHash = localStorage.getItem('buyer_hash');
  const errorMsg = document.getElementById('hashError');

  if (enteredHash === storedHash) {
    window.location.href = `/buyer_invoice_room/${roomHash}/${enteredHash}/`;
  } else {
    attempts++;
    errorMsg.textContent = `Incorrect hash. Attempt ${attempts}/2.`;
    errorMsg.style.display = 'block';

    if (attempts >= 2) {
      lockout();
    }
  }
});

function lockout() {
  locked = true;
  const input = document.getElementById('buyerHashInput');
  const button = document.getElementById('verifyHashBtn');
  const lockoutMsg = document.getElementById('lockoutMsg');
  const errorMsg = document.getElementById('hashError');

  input.disabled = true;
  button.disabled = true;

  let remaining = 30;
  lockoutMsg.style.display = 'block';
  lockoutMsg.textContent = `Too many attempts. Try again in ${remaining}s.`;

  countdownTimer = setInterval(() => {
    remaining--;
    lockoutMsg.textContent = `Too many attempts. Try again in ${remaining}s.`;

    if (remaining <= 0) {
      clearInterval(countdownTimer);
      input.disabled = false;
      button.disabled = false;
      lockoutMsg.style.display = 'none';
      errorMsg.style.display = 'none';
      attempts = 0;
      locked = false;
    }
  }, 1000);
}