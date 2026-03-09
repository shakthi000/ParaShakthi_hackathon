/**
 * Parashakthi - OSRM Routing Module
 * Free routing via OSRM public API
 */

const RoutingModule = (function() {
    const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
    let currentRouteLayer = null;
    let routeStartMarker = null;
    let routeEndMarker = null;

    async function geocode(query) {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
            { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        return data[0] ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
    }

    async function getRoute(start, end) {
        const [startLat, startLng] = Array.isArray(start) ? start : [start.lat, start.lng];
        const [endLat, endLng] = Array.isArray(end) ? end : [end.lat, end.lng];
        const url = `${OSRM_BASE}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.code !== 'Ok' || !data.routes?.length) {
            throw new Error('Route not found');
        }
        return data.routes[0];
    }

    function parseDuration(seconds) {
        const m = Math.floor(seconds / 60);
        return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60} min`;
    }

    function parseDistance(meters) {
        return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
    }

    function drawRoute(routeData, options = {}) {
        clearRoute();
        const map = MapModule.getMap();
        if (!map || !routeData?.geometry?.coordinates) return;

        const coords = routeData.geometry.coordinates.map(c => [c[1], c[0]]);
        const color = options.color || '#10b981';
        const routeLayer = L.polyline(coords, {
            color,
            weight: 5,
            opacity: 0.8
        }).addTo(map);

        currentRouteLayer = routeLayer;
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

        if (options.start) {
            routeStartMarker = L.marker(options.start).addTo(map).bindPopup('Start');
        }
        if (options.end) {
            routeEndMarker = L.marker(options.end).addTo(map).bindPopup('Destination');
        }

        return {
            distance: routeData.distance,
            duration: routeData.duration,
            coordinates: coords
        };
    }

    function clearRoute() {
        if (currentRouteLayer) {
            currentRouteLayer.remove();
            currentRouteLayer = null;
        }
        if (routeStartMarker) {
            routeStartMarker.remove();
            routeStartMarker = null;
        }
        if (routeEndMarker) {
            routeEndMarker.remove();
            routeEndMarker = null;
        }
    }

    function getRouteCoordinates(routeData) {
        if (!routeData?.geometry?.coordinates) return [];
        return routeData.geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
    }

    async function searchAndDraw(startQuery, endQuery) {
        const start = await geocode(startQuery);
        const end = await geocode(endQuery);
        if (!start || !end) throw new Error('Could not find locations');
        const route = await getRoute(start, end);
        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
        const info = { distance: route.distance, duration: route.duration, coordinates: coords };
        const map = MapModule.getMap();
        if (map && document.getElementById('mapSection')?.classList.contains('active')) {
            drawRoute(route, { start, end });
        }
        return {
            route,
            start,
            end,
            distance: info.distance,
            duration: info.duration,
            coordinates: info.coordinates
        };
    }

    return {
        geocode,
        getRoute,
        drawRoute,
        clearRoute,
        getRouteCoordinates,
        searchAndDraw,
        parseDuration,
        parseDistance
    };
})();
