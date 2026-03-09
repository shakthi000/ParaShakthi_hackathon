/**
 * Parashakthi - Main Application Controller
 * SPA navigation and section management
 */

(function() {
    let currentRouteData = null;
    let nightModeActive = false;
    let reportMapPicker = null;
    let reportSelectedLatLng = null;
    let routesMapPreview = null;
    let routesPreviewLayers = null;
    let lastKnownSosLocation = null;

    const EMERGENCY_CONTACTS_KEY = 'parashakthi_emergency_contacts';

    // -------------------- Emergency Contacts Storage --------------------

    function getEmergencyContacts() {
        try {
            const raw = localStorage.getItem(EMERGENCY_CONTACTS_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('Failed to read emergency contacts', e);
            return [];
        }
    }

    function saveEmergencyContacts(contacts) {
        try {
            localStorage.setItem(EMERGENCY_CONTACTS_KEY, JSON.stringify(contacts || []));
        } catch (e) {
            console.error('Failed to save emergency contacts', e);
        }
        renderEmergencyContacts();
    }

    function normalizePhoneNumber(phone) {
        if (!phone) return '';
        return phone.replace(/[^\d]/g, '');
    }

    function addEmergencyContact(name, phone, details) {
        const trimmedName = (name || '').trim();
        const trimmedPhone = (phone || '').trim();
        const cleanedPhone = normalizePhoneNumber(trimmedPhone);
        const info = (details || '').trim();

        if (!trimmedName || !cleanedPhone) {
            alert('Please provide both a name and a valid phone number.');
            return;
        }

        if (cleanedPhone.length < 6) {
            alert('Please enter a valid phone number with country code.');
            return;
        }

        const contacts = getEmergencyContacts();
        contacts.push({ name: trimmedName, phone: cleanedPhone, details: info });
        saveEmergencyContacts(contacts);
    }

    function deleteEmergencyContact(index) {
        const contacts = getEmergencyContacts();
        if (index < 0 || index >= contacts.length) return;
        contacts.splice(index, 1);
        saveEmergencyContacts(contacts);
    }

    // Expose core APIs globally for safety / HTML usage
    window.getEmergencyContacts = getEmergencyContacts;
    window.saveEmergencyContacts = saveEmergencyContacts;
    window.addEmergencyContact = addEmergencyContact;
    window.deleteEmergencyContact = deleteEmergencyContact;

    function init() {
        MapModule.init();
        IncidentsModule.init();

        setupNavigation();
        setupMapSection();
        setupReportSection();
        setupRoutesSection();
        setupEmergencySection();
        setupDashboardSection();

        setupNightMode();
        seedDemoData();

        ShareLocationModule.checkSharedLocation();

        // Show map section by default
        showSection('mapSection');
    }

    function setupNavigation() {
        document.querySelectorAll('.nav-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                if (page) showSection(page);
            });
        });
    }

    function showSection(sectionId) {
        document.querySelectorAll('.app-section').forEach(sec => {
            sec.classList.remove('active');
        });
        document.querySelectorAll('.nav-link[data-page]').forEach(link => {
            link.classList.toggle('active', link.dataset.page === sectionId);
        });

        const section = document.getElementById(sectionId);
        if (section) section.classList.add('active');

        if (sectionId === 'mapSection') {
            setTimeout(() => {
                const map = MapModule.getMap();
                if (map) map.invalidateSize();
            }, 100);
        } else if (sectionId === 'reportSection') {
            initReportMapPicker();
            setTimeout(() => reportMapPicker?.invalidateSize?.(), 150);
        } else if (sectionId === 'routesSection') {
            initRoutesMapPreview();
            setTimeout(() => routesMapPreview?.invalidateSize?.(), 150);
        } else if (sectionId === 'dashboardSection') {
            DashboardModule?.refresh?.();
        }
    }

    function setupMapSection() {
        document.getElementById('searchRoute')?.addEventListener('click', handleRouteSearch);
        document.getElementById('toggleHeatmap')?.addEventListener('click', () => {
            FirestoreService.getIncidents(incidents => {
                HeatmapModule.updateFromIncidents(incidents);
                HeatmapModule.toggle();
            });
        });
        document.getElementById('toggleSafeZones')?.addEventListener('click', () => SafeZonesModule.toggle());
        document.getElementById('toggleIncidents')?.addEventListener('click', () => IncidentsModule.toggleMarkers());
        document.getElementById('locateMe')?.addEventListener('click', () => MapModule.centerOnUser());
        document.getElementById('toggleLiveShare')?.addEventListener('click', () => {
            document.getElementById('liveSharePanel')?.classList.toggle('hidden');
        });
        document.getElementById('startSharing')?.addEventListener('click', () => ShareLocationModule.startSharing());
        document.getElementById('stopSharing')?.addEventListener('click', () => ShareLocationModule.stopSharing());

        document.getElementById('toggleAiRisk')?.addEventListener('click', () => {
            try {
                if (typeof AiDangerPredictionModule !== 'undefined') {
                    AiDangerPredictionModule.toggle();
                }
            } catch (e) {
                console.error('Failed to toggle AI risk prediction', e);
            }
        });

        setupAreaRating();
        setupIncidentFilters();
        updateSafetyStats();
        setInterval(updateSafetyStats, 10000);
    }

    function setupReportSection() {
        document.getElementById('reportPageForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = document.getElementById('reportType')?.value;
            const severity = document.getElementById('reportSeverity')?.value;
            const comment = document.getElementById('reportComment')?.value?.trim() || '';
            if (!type || !reportSelectedLatLng) {
                alert('Please select a location on the map');
                return;
            }
            await IncidentsModule.submitIncident({
                type,
                lat: reportSelectedLatLng.lat,
                lng: reportSelectedLatLng.lng,
                severity: severity || 'medium',
                comment
            });
            alert('Report submitted. Thank you for helping keep our community safe.');
            document.getElementById('reportPageForm').reset();
            reportSelectedLatLng = null;
            document.getElementById('reportLocationDisplay')?.classList.add('hidden');
        });
    }

    function initReportMapPicker() {
        const el = document.getElementById('reportMapPicker');
        if (!el || reportMapPicker) return;
        reportMapPicker = L.map('reportMapPicker', {
            center: MapModule.CHENNAI_CENTER,
            zoom: 13
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(reportMapPicker);
        reportMapPicker.on('click', (e) => {
            reportSelectedLatLng = e.latlng;
            document.getElementById('reportLocationDisplay')?.classList.remove('hidden');
            if (window.reportPickerMarker) reportPickerMarker.remove();
            window.reportPickerMarker = L.marker(e.latlng).addTo(reportMapPicker);
        });
    }

    function setupRoutesSection() {
        document.getElementById('routesSearchBtn')?.addEventListener('click', handleRoutesSearch);
        document.getElementById('routesViewOnMap')?.addEventListener('click', () => {
            showSection('mapSection');
            document.getElementById('startLocation').value = document.getElementById('routesStart')?.value || '';
            document.getElementById('destination').value = document.getElementById('routesDest')?.value || '';
            setTimeout(() => document.getElementById('searchRoute')?.click(), 300);
        });
    }

    function initRoutesMapPreview() {
        const el = document.getElementById('routesMapPreview');
        if (!el || routesMapPreview) return;
        routesMapPreview = L.map('routesMapPreview', {
            center: MapModule.CHENNAI_CENTER,
            zoom: 13
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(routesMapPreview);
    }

    async function handleRoutesSearch() {
        const start = document.getElementById('routesStart')?.value?.trim();
        const dest = document.getElementById('routesDest')?.value?.trim();
        if (!start || !dest) {
            alert('Enter start and destination');
            return;
        }
        try {
            const result = await RoutingModule.searchAndDraw(start, dest);
            currentRouteData = result;
            document.getElementById('routesResult')?.classList.remove('hidden');
            document.getElementById('routesDistance').textContent = `Distance: ${RoutingModule.parseDistance(result.distance)}`;
            document.getElementById('routesDuration').textContent = `ETA: ${RoutingModule.parseDuration(result.duration)}`;
            const routeCoords = result.coordinates.map(c => ({ lat: c[0], lng: c[1] }));
            const score = await SafetyScoreModule.calculateRouteScore(routeCoords);
            const color = SafetyScoreModule.getScoreColor(score);
            const scoreEl = document.getElementById('routesScore');
            if (scoreEl) {
                scoreEl.textContent = `${score}/5`;
                scoreEl.style.color = color;
            }
            if (routesMapPreview) {
                if (routesPreviewLayers) routesMapPreview.removeLayer(routesPreviewLayers);
                routesPreviewLayers = L.layerGroup();
                const coords = result.coordinates.map(c => [c[0], c[1]]);
                L.polyline(coords, { color, weight: 5 }).addTo(routesPreviewLayers);
                L.marker(result.start).addTo(routesPreviewLayers).bindPopup('Start');
                L.marker(result.end).addTo(routesPreviewLayers).bindPopup('Destination');
                routesPreviewLayers.addTo(routesMapPreview);
                routesMapPreview.fitBounds(L.latLngBounds(coords), { padding: [20, 20] });
            }
        } catch (err) {
            console.error(err);
            alert('Could not find route.');
        }
    }

    function setupEmergencySection() {
        document.getElementById('emergencySosBtn')?.addEventListener('click', handleSOS);
        document.getElementById('emergencyCopyAlert')?.addEventListener('click', handleCopyAlert);
        document.getElementById('emergencyStartShare')?.addEventListener('click', () => {
            ShareLocationModule.startSharing();
            document.getElementById('emergencyStopShare')?.classList.remove('hidden');
        });
        document.getElementById('emergencyStopShare')?.addEventListener('click', () => {
            ShareLocationModule.stopSharing();
            document.getElementById('emergencyStopShare').classList.add('hidden');
            document.getElementById('emergencyShareLink').classList.add('hidden');
        });
        document.getElementById('emergencyLoadZones')?.addEventListener('click', () => {
            showSection('mapSection');
            MapModule.getUserLocation(pos => {
                if (pos) {
                    const map = MapModule.getMap();
                    if (map) map.setView(pos, 15);
                    SafeZonesModule.loadSafeZones(true);
                }
            });
        });

        // Emergency contacts UI
        document.getElementById('addEmergencyContactBtn')?.addEventListener('click', () => {
            const modal = document.getElementById('emergencyContactModal');
            if (modal) modal.classList.remove('hidden');
            const nameInput = document.getElementById('contactName');
            const phoneInput = document.getElementById('contactPhone');
            const detailsInput = document.getElementById('contactDetails');
            if (nameInput) nameInput.value = '';
            if (phoneInput) phoneInput.value = '';
            if (detailsInput) detailsInput.value = '';
            nameInput?.focus();
        });

        document.getElementById('emergencyContactCancel')?.addEventListener('click', () => {
            const modal = document.getElementById('emergencyContactModal');
            if (modal) modal.classList.add('hidden');
        });

        document.getElementById('emergencyContactForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('contactName')?.value;
            const phone = document.getElementById('contactPhone')?.value;
            const details = document.getElementById('contactDetails')?.value;
            addEmergencyContact(name, phone, details);
            const modal = document.getElementById('emergencyContactModal');
            if (modal) modal.classList.add('hidden');
        });

        renderEmergencyContacts();

        // Initialize Community Guardian Network and Evidence Capture UI
        try {
            if (typeof GuardianNetworkModule !== 'undefined') {
                GuardianNetworkModule.initUi();
            }
        } catch (e) {
            console.error('Failed to initialize Guardian Network UI', e);
        }

        try {
            if (typeof EvidenceCaptureModule !== 'undefined') {
                EvidenceCaptureModule.initUi();
            }
        } catch (e) {
            console.error('Failed to initialize Evidence Capture UI', e);
        }
    }

    function setupDashboardSection() {
        // DashboardModule handles its own init
    }

    async function handleRouteSearch() {
        const start = document.getElementById('startLocation')?.value?.trim();
        const dest = document.getElementById('destination')?.value?.trim();
        if (!start || !dest) {
            alert('Enter start and destination');
            return;
        }
        try {
            const result = await RoutingModule.searchAndDraw(start, dest);
            currentRouteData = result;
            document.getElementById('routeInfo')?.classList.remove('hidden');
            document.getElementById('routeDistance').textContent = `Distance: ${RoutingModule.parseDistance(result.distance)}`;
            document.getElementById('routeDuration').textContent = `ETA: ${RoutingModule.parseDuration(result.duration)}`;
            const routeCoords = result.coordinates.map(c => ({ lat: c[0], lng: c[1] }));
            const score = await SafetyScoreModule.calculateRouteScore(routeCoords);
            const color = SafetyScoreModule.getScoreColor(score);
            document.getElementById('routeSafetyScore').textContent = `${score}/5`;
            document.getElementById('routeSafetyScore').style.color = color;
            RoutingModule.drawRoute(result.route, { start: result.start, end: result.end, color });
        } catch (err) {
            console.error(err);
            alert('Could not find route.');
        }
    }

    // -------------------- SOS Helpers & Logic --------------------

    function withSosLocation(callback) {
        if (lastKnownSosLocation) {
            callback(lastKnownSosLocation);
            return;
        }
        MapModule.getUserLocation(pos => {
            if (pos) {
                lastKnownSosLocation = pos;
            }
            callback(lastKnownSosLocation);
        });
    }

    function buildSosMessage(pos) {
        if (pos && Array.isArray(pos) && pos.length === 2) {
            const lat = pos[0];
            const lng = pos[1];
            return [
                '🚨 EMERGENCY ALERT',
                'I need help.',
                '',
                'My location:',
                `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
                '',
                'Please come immediately.'
            ].join('\n');
        }

        return [
            '🚨 EMERGENCY ALERT',
            'I need help.',
            '',
            'My location could not be determined.',
            '',
            'Please come immediately.'
        ].join('\n');
    }

    function handleSOS() {
        const modal = document.getElementById('sosModal');
        if (!modal) return;
        modal.classList.remove('hidden');

        const sosLocationEl = document.getElementById('sosLocation');
        const sosNearbyEl = document.getElementById('sosNearby');
        const selectionEl = document.getElementById('sosContactsSelection');

        if (sosLocationEl) sosLocationEl.textContent = 'Getting location...';
        if (sosNearbyEl) sosNearbyEl.innerHTML = '';
        if (selectionEl) selectionEl.classList.add('hidden');

        // Start automatic evidence capture without blocking SOS flow
        try {
            if (typeof EvidenceCaptureModule !== 'undefined') {
                EvidenceCaptureModule.startCapture();
            }
        } catch (e) {
            console.error('Failed to start evidence capture', e);
        }

        withSosLocation(pos => {
            if (pos) {
                if (sosLocationEl) {
                    sosLocationEl.textContent = `Your location: ${pos[0].toFixed(4)}, ${pos[1].toFixed(4)}`;
                }
                showSection('mapSection');
                setTimeout(() => {
                    const map = MapModule.getMap();
                    if (map) map.setView(pos, 15);
                    SafeZonesModule.loadSafeZones(true);
                    if (sosNearbyEl) {
                        sosNearbyEl.innerHTML = '<p class="text-slate-300">Nearest safe zones loaded on map.</p>';
                    }
                }, 100);

                // Notify nearby guardians asynchronously
                try {
                    if (typeof GuardianNetworkModule !== 'undefined') {
                        // fire-and-forget; do not block SOS UX
                        setTimeout(() => {
                            try {
                                GuardianNetworkModule.notifyGuardians(pos);
                            } catch (e) {
                                console.error('Failed to notify guardians', e);
                            }
                        }, 0);
                    }
                } catch (e) {
                    console.error('Guardian notification error', e);
                }
            } else if (sosLocationEl) {
                sosLocationEl.textContent = 'Location unavailable';
            }
        });
    }

    function handleCopyAlert() {
        withSosLocation(pos => {
            const msg = buildSosMessage(pos);
            if (!navigator.clipboard) {
                alert('Copy is not supported in this browser.');
                return;
            }
            navigator.clipboard.writeText(msg).then(
                () => alert('Emergency alert text copied to clipboard.'),
                () => alert('Could not copy alert text.')
            );
        });
    }

    function openWhatsAppForContacts(contacts) {
        if (!contacts || !contacts.length) {
            alert('No emergency contacts selected.');
            return;
        }

        withSosLocation(pos => {
            const message = buildSosMessage(pos);
            const encodedMsg = encodeURIComponent(message);

            contacts.forEach(contact => {
                const cleanedPhone = normalizePhoneNumber(contact.phone);
                if (!cleanedPhone) return;
                const url = `https://wa.me/${cleanedPhone}?text=${encodedMsg}`;
                window.open(url, '_blank');
            });
        });
    }

    function handleSosSendAll() {
        const contacts = getEmergencyContacts();
        if (!contacts.length) {
            alert('No emergency contacts added. Please add a contact first.');
            return;
        }
        openWhatsAppForContacts(contacts);
    }

    function renderSosContactsSelection() {
        const container = document.getElementById('sosContactsCheckboxList');
        if (!container) return;
        const contacts = getEmergencyContacts();

        if (!contacts.length) {
            container.innerHTML = '<p class="text-xs text-slate-400">No emergency contacts added yet.</p>';
            return;
        }

        container.innerHTML = '';
        contacts.forEach((c, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'flex items-start gap-2';
            wrapper.innerHTML = `
                <input type="checkbox" class="mt-1 accent-emerald-500 sos-contact-checkbox" data-index="${index}">
                <div>
                    <p class="font-medium text-slate-100 text-sm">${c.name}</p>
                    <p class="text-xs text-slate-300">+${c.phone}</p>
                    ${c.details ? `<p class="text-[0.7rem] text-slate-400">${c.details}</p>` : ''}
                </div>
            `;
            container.appendChild(wrapper);
        });
    }

    function handleSosSendSelectedInit() {
        const contacts = getEmergencyContacts();
        if (!contacts.length) {
            alert('No emergency contacts added. Please add a contact first.');
            return;
        }
        renderSosContactsSelection();
        const selectionEl = document.getElementById('sosContactsSelection');
        if (selectionEl) selectionEl.classList.remove('hidden');
    }

    function handleSosSendSelectedConfirm() {
        const checkboxes = document.querySelectorAll('.sos-contact-checkbox:checked');
        if (!checkboxes.length) {
            alert('Please select at least one contact.');
            return;
        }
        const contacts = getEmergencyContacts();
        const selected = [];
        checkboxes.forEach(cb => {
            const idx = parseInt(cb.getAttribute('data-index'), 10);
            if (!isNaN(idx) && contacts[idx]) {
                selected.push(contacts[idx]);
            }
        });
        if (!selected.length) {
            alert('No valid contacts selected.');
            return;
        }
        openWhatsAppForContacts(selected);
    }

    function renderEmergencyContacts() {
        const list = document.getElementById('emergencyContactsList');
        if (!list) return;
        const contacts = getEmergencyContacts();

        if (!contacts.length) {
            list.innerHTML = '<p class="text-sm text-slate-400">No emergency contacts added yet. Use the "Add Emergency Contact" button above to add someone you trust.</p>';
            return;
        }

        list.innerHTML = '';
        contacts.forEach((c, index) => {
            const card = document.createElement('div');
            card.className = 'flex items-start justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3';
            card.innerHTML = `
                <div class="text-sm">
                    <p class="font-semibold text-slate-100">${c.name}</p>
                    <p class="text-slate-300 text-xs mt-1">Phone: +${c.phone}</p>
                    ${c.details ? `<p class="text-slate-400 text-xs mt-1">Details: ${c.details}</p>` : ''}
                </div>
                <button class="text-xs px-2 py-1 rounded-md bg-red-600/80 hover:bg-red-500 text-white delete-emergency-contact" data-index="${index}">
                    Delete
                </button>
            `;
            list.appendChild(card);
        });

        list.querySelectorAll('.delete-emergency-contact').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                deleteEmergencyContact(idx);
            });
        });
    }

    // Attach any HTML-accessed helpers to window to avoid scope issues
    window.handleSOS = handleSOS;
    window.handleCopyAlert = handleCopyAlert;
    window.promptAddContact = function() {
        const btn = document.getElementById('addEmergencyContactBtn');
        btn?.click();
    };

    // Global listeners that rely on the handlers above
    document.getElementById('closeSos')?.addEventListener('click', () => {
        document.getElementById('sosModal')?.classList.add('hidden');
        try {
            if (typeof EvidenceCaptureModule !== 'undefined') {
                EvidenceCaptureModule.stopRecording();
            }
        } catch (e) {
            console.error('Failed to stop evidence recording', e);
        }
    });
    document.getElementById('copyAlert')?.addEventListener('click', handleCopyAlert);
    document.getElementById('sosButton')?.addEventListener('click', handleSOS);
    document.getElementById('sosSendAllBtn')?.addEventListener('click', handleSosSendAll);
    document.getElementById('sosSendSelectedBtn')?.addEventListener('click', handleSosSendSelectedInit);
    document.getElementById('sosSendSelectedConfirmBtn')?.addEventListener('click', handleSosSendSelectedConfirm);

    function setupAreaRating() {
        document.querySelectorAll('#areaRating span').forEach(star => {
            star.addEventListener('click', () => {
                const rating = parseInt(star.dataset.rating);
                document.querySelectorAll('#areaRating span').forEach((s, i) => {
                    s.classList.toggle('active', i < rating);
                    s.classList.toggle('rated', i < rating);
                });
                const center = MapModule.getCenter();
                if (center) FirestoreService.addRating({ lat: center.lat, lng: center.lng, rating });
            });
        });
    }

    function setupIncidentFilters() {
        document.querySelectorAll('[data-incident-filter]').forEach(cb => {
            cb.addEventListener('change', () => {
                const set = new Set();
                document.querySelectorAll('[data-incident-filter]:checked').forEach(c => set.add(c.value));
                IncidentsModule.setActiveTypes(set);
            });
        });
        const set = new Set();
        document.querySelectorAll('[data-incident-filter]:checked').forEach(c => set.add(c.value));
        IncidentsModule.setActiveTypes(set);
    }

    async function updateSafetyStats() {
        if (!document.getElementById('mapSection')?.classList.contains('active')) return;
        const center = MapModule.getCenterLatLng();
        const [incidents, ratings] = await Promise.all([
            new Promise(r => FirestoreService.getIncidents(r)),
            new Promise(r => FirestoreService.getRatings(r))
        ]);
        const nearby = incidents.filter(i => {
            const d = haversine(center[0], center[1], i.lat ?? i.latitude, i.lng ?? i.longitude);
            return d < 0.5;
        });
        const countEl = document.getElementById('incidentCount');
        if (countEl) countEl.textContent = nearby.length;
        const R = 6371;
        const nearbyRatings = ratings.filter(r => {
            const d = haversine(center[0], center[1], r.lat, r.lng);
            return d < 0.3;
        });
        const avgRating = nearbyRatings.length
            ? (nearbyRatings.reduce((s, r) => s + r.rating, 0) / nearbyRatings.length).toFixed(1)
            : '--';
        const ratingEl = document.getElementById('areaRatingDisplay');
        if (ratingEl) ratingEl.textContent = avgRating;
    }

    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    function setupNightMode() {
        document.getElementById('nightModeToggle')?.addEventListener('click', () => {
            nightModeActive = !nightModeActive;
            document.getElementById('nightWarning')?.classList.toggle('hidden', !nightModeActive);
        });
        if (new Date().getHours() >= 20 || new Date().getHours() < 6) {
            nightModeActive = true;
            document.getElementById('nightWarning')?.classList.remove('hidden');
        }
    }

    function seedDemoData() {
        const stored = localStorage.getItem('parashakthi_incidents');
        if (stored && JSON.parse(stored).length > 0) return;
        const demo = [
            { type: 'poor_lighting', lat: 13.0827, lng: 80.2707, severity: 'medium' },
            { type: 'harassment', lat: 13.0830, lng: 80.2710, severity: 'high' },
            { type: 'unsafe_street', lat: 13.0820, lng: 80.2700, severity: 'medium' }
        ];
        demo.forEach(d => {
            const items = JSON.parse(localStorage.getItem('parashakthi_incidents') || '[]');
            items.push({ ...d, id: Date.now().toString(), timestamp: new Date().toISOString() });
            localStorage.setItem('parashakthi_incidents', JSON.stringify(items));
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
