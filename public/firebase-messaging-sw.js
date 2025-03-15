// This enables Firebase offline capabilities and messaging

importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js');

// We need to get these values from the __FIREBASE_CONFIG__ placeholder
// that will be replaced during the build process
const firebaseConfig = self.__FIREBASE_CONFIG__ || {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

firebase.initializeApp(firebaseConfig);

// Enable background sync for Firestore
firebase.firestore().enablePersistence()
  .catch(function(err) {
    console.error('Firestore persistence error:', err);
  });

// This is needed for push notifications
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('Received background message:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png'
  };
  
  return self.registration.showNotification(notificationTitle, notificationOptions);
}); 