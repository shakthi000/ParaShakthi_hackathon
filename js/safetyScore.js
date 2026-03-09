/**
 * Parashakthi - AI Safe Route Scoring
 * safetyScore = (incidentWeight * incidentCount) + (nightRiskWeight * timeFactor) + (ratingWeight * areaRating)
 */

const SafetyScoreModule = (function() {
    const INCIDENT_WEIGHT = 0.4;
    const NIGHT_RISK_WEIGHT = 0.3;
    const RATING_WEIGHT = 0.2;
    const SAFEZONE_WEIGHT = -0.1;

    function getTimeFactor() {
        const hour = new Date().getHours();
        if (hour >= 22 || hour < 5) return 1;
        if (hour >= 20 || hour < 6) return 0.7;
        if (hour >= 18 || hour < 7) return 0.4;
        return 0.2;
    }

    function getAreaRating(ratings, lat, lng, radiusKm = 0.3) {
        if (!ratings?.length) return 3;
        const R = 6371;
        const nearby = ratings.filter(r => {
            const dlat = (r.lat - lat) * Math.PI / 180;
            const dlon = (r.lng - lng) * Math.PI / 180;
            const a = Math.sin(dlat/2)**2 + Math.cos(lat * Math.PI/180) * Math.cos(r.lat * Math.PI/180) * Math.sin(dlon/2)**2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) <= radiusKm;
        });
        if (nearby.length === 0) return 3;
        const avg = nearby.reduce((s, r) => s + (5 - r.rating), 0) / nearby.length;
        return Math.min(2, avg);
    }

    function countIncidentsOnRoute(routeCoords, incidents, radiusKm = 0.15) {
        let count = 0;
        const R = 6371;
        routeCoords.forEach(seg => {
            incidents.forEach(inc => {
                const lat = inc.lat ?? inc.latitude;
                const lng = inc.lng ?? inc.longitude;
                const dlat = (lat - seg.lat) * Math.PI / 180;
                const dlon = (lng - seg.lng) * Math.PI / 180;
                const a = Math.sin(dlat/2)**2 + Math.cos(seg.lat * Math.PI/180) * Math.cos(lat * Math.PI/180) * Math.sin(dlon/2)**2;
                const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                if (d <= radiusKm) count++;
            });
        });
        return count;
    }

    function countSafeZonesNearRoute(routeCoords, safeZones, radiusKm = 0.2) {
        let count = 0;
        const R = 6371;
        routeCoords.forEach(seg => {
            safeZones.forEach(sz => {
                const lat = sz.lat ?? sz[0];
                const lng = sz.lng ?? sz[1];
                const dlat = (lat - seg.lat) * Math.PI / 180;
                const dlon = (lng - seg.lng) * Math.PI / 180;
                const a = Math.sin(dlat/2)**2 + Math.cos(seg.lat * Math.PI/180) * Math.cos(lat * Math.PI/180) * Math.sin(dlon/2)**2;
                const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                if (d <= radiusKm) count++;
            });
        });
        return count;
    }

    async function calculateRouteScore(routeCoords) {
        const [incidents, ratings, safeZones] = await Promise.all([
            new Promise(r => FirestoreService.getIncidents(r)),
            new Promise(r => FirestoreService.getRatings(r)),
            new Promise(r => { if (typeof SafeZonesModule !== 'undefined') SafeZonesModule.getLoadedZones(r); else r([]); })
        ]);

        const incidentCount = countIncidentsOnRoute(routeCoords, incidents);
        const timeFactor = getTimeFactor();
        const midLat = routeCoords.reduce((s, c) => s + c.lat, 0) / routeCoords.length;
        const midLng = routeCoords.reduce((s, c) => s + c.lng, 0) / routeCoords.length;
        const areaRating = getAreaRating(ratings, midLat, midLng);
        const safeZoneCount = countSafeZonesNearRoute(routeCoords, safeZones);

        const rawScore = 
            (INCIDENT_WEIGHT * Math.min(incidentCount * 2, 5)) +
            (NIGHT_RISK_WEIGHT * timeFactor * 3) +
            (RATING_WEIGHT * areaRating) -
            (SAFEZONE_WEIGHT * Math.min(safeZoneCount, 5));

        const score = Math.max(1, Math.min(5, 5 - rawScore));
        return Math.round(score * 10) / 10;
    }

    function getScoreColor(score) {
        if (score >= 4) return '#10b981';
        if (score >= 3) return '#f59e0b';
        return '#ef4444';
    }

    function getScoreLabel(score) {
        if (score >= 4) return 'Safe';
        if (score >= 3) return 'Moderate';
        return 'Risky';
    }

    return {
        calculateRouteScore,
        getScoreColor,
        getScoreLabel,
        getTimeFactor,
        getAreaRating
    };
})();
