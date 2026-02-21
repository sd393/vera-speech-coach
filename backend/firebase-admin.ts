import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

let app: App | null = null

function getApp(): App {
  if (!app) {
    if (getApps().length > 0) {
      app = getApps()[0]
      return app
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    if (!serviceAccountJson) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. ' +
        'Set it to a JSON string of your Firebase service account key.'
      )
    }

    const serviceAccount = JSON.parse(serviceAccountJson)
    app = initializeApp({
      credential: cert(serviceAccount),
    })
  }
  return app
}

export function adminAuth(): Auth {
  return getAuth(getApp())
}

export function db(): Firestore {
  return getFirestore(getApp())
}
