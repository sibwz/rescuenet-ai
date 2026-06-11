import mongoose from 'mongoose'

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined
}

const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null }
global.mongooseCache = cached

function redactUri(uri: string): string {
  try {
    const url = new URL(uri)
    if (url.password) url.password = '***'
    return url.toString()
  } catch {
    return uri.replace(/:([^@/]+)@/, ':***@')
  }
}

function connectionOptions(uri: string): mongoose.ConnectOptions {
  const base: mongoose.ConnectOptions = {
    bufferCommands: false,
    serverSelectionTimeoutMS: 30_000,
    connectTimeoutMS: 30_000,
    socketTimeoutMS: 45_000,
    heartbeatFrequencyMS: 10_000,
    maxPoolSize: 10,
    minPoolSize: 1,
    retryWrites: true,
    retryReads: true,
  }

  if (uri.startsWith('mongodb+srv://')) {
    return { ...base, directConnection: false }
  }

  return base
}

const RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 1_500

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function connectWithRetry(uri: string): Promise<typeof mongoose> {
  let lastError: unknown

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[MongoDB] Retry ${attempt}/${RETRY_ATTEMPTS} in ${RETRY_DELAY_MS}ms...`)
        await sleep(RETRY_DELAY_MS)
      }
      const conn = await mongoose.connect(uri, connectionOptions(uri))
      console.log(`[MongoDB] Connected${attempt > 1 ? ` on attempt ${attempt}` : ''}`)
      return conn
    } catch (err) {
      lastError = err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[MongoDB] Attempt ${attempt}/${RETRY_ATTEMPTS} failed: ${msg}`)
      cached.promise = null
    }
  }

  throw lastError
}

export async function connectDB(): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Add it to .env.local and restart the dev server.')
  }

  if (cached.conn) {
    const state = cached.conn.connection.readyState
    if (state === 1) return cached.conn
    // Connection dropped — reset so next call reconnects
    console.log('[MongoDB] Cached connection lost (state=%d), reconnecting...', state)
    cached.conn = null
    cached.promise = null
  }

  if (!cached.promise) {
    console.log(`[MongoDB] Connecting to ${redactUri(MONGODB_URI)}`)
    cached.promise = connectWithRetry(MONGODB_URI).catch((err: unknown) => {
      cached.promise = null
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[MongoDB] All ${RETRY_ATTEMPTS} connection attempts failed: ${message}`)
      throw err
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}
