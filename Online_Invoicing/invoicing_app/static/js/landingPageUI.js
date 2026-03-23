document.addEventListener('DOMContentLoaded', function () {

    const scrollBar = document.getElementById('scroll-bar');
    window.addEventListener('scroll', () => {
        const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100;
        scrollBar.style.width = Math.min(pct, 100) + '%';
    }, { passive: true });

    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });

    const marqueeItems = [
        'Single-Item Invoice', 'Multi-Item Invoice', '5-Stage Workflow',
        'QR Verification', 'Audit Trail', 'No Account Required',
        'Immutable Records', 'Printable PDF', 'Buyer-Seller Protection',
        'Non-Taxable Transactions', 'Dispute Reduction', 'Philippines',
        'Real-Time Negotiation', 'Finalized & Locked'
    ];
    const track = document.getElementById('mtrack');
    if (track) {
        [...marqueeItems, ...marqueeItems].forEach(text => {
            const el = document.createElement('div');
            el.className = 'marquee-item';
            el.innerHTML = `<span class="dot"></span>${text}`;
            track.appendChild(el);
        });
    }

    const revealEls = document.querySelectorAll('.reveal, .reveal-l, .reveal-r');
    const revealObserver = new IntersectionObserver(
        entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); }),
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach(el => revealObserver.observe(el));

    const modal = document.getElementById('invoiceModal');
    const closeBtn = document.getElementById('closeModal');

    function openModal() {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    ['openInvoiceModalNav', 'openInvoiceModalHero', 'openInvoiceModalCTA', 'openInvoiceModalPricing'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', openModal);
    });

    const legacyOpenBtn = document.getElementById('openInvoiceModal');
    if (legacyOpenBtn) {
        legacyOpenBtn.addEventListener('click', function (e) {
            e.preventDefault();
            openModal();
        });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'block') closeModal();
    });

    const navToggle = document.getElementById('nav-toggle');
    const navLinks = document.getElementById('nav-links');
    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            const isOpen = navLinks.style.display === 'flex';
            if (isOpen) {
                navLinks.style.cssText = '';
            } else {
                const navHeight = document.getElementById('navbar').offsetHeight;
                navLinks.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    position: fixed;
                    top: ${navHeight}px;
                    left: 0;
                    right: 0;
                    background: rgba(255,255,255,0.98);
                    padding: 16px 18px 22px;
                    gap: 14px;
                    border-bottom: 1px solid #e5e7ff;
                    z-index: 999;
                    box-shadow: 0 12px 48px rgba(102,126,234,0.12);
                    backdrop-filter: blur(20px);
                `;
            }
        });

        navLinks.querySelectorAll('a').forEach(a => {
            a.style.fontSize = '12px';
            a.style.fontWeight = '600';
            a.style.color = '#1a1a2e';
            a.style.textDecoration = 'none';
            a.style.padding = '6px 0';
            a.style.display = 'block';
            a.addEventListener('click', () => {
                navLinks.style.cssText = '';
            });
        });
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulse {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-8px); }
            75% { transform: translateX(8px); }
        }
    `;
    document.head.appendChild(style);

});