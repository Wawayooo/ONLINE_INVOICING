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



// Get CSRF token from cookie
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

// Get CSRF token from meta tag or cookie
function getCSRFToken() {
    // Try to get from meta tag first
    const metaToken = document.querySelector('[name=csrfmiddlewaretoken]');
    if (metaToken) {
        return metaToken.value;
    }
    
    // Fallback to cookie
    return getCookie('csrftoken');
}

// Validate strong key
function isStrongKey(key) {
    if (key.length < 8) return false;
    const hasUpper = /[A-Z]/.test(key);
    const hasLower = /[a-z]/.test(key);
    const hasNumber = /[0-9]/.test(key);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(key);
    return hasUpper && hasLower && hasNumber && hasSpecial;
}

// Initialize attempts counter and lock state
let attempts = 0;
let isLocked = false;
let isLoading = false;

const sellerBtn = document.getElementById('sellerGoBtn');
const sellerInput = document.getElementById('sellerSecretInput');

// Create loading overlay
function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'authLoadingOverlay';
    overlay.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            backdrop-filter: blur(5px);
        ">
            <div style="
                background: white;
                padding: 40px;
                border-radius: 15px;
                text-align: center;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                max-width: 300px;
            ">
                <div style="
                    width: 50px;
                    height: 50px;
                    border: 5px solid #f3f3f3;
                    border-top: 5px solid #3498db;
                    border-radius: 50%;
                    margin: 0 auto 20px;
                    animation: spin 1s linear infinite;
                "></div>
                <h3 style="margin: 0 0 10px 0; color: #333; font-size: 18px;">Authenticating...</h3>
                <p style="margin: 0; color: #666; font-size: 14px;">Please wait</p>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    document.body.appendChild(overlay);
}

// Show loading screen
function showLoading() {
    isLoading = true;
    sellerBtn.disabled = true;
    sellerInput.disabled = true;
    createLoadingOverlay();
}

// Hide loading screen
function hideLoading() {
    isLoading = false;
    const overlay = document.getElementById('authLoadingOverlay');
    if (overlay) {
        overlay.remove();
    }
    if (!isLocked) {
        sellerBtn.disabled = false;
        sellerInput.disabled = false;
    }
}

// Lock fields for 30 seconds
function lockFields() {
    isLocked = true;
    sellerInput.disabled = true;
    sellerBtn.disabled = true;
    sellerBtn.textContent = 'Locked (30s)';
    
    let countdown = 30;
    const timer = setInterval(() => {
        countdown--;
        sellerBtn.textContent = `Locked (${countdown}s)`;
        
        if (countdown <= 0) {
            clearInterval(timer);
            unlockFields();
        }
    }, 1000);
}

// Unlock fields and reset attempts
function unlockFields() {
    isLocked = false;
    attempts = 0;
    sellerInput.disabled = false;
    sellerBtn.disabled = false;
    sellerBtn.textContent = 'Go to Seller Room';
    sellerInput.value = '';
}

sellerBtn.addEventListener('click', () => {
    if (isLocked || isLoading) {
        return;
    }

    const secretKey = sellerInput.value.trim();
    const csrftoken = getCSRFToken();

    if (!csrftoken) {
        alert("Security token missing. Please refresh the page.");
        return;
    }

    if (!secretKey) {
        alert("Please enter your secret key");
        return;
    }

    if (!isStrongKey(secretKey)) {
        alert("Your key must be at least 8 characters long and include uppercase, lowercase, number, and special character.");
        return;
    }

    // Show loading screen
    showLoading();

    // Create FormData object - only send secret_key
    const formData = new FormData();
    formData.append('secret_key', secretKey);
    
    console.log('Authenticating with secret key...');

    fetch("/seller_authenticate/", {
        method: "POST",
        headers: {
            "X-CSRFToken": csrftoken
        },
        body: formData
    })
    .then(res => {
        console.log('Response status:', res.status);
        if (!res.ok) {
            // Try to get error details
            return res.json().then(errData => {
                console.error('Error response:', errData);
                throw new Error(`HTTP error! status: ${res.status}, message: ${errData.error || 'Unknown error'}`);
            }).catch(parseErr => {
                // If JSON parsing fails, throw original error
                throw new Error(`HTTP error! status: ${res.status}`);
            });
        }
        return res.json();
    })
    .then(data => {
        console.log('Response data:', data);
        
        if (data.success) {
            // Successful authentication - keep loading screen while redirecting
            // Don't hide loading - let redirect happen
            window.location.href = data.redirect_url;
        } else {
            // Hide loading screen before showing error
            hideLoading();
            
            // Failed authentication
            attempts++;
            const remainingAttempts = 2 - attempts;
            
            console.log(`Failed attempt ${attempts}/2, remaining: ${remainingAttempts}`);
            
            if (remainingAttempts > 0) {
                alert(`Invalid key. Please try again. You have ${remainingAttempts} attempt(s) left.`);
                sellerInput.value = ''; // Clear the input
                sellerInput.focus();
            } else {
                alert("Invalid key. Too many failed attempts. Please wait 30 seconds.");
                sellerInput.value = ''; // Clear the input
                lockFields();
            }
        }
    })
    .catch(err => {
        // Hide loading screen on error
        hideLoading();
        
        console.error("Fetch error:", err);
        
        // Only increment attempts for authentication failures (401), not server errors
        if (err.message.includes('401')) {
            attempts++;
            const remainingAttempts = 2 - attempts;
            
            if (remainingAttempts > 0) {
                alert(`Invalid key. Please try again. You have ${remainingAttempts} attempt(s) left.`);
                sellerInput.value = ''; // Clear the input
                sellerInput.focus();
            } else {
                alert("Invalid key. Too many failed attempts. Please wait 30 seconds.");
                sellerInput.value = ''; // Clear the input
                lockFields();
            }
        } else {
            alert("An error occurred. Please try again.");
        }
    });
});

// Optional: Allow Enter key to submit
sellerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isLocked) {
        sellerBtn.click();
    }
});

