/**
 * Parashakthi - Leaflet Map Module
 * Interactive map with OpenStreetMap tiles, Chennai default
 */

const MapModule = (function() {
    let map = null;
    let userMarker = null;
    const CHENNAI_CENTER = [13.0827, 80.2707];

    function init() {
        map = L.map('map', {
            center: CHENNAI_CENTER,
            zoom: 13,
            zoomControl: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        L.control.zoom({ position: 'topright' }).addTo(map);

        // Get user location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    const coords = [pos.coords.latitude, pos.coords.longitude];
                    map.setView(coords, 15);
                    userMarker = L.marker(coords, {
                        icon: L.divIcon({
                            className: 'user-marker',
                            html: '<div style="background:#6366f1;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3)"></div>',
                            iconSize: [22, 22]
                        })
                    }).addTo(map).bindPopup('Your location');
                },
                () => {}
            );
        }

        return map;
    }

    function getMap() {
        return map;
    }

    function getCenter() {
        return map ? map.getCenter() : null;
    }

    function getCenterLatLng() {
        const c = map?.getCenter();
        return c ? [c.lat, c.lng] : CHENNAI_CENTER;
    }

    function centerOnUser() {
        if (userMarker) {
            map.setView(userMarker.getLatLng(), 16);
        } else if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => map.setView([pos.coords.latitude, pos.coords.longitude], 16)
            );
        }
    }

    function getUserLocation(callback) {
        if (!navigator.geolocation) {
            callback(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => callback([pos.coords.latitude, pos.coords.longitude]),
            () => callback(null)
        );
    }

    function onMapClick(callback) {
        if (map) map.on('click', callback);
    }

    return {
        init,
        getMap,
        getCenter,
        getCenterLatLng,
        centerOnUser,
        getUserLocation,
        onMapClick,
        CHENNAI_CENTER
    };
})();
