import { NextResponse } from 'next/server'

const OFFLINE_PATTERNS = [
  'Could not connect',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'server selection',
  'Server selection',
  'topology was destroyed',
  'MongoNetworkError',
  'MongoServerSelectionError',
  'MongoTopologyClosedError',
  'MongoConnectionError',
  'buffering timed out',
  'connect ECONNREFUSED',
  'getaddrinfo ENOTFOUND',
  'querySrv ESERVFAIL',
  'querySrv ENOTFOUND',
  'no servers in your MongoDB Atlas cluster',
]

export function isDbConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  const name = err instanceof Error ? (err.name ?? '') : ''
  return OFFLINE_PATTERNS.some((p) => msg.includes(p) || name.includes(p))
}

export function dbOfflineResponse() {
  return NextResponse.json(
    {
      success: false,
      offline: true,
      message: 'Database is reconnecting. Please try again in a moment.',
    },
    { status: 503 }
  )
}
