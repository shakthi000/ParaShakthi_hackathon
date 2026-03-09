/**
 * Parashakthi - Firestore Data Layer
 * Handles all Firebase Firestore operations
 */

const FirestoreService = (function() {
    const getDb = () => typeof db !== 'undefined' ? db : null;

    // Incidents
    async function addIncident(data) {
        const database = getDb();
        if (!database) {
            saveToLocalStorage('incidents', { ...data, timestamp: new Date().toISOString() });
            return;
        }
        const doc = {
            type: data.type,
            lat: data.lat,
            lng: data.lng,
            severity: data.severity || 'medium',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userId: data.userId || 'anonymous'
        };
        if (data.comment) doc.comment = data.comment;
        const ref = await database.collection('incidents').add(doc);
        return ref.id;
    }

    async function getIncidents(callback) {
        const database = getDb();
        if (!database) {
            callback(getFromLocalStorage('incidents'));
            return;
        }
        try {
            let snapshot = await database.collection('incidents').orderBy('timestamp', 'desc').limit(500).get();
            const incidents = [];
            snapshot.forEach(doc => {
                const d = doc.data();
                incidents.push({
                    id: doc.id,
                    ...d,
                    timestamp: d.timestamp?.toDate?.() || new Date()
                });
            });
            callback(incidents);
        } catch (e) {
            const snapshot = await database.collection('incidents').limit(500).get();
            const incidents = [];
            snapshot.forEach(doc => {
                const d = doc.data();
                incidents.push({
                    id: doc.id,
                    ...d,
                    timestamp: d.timestamp?.toDate?.() || new Date()
                });
            });
            incidents.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            callback(incidents);
        }
    }

    function subscribeIncidents(callback) {
        const database = getDb();
        if (!database) {
            callback(getFromLocalStorage('incidents'));
            return () => {};
        }
        return database.collection('incidents')
            .orderBy('timestamp', 'desc')
            .limit(200)
            .onSnapshot(snapshot => {
                const incidents = [];
                snapshot.forEach(doc => {
                    const d = doc.data();
                    incidents.push({
                        id: doc.id,
                        ...d,
                        timestamp: d.timestamp?.toDate?.() || new Date()
                    });
                });
                callback(incidents);
            });
    }

    // Ratings
    async function addRating(data) {
        const database = getDb();
        if (!database) {
            saveToLocalStorage('ratings', { ...data, timestamp: new Date().toISOString() });
            return;
        }
        const doc = {
            lat: data.lat,
            lng: data.lng,
            rating: data.rating,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        const ref = await database.collection('ratings').add(doc);
        return ref.id;
    }

    async function getRatings(callback) {
        const database = getDb();
        if (!database) {
            callback(getFromLocalStorage('ratings'));
            return;
        }
        const snapshot = await database.collection('ratings').get();
        const ratings = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            ratings.push({ id: doc.id, ...d });
        });
        callback(ratings);
    }

    // Shared Locations
    async function updateSharedLocation(userId, lat, lng) {
        const database = getDb();
        if (!database) return;
        await database.collection('sharedLocations').doc(userId).set({
            userId,
            lat,
            lng,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    async function getSharedLocation(userId, callback) {
        const database = getDb();
        if (!database) {
            callback(null);
            return;
        }
        const doc = await database.collection('sharedLocations').doc(userId).get();
        callback(doc.exists ? doc.data() : null);
    }

    // LocalStorage fallback
    function saveToLocalStorage(collection, data) {
        const key = `parashakthi_${collection}`;
        const items = JSON.parse(localStorage.getItem(key) || '[]');
        items.push({ ...data, id: Date.now().toString() });
        localStorage.setItem(key, JSON.stringify(items));
        return data.id;
    }

    function getFromLocalStorage(collection) {
        const key = `parashakthi_${collection}`;
        const raw = localStorage.getItem(key) || '[]';
        const items = JSON.parse(raw);
        if (collection === 'ratings') {
            return items.map((item, i) => ({ ...item, id: item.id || `local_${i}` }));
        }
        return items.map((item, i) => ({
            ...item,
            id: item.id || `local_${i}`,
            lat: item.lat ?? item.latitude,
            lng: item.lng ?? item.longitude,
            timestamp: item.timestamp ? new Date(item.timestamp) : new Date()
        }));
    }

    return {
        addIncident,
        getIncidents,
        subscribeIncidents,
        addRating,
        getRatings,
        updateSharedLocation,
        getSharedLocation
    };
})();
