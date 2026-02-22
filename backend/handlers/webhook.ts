import { NextRequest } from 'next/server'
import { stripe } from '@/backend/stripe'
import { ensureUserDoc, updateSubscription } from '@/backend/subscription'
import { db } from '@/backend/firebase-admin'
import type Stripe from 'stripe'

export async function handleWebhook(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return new Response(
      JSON.stringify({ error: 'Missing stripe-signature header' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured')
    return new Response(
      JSON.stringify({ error: 'Webhook not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let event: Stripe.Event
  try {
    const body = await request.text()
    event = stripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid signature' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Idempotency: skip events older than the doc's updatedAt
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const uid = session.metadata?.firebaseUid
        if (!uid) {
          console.error('Webhook: checkout.session.completed missing firebaseUid metadata')
          break
        }

        if (await shouldSkipEvent(uid, event)) break

        await ensureUserDoc(uid)

        // Retrieve the subscription to get its ID
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.toString() ?? null

        await updateSubscription(uid, {
          plan: 'pro',
          subscriptionId,
          subscriptionStatus: 'active',
          stripeCustomerId: typeof session.customer === 'string'
            ? session.customer
            : session.customer?.toString() ?? null,
        })
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const uid = subscription.metadata?.firebaseUid
        if (!uid) {
          console.error('Webhook: customer.subscription.updated missing firebaseUid metadata')
          break
        }

        if (await shouldSkipEvent(uid, event)) break

        const status = mapSubscriptionStatus(subscription.status)
        await updateSubscription(uid, {
          subscriptionStatus: status,
          ...(subscription.status === 'active' ? { plan: 'pro' } : {}),
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const uid = subscription.metadata?.firebaseUid
        if (!uid) {
          console.error('Webhook: customer.subscription.deleted missing firebaseUid metadata')
          break
        }

        if (await shouldSkipEvent(uid, event)) break

        await updateSubscription(uid, {
          plan: 'free',
          subscriptionId: null,
          subscriptionStatus: null,
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.toString() ?? null

        if (!subscriptionId) break

        // Look up uid from the subscription metadata
        const sub = await stripe().subscriptions.retrieve(subscriptionId)
        const uid = sub.metadata?.firebaseUid
        if (!uid) {
          console.error('Webhook: invoice.payment_failed missing firebaseUid in subscription metadata')
          break
        }

        if (await shouldSkipEvent(uid, event)) break

        await updateSubscription(uid, {
          subscriptionStatus: 'past_due',
        })
        break
      }

      default:
        // Unknown event type — ignore but return 200
        break
    }
  } catch (error) {
    console.error('Webhook processing error:', error)
    // Still return 200 to prevent Stripe from retrying on server errors
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mapSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status
): 'active' | 'canceled' | 'past_due' | null {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'canceled':
      return 'canceled'
    case 'past_due':
      return 'past_due'
    default:
      return null
  }
}

/**
 * Check if this event is older than the user doc's updatedAt.
 * Returns true if the event should be skipped.
 */
async function shouldSkipEvent(uid: string, event: Stripe.Event): Promise<boolean> {
  const ref = db().collection('users').doc(uid)
  const snap = await ref.get()
  if (!snap.exists) return false

  const data = snap.data()!
  if (!data.updatedAt) return false

  const eventTimestamp = event.created * 1000 // Stripe uses seconds
  const docTimestamp = data.updatedAt.toMillis?.() ?? 0

  return eventTimestamp < docTimestamp
}
