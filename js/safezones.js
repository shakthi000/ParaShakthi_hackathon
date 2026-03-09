/**
 * Parashakthi - Safe Zones Module
 * Police, hospitals, metro, crowded areas via Overpass API
 */

const SafeZonesModule = (function() {
    const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
    let markersLayer = null;
    let loadedZones = [];
    let visible = false;

    const ZONE_QUERIES = [
        { key: 'police', tag: 'amenity=police', icon: '🚓' },
        { key: 'hospital', tag: 'amenity=hospital', icon: '🏥' },
        { key: 'clinic', tag: 'amenity=clinic', icon: '🏥' },
        { key: 'metro', tag: 'railway=station', icon: '🚇' },
        { key: 'bus', tag: 'highway=bus_stop', icon: '🚌' }
    ];

    async function fetchFromOverpass(bounds, tag) {
        const [s, w, n, e] = [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()];
        const [k, v] = tag.split('=');
        const query = `[out:json][timeout:10];node["${k}"="${v}"](${s},${w},${n},${e});out body 50;`;
        const res = await fetch(OVERPASS_URL, {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`
        });
        const data = await res.json();
        return data.elements || [];
    }

    async function loadSafeZones(forceShow = false) {
        const map = MapModule.getMap();
        if (!map) return;
        if (forceShow) visible = true;
        const bounds = map.getBounds();

        loadedZones = [];
        for (const q of ZONE_QUERIES) {
            try {
                const elements = await fetchFromOverpass(bounds, q.tag);
                elements.forEach(el => {
                    if (el.lat && el.lon) {
                        loadedZones.push({
                            lat: el.lat,
                            lng: el.lon,
                            type: q.key,
                            name: el.tags?.name || q.key,
                            icon: q.icon
                        });
                    }
                });
            } catch (e) {
                console.warn('Overpass fetch failed for', q.tag, e);
            }
        }

        renderMarkers();
    }

    function renderMarkers() {
        const map = MapModule.getMap();
        if (!map) return;

        if (markersLayer) {
            map.removeLayer(markersLayer);
        }
        markersLayer = L.layerGroup();

        if (!visible) return;

        loadedZones.forEach(z => {
            const m = L.marker([z.lat, z.lng], {
                icon: L.divIcon({
                    className: 'safe-zone-marker',
                    html: z.icon,
                    iconSize: [28, 28]
                })
            }).bindPopup(`<strong>${z.name}</strong><br>${z.type}`);
            markersLayer.addLayer(m);
        });
        markersLayer.addTo(map);
    }

    function toggle() {
        visible = !visible;
        if (visible) {
            if (loadedZones.length === 0) {
                loadSafeZones();
            } else {
                renderMarkers();
            }
        } else {
            const map = MapModule.getMap();
            if (markersLayer && map) map.removeLayer(markersLayer);
        }
        return visible;
    }

    function getLoadedZones(callback) {
        callback(loadedZones.map(z => ({ lat: z.lat, lng: z.lng })));
    }

    return {
        loadSafeZones,
        toggle,
        getLoadedZones,
        renderMarkers
    };
})();
