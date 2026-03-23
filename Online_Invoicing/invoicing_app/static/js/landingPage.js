const CONFIG = {
    //API_BASE: "http://127.0.0.1:8000",
    API_BASE: "https://nontaxinvoiceproof.pythonanywhere.com",
    MAX_BUYER_ATTEMPTS: 3,
    MAX_SECRET_ATTEMPTS: 2,
    MAX_ROOM_ATTEMPTS: 2,
    LOCK_DURATION_SECONDS: 30
};

const state = {
    buyerFailedAttempts: 0,
    secretAttempts: 0,
    roomAttempts: 0,
    isLocked: false,
    isLoading: false
};

const elements = {
    buyerBtn: document.getElementById('buyerBtn'),
    sellerBtn: document.getElementById('sellerGoBtn'),
    sellerInput: document.getElementById('sellerSecretInput')
};

function getCookie(name) {
    if (!document.cookie) return null;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [key, value] = cookie.trim().split('=');
        if (key === name) return decodeURIComponent(value);
    }
    return null;
}

function getCSRFToken() {
    const metaToken = document.querySelector('[name=csrfmiddlewaretoken]');
    return metaToken?.value || getCookie('csrftoken');
}

function isStrongKey(key) {
    if (key.length < 8) return false;
    return /[A-Z]/.test(key) && /[a-z]/.test(key) && /[0-9]/.test(key) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(key);
}

function extractRoomHash(input) {
    try {
        const url = new URL(input, window.location.origin);
        return url.pathname.split('/').filter(Boolean).pop() || url.searchParams.get('room') || input;
    } catch {
        return input.trim();
    }
}

function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'authLoadingOverlay';
    overlay.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(135deg,rgba(102,126,234,0.9),rgba(118,75,162,0.9));display:flex;justify-content:center;align-items:center;z-index:10000;backdrop-filter:blur(8px);animation:fadeIn 0.3s ease">
            <div style="background:white;padding:48px 40px;border-radius:24px;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.3);max-width:360px;animation:slideUp 0.4s ease">
                <div style="width:64px;height:64px;border:6px solid #e5e7eb;border-top:6px solid #667eea;border-radius:50%;margin:0 auto 24px;animation:spin 1s linear infinite"></div>
                <h3 style="margin:0 0 12px 0;color:#1f2937;font-size:22px;font-weight:700;letter-spacing:-0.5px">Authenticating</h3>
                <p style="margin:0;color:#6b7280;font-size:15px;font-weight:500">Verifying your credentials...</p>
                <div style="margin-top:20px;display:flex;gap:6px;justify-content:center">
                    <span style="width:8px;height:8px;background:#667eea;border-radius:50%;animation:pulse 1.5s ease infinite"></span>
                    <span style="width:8px;height:8px;background:#667eea;border-radius:50%;animation:pulse 1.5s ease infinite 0.2s"></span>
                    <span style="width:8px;height:8px;background:#667eea;border-radius:50%;animation:pulse 1.5s ease infinite 0.4s"></span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function showLoading() {
    state.isLoading = true;
    elements.sellerBtn.disabled = true;
    elements.sellerInput.disabled = true;
    createLoadingOverlay();
}

function hideLoading() {
    state.isLoading = false;
    const overlay = document.getElementById('authLoadingOverlay');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => overlay.remove(), 200);
    }
    if (!state.isLocked) {
        elements.sellerBtn.disabled = false;
        elements.sellerInput.disabled = false;
    }
}

function showRoomHashPopup() {
    if (document.getElementById('roomHashPopup')) return;
    const popup = document.createElement('div');
    popup.id = 'roomHashPopup';
    popup.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:10001;animation:fadeIn 0.3s ease;backdrop-filter:blur(4px)">
            <div style="background:white;padding:32px;border-radius:20px;text-align:center;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.4);animation:slideUp 0.4s ease;border:1px solid rgba(255,255,255,0.8)">
                <div style="width:56px;height:56px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 8px 16px rgba(102,126,234,0.3)">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <h3 style="margin:0 0 8px 0;color:#111827;font-size:24px;font-weight:700;letter-spacing:-0.5px">Enter Room Hash</h3>
                <p style="margin:0 0 24px 0;color:#6b7280;font-size:14px;line-height:1.5">Please provide your unique room identifier to proceed</p>
                <input id="roomHashInput" type="text" placeholder="Enter room hash..." autocomplete="off" style="width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;box-sizing:border-box;transition:all 0.2s ease;outline:none;font-family:inherit" onfocus="this.style.borderColor='#667eea';this.style.boxShadow='0 0 0 4px rgba(102,126,234,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'">
                <div style="display:flex;gap:12px;justify-content:center;margin-top:24px">
                    <button id="roomHashSubmit" style="flex:1;padding:13px 24px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;transition:all 0.2s ease;box-shadow:0 4px 12px rgba(102,126,234,0.3)" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">Submit</button>
                    <button id="roomHashCancel" style="flex:1;padding:13px 24px;background:#f3f4f6;color:#374151;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">Cancel</button>
                </div>
                <p id="roomHashMsg" style="color:#ef4444;margin:16px 0 0 0;font-size:14px;font-weight:500;display:none"></p>
            </div>
        </div>
    `;
    document.body.appendChild(popup);

    const input = document.getElementById('roomHashInput');
    const submitBtn = document.getElementById('roomHashSubmit');
    const cancelBtn = document.getElementById('roomHashCancel');

    input.focus();
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') submitBtn.click(); });
    cancelBtn.addEventListener('click', () => {
        popup.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => popup.remove(), 200);
    });
    submitBtn.addEventListener('click', () => handleRoomHashSubmit(input));
}

function lockFields(messagePrefix = 'Locked') {
    state.isLocked = true;
    elements.sellerInput.disabled = true;
    elements.sellerBtn.disabled = true;
    let countdown = CONFIG.LOCK_DURATION_SECONDS;
    const originalText = elements.sellerBtn.textContent;
    const timer = setInterval(() => {
        elements.sellerBtn.textContent = `${messagePrefix} (${countdown}s)`;
        countdown--;
        if (countdown < 0) {
            clearInterval(timer);
            unlockFields(originalText);
        }
    }, 1000);
}

function unlockFields(originalText = 'Go to Seller Room') {
    state.isLocked = false;
    state.secretAttempts = 0;
    state.roomAttempts = 0;
    elements.sellerInput.disabled = false;
    elements.sellerBtn.disabled = false;
    elements.sellerBtn.textContent = originalText;
    elements.sellerInput.value = '';
}

function showBuyerInputPopup() {
    if (document.getElementById('buyerInputPopup')) return;
    const popup = document.createElement('div');
    popup.id = 'buyerInputPopup';
    popup.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:10001;animation:fadeIn 0.3s ease;backdrop-filter:blur(4px)">
            <div style="background:white;padding:32px;border-radius:20px;text-align:center;max-width:460px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.4);animation:slideUp 0.4s ease;border:1px solid rgba(255,255,255,0.8)">
                <div style="width:56px;height:56px;background:linear-gradient(135deg,#10b981,#059669);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 8px 16px rgba(16,185,129,0.3)">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                </div>
                <h3 style="margin:0 0 8px 0;color:#111827;font-size:24px;font-weight:700;letter-spacing:-0.5px">Join as Buyer</h3>
                <p style="margin:0 0 24px 0;color:#6b7280;font-size:14px;line-height:1.5">Enter the room link or hash provided by the seller</p>
                <input id="buyerRoomInput" type="text" placeholder="Paste room link or hash..." autocomplete="off" style="width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;box-sizing:border-box;transition:all 0.2s ease;outline:none;font-family:inherit" onfocus="this.style.borderColor='#10b981';this.style.boxShadow='0 0 0 4px rgba(16,185,129,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'">
                <div style="display:flex;gap:12px;justify-content:center;margin-top:24px">
                    <button id="buyerJoinSubmit" style="flex:1;padding:13px 24px;background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;transition:all 0.2s ease;box-shadow:0 4px 12px rgba(16,185,129,0.3)" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">Join Room</button>
                    <button id="buyerJoinCancel" style="flex:1;padding:13px 24px;background:#f3f4f6;color:#374151;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">Cancel</button>
                </div>
                <p id="buyerErrorMsg" style="color:#ef4444;margin:16px 0 0 0;font-size:14px;font-weight:500;display:none"></p>
                <p style="margin:20px 0 0 0;color:#9ca3af;font-size:13px">Attempts remaining: <strong id="buyerAttemptsRemaining">${CONFIG.MAX_BUYER_ATTEMPTS - state.buyerFailedAttempts}</strong></p>
            </div>
        </div>
    `;
    document.body.appendChild(popup);

    const input = document.getElementById('buyerRoomInput');
    const submitBtn = document.getElementById('buyerJoinSubmit');
    const cancelBtn = document.getElementById('buyerJoinCancel');

    input.focus();
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') submitBtn.click(); });
    cancelBtn.addEventListener('click', () => {
        popup.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => popup.remove(), 200);
    });
    submitBtn.addEventListener('click', () => handleBuyerRoomSubmit(input));
}

function createBuyerLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'buyerLoadingOverlay';
    overlay.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(135deg,rgba(16,185,129,0.9),rgba(5,150,105,0.9));display:flex;justify-content:center;align-items:center;z-index:10002;backdrop-filter:blur(8px);animation:fadeIn 0.3s ease">
            <div style="background:white;padding:48px 40px;border-radius:24px;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.3);max-width:360px;animation:slideUp 0.4s ease">
                <div style="width:64px;height:64px;border:6px solid #e5e7eb;border-top:6px solid #10b981;border-radius:50%;margin:0 auto 24px;animation:spin 1s linear infinite"></div>
                <h3 style="margin:0 0 12px 0;color:#1f2937;font-size:22px;font-weight:700;letter-spacing:-0.5px">Verifying Room</h3>
                <p style="margin:0;color:#6b7280;font-size:15px;font-weight:500">Checking room availability...</p>
                <div style="margin-top:20px;display:flex;gap:6px;justify-content:center">
                    <span style="width:8px;height:8px;background:#10b981;border-radius:50%;animation:pulse 1.5s ease infinite"></span>
                    <span style="width:8px;height:8px;background:#10b981;border-radius:50%;animation:pulse 1.5s ease infinite 0.3s"></span>
                    <span style="width:8px;height:8px;background:#10b981;border-radius:50%;animation:pulse 1.5s ease infinite 0.6s"></span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function showBuyerLoading() {
    createBuyerLoadingOverlay();
}

function hideBuyerLoading() {
    const overlay = document.getElementById('buyerLoadingOverlay');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => overlay.remove(), 200);
    }
}

async function handleBuyerRoomSubmit(input) {
    const errorMsg = document.getElementById('buyerErrorMsg');
    const submitBtn = document.getElementById('buyerJoinSubmit');
    const roomInput = input.value.trim();

    errorMsg.style.display = 'none';

    if (!roomInput) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = 'Please enter a room link or hash.';
        return;
    }

    const roomHash = extractRoomHash(roomInput);
    if (!roomHash) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = 'Invalid room link or hash format.';
        return;
    }

    showBuyerLoading();

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Checking...';

        const inputPopup = document.getElementById('buyerInputPopup');
        if (inputPopup) {
            inputPopup.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => inputPopup.remove(), 200);
        }

        const response = await fetch(`${CONFIG.API_BASE}/api/room/${roomHash}/`);
        if (!response.ok) throw new Error(response.status === 404 ? 'Room not found' : 'Server error');

        const data = await response.json();
        hideBuyerLoading();

        if (data.is_buyer_assigned) {
            alert('A buyer has already joined this room.');
            window.location.href = `/buyer_room/${data.room_hash}/`;
        } else {
            window.location.href = `/buyer_room/${data.room_hash}/`;
        }

    } catch (error) {
        hideBuyerLoading();
        state.buyerFailedAttempts++;
        const remaining = CONFIG.MAX_BUYER_ATTEMPTS - state.buyerFailedAttempts;

        if (remaining > 0) {
            alert(`Invalid room link or hash. You have ${remaining} attempt(s) remaining.`);
            updateBuyerAttemptsUI();
        } else {
            alert('Maximum attempts exceeded. The buyer button has been disabled.');
            if (elements.buyerBtn) {
                elements.buyerBtn.style.opacity = '0.6';
                elements.buyerBtn.style.cursor = 'not-allowed';
                elements.buyerBtn.disabled = true;
            }
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Join Room';
    }
}

function updateBuyerAttemptsUI() {
    const attemptsEl = document.getElementById('buyerAttemptsRemaining');
    if (attemptsEl) {
        const remaining = CONFIG.MAX_BUYER_ATTEMPTS - state.buyerFailedAttempts;
        attemptsEl.textContent = remaining;
        if (remaining <= 1) attemptsEl.style.color = '#ef4444';
    }
}

async function handleBuyerJoin() {
    if (state.buyerFailedAttempts >= CONFIG.MAX_BUYER_ATTEMPTS) {
        alert('You have exceeded the maximum number of attempts. Please try later.');
        return;
    }
    showBuyerInputPopup();
}

async function handleSecretKeySubmit(secretKey) {
    const csrftoken = getCSRFToken();
    if (!csrftoken) {
        alert('Security token missing. Please refresh the page.');
        return;
    }

    const formData = new FormData();
    formData.append('secret_key', secretKey);

    try {
        showLoading();

        const response = await fetch('/seller_authenticate/', {
            method: 'POST',
            headers: { 'X-CSRFToken': csrftoken },
            body: formData
        });

        const data = await response.json().catch(() => ({}));
        hideLoading();

        if (!response.ok) {
            handleSecretKeyFailure(response.status, data);
            return;
        }

        if (data.success && data.next_step === 'room_hash_required') {
            showRoomHashPopup();
        } else if (data.success && data.redirect_url) {
            window.location.href = data.redirect_url;
        } else {
            alert(data.error || 'Authentication failed.');
        }

    } catch (error) {
        hideLoading();
        alert('An error occurred. Please try again.');
    }
}

function handleSecretKeyFailure(status, data) {
    if (status === 401) {
        state.secretAttempts++;
        const remaining = Math.max(0, CONFIG.MAX_SECRET_ATTEMPTS - state.secretAttempts);
        if (remaining > 0) {
            alert(`Invalid key. Please try again. You have ${remaining} attempt(s) left.`);
            elements.sellerInput.value = '';
            elements.sellerInput.focus();
        } else {
            alert('Invalid key. Too many failed attempts. Please wait 30 seconds.');
            lockFields('Locked');
        }
    } else {
        alert(data.error || 'Server error occurred. Please try again.');
    }
}

async function handleRoomHashSubmit(input) {
    if (state.isLocked || state.isLoading) return;

    const msg = document.getElementById('roomHashMsg');
    const submitBtn = document.getElementById('roomHashSubmit');
    const roomHash = input.value.trim();

    if (!roomHash) {
        msg.style.display = 'block';
        msg.textContent = 'Please enter a valid room hash.';
        return;
    }

    if (state.roomAttempts >= CONFIG.MAX_ROOM_ATTEMPTS) {
        alert('Too many room hash attempts. Please wait 30 seconds.');
        document.getElementById('roomHashPopup')?.remove();
        lockFields('Locked');
        return;
    }

    const csrftoken = getCSRFToken();
    const formData = new FormData();
    formData.append('room_hash', roomHash);

    try {
        state.isLoading = true;
        submitBtn.disabled = true;

        const response = await fetch('/seller_room_authenticate/', {
            method: 'POST',
            headers: { 'X-CSRFToken': csrftoken },
            body: formData
        });

        const data = await response.json().catch(() => ({}));
        state.isLoading = false;
        submitBtn.disabled = false;

        if (!response.ok) {
            handleRoomHashFailure(response.status, data, input);
            return;
        }

        if (data.success && data.redirect_url) {
            window.location.href = data.redirect_url;
        } else {
            alert(data.error || 'Room authentication failed.');
        }

    } catch (error) {
        state.isLoading = false;
        submitBtn.disabled = false;
        alert('An error occurred. Please try again.');
    }
}

function handleRoomHashFailure(status, data, input) {
    if (status === 401) {
        state.roomAttempts++;
        const remaining = Math.max(0, CONFIG.MAX_ROOM_ATTEMPTS - state.roomAttempts);
        if (remaining > 0) {
            alert(`Invalid room hash. You have ${remaining} attempt(s) left.`);
            input.value = '';
            input.focus();
        } else {
            alert('Invalid room hash. Too many failed attempts. Please wait 30 seconds.');
            document.getElementById('roomHashPopup')?.remove();
            lockFields('Locked');
        }
    } else {
        alert(data.error || 'Server error occurred. Please try again.');
    }
}

elements.buyerBtn?.addEventListener('click', handleBuyerJoin);

elements.sellerBtn?.addEventListener('click', () => {
    if (state.isLocked || state.isLoading) return;

    const secretKey = elements.sellerInput.value.trim();

    if (!secretKey) {
        alert('Please enter your secret key.');
        return;
    }

    if (!isStrongKey(secretKey)) {
        alert('Your key must be at least 8 characters long and include uppercase, lowercase, number, and special character.');
        return;
    }

    if (state.secretAttempts >= CONFIG.MAX_SECRET_ATTEMPTS) {
        alert('Too many attempts. Please wait 30 seconds.');
        lockFields('Locked');
        return;
    }

    handleSecretKeySubmit(secretKey);
});

elements.sellerInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !state.isLocked && !state.isLoading) {
        elements.sellerBtn.click();
    }
});