/**
 * Parashakthi - Community Guardian Network
 *
 * Lightweight localStorage-backed demo of "Safety Guardians" who
 * can opt in to help nearby users in emergencies.
 *
 * This module does not modify the existing SOS contact system.
 */

const GuardianNetworkModule = (function() {
    const STORAGE_KEY = 'parashakthi_guardians';
    let guardians = [];
    let guardianMarkersLayer = null;

    function loadGuardians() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            guardians = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(guardians)) guardians = [];
        } catch (e) {
            console.warn('Failed to read guardians from storage', e);
            guardians = [];
        }
    }

    function saveGuardians() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(guardians || []));
        } catch (e) {
            console.warn('Failed to save guardians to storage', e);
        }
    }

    function ensureLayer() {
        const map = MapModule.getMap();
        if (!map) return null;
        if (!guardianMarkersLayer) {
            guardianMarkersLayer = L.layerGroup();
            guardianMarkersLayer.addTo(map);
            window.guardianMarkersLayer = guardianMarkersLayer;
        }
        return guardianMarkersLayer;
    }

    function renderMarkers() {
        const layer = ensureLayer();
        const map = MapModule.getMap();
        if (!layer || !map) return;

        layer.clearLayers();

        (guardians || []).forEach(g => {
            if (!g.active) return;
            if (typeof g.lat !== 'number' || typeof g.lng !== 'number') return;

            const marker = L.marker([g.lat, g.lng], {
                icon: L.divIcon({
                    className: 'guardian-marker',
                    html: '<div style="background:#1d4ed8;width:18px;height:18px;border-radius:50%;border:3px solid #93c5fd;box-shadow:0 2px 5px rgba(0,0,0,0.4)"></div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            });

            marker.bindTooltip(
                'Community Guardian\nReady to help nearby users',
                { direction: 'top' }
            );

            layer.addLayer(marker);
        });
    }

    function updateGuardianStatusText() {
        const statusEl = document.getElementById('guardianStatus');
        if (!statusEl) return;
        const anyActive = (guardians || []).some(g => g.active);
        statusEl.textContent = anyActive
            ? 'Guardian mode is ACTIVE on this device.'
            : 'Guardian mode is currently inactive.';
    }

    function becomeGuardian() {
        const map = MapModule.getMap();
        if (!map || !navigator.geolocation) {
            alert('Location services are not available in this browser.');
            return;
        }

        const name = (prompt('Enter your name to become a Community Guardian:') || '').trim();
        if (!name) return;

        const phone = (prompt('Optional: Enter a phone number (for your reference):') || '').trim();

        MapModule.getUserLocation(pos => {
            if (!pos) {
                alert('Could not determine your location. Guardian mode not enabled.');
                return;
            }

            loadGuardians();

            const guardian = {
                name,
                phone,
                lat: pos[0],
                lng: pos[1],
                active: true,
                createdAt: new Date().toISOString()
            };

            // For this demo, we only keep one active guardian entry per device.
            guardians = (guardians || []).filter(g => !g._localDevice);
            guardian._localDevice = true;
            guardians.push(guardian);
            saveGuardians();
            renderMarkers();
            updateGuardianStatusText();
            alert('You are now a Community Guardian. Your location is visible on the map.');
        });
    }

    function disableGuardian() {
        loadGuardians();
        let changed = false;
        guardians = (guardians || []).map(g => {
            if (g._localDevice && g.active) {
                changed = true;
                return { ...g, active: false };
            }
            return g;
        });
        if (!changed) {
            alert('Guardian mode is already inactive on this device.');
            return;
        }
        saveGuardians();
        renderMarkers();
        updateGuardianStatusText();
        alert('Guardian mode disabled for this device.');
    }

    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function notifyGuardians(emergencyPos) {
        if (!emergencyPos || emergencyPos.length !== 2) return;
        loadGuardians();

        const [lat, lng] = emergencyPos;
        const nearby = (guardians || []).filter(g => {
            if (!g.active) return false;
            if (typeof g.lat !== 'number' || typeof g.lng !== 'number') return false;
            const d = haversine(lat, lng, g.lat, g.lng);
            return d <= 1; // within 1 km
        });

        if (!nearby.length) {
            return;
        }

        const closest = nearby.reduce((best, g) => {
            const d = haversine(lat, lng, g.lat, g.lng);
            if (!best || d < best.distance) {
                return { guardian: g, distance: d };
            }
            return best;
        }, null);

        const distanceMeters = Math.round(closest.distance * 1000);
        const messageLines = [
            'Emergency Nearby',
            'Someone needs help.',
            '',
            `Distance: ${distanceMeters} m`
        ];
        const msg = messageLines.join('\n');

        const view = confirm(`${msg}\n\nView Location on Map?`);
        if (view) {
            const map = MapModule.getMap();
            if (map) {
                map.setView([lat, lng], 16);
            }
        }
    }

    function initUi() {
        loadGuardians();
        renderMarkers();
        updateGuardianStatusText();

        const becomeBtn = document.getElementById('becomeGuardianBtn');
        const disableBtn = document.getElementById('disableGuardianBtn');

        if (becomeBtn) {
            becomeBtn.addEventListener('click', () => {
                try {
                    becomeGuardian();
                } catch (e) {
                    console.error('Failed to enable guardian mode', e);
                }
            });
        }

        if (disableBtn) {
            disableBtn.addEventListener('click', () => {
                try {
                    disableGuardian();
                } catch (e) {
                    console.error('Failed to disable guardian mode', e);
                }
            });
        }
    }

    return {
        initUi,
        notifyGuardians,
        getLayer: () => guardianMarkersLayer
    };
})();

