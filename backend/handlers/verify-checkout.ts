import { NextRequest } from 'next/server'
import { requireAuth } from '@/backend/auth'
import { checkRateLimit } from '@/backend/rate-limit'
import { stripe } from '@/backend/stripe'
import { ensureUserDoc, updateSubscription } from '@/backend/subscription'

export async function handleVerifyCheckout(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) return auth

  // Rate limit: 5 verify attempts per 60s per user
  if (!checkRateLimit('verify-checkout:' + auth.uid, 5, 60_000).allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait a moment.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let body: { session_id?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const sessionId = body.session_id
  if (!sessionId || typeof sessionId !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Missing session_id' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    // Verify the session belongs to this user
    if (session.metadata?.firebaseUid !== auth.uid) {
      return new Response(
        JSON.stringify({ error: 'Session does not belong to this user' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verify the session is complete and paid
    if (session.status !== 'complete' || session.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({ error: 'Checkout session is not complete' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const subscription =
      typeof session.subscription === 'object' ? session.subscription : null
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : subscription?.id ?? null
    const stripeCustomerId =
      typeof session.customer === 'string' ? session.customer : null

    await ensureUserDoc(auth.uid, auth.email)
    await updateSubscription(auth.uid, {
      plan: 'pro',
      subscriptionId,
      subscriptionStatus: 'active',
      stripeCustomerId,
    })

    return new Response(
      JSON.stringify({ plan: 'pro' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Verify checkout error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to verify checkout session' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
