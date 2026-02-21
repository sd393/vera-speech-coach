import { NextRequest } from 'next/server'
import { requireAuth } from '@/backend/auth'
import { checkRateLimit } from '@/backend/rate-limit'
import { stripe } from '@/backend/stripe'
import { createOrGetStripeCustomer, getUserPlan } from '@/backend/subscription'

export async function handleCheckout(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) return auth

  // Rate limit: 3 checkout attempts per 60s per user
  if (!checkRateLimit('checkout:' + auth.uid, 3, 60_000).allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait a moment.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    // If user already has active Pro, send them to billing portal instead
    const { plan, subscriptionStatus } = await getUserPlan(auth.uid)
    if (plan === 'pro' && subscriptionStatus === 'active') {
      const customerId = await createOrGetStripeCustomer(auth.uid, auth.email)
      const portalSession = await stripe().billingPortal.sessions.create({
        customer: customerId,
        return_url: `${getOrigin(request)}/account`,
      })
      return new Response(
        JSON.stringify({ url: portalSession.url }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const priceId = process.env.STRIPE_PRO_PRICE_ID
    if (!priceId) {
      console.error('STRIPE_PRO_PRICE_ID is not configured')
      return new Response(
        JSON.stringify({ error: 'Payment is not configured. Please try again later.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const customerId = await createOrGetStripeCustomer(auth.uid, auth.email)
    const origin = getOrigin(request)

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/chat?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/premium?checkout=canceled`,
      subscription_data: {
        metadata: { firebaseUid: auth.uid },
      },
      metadata: { firebaseUid: auth.uid },
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Checkout error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

function getOrigin(request: NextRequest): string {
  const host = request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}
