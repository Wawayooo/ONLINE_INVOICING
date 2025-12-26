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

    // Seller Fullname: must be letters and spaces only
    const fullname = form.querySelector("[name='seller_fullname']").value.trim();
    if (!/^[A-Za-z\s]+$/.test(fullname)) {
      errors.push("Full Name must contain only letters and spaces.");
    }

    // Email: if provided, must be valid format
    const email = form.querySelector("[name='seller_email']").value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Email must be a valid format.");
    }

    // Phone: if provided, must be digits only (allow + and -)
    const phone = form.querySelector("[name='seller_phone']").value.trim();
    if (phone && !/^[0-9+\-\s]+$/.test(phone)) {
      errors.push("Phone must contain only digits, spaces, + or -.");
    }

    // Social Media: if provided, must start with @ or be alphanumeric
    const social = form.querySelector("[name='seller_social_media']").value.trim();

    // Regex explanation:
    // ^[A-Za-z]+(?:\s[A-Za-z]+)* → one or more words (letters only, spaces allowed between words)
    // \s* → optional spaces before parentheses
    // \( (FB|IG) \)$ → must end with (FB) or (IG)
    if (social && !/^[A-Za-z]+(?:\s[A-Za-z]+)*\s*\((FB|IG)\)$/.test(social)) {
      errors.push("Social Media must be in the format: Name (FB) or Name (IG).");
    }


    // Secret Key: must be at least 6 characters
    const secretKey = form.querySelector("[name='seller_secret_key']").value;
    const confirmKey = form.querySelector("[name='seller_secret_key_confirm']").value;
    if (secretKey.length < 6) {
      errors.push("Secret Key must be at least 6 characters long.");
    }
    if (secretKey !== confirmKey) {
      errors.push("Secret Key and Confirm Secret Key must match.");
    }

    // Invoice Date: must not be empty
    const invoiceDate = form.querySelector("[name='invoice_date']").value;
    if (!invoiceDate) {
      errors.push("Invoice Date is required.");
    }

    // Due Date: must be after invoice date if provided
    const dueDate = form.querySelector("[name='due_date']").value;
    if (dueDate && invoiceDate && new Date(dueDate) < new Date(invoiceDate)) {
      errors.push("Due Date must be after Invoice Date.");
    }

    // Items: must have at least one item
    const itemsCount = parseInt(document.getElementById("items-count").value, 10);
    if (itemsCount < 1) {
      errors.push("You must add at least one invoice item.");
    }

    // Validate each item
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

    // If errors exist, prevent submission and show alert
    if (errors.length > 0) {
      e.preventDefault();
      alert("Please correct the following:\n\n" + errors.join("\n"));
    }
  });
});