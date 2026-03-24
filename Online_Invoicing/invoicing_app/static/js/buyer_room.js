//const API_BASE = "http://127.0.0.1:8000";
const API_BASE = "https://nontaxinvoiceproof.pythonanywhere.com";

const roomHash = window.location.pathname.split('/').filter(Boolean).pop();

let attempts = 0;
let locked = false;
let countdownTimer = null;

const validators = {
  fullname(val) {
    if (!val) return "Full name is required.";
    if (val.length < 2) return "Full name must be at least 2 characters.";
    if (val.length > 100) return "Full name must not exceed 100 characters.";
    if (!/^[a-zA-Z\s\-'.]+$/.test(val)) return "Full name can only contain letters, spaces, hyphens, apostrophes, and periods.";
    return null;
  },
  email(val) {
    if (!val) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Please enter a valid email address (e.g. example@gmail.com).";
    if (val.length > 254) return "Email address is too long.";
    return null;
  },
  phone(val) {
    if (!val) return "Phone number is required.";
    const digits = val.replace(/[\s\-().+]/g, '');
    if (!/^\d+$/.test(digits)) return "Phone number can only contain digits, spaces, dashes, and parentheses.";
    if (digits.length < 7) return "Phone number is too short.";
    if (digits.length > 15) return "Phone number is too long.";
    return null;
  },
  social_media(val) {
    if (!val) return "Social media handle is required.";
    if (val.length < 2) return "Social media handle is too short.";
    if (val.length > 100) return "Social media handle must not exceed 100 characters.";
    return null;
  },
  profile_picture(file) {
    if (!file) return null; // optional
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) return "Profile picture must be a JPG, PNG, GIF, or WEBP image.";
    if (file.size > 5 * 1024 * 1024) return "Profile picture must be smaller than 5MB.";
    return null;
  }
};

function showError(fieldId, message) {
  const input = document.getElementById(fieldId);
  input.classList.add('input-error');
  let err = input.parentElement.querySelector('.field-error');
  if (!err) {
    err = document.createElement('p');
    err.className = 'field-error';
    input.parentElement.appendChild(err);
  }
  err.textContent = message;
  err.style.display = 'block';
}

function clearError(fieldId) {
  const input = document.getElementById(fieldId);
  input.classList.remove('input-error');
  const err = input.parentElement.querySelector('.field-error');
  if (err) err.style.display = 'none';
}

function clearAllErrors() {
  ['buyerFullname', 'buyerEmail', 'buyerPhone', 'buyerSocial', 'buyerProfilePic']
    .forEach(clearError);
}

function validateForm() {
  clearAllErrors();
  let valid = true;

  const checks = [
    { id: 'buyerFullname', key: 'fullname',      val: () => document.getElementById('buyerFullname').value.trim() },
    { id: 'buyerEmail',    key: 'email',         val: () => document.getElementById('buyerEmail').value.trim() },
    { id: 'buyerPhone',    key: 'phone',         val: () => document.getElementById('buyerPhone').value.trim() },
    { id: 'buyerSocial',   key: 'social_media',  val: () => document.getElementById('buyerSocial').value.trim() },
    { id: 'buyerProfilePic', key: 'profile_picture', val: () => document.getElementById('buyerProfilePic').files[0] || null },
  ];

  for (const { id, key, val } of checks) {
    const error = validators[key](val());
    if (error) {
      showError(id, error);
      valid = false;
    }
  }

  return valid;
}

document.getElementById('buyerFullname').addEventListener('blur', () => {
  const err = validators.fullname(document.getElementById('buyerFullname').value.trim());
  err ? showError('buyerFullname', err) : clearError('buyerFullname');
});
document.getElementById('buyerEmail').addEventListener('blur', () => {
  const err = validators.email(document.getElementById('buyerEmail').value.trim());
  err ? showError('buyerEmail', err) : clearError('buyerEmail');
});
document.getElementById('buyerPhone').addEventListener('blur', () => {
  const err = validators.phone(document.getElementById('buyerPhone').value.trim());
  err ? showError('buyerPhone', err) : clearError('buyerPhone');
});
document.getElementById('buyerSocial').addEventListener('blur', () => {
  const err = validators.social_media(document.getElementById('buyerSocial').value.trim());
  err ? showError('buyerSocial', err) : clearError('buyerSocial');
});
document.getElementById('buyerProfilePic').addEventListener('change', (e) => {
  const file = e.target.files[0] || null;
  const err = validators.profile_picture(file);
  err ? showError('buyerProfilePic', err) : clearError('buyerProfilePic');

  const preview = document.getElementById('buyerPreview');
  if (file && !err) {
    const reader = new FileReader();
    reader.onload = ev => { preview.src = ev.target.result; preview.style.display = 'block'; };
    reader.readAsDataURL(file);
  } else {
    preview.src = '';
    preview.style.display = 'none';
  }
});

document.getElementById('buyerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateForm()) return;

  const formData = new FormData(e.target);

  try {
    const response = await fetch(`${API_BASE}/api/buyer/join/${roomHash}/`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem('buyer_hash', data.buyer_hash);
      window.location.href = data.redirect_url;
    } else if (response.status === 403) {
      await verifyBuyerInfo();
    } else {
      alert(data.error || "Failed to join the room.");
    }
  } catch (err) {
    console.error(err);
    alert("Network error. Please try again.");
  }
});

async function verifyBuyerInfo() {
  try {
    const res = await fetch(`${API_BASE}/api/room/${roomHash}/`);
    if (!res.ok) throw new Error("Room not found");
    const data = await res.json();

    if (data.buyer) {
      const fullname = document.getElementById('buyerFullname').value.trim();
      const email    = document.getElementById('buyerEmail').value.trim();
      const phone    = document.getElementById('buyerPhone').value.trim();
      const social   = document.getElementById('buyerSocial').value.trim();

      const isExistingBuyer =
        fullname === data.buyer.fullname &&
        email    === (data.buyer.email        || '') &&
        phone    === (data.buyer.phone        || '') &&
        social   === (data.buyer.social_media || '');

      isExistingBuyer ? showHashModal() : showOccupiedModal();
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
  const storedHash  = localStorage.getItem('buyer_hash');
  const errorMsg    = document.getElementById('hashError');

  if (enteredHash === storedHash) {
    window.location.href = `/buyer_invoice_room/${roomHash}/${enteredHash}/`;
  } else {
    attempts++;
    errorMsg.textContent = `Incorrect hash. Attempt ${attempts}/2.`;
    errorMsg.style.display = 'block';
    if (attempts >= 2) lockout();
  }
});

function lockout() {
  locked = true;
  const input      = document.getElementById('buyerHashInput');
  const button     = document.getElementById('verifyHashBtn');
  const lockoutMsg = document.getElementById('lockoutMsg');
  const errorMsg   = document.getElementById('hashError');

  input.disabled  = true;
  button.disabled = true;

  let remaining = 30;
  lockoutMsg.style.display = 'block';
  lockoutMsg.textContent = `Too many attempts. Try again in ${remaining}s.`;

  countdownTimer = setInterval(() => {
    remaining--;
    lockoutMsg.textContent = `Too many attempts. Try again in ${remaining}s.`;
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      input.disabled  = false;
      button.disabled = false;
      lockoutMsg.style.display = 'none';
      errorMsg.style.display   = 'none';
      attempts = 0;
      locked   = false;
    }
  }, 1000);
}