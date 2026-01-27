document.querySelector("form").addEventListener("submit", function(e) {
      const key = document.getElementById("sellerSecretKey").value;
      const confirmKey = document.getElementById("sellerSecretKeyConfirm").value;

      if (key !== confirmKey) {
        e.preventDefault();
        alert("Secret keys do not match. Please re-enter.");
      }
    });

document.addEventListener("DOMContentLoaded", function() {
  const form = document.querySelector("form");

  form.addEventListener("submit", function(e) {
    let errors = [];

    const fullname = form.querySelector("[name='seller_fullname']").value.trim();
    if (!/^[A-Za-z\s]+$/.test(fullname)) {
      errors.push("Full Name must contain only letters and spaces.");
    }

    const email = form.querySelector("[name='seller_email']").value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Email must be a valid format.");
    }

    const phone = form.querySelector("[name='seller_phone']").value.trim();
    if (phone && !/^[0-9+\-\s]+$/.test(phone)) {
      errors.push("Phone must contain only digits, spaces, + or -.");
    }

    const social = form.querySelector("[name='seller_social_media']").value.trim();

    if (social && !/^[A-Za-z]+(?:\s[A-Za-z]+)*\s*\((FB|IG)\)$/.test(social)) {
      errors.push("Social Media must be in the format: Name (FB) or Name (IG).");
    }


    const secretKey = form.querySelector("[name='seller_secret_key']").value;
    const confirmKey = form.querySelector("[name='seller_secret_key_confirm']").value;
    if (secretKey.length < 6) {
      errors.push("Secret Key must be at least 6 characters long.");
    }
    if (secretKey !== confirmKey) {
      errors.push("Secret Key and Confirm Secret Key must match.");
    }

    const invoiceDate = form.querySelector("[name='invoice_date']").value;
    if (!invoiceDate) {
      errors.push("Invoice Date is required.");
    }

    const dueDate = form.querySelector("[name='due_date']").value;
    if (dueDate && invoiceDate && new Date(dueDate) < new Date(invoiceDate)) {
      errors.push("Due Date must be after Invoice Date.");
    }

    const itemsCount = parseInt(document.getElementById("items-count").value, 10);
    if (itemsCount < 1) {
      errors.push("You must add at least one invoice item.");
    }

    for (let i = 0; i < itemsCount; i++) {
      const product = form.querySelector(`[name='items-${i}-product_name']`).value.trim();
      const qty = form.querySelector(`[name='items-${i}-quantity']`).value;
      const price = form.querySelector(`[name='items-${i}-unit_price']`).value;

      if (!product) {
        errors.push(`Item ${i+1}: Product Name is required.`);
      }
      if (!qty || qty <= 0) {
        errors.push(`Item ${i+1}: Quantity must be greater than 0.`);
      }
      if (!price || price <= 0) {
        errors.push(`Item ${i+1}: Unit Price must be greater than 0.`);
      }
    }

    if (errors.length > 0) {
      e.preventDefault();
      alert("Please correct the following:\n\n" + errors.join("\n"));
    }
  });
});