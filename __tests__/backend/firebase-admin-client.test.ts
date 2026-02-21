import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockInitializeApp = vi.fn().mockReturnValue({ name: 'mock-app' })
const mockGetApps = vi.fn().mockReturnValue([])
const mockCert = vi.fn().mockReturnValue({ type: 'mock-credential' })
const mockGetAuth = vi.fn().mockReturnValue({ type: 'mock-auth' })
const mockGetFirestore = vi.fn().mockReturnValue({ type: 'mock-firestore' })

vi.mock('firebase-admin/app', () => ({
  initializeApp: mockInitializeApp,
  getApps: mockGetApps,
  cert: mockCert,
}))

vi.mock('firebase-admin/auth', () => ({
  getAuth: mockGetAuth,
}))

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore,
}))

let savedEnv: string | undefined

describe('firebase-admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    savedEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      project_id: 'test-project',
      private_key: 'test-key',
      client_email: 'test@test.iam.gserviceaccount.com',
    })
    // Reset modules so the singleton `let app` is cleared between tests
    vi.resetModules()
    // Re-apply mocks after resetModules
    mockGetApps.mockReturnValue([])
    mockInitializeApp.mockReturnValue({ name: 'mock-app' })
  })

  afterEach(() => {
    if (savedEnv !== undefined) {
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY = savedEnv
    } else {
      delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    }
  })

  it('adminAuth() returns an Auth instance', async () => {
    const { adminAuth } = await import('@/backend/firebase-admin')
    const auth = adminAuth()
    expect(auth).toEqual({ type: 'mock-auth' })
  })

  it('db() returns a Firestore instance', async () => {
    const { db } = await import('@/backend/firebase-admin')
    const firestore = db()
    expect(firestore).toEqual({ type: 'mock-firestore' })
  })

  it('throws when FIREBASE_SERVICE_ACCOUNT_KEY is not set', async () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    mockGetApps.mockReturnValue([])

    const { adminAuth } = await import('@/backend/firebase-admin')
    expect(() => adminAuth()).toThrow(
      'FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set'
    )
  })

  it('calls initializeApp only once across multiple calls (singleton)', async () => {
    const { adminAuth, db } = await import('@/backend/firebase-admin')

    adminAuth()
    adminAuth()
    db()

    expect(mockInitializeApp).toHaveBeenCalledTimes(1)
  })
})
