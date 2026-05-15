import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

// Firebase configuration pulled from Vite environment variables (VITE_ prefix)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

let app = null
let auth = null
let database = null

const hasFirebaseConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

if (hasFirebaseConfig) {
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    database = getDatabase(app)
  } catch (err) {
    // Initialization failure (invalid keys, environment issues) — log and continue without Firebase
    // eslint-disable-next-line no-console
    console.warn('Firebase initialization failed:', err.message || err)
    app = null
    auth = null
    database = null
  }
} else {
  // eslint-disable-next-line no-console
  console.warn('Firebase not configured — continuing without auth/database. Set VITE_FIREBASE_* env vars to enable Firebase.')
}

export { app, auth, database }

export default { app, auth, database }
