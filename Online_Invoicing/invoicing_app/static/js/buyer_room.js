
const API_BASE = "https://kt2980zx-8000.asse.devtunnels.ms";
//const API_BASE = 'http://localhost:8000';
const roomHash = window.location.pathname.split('/').filter(Boolean).pop();

// State variables (declare once)
let attempts = 0;
let locked = false;
let countdownTimer = null;

/**
 * Join room form submission
 */
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
      alert("You have successfully joined this room!");
      localStorage.setItem('buyer_hash', data.buyer_hash);
      window.location.href = data.redirect_url; // redirect to invoice room
    } else if (response.status === 403) {
      // Room already occupied
      showOccupiedModal();
    } else {
      alert(data.error || "Failed to join the room.");
    }
  } catch (err) {
    console.error(err);
    alert("Network error. Please try again.");
  }
});

/**
 * Show occupied modal
 */
function showOccupiedModal() {
  document.getElementById('buyerForm').style.pointerEvents = 'none';
  document.getElementById('buyerForm').style.opacity = 0.5;
  document.getElementById('occupiedModal').style.display = 'block';
}

/**
 * Show hash modal
 */
function showHashModal() {
  document.getElementById('hashModal').style.display = 'block';
}

/**
 * Verify buyer info against backend serializer data
 */
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

      if (
        fullname === data.buyer.fullname &&
        email === (data.buyer.email || '') &&
        phone === (data.buyer.phone || '') &&
        social === (data.buyer.social_media || '')
      ) {
        // Info matches → show hash modal
        showHashModal();
      } else {
        // Info mismatch → show occupied modal
        showOccupiedModal();
      }
    } else {
      // No buyer assigned yet → show occupied modal
      showOccupiedModal();
    }
  } catch (err) {
    console.error(err);
    alert("Failed to verify buyer info");
  }
}

/**
 * Verify buyer hash inside modal
 */
document.getElementById('verifyHashBtn').addEventListener('click', () => {
  if (locked) return;

  const enteredHash = document.getElementById('buyerHashInput').value.trim();
  const storedHash = localStorage.getItem('buyer_hash'); // saved after join
  const errorMsg = document.getElementById('hashError');

  if (enteredHash === storedHash) {
    // Correct hash → redirect
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

/**
 * Lockout function (after 2 failed attempts)
 */
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

/**
 * Hook buyer form to verify info before showing hash modal
 */
document.getElementById('buyerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  verifyBuyerInfo();
});
