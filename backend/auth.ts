import { adminAuth } from '@/backend/firebase-admin'

interface AuthResult {
  uid: string
  email: string | undefined
}

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns the decoded user if valid, null if no token (trial user),
 * or a 401 Response if the token is present but invalid.
 */
export async function verifyAuth(
  request: Request
): Promise<AuthResult | null | Response> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return null
  }

  if (!authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Invalid authorization format' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const token = authHeader.slice(7)
  try {
    const decoded = await adminAuth().verifyIdToken(token)
    return { uid: decoded.uid, email: decoded.email }
  } catch (err) {
    console.error('verifyAuth failed:', err)
    return new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Like verifyAuth but requires a valid token — returns 401 if missing or invalid.
 */
export async function requireAuth(
  request: Request
): Promise<AuthResult | Response> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Invalid authorization format' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const token = authHeader.slice(7)
  try {
    const decoded = await adminAuth().verifyIdToken(token)
    return { uid: decoded.uid, email: decoded.email }
  } catch (err) {
    console.error('requireAuth failed:', err)
    return new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
