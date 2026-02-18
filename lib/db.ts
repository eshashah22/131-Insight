import mongoose from 'mongoose';

declare global {
  // Extend globalThis with a mongoose property
  var mongoose: {
    conn: mongoose.Connection | null;
    promise: Promise<mongoose.Connection> | null;
  };
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}


async function dbConnect() {
  // Validate MONGODB_URI at runtime, not at module load time
  // This allows the build to succeed even if env vars aren't set
  const MONGODB_URI = process.env.MONGODB_URI;
  
  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable in your .env file');
  }

  if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
    throw new Error(`Invalid MONGODB_URI format. It must start with "mongodb://" or "mongodb+srv://". Current value: ${MONGODB_URI.substring(0, 20)}...`);
  }

  // Validate URI structure - check if it has a proper hostname (not placeholders)
  const hostnameMatch = MONGODB_URI.match(/@([^\/\?]+)/);
  if (hostnameMatch) {
    const hostname = hostnameMatch[1];
    // Check for common placeholder patterns
    if (hostname.includes('{') || hostname.includes('user') || hostname.includes('pass') || 
        hostname === '0' || hostname.length < 10 || !hostname.includes('mongodb.net')) {
      throw new Error(
        `Invalid MongoDB URI: The cluster hostname appears to be missing or contains placeholders.\n` +
        `Found hostname: "${hostname}"\n` +
        `Expected format: mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=TA-Data\n` +
        `Make sure you've replaced {user} and {pass} with your actual MongoDB credentials.`
      );
    }
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    // Explicitly cast the result to match the expected type of Promise<mongoose.Connection>
    cached.promise = mongoose.connect(MONGODB_URI as string, opts).then((m) => {
      return m.connection; // Ensure only the `Connection` object is returned
    }) as Promise<mongoose.Connection>;
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
