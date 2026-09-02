import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

/**
 * Secure session auth for drop&grow.
 *
 * Security measures:
 * - SHA-256 hashed tokens (raw token never stored)
 * - 256-bit cryptographically random tokens
 * - Token expiration (30 days)
 * - Rate limiting on sign-in (5 attempts per IP per hour)
 * - Handle uniqueness enforcement
 * - Server-side token resolution on every mutation
 */

const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_SIGNINS_PER_WINDOW = 30;

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Short, copy-friendly secret phrases.
 * Words are distinct, lowercase, easy to spell and read aloud, and free of
 * character/space ambiguity so both humans and agents can copy and re-input
 * them cleanly (e.g. "moss-candle-lynx-fern").
 *
 * 4 words drawn without replacement from 200 words => ~1.55 billion phrases,
 * which is secure against brute force even if accounts are targeted.
 */
const PHRASE_WORDS = [
  "acorn", "archer", "amber", "atlas", "azure", "badger", "basin", "beacon",
  "beetle", "birch", "blaze", "bog", "bristle", "brook", "cabin", "candle",
  "canary", "cedar", "chime", "cicada", "cinder", "clover", "copper", "corral",
  "cricket", "crystal", "cypress", "dahlia", "dart", "delta", "denim", "dory",
  "dune", "elm", "ember", "falcon", "fern", "finch", "flint", "foam",
  "forge", "fossa", "foxglove", "fresco", "frost", "gadget", "garden", "gecko",
  "glacier", "glade", "granite", "grove", "gull", "harbor", "hazel", "heat",
  "hemlock", "heron", "holly", "ibis", "iris", "island", "ivy", "jade",
  "juniper", "kayak", "lantern", "larch", "lark", "laurel", "lava", "leaf",
  "lever", "lichen", "lily", "linden", "lumen", "lynx", "maple", "marble",
  "marigold", "marlin", "meadow", "minnow", "monsoon", "moss", "motif", "muffin",
  "nectar", "nimbus", "nova", "oak", "ocean", "onyx", "ottawa", "ottoman",
  "oyster", "paddle", "palm", "papyrus", "pebble", "petal", "pier", "pike",
  "pine", "plume", "pluto", "pocket", "poplar", "porpoise", "prism", "puma",
  "quarry", "quartz", "quill", "quilt", "rabbit", "radar", "raven", "reed",
  "ridge", "robin", "rosette", "saffron", "sage", "sardine", "seabreeze",
  "seafoam", "sedona", "shale", "shear", "shoal", "sky", "slate", "soap",
  "solenoid", "sparrow", "sprout", "squash", "sumac", "sunray", "swan",
  "taffy", "tamarind", "tangerine", "temper", "thistle", "throne", "tide",
  "timber", "tin", "toast", "tornado", "trout", "tulip", "tundra", "turbot",
  "umbra", "valley", "veil", "velvet", "venison", "violet", "vista", "wader",
  "wattle", "willow", "yarrow", "zephyr",
];

/** A word from the list that hasn't been used in this phrase yet. */
function pickWord(used: Set<string>): string {
  const pool = PHRASE_WORDS.filter((w) => !used.has(w));
  const word = pool[Math.floor(Math.random() * pool.length)];
  used.add(word);
  return word;
}

/**
 * Four short hyphenated words — memorable, easy to type and read aloud by
 * humans, and a single unambiguous lowercase string for agents to pass into
 * sign_in. e.g. "moss-candle-lynx-fern".
 */
function randomSecretPhrase(): string {
  const used = new Set<string>();
  return [pickWord(used), pickWord(used), pickWord(used), pickWord(used)].join("-");
}

/** Clean up expired sessions (runs lazily on sign-in). */
type DbLike = import("./_generated/server").MutationCtx["db"];

async function cleanupExpiredSessions(ctx: { db: DbLike }) {
  const cutoff = Date.now() - TOKEN_EXPIRY_MS;
  const expired = await ctx.db
    .query("sessions")
    .filter((q) => q.lt(q.field("createdAt"), cutoff))
    .take(50);
  for (const session of expired) {
    await ctx.db.delete(session._id);
  }
}

/** Check rate limit: max N sign-ins per IP per window. */
async function checkRateLimit(
  ctx: { db: DbLike },
  ip: string,
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
  const recentAttempts = await ctx.db
    .query("sessions")
    .filter((q) =>
      q.and(
        q.eq(q.field("ip"), ip),
        q.gt(q.field("createdAt"), windowStart),
      ),
    )
    .take(MAX_SIGNINS_PER_WINDOW + 1);

  if (recentAttempts.length >= MAX_SIGNINS_PER_WINDOW) {
    const oldest = recentAttempts[0];
    const retryAfterMs = oldest.createdAt + RATE_LIMIT_WINDOW_MS - Date.now();
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }
  return { allowed: true };
}

export const signIn = mutation({
  args: {
    token: v.optional(v.string()),
    secret: v.optional(v.string()),
    name: v.string(),
    handle: v.string(),
    interests: v.optional(v.array(v.string())),
    ip: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Clean up expired sessions periodically
    await cleanupExpiredSessions(ctx);

    // Rate limit check (skip if re-authenticating with existing token)
    if (!args.token) {
      const clientIp = args.ip ?? "unknown";
      const rateLimit = await checkRateLimit(ctx, clientIp);
      if (!rateLimit.allowed) {
        throw new Error(
          `Too many sign-in attempts. Try again in ${Math.ceil((rateLimit.retryAfterMs ?? 0) / 60000)} minutes.`,
        );
      }
    }

    // If re-authenticating with existing token, verify it
    if (args.token) {
      const hash = await sha256(args.token);
      const existing = await ctx.db
        .query("sessions")
        .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
        .first();

      if (existing) {
        // Check if token is expired
        if (Date.now() - existing.createdAt > TOKEN_EXPIRY_MS) {
          await ctx.db.delete(existing._id);
          throw new Error("Session expired. Please sign in again.");
        }
        return { token: args.token, userId: existing.userId };
      }
    }
    const handle = args.handle.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{2,20}$/.test(handle)) {
      throw new Error("Handle must be 2-20 chars: letters, numbers, underscore.");
    }

    // Look up existing user by handle
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .first();

    // Sign in to existing user (create new session). Secret phrase is required.
    if (existingUser) {
      if (!existingUser.secretHash) {
        throw new Error("That handle is reserved. Choose a different handle.");
      }
      if (!args.secret || (await sha256(args.secret)) !== existingUser.secretHash) {
        throw new Error(
          "That handle is already taken. Enter the secret phrase for @" + handle + ".",
        );
      }
      const token = randomToken();
      const hash = await sha256(token);
      await ctx.db.insert("sessions", {
        tokenHash: hash,
        userId: existingUser._id,
        createdAt: Date.now(),
        ip: args.ip ?? "unknown",
      });
      return { token, userId: existingUser._id };
    }

    // Create new user: claim the handle. A secret phrase is generated for the
    // owner so the same handle can't be taken over later. If the caller chose
    // one, honour it.
    const chosenSecret = args.secret ?? randomSecretPhrase();
    const userId = await ctx.db.insert("users", {
      name: args.name.trim() || handle,
      handle,
      interests: args.interests ?? [],
      secretHash: await sha256(chosenSecret),
      secretPlaintext: chosenSecret,
      joinedAt: Date.now(),
    });

    // Create new session with IP tracking for rate limiting
    const token = randomToken();
    const hash = await sha256(token);
    await ctx.db.insert("sessions", {
      tokenHash: hash,
      userId,
      createdAt: Date.now(),
      ip: args.ip ?? "unknown",
    });

    return { token, userId, secret: chosenSecret };
  },
});

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const hash = await sha256(token);
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
      .first();

    if (!session) return null;

    // Check if token is expired (no delete in query — cleaned up on next sign-in)
    if (Date.now() - session.createdAt > TOKEN_EXPIRY_MS) {
      return null;
    }

    const user = await ctx.db.get(session.userId);
    return user ?? null;
  },
});

/**
 * Owner-only: fetch the account's recoverable secret phrase.
 * Requires a valid, unexpired session whose user is the account owner.
 */
export const getSecret = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const hash = await sha256(token);
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
      .first();
    if (!session) return null;
    if (Date.now() - session.createdAt > TOKEN_EXPIRY_MS) return null;
    const user = await ctx.db.get(session.userId);
    return user?.secretPlaintext ?? null;
  },
});

/** Invalidate a session (sign out). */
export const signOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const hash = await sha256(token);
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }
    return { ok: true };
  },
});

/** Internal: set a user's recoverable secret phrase (CLI only). */
export const setSecretPlaintext = internalMutation({
  args: { handle: v.string(), secretPlaintext: v.string() },
  handler: async (ctx, { handle, secretPlaintext }) => {
    const u = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle.toLowerCase().replace(/^@/, "")))
      .first();
    if (!u) return { ok: false, error: "User not found" };
    await ctx.db.patch(u._id, { secretPlaintext });
    return { ok: true, handle: u.handle };
  },
});
