/**
 * Parashakthi - Live Location Sharing Module
 */

const ShareLocationModule = (function() {
    let shareInterval = null;
    let shareId = null;

    function generateShareId() {
        return 'ps_' + Math.random().toString(36).slice(2, 12);
    }

    function startSharing() {
        shareId = generateShareId();
        const url = `${window.location.origin}${window.location.pathname}?share=${shareId}`;
        const shareLinkEl = document.getElementById('shareLink');
        if (shareLinkEl) {
            shareLinkEl.textContent = url;
            shareLinkEl.classList.remove('hidden');
        }
        const shareStatusEl = document.getElementById('shareStatus');
        if (shareStatusEl) shareStatusEl.textContent = 'Sharing active';
        const startBtn = document.getElementById('startSharing');
        if (startBtn) startBtn.classList.add('hidden');
        const stopBtn = document.getElementById('stopSharing');
        if (stopBtn) stopBtn.classList.remove('hidden');

        const emergencyLink = document.getElementById('emergencyShareLink');
        if (emergencyLink) {
            emergencyLink.textContent = url;
            emergencyLink.classList.remove('hidden');
        }

        shareInterval = setInterval(() => {
            MapModule.getUserLocation(pos => {
                if (pos && typeof FirestoreService !== 'undefined' && typeof db !== 'undefined') {
                    FirestoreService.updateSharedLocation(shareId, pos[0], pos[1]);
                }
            });
        }, 3000);
    }

    function stopSharing() {
        clearInterval(shareInterval);
        shareInterval = null;
        const shareLinkEl = document.getElementById('shareLink');
        if (shareLinkEl) shareLinkEl.classList.add('hidden');
        const shareStatusEl = document.getElementById('shareStatus');
        if (shareStatusEl) shareStatusEl.textContent = 'Share your location with trusted contacts';
        const startBtn = document.getElementById('startSharing');
        if (startBtn) startBtn.classList.remove('hidden');
        const stopBtn = document.getElementById('stopSharing');
        if (stopBtn) stopBtn.classList.add('hidden');
        const emergencyLink = document.getElementById('emergencyShareLink');
        if (emergencyLink) emergencyLink.classList.add('hidden');
    }

    function checkSharedLocation() {
        const params = new URLSearchParams(window.location.search);
        const shareIdParam = params.get('share');
        if (shareIdParam) {
            const panel = document.getElementById('liveSharePanel');
            if (panel) panel.classList.remove('hidden');
            trackSharedLocation(shareIdParam);
        }
    }

    function trackSharedLocation(id) {
        const map = MapModule.getMap();
        if (!map) return;
        const marker = L.marker([0, 0], {
            icon: L.divIcon({
                className: 'shared-location-marker',
                html: '<div style="background:#6366f1;width:14px;height:14px;border-radius:50%;border:2px solid white;animation:pulse 1s infinite"></div>',
                iconSize: [18, 18]
            })
        }).addTo(map);

        const updatePos = () => {
            FirestoreService.getSharedLocation(id, data => {
                if (data && data.lat && data.lng) {
                    marker.setLatLng([data.lat, data.lng]);
                    map.setView([data.lat, data.lng], 16);
                }
            });
        };
        updatePos();
        setInterval(updatePos, 3000);
    }

    return {
        startSharing,
        stopSharing,
        checkSharedLocation
    };
})();
