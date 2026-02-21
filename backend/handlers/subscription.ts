import { NextRequest } from 'next/server'
import { requireAuth } from '@/backend/auth'
import { getUserPlan } from '@/backend/subscription'

export async function handleGetSubscription(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) return auth

  try {
    const { plan, subscriptionStatus } = await getUserPlan(auth.uid)

    return new Response(
      JSON.stringify({ plan, subscriptionStatus }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Subscription fetch error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch subscription status.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
