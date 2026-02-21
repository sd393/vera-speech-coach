import { db } from '@/backend/firebase-admin'
import { stripe } from '@/backend/stripe'
import { FieldValue } from 'firebase-admin/firestore'

export interface UserDoc {
  stripeCustomerId: string | null
  plan: 'free' | 'pro'
  subscriptionId: string | null
  subscriptionStatus: 'active' | 'canceled' | 'past_due' | null
  createdAt: FirebaseFirestore.Timestamp
  updatedAt: FirebaseFirestore.Timestamp
}

export interface UserPlan {
  plan: 'free' | 'pro'
  subscriptionStatus: 'active' | 'canceled' | 'past_due' | null
}

/**
 * Create user doc if it doesn't exist, with safe defaults.
 * Uses set({ merge: true }) for race safety.
 */
export async function ensureUserDoc(uid: string, email?: string): Promise<UserDoc> {
  const ref = db().collection('users').doc(uid)
  const snap = await ref.get()

  if (!snap.exists) {
    const now = FieldValue.serverTimestamp()
    await ref.set(
      {
        stripeCustomerId: null,
        plan: 'free',
        subscriptionId: null,
        subscriptionStatus: null,
        createdAt: now,
        updatedAt: now,
        ...(email ? { email } : {}),
      },
      { merge: true }
    )
    const newSnap = await ref.get()
    return newSnap.data() as UserDoc
  }

  return snap.data() as UserDoc
}

/**
 * Get user's plan and subscription status. Returns free defaults if doc doesn't exist.
 */
export async function getUserPlan(uid: string): Promise<UserPlan> {
  const ref = db().collection('users').doc(uid)
  const snap = await ref.get()

  if (!snap.exists) {
    return { plan: 'free', subscriptionStatus: null }
  }

  const data = snap.data()!
  return {
    plan: data.plan ?? 'free',
    subscriptionStatus: data.subscriptionStatus ?? null,
  }
}

/**
 * Create a Stripe customer or return the existing one.
 */
export async function createOrGetStripeCustomer(
  uid: string,
  email?: string
): Promise<string> {
  const doc = await ensureUserDoc(uid, email)

  if (doc.stripeCustomerId) {
    return doc.stripeCustomerId
  }

  const customer = await stripe().customers.create({
    email: email ?? undefined,
    metadata: { firebaseUid: uid },
  })

  await db().collection('users').doc(uid).update({
    stripeCustomerId: customer.id,
    updatedAt: FieldValue.serverTimestamp(),
  })

  return customer.id
}

/**
 * Partial update of subscription fields on a user doc.
 */
export async function updateSubscription(
  uid: string,
  data: Partial<Pick<UserDoc, 'plan' | 'subscriptionId' | 'subscriptionStatus' | 'stripeCustomerId'>>
): Promise<void> {
  await db().collection('users').doc(uid).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  })
}
