// invoice_detectors.js

export const detectors = {

  seller_fullname: (value) => {
    if (!value || value.trim().length < 2) return "Full name must be at least 2 characters.";
    if (!/^[a-zA-Z\s.'-]+$/.test(value)) return "Full name contains invalid characters.";
    return null;
  },

  seller_email: (value) => {
    if (!value) return null; // optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return "Invalid email format.";
    return null;
  },

  seller_phone: (value) => {
    if (!value) return null; // optional
    const phoneRegex = /^[\d+\-\s]{7,15}$/;
    if (!phoneRegex.test(value)) return "Invalid phone number format.";
    return null;
  },

  seller_social_media: (value) => {
    if (!value) return null; // optional

    // Require "(FB)" or "(IG)" in the input
    if (!value.includes("(FB)") && !value.includes("(IG)")) {
      return "Social media must include (FB) or (IG).";
    }

    return null; // valid
  },


  seller_profile_picture: (file) => {
    if (!file) return null; // optional
    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) return "Only JPEG or PNG images allowed.";
    if (file.size > 2 * 1024 * 1024) return "File size must be < 2MB.";
    return null;
  },

  invoice_date: (value) => {
    if (!value) return "Invoice date is required.";
    const today = new Date();
    const invoice = new Date(value);
    if (invoice > today) return "Invoice date cannot be in the future.";
    return null;
  },

  due_date: (value, invoiceDate) => {
    if (!value) return null; // optional
    const due = new Date(value);
    const invoice = new Date(invoiceDate);
    if (due < invoice) return "Due date cannot be before invoice date.";
    return null;
  },

  description: (value) => {
    if (!value || value.trim().length < 5) return "Description must be at least 5 characters.";
    return null;
  },

  quantity: (value) => {
    if (!value) return "Quantity is required.";
    if (isNaN(value) || Number(value) < 1) return "Quantity must be a number >= 1.";
    return null;
  },

  unit_price: (value) => {
    if (!value) return "Unit price is required.";
    if (isNaN(value) || Number(value) < 0) return "Unit price must be a number >= 0.";
    return null;
  },

  payment_method: (value) => {
      const options = ["cash", "gcash", "paypal", "bank_transfer", "other"];
      if (!value || !options.includes(value)) return "Payment method is required.";
      return null;
  },

  seller_secret_key: (value) => {
    if (!value) return "Secret key is required.";
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!strongRegex.test(value)) {
      return "Secret key must be 8+ characters with uppercase, lowercase, number, and special character.";
    }
    return null;
  },

  seller_secret_key_confirm: (value, formData) => {
    const original = formData.get("seller_secret_key");
    if (!value) return "Please confirm your secret key.";
    if (value !== original) return "Secret key confirmation does not match.";
    return null;
  }

};

// Helper to run all detectors
export function validateInvoiceForm(formData) {
  const errors = {};

  for (const field in detectors) {
    let value = formData.get(field);

    if (field === 'due_date') {
      const invoiceDate = formData.get('invoice_date');
      errors[field] = detectors[field](value, invoiceDate);
    } else if (field === 'seller_profile_picture') {
      errors[field] = detectors[field](value);
    } else if (field === 'seller_secret_key_confirm') {
      errors[field] = detectors[field](value, formData);
    } else {
      errors[field] = detectors[field](value);
    }

    if (errors[field] === null) delete errors[field];
  }

  return errors;
}

