/**
 * Firebase Configuration for Parashakthi
 * Replace with your Firebase project credentials
 */
const firebaseConfig = {
    apiKey: "AIzaSyBLK0k0rqhkLREFHQNqEBsHVD-AQjfQ6P8",
    authDomain: "parashakthi-demo.firebaseapp.com",
    projectId: "parashakthi-demo",
    storageBucket: "parashakthi-demo.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

// Initialize Firebase (only if not already initialized)
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Firestore reference
const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
