/**
 * Parashakthi - Heatmap Module
 * Crime density visualization using Leaflet.heat
 */

const HeatmapModule = (function() {
    let heatLayer = null;
    let isVisible = false;

    function createHeatmap(points) {
        const map = MapModule.getMap();
        if (!map || typeof L.heatLayer !== 'function') return;

        const heatData = points.map(p => {
            const lat = p.lat ?? p.latitude;
            const lng = p.lng ?? p.longitude;
            const intensity = p.severity === 'high' ? 1.5 : p.severity === 'medium' ? 1 : 0.5;
            return [lat, lng, intensity];
        });

        if (heatLayer) {
            map.removeLayer(heatLayer);
        }

        heatLayer = L.heatLayer(heatData, {
            radius: 35,
            blur: 25,
            maxZoom: 17,
            max: 1.5,
            gradient: {
                0.0: 'green',
                0.5: 'yellow',
                1.0: 'red'
            }
        });

        if (isVisible) {
            heatLayer.addTo(map);
        }
    }

    function updateFromIncidents(incidents) {
        const points = incidents.map(i => ({
            lat: i.lat ?? i.latitude,
            lng: i.lng ?? i.longitude,
            severity: i.severity || 'medium'
        }));
        createHeatmap(points);
    }

    function toggle() {
        isVisible = !isVisible;
        const map = MapModule.getMap();
        if (!map) return;
        if (heatLayer) {
            if (isVisible) heatLayer.addTo(map);
            else heatLayer.remove();
        }
        return isVisible;
    }

    function show() {
        isVisible = true;
        if (heatLayer && MapModule.getMap()) {
            heatLayer.addTo(MapModule.getMap());
        }
    }

    function hide() {
        isVisible = false;
        if (heatLayer) heatLayer.remove();
    }

    function isOn() {
        return isVisible;
    }

    return {
        createHeatmap,
        updateFromIncidents,
        toggle,
        show,
        hide,
        isOn
    };
})();
