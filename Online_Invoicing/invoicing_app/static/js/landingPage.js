//const API_BASE = 'http://localhost:8000';
const API_BASE = "https://kt2980zx-8000.asse.devtunnels.ms";

let failedAttempts = 0;
const MAX_ATTEMPTS = 3;

// Buyer Join Logic
document.getElementById('buyerBtn').addEventListener('click', async () => {
    if (failedAttempts >= MAX_ATTEMPTS) {
        alert("You have exceeded the maximum number of attempts. Please try later.");
        return;
    }

    let input = prompt("Enter the room hash or full link from seller:");
    if (!input) return;

    // Extract room hash safely
    let roomHash;
    try {
        const url = new URL(input, window.location.origin);
        roomHash = url.pathname.split('/').filter(Boolean).pop() || url.searchParams.get('room') || input;
    } catch {
        roomHash = input;
    }

    try {
        const response = await fetch(`${API_BASE}/api/room/${roomHash}/`);
        if (!response.ok) throw new Error("Room not found");

        const data = await response.json();

        if (data.is_buyer_assigned) {
            alert("Sorry, a buyer has already joined this room.");
        } else {
            // Redirect to join page (new URL style)
            window.location.href = `/buyer_room/${data.room_hash}/`;
        }

    } catch (err) {
        failedAttempts++;
        alert("Invalid room link or hash. Please try again.");

        if (failedAttempts >= MAX_ATTEMPTS) {
            const btn = document.getElementById('buyerBtn');
            btn.style.opacity = 0.6;
            btn.style.cursor = 'not-allowed';
            btn.disabled = true;
        }
    }
});

const sellerInput = document.getElementById('sellerSecretInput');
const sellerBtn = document.getElementById('sellerGoBtn');

let attempts = 0;
let lockInterval = null;

function isStrongKey(key) {
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return strongRegex.test(key);
}

function lockFields() {
    let remaining = 30;
    sellerInput.disabled = true;
    sellerBtn.disabled = true;
    sellerInput.value = "";
    sellerInput.placeholder = `Too many attempts, wait ${remaining}s`;

    lockInterval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            sellerInput.placeholder = `Too many attempts, wait ${remaining}s`;
        } else {
            clearInterval(lockInterval);
            sellerInput.disabled = false;
            sellerBtn.disabled = false;
            sellerInput.placeholder = "Enter your secret key";
            attempts = 0; // reset attempts
        }
    }, 1000);
}

// Add this at the top of your JavaScript file if not already present
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

const csrftoken = getCookie('csrftoken');

sellerBtn.addEventListener('click', () => {
    const secretKey = sellerInput.value.trim();
    const roomHash = document.getElementById('roomHashInput').value;

    if (!secretKey) {
        alert("Please enter your secret key");
        return;
    }

    if (!isStrongKey(secretKey)) {
        alert("Your key must be at least 8 characters long and include uppercase, lowercase, number, and special character.");
        return;
    }

    fetch("/seller_authenticate/", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-CSRFToken": csrftoken
        },
        body: `secret_key=${encodeURIComponent(secretKey)}&room_hash=${encodeURIComponent(roomHash)}`
    })
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
    })
    .then(data => {
        if (data.success) {
            window.location.href = data.redirect_url;
        } else {
            attempts++;
            alert(`Invalid key. Please Try Again. You have ${2 - attempts} attempts left.`);
            if (attempts >= 2) {
                lockFields();
            }
        }
    })
    .catch(err => {
        console.error("Fetch error:", err);
        alert("An error occurred. Please try again.");
    });
});
