/**
 * Parashakthi - Incident Reporting & Visualization
 * - Map click to report incidents
 * - Severity-based markers with pulsing high severity
 * - Marker clustering and filtering
 */

const IncidentsModule = (function() {
    let clusterGroup = null;
    let incidentsVisible = true;
    let currentIncidentLatLng = null;
    let allIncidents = [];
    let activeTypes = new Set([
        'harassment',
        'unsafe_street',
        'poor_lighting',
        'theft',
        'suspicious_activity'
    ]);
    let ratingsCache = [];

    function init() {
        const map = MapModule.getMap();
        if (!map) return;

        clusterGroup = L.markerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 50,
            disableClusteringAtZoom: 17
        });
        map.addLayer(clusterGroup);

        MapModule.onMapClick(e => {
            currentIncidentLatLng = e.latlng;
            showReportPopup(e.latlng);
        });

        FirestoreService.getRatings(r => {
            ratingsCache = r || [];
        });

        FirestoreService.subscribeIncidents(incidents => {
            allIncidents = incidents || [];
            renderMarkers();
            if (typeof HeatmapModule !== 'undefined') {
                HeatmapModule.updateFromIncidents(allIncidents);
            }
        });
    }

    function showReportPopup(latlng) {
        const map = MapModule.getMap();
        const template = document.getElementById('incidentPopupTemplate');
        if (!template || !template.content) return;

        const wrapper = document.createElement('div');
        wrapper.appendChild(template.content.cloneNode(true));

        const form = wrapper.querySelector('#incidentForm');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const type = wrapper.querySelector('#incidentType')?.value;
                const severity = wrapper.querySelector('#incidentSeverity')?.value || 'medium';
                const comment = wrapper.querySelector('#incidentComment')?.value?.trim() || '';
                if (!type || !currentIncidentLatLng) return;

                await submitIncident({
                    type,
                    lat: currentIncidentLatLng.lat,
                    lng: currentIncidentLatLng.lng,
                    severity,
                    comment
                });
                map.closePopup();
                currentIncidentLatLng = null;
            };
        }

        L.popup().setLatLng(latlng).setContent(wrapper).openOn(map);
    }

    async function submitIncident(data) {
        const hasDb = typeof db !== 'undefined' && db;
        if (hasDb) {
            await FirestoreService.addIncident(data);
        } else {
            const items = JSON.parse(localStorage.getItem('parashakthi_incidents') || '[]');
            items.push({
                ...data,
                id: Date.now().toString(),
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('parashakthi_incidents', JSON.stringify(items));
            FirestoreService.getIncidents(incidents => {
                allIncidents = incidents || [];
                renderMarkers();
                if (typeof HeatmapModule !== 'undefined') {
                    HeatmapModule.updateFromIncidents(allIncidents);
                }
            });
        }
    }

    function buildPopupHtml(inc) {
        const typeLabel = (inc.type || 'incident').replace(/_/g, ' ');
        const severity = (inc.severity || 'medium').toUpperCase();
        const ts = inc.timestamp instanceof Date
            ? inc.timestamp
            : new Date(inc.timestamp || Date.now());
        const dateStr = ts.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
        const lat = inc.lat ?? inc.latitude;
        const lng = inc.lng ?? inc.longitude;
        const rating = getAreaSafetyRating(lat, lng);
        const comment = inc.comment && inc.comment.trim()
            ? inc.comment.trim()
            : 'No additional details provided.';

        const sevClass = severity === 'HIGH' ? 'text-red-500' : 'text-amber-500';

        return `
            <div class="p-2 text-sm">
                <h3 class="font-bold ${sevClass} mb-1">Reported Incident</h3>
                <p><span class="font-semibold">Type:</span> ${typeLabel}</p>
                <p><span class="font-semibold">Severity:</span> ${severity}</p>
                <p><span class="font-semibold">Date:</span> ${dateStr}</p>
                <p><span class="font-semibold">Area Safety Rating:</span> ${rating ? rating.toFixed(1) + ' / 5' : 'N/A'}</p>
                <p class="mt-1"><span class="font-semibold">Comments:</span> ${comment}</p>
            </div>
        `;
    }

    function getAreaSafetyRating(lat, lng) {
        if (!ratingsCache?.length || lat == null || lng == null) return null;
        const R = 6371;
        const nearby = ratingsCache.filter(r => {
            const dlat = (r.lat - lat) * Math.PI / 180;
            const dlon = (r.lng - lng) * Math.PI / 180;
            const a =
                Math.sin(dlat / 2) ** 2 +
                Math.cos(lat * Math.PI / 180) *
                Math.cos(r.lat * Math.PI / 180) *
                Math.sin(dlon / 2) ** 2;
            const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return d <= 0.3;
        });
        if (!nearby.length) return null;
        return nearby.reduce((sum, r) => sum + r.rating, 0) / nearby.length;
    }

    function renderMarkers() {
        if (!clusterGroup) return;
        clusterGroup.clearLayers();

        if (!incidentsVisible) return;

        (allIncidents || []).forEach(inc => {
            const type = inc.type || 'other';
            if (!activeTypes.has(type)) return;
            const lat = inc.lat ?? inc.latitude;
            const lng = inc.lng ?? inc.longitude;
            if (lat == null || lng == null) return;

            const sev = (inc.severity || 'medium').toLowerCase();
            const size = sev === 'high' ? 28 : sev === 'medium' ? 22 : 16;
            const sevClass =
                sev === 'high' ? 'severity-high' :
                sev === 'medium' ? 'severity-medium' :
                'severity-low';
            const pulseClass = sev === 'high' ? ' pulse-marker' : '';

            const html = `<div class="incident-dot ${sevClass}${pulseClass}"></div>`;

            const marker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className: 'incident-marker',
                    html,
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size / 2]
                })
            });

            marker.bindPopup(buildPopupHtml(inc));
            clusterGroup.addLayer(marker);
        });
    }

    function toggleMarkers() {
        incidentsVisible = !incidentsVisible;
        if (!clusterGroup) return incidentsVisible;
        const map = MapModule.getMap();
        if (map) {
            if (incidentsVisible) {
                map.addLayer(clusterGroup);
            } else {
                map.removeLayer(clusterGroup);
            }
        }
        return incidentsVisible;
    }

    function setActiveTypes(set) {
        if (set && set.size) {
            activeTypes = set;
            renderMarkers();
        }
    }

    function getIncidentsNear(lat, lng, radiusKm = 0.5) {
        return new Promise(resolve => {
            FirestoreService.getIncidents(incidents => {
                const R = 6371;
                const nearby = (incidents || []).filter(inc => {
                    const ilat = inc.lat ?? inc.latitude;
                    const ilng = inc.lng ?? inc.longitude;
                    const dlat = (ilat - lat) * Math.PI / 180;
                    const dlon = (ilng - lng) * Math.PI / 180;
                    const a =
                        Math.sin(dlat / 2) ** 2 +
                        Math.cos(lat * Math.PI / 180) *
                        Math.cos(ilat * Math.PI / 180) *
                        Math.sin(dlon / 2) ** 2;
                    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    return d <= radiusKm;
                });
                resolve(nearby);
            });
        });
    }

    return {
        init,
        submitIncident,
        toggleMarkers,
        getIncidentsNear,
        renderMarkers,
        setActiveTypes
    };
})();

