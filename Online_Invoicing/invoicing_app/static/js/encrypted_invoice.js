const decryptBtn = document.getElementById('decryptBtn');
const roomHashInput = document.getElementById('roomHashInput');
const errorMessage = document.getElementById('errorMessage');
const decryptingModal = document.getElementById('decryptingModal');
const encryptedView = document.getElementById('encryptedView');
const decryptedView = document.getElementById('decryptedView');
const resetBtn = document.getElementById('resetBtn');

function typeWriter(text, element, speed = 50) {
  let i = 0;
  element.textContent = '';
  function type() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }
  type();
}

function showDecryptAnimation() {
  decryptingModal.style.display = 'flex';
  animateSteps();
}

function hideDecryptAnimation() {
  decryptingModal.style.display = 'none';
}

function animateSteps() {
  const steps = ['step1', 'step2', 'step3'];
  let currentStep = 0;

  const interval = setInterval(() => {
    if (currentStep > 0) {
      const prevStep = document.getElementById(steps[currentStep - 1]);
      prevStep.querySelector('.step-icon').textContent = '✅';
      prevStep.classList.add('completed');
    }

    if (currentStep < steps.length) {
      const step = document.getElementById(steps[currentStep]);
      step.querySelector('.step-icon').textContent = '⏳';
      step.classList.add('active');
      currentStep++;
    } else {
      clearInterval(interval);
    }
  }, 800);
}

async function decryptInvoice() {
  const userRoomHash = roomHashInput.value.trim();

  if (!userRoomHash) {
    showError('Please enter the room hash');
    return;
  }

  if (userRoomHash.length !== 16) {
    showError('Room hash must be exactly 16 characters');
    return;
  }

  showDecryptAnimation();
  errorMessage.textContent = '';

  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ room_hash: userRoomHash })
    });

    const data = await response.json();

    setTimeout(() => {
      hideDecryptAnimation();

      if (data.success) {
        displayDecryptedData(data);
      } else {
        showError(data.message || 'Decryption failed');
      }
    }, 2500);

  } catch (error) {
    setTimeout(() => {
      hideDecryptAnimation();
      showError('Network error. Please try again.');
    }, 2500);
  }
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 5000);
}

function displayDecryptedData(data) {
  encryptedView.style.display = 'none';
  decryptedView.style.display = 'block';

  const typingEl = document.getElementById('typingEffect');
  if (typingEl) {
    const typingText = `Transaction successfully verified and decrypted! This invoice is authentic and has been validated ${data.metadata.verification_count} time(s).`;
    typeWriter(typingText, typingEl);
  }

  document.getElementById('sellerName').textContent = data.seller.fullname;
  document.getElementById('sellerEmail').textContent = data.seller.email || 'N/A';
  document.getElementById('sellerPhone').textContent = data.seller.phone || 'N/A';
  document.getElementById('sellerSocial').textContent = data.seller.social_media || 'N/A';

  const sellerImg = document.getElementById('sellerImage');
  if (data.seller.profile_picture_url) {
    sellerImg.src = data.seller.profile_picture_url;
    sellerImg.style.display = 'block';
  }

  document.getElementById('buyerName').textContent = data.buyer.fullname;
  document.getElementById('buyerEmail').textContent = data.buyer.email || 'N/A';
  document.getElementById('buyerPhone').textContent = data.buyer.phone || 'N/A';
  document.getElementById('buyerSocial').textContent = data.buyer.social_media || 'N/A';

  const buyerImg = document.getElementById('buyerImage');
  if (data.buyer.profile_picture_url) {
    buyerImg.src = data.buyer.profile_picture_url;
    buyerImg.style.display = 'block';
  }

  document.getElementById('invoiceDate').textContent = data.invoice.invoice_date;
  document.getElementById('dueDate').textContent = data.invoice.due_date || 'N/A';
  document.getElementById('paymentMethod').textContent = formatPaymentMethod(data.invoice.payment_method);

  const tbody = document.getElementById('itemsTableBody');
  tbody.innerHTML = '';
  data.items.items.forEach(item => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>${item.product_name}</td>
      <td>${item.quantity}</td>
      <td>₱${parseFloat(item.unit_price).toFixed(2)}</td>
      <td>₱${parseFloat(item.line_total).toFixed(2)}</td>
    `;
  });

  document.getElementById('grandTotal').textContent = `₱${parseFloat(data.items.total_amount).toFixed(2)}`;

  document.getElementById('metaFinalized').textContent = formatDateTime(data.metadata.finalized_at);
  document.getElementById('metaVerifications').textContent = data.metadata.verification_count;
  document.getElementById('metaLastVerified').textContent = data.metadata.last_verified_at
    ? formatDateTime(data.metadata.last_verified_at)
    : 'N/A';
  document.getElementById('metaHash').textContent = data.metadata.data_hash.substring(0, 32) + '...';
}

function formatPaymentMethod(method) {
  const methods = {
    'cash': 'Cash',
    'gcash': 'GCash',
    'paypal': 'PayPal',
    'bank_transfer': 'Bank Transfer',
    'other': 'Other'
  };
  return methods[method] || method;
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

decryptBtn.addEventListener('click', decryptInvoice);

roomHashInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    decryptInvoice();
  }
});

resetBtn.addEventListener('click', () => {
  encryptedView.style.display = 'block';
  decryptedView.style.display = 'none';
  roomHashInput.value = '';
  errorMessage.style.display = 'none';
  errorMessage.textContent = '';
});