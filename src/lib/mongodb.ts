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
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  }

  if (uri.startsWith('mongodb+srv://')) {
    // SRV URIs require DNS resolution; disable directConnection which is incompatible with SRV
    return { ...base, directConnection: false }
  }

  return base
}

export async function connectDB(): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI is not set. Add it to .env.local and restart the dev server.'
    )
  }

  if (cached.conn) return cached.conn

  if (!cached.promise) {
    console.log(`[MongoDB] Connecting to ${redactUri(MONGODB_URI)}`)
    cached.promise = mongoose
      .connect(MONGODB_URI, connectionOptions(MONGODB_URI))
      .then((conn) => {
        console.log('[MongoDB] Connected successfully')
        return conn
      })
      .catch((err: unknown) => {
        // Clear so the next request retries instead of reusing a failed promise
        cached.promise = null
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[MongoDB] Connection failed: ${message}`)
        throw err
      })
  }

  cached.conn = await cached.promise
  return cached.conn
}
