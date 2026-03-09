/**
 * Parashakthi - AI Danger Prediction
 *
 * Uses historical incident data to predict likely risk zones and
 * renders them as Leaflet circles on top of the base map.
 *
 * This module is completely additive and does not modify
 * existing map / incident / heatmap layers.
 */

const AiDangerPredictionModule = (function() {
    let aiDangerLayer = null;
    let visible = false;

    function ensureLayer() {
        const map = MapModule.getMap();
        if (!map) return null;
        if (!aiDangerLayer) {
            aiDangerLayer = L.layerGroup();
            window.aiDangerLayer = aiDangerLayer;
        }
        return aiDangerLayer;
    }

    function getNightTimeFactor() {
        const hour = new Date().getHours();
        return (hour >= 20 || hour < 6) ? 2 : 0;
    }

    function classifySeverity(score) {
        if (score < 3) return 'low';
        if (score <= 6) return 'medium';
        return 'high';
    }

    function getSeverityStyle(score) {
        const level = classifySeverity(score);
        if (level === 'high') {
            return { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.3 };
        }
        if (level === 'medium') {
            return { color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.25 };
        }
        return { color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2 };
    }

    function buildTooltip(score) {
        const level = classifySeverity(score);
        const label =
            level === 'high' ? 'High Risk' :
            level === 'medium' ? 'Medium Risk' :
            'Low Risk';
        return [
            '⚠ Predicted Risk Zone',
            `${label} predicted${getNightTimeFactor() > 0 ? ' after 8 PM' : ''}`
        ].join('\n');
    }

    function buildClusters(incidents) {
        const nightFactor = getNightTimeFactor();
        const buckets = new Map();

        (incidents || []).forEach(inc => {
            const lat = inc.lat ?? inc.latitude;
            const lng = inc.lng ?? inc.longitude;
            if (lat == null || lng == null) return;

            // Simple spatial clustering by rounding coordinates (~1km grid)
            const keyLat = lat.toFixed(2);
            const keyLng = lng.toFixed(2);
            const key = `${keyLat},${keyLng}`;

            if (!buckets.has(key)) {
                buckets.set(key, {
                    lat: parseFloat(keyLat),
                    lng: parseFloat(keyLng),
                    incidentCount: 0,
                    highSeverityCount: 0
                });
            }
            const b = buckets.get(key);
            b.incidentCount += 1;
            const sev = (inc.severity || 'medium').toLowerCase();
            if (sev === 'high') b.highSeverityCount += 1;
        });

        const clusters = [];
        buckets.forEach(b => {
            const score =
                (b.incidentCount * 2) +
                (b.highSeverityCount * 3) +
                nightFactor;
            clusters.push({
                lat: b.lat,
                lng: b.lng,
                incidentCount: b.incidentCount,
                highSeverityCount: b.highSeverityCount,
                score
            });
        });

        return clusters;
    }

    function renderClusters(clusters) {
        const map = MapModule.getMap();
        const layer = ensureLayer();
        if (!map || !layer) return;

        layer.clearLayers();

        clusters.forEach(c => {
            const style = getSeverityStyle(c.score);
            const radius = classifySeverity(c.score) === 'high'
                ? 500
                : classifySeverity(c.score) === 'medium'
                ? 350
                : 250;

            const circle = L.circle([c.lat, c.lng], {
                radius,
                color: style.color,
                fillColor: style.fillColor,
                fillOpacity: style.fillOpacity,
                weight: 1
            });

            circle.bindTooltip(buildTooltip(c.score), {
                permanent: false,
                direction: 'top'
            });

            layer.addLayer(circle);
        });

        if (visible && !map.hasLayer(layer)) {
            layer.addTo(map);
        }
    }

    function runPrediction() {
        const map = MapModule.getMap();
        if (!map) return;

        FirestoreService.getIncidents(incidents => {
            const clusters = buildClusters(incidents || []);
            renderClusters(clusters);
        });
    }

    function toggle() {
        const map = MapModule.getMap();
        const layer = ensureLayer();
        if (!map || !layer) return;

        if (!visible) {
            visible = true;
            runPrediction();
            layer.addTo(map);
        } else {
            visible = false;
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        }
    }

    return {
        toggle,
        runPrediction,
        getLayer: () => aiDangerLayer
    };
})();

