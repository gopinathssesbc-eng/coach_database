// Progressive Web App (PWA) Controller for Coach Database
// Handles Service Worker registration, caching updates, installation prompts, and offline network state.

let deferredPrompt = null;
let newWorker = null;

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
            .then((registration) => {
                console.log('[PWA] Service Worker registered successfully with scope:', registration.scope);

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const installingWorker = registration.installing;
                    if (installingWorker) {
                        installingWorker.addEventListener('statechange', () => {
                            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New update ready
                                console.log('[PWA] New version installed and ready.');
                                newWorker = installingWorker;
                                showUpdateNotification();
                            }
                        });
                    }
                });
            })
            .catch((error) => {
                console.error('[PWA] Service Worker registration failed:', error);
            });

        // Ensure refresh once new SW takes control
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    });
}

// Show Update Notification Toast
function showUpdateNotification() {
    const banner = document.getElementById('pwaUpdateBanner');
    if (banner) {
        banner.classList.remove('hidden');
    }
}

// Trigger Update Reload
function applyPwaUpdate() {
    if (newWorker) {
        newWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
        window.location.reload();
    }
}

// Check if running in Standalone PWA mode
function isRunningStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
           (window.navigator.standalone === true) ||
           (document.referrer && document.referrer.includes('android-app://'));
}

// Check if iOS Safari
function isIos() {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
}

// Handle PWA Install Prompt
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent standard mini-infobar
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] beforeinstallprompt captured');

    // Only show install prompts if not already in standalone mode
    if (!isRunningStandalone()) {
        const headerBtn = document.getElementById('pwaHeaderInstallBtn');
        if (headerBtn) headerBtn.classList.remove('hidden');

        const loginPrompt = document.getElementById('loginInstallPrompt');
        if (loginPrompt) loginPrompt.classList.remove('hidden');

        // Show toast banner if user hasn't dismissed it in this session
        if (!sessionStorage.getItem('pwa_banner_dismissed')) {
            const banner = document.getElementById('pwaInstallBanner');
            if (banner) banner.classList.remove('hidden');
        }
    }
});

// Trigger Install on Button Click
async function triggerPwaInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] User choice outcome:', outcome);
        deferredPrompt = null;
        hideAllInstallPrompts();
    } else if (isIos()) {
        // Show iOS Add to Home Screen instructions
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Install on iOS',
                html: '<div style="text-align: left; font-size: 0.92rem; line-height: 1.6;">' +
                      '<p>To install <b>Coach Database</b> on your iPhone or iPad:</p>' +
                      '<ol style="margin-left: 1.2rem; margin-top: 0.6rem;">' +
                      '<li>Tap the <b>Share</b> button <i class="fa-solid fa-arrow-up-from-bracket" style="color:#38BDF8;"></i> in Safari toolbar</li>' +
                      '<li>Scroll down and tap <b>Add to Home Screen</b> <i class="fa-regular fa-square-plus" style="color:#38BDF8;"></i></li>' +
                      '<li>Tap <b>Add</b> in the top right corner</li>' +
                      '</ol></div>',
                icon: 'info',
                background: 'rgba(30, 41, 59, 0.95)',
                color: 'var(--text)',
                confirmButtonColor: 'var(--primary)',
                confirmButtonText: 'Got It'
            });
        } else {
            alert("To install on iOS: Tap Safari's Share button and select 'Add to Home Screen'.");
        }
    } else {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'App Installation',
                text: 'To install Coach DB, use your browser menu (⋮ or ...) and click "Install Coach Database" or "Add to Home screen".',
                icon: 'info',
                background: 'rgba(30, 41, 59, 0.95)',
                color: 'var(--text)',
                confirmButtonColor: 'var(--primary)'
            });
        }
    }
}

// Dismiss Install Banner
function dismissInstallBanner() {
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) banner.classList.add('hidden');
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
}

// Hide all install UI elements
function hideAllInstallPrompts() {
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) banner.classList.add('hidden');

    const headerBtn = document.getElementById('pwaHeaderInstallBtn');
    if (headerBtn) headerBtn.classList.add('hidden');

    const loginPrompt = document.getElementById('loginInstallPrompt');
    if (loginPrompt) loginPrompt.classList.add('hidden');
}

// App Installed Event
window.addEventListener('appinstalled', () => {
    console.log('[PWA] Coach Database app was successfully installed!');
    deferredPrompt = null;
    hideAllInstallPrompts();
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'App Installed!',
            text: 'Coach Database is now installed on your device. Launch it directly anytime from your home screen!',
            background: 'rgba(30, 41, 59, 0.95)',
            color: 'var(--text)',
            confirmButtonColor: 'var(--primary)',
            timer: 4000
        });
    }
});

// Network Connection Status Handling
function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    const offlineBanner = document.getElementById('offlineIndicator');

    if (offlineBanner) {
        if (!isOnline) {
            offlineBanner.classList.remove('hidden');
        } else {
            offlineBanner.classList.add('hidden');
        }
    }
}

window.addEventListener('online', () => {
    updateNetworkStatus();
    if (typeof Swal !== 'undefined') {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: 'rgba(30, 41, 59, 0.95)',
            color: 'var(--text)'
        });
        Toast.fire({
            icon: 'success',
            title: 'Back online! Sync active.'
        });
    }
});

window.addEventListener('offline', () => {
    updateNetworkStatus();
    if (typeof Swal !== 'undefined') {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 4000,
            timerProgressBar: true,
            background: 'rgba(30, 41, 59, 0.95)',
            color: 'var(--text)'
        });
        Toast.fire({
            icon: 'warning',
            title: 'Offline mode &bull; Using cached data'
        });
    }
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    updateNetworkStatus();

    // Bind PWA update button
    const updateBtn = document.getElementById('pwaUpdateBtn');
    if (updateBtn) {
        updateBtn.addEventListener('click', applyPwaUpdate);
    }

    // Bind PWA install confirm button
    const installConfirmBtn = document.getElementById('pwaInstallConfirmBtn');
    if (installConfirmBtn) {
        installConfirmBtn.addEventListener('click', triggerPwaInstall);
    }

    // Bind PWA install dismiss button
    const installDismissBtn = document.getElementById('pwaInstallDismissBtn');
    if (installDismissBtn) {
        installDismissBtn.addEventListener('click', dismissInstallBanner);
    }

    // If standalone, make sure prompts are hidden
    if (isRunningStandalone()) {
        hideAllInstallPrompts();
    } else if (isIos()) {
        // Show header install button for iOS users so they can see instructions
        const headerBtn = document.getElementById('pwaHeaderInstallBtn');
        if (headerBtn) headerBtn.classList.remove('hidden');
        const loginPrompt = document.getElementById('loginInstallPrompt');
        if (loginPrompt) loginPrompt.classList.remove('hidden');
    }
});
