// Firebase config is isolated here to keep script.js clean.
// This file only initializes Firebase and exports handles used by the app.

// --- Firebase Configuration & Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyClJPT4UQsy9XmV4JB34rt0rYUB-FefyXY",
  authDomain: "mustafa-dbece.firebaseapp.com",
  databaseURL: "https://mustafa-dbece-default-rtdb.firebaseio.com",
  projectId: "mustafa-dbece",
  storageBucket: "mustafa-dbece.appspot.com",
  messagingSenderId: "692060842077",
  appId: "1:692060842077:web:04f0598199c58d403d05b4",
};

firebase.initializeApp(firebaseConfig);

// Firestore is used for Ads + Orders.
window.db = firebase.firestore();
