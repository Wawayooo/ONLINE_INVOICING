import { validateInvoiceForm } from './invoice_detectors.js';

//const API_BASE = 'http://localhost:8000';
const API_BASE = "https://kt2980zx-8000.asse.devtunnels.ms";
// ===== INIT PAGE =====

// Set today's date as default
document.getElementById('invoiceDate').valueAsDate = new Date();

// Preview profile picture
document.getElementById('sellerProfilePic').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const preview = document.getElementById('sellerPreview');
      preview.src = e.target.result;
      preview.classList.add('active');
    };
    reader.readAsDataURL(file);
    document.querySelector('.file-input-label').textContent = file.name;
  }
});

// Calculate line total
function calculateTotal() {
  const qty = parseFloat(document.getElementById('quantity').value) || 0;
  const price = parseFloat(document.getElementById('unitPrice').value) || 0;
  const total = qty * price;
  document.getElementById('lineTotal').textContent = '₱' + total.toFixed(2);
}
document.getElementById('quantity').addEventListener('input', calculateTotal);
document.getElementById('unitPrice').addEventListener('input', calculateTotal);

// ===== FORM SUBMISSION =====
document.getElementById('invoiceForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  const loading = document.getElementById('loading');

  // Collect form data
  const formData = new FormData(this);

  // Validate fields
  const errors = validateInvoiceForm(formData);
  if (Object.keys(errors).length > 0) {
    let msg = "Please fix the following errors:\n";
    for (let key in errors) {
      msg += `- ${errors[key]}\n`;
    }
    alert(msg);
    return;
  }

  // Disable button and show loading
  submitBtn.disabled = true;
  loading.classList.add('active');

  try {
    const response = await fetch(`${API_BASE}/api/invoice/create/`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (response.ok && data.room_hash) {
      window.location.href = `/seller_room/${data.room_hash}/`;
    } else {
      console.error('Invoice creation failed:', data);
      alert('Error creating invoice. Check console for details.');
      submitBtn.disabled = false;
      loading.classList.remove('active');
    }

  } catch (error) {
    console.error('Network error:', error);
    alert('Network error: ' + error.message);
    submitBtn.disabled = false;
    loading.classList.remove('active');
  }
});
