/**
 * Prisma 6 connected through the Rust engine, where `sslmode=require` meant
 * "encrypt, don't verify the certificate". Prisma 7 uses node-postgres, which
 * verifies by default and therefore rejects Supabase's self-signed chain.
 *
 * `uselibpqcompat=true` restores libpq semantics in pg >= 8.16, so `require`
 * encrypts without verification and an absent `sslmode` falls back to `prefer`
 * (SSL when the server offers it, plaintext for a local Docker Postgres).
 * Explicit `verify-ca` / `verify-full` are left alone.
 */
function normalizeConnectionString(url) {
  if (!url) return url

  const parsed = new URL(url)
  const sslmode = parsed.searchParams.get('sslmode')

  if (sslmode === 'verify-ca' || sslmode === 'verify-full') return url
  if (parsed.searchParams.has('uselibpqcompat')) return url

  parsed.searchParams.set('uselibpqcompat', 'true')
  return parsed.toString()
}

module.exports = { normalizeConnectionString }
