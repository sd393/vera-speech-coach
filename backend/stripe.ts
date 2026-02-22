import Stripe from 'stripe'

let client: Stripe | null = null

export function stripe(): Stripe {
  if (!client) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error(
        'STRIPE_SECRET_KEY environment variable is not set. ' +
        'Add it to your .env file.'
      )
    }
    client = new Stripe(secretKey)
  }
  return client
}
