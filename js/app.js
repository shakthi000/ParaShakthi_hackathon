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

    function handleSOS() {
        document.getElementById('sosModal')?.classList.remove('hidden');
        document.getElementById('sosLocation').textContent = 'Getting location...';
        MapModule.getUserLocation(pos => {
            if (pos) {
                document.getElementById('sosLocation').textContent = `Your location: ${pos[0].toFixed(4)}, ${pos[1].toFixed(4)}`;
                showSection('mapSection');
                setTimeout(() => {
                    const map = MapModule.getMap();
                    if (map) map.setView(pos, 15);
                    SafeZonesModule.loadSafeZones(true);
                    document.getElementById('sosNearby').innerHTML = '<p class="text-slate-300">Nearest safe zones loaded on map.</p>';
                }, 100);
            } else {
                document.getElementById('sosLocation').textContent = 'Location unavailable';
            }
        });
    }

    document.getElementById('closeSos')?.addEventListener('click', () => document.getElementById('sosModal')?.classList.add('hidden'));
    document.getElementById('copyAlert')?.addEventListener('click', handleCopyAlert);
    document.getElementById('sosButton')?.addEventListener('click', handleSOS);

    function handleCopyAlert() {
        MapModule.getUserLocation(pos => {
            const msg = pos
                ? `SOS - I need help! Location: https://www.openstreetmap.org/?mlat=${pos[0]}&mlon=${pos[1]}#map=17/${pos[0]}/${pos[1]}`
                : 'SOS - I need help! Location unavailable.';
            navigator.clipboard?.writeText(msg).then(() => alert('Alert copied to clipboard'));
        });
    }

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
