import type { AuthUser } from './auth'

let cachedAdminIdSet: Set<string> | null = null
let cachedAdminUsernameSet: Set<string> | null = null
let cachedEnvKey = ''

function parseList(envValue?: string | null): Set<string> {
  if (!envValue) return new Set()
  return new Set(
    envValue
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  )
}

function getAdminSets() {
  const key = `${process.env.ADMIN_USER_IDS || ''}__${process.env.ADMIN_USERNAMES || ''}`
  if (key === cachedEnvKey && cachedAdminIdSet && cachedAdminUsernameSet) {
    return {
      adminIdSet: cachedAdminIdSet,
      adminUsernameSet: cachedAdminUsernameSet,
    }
  }

  cachedAdminIdSet = parseList(process.env.ADMIN_USER_IDS)
  cachedAdminUsernameSet = parseList(process.env.ADMIN_USERNAMES)
  cachedEnvKey = key

  return {
    adminIdSet: cachedAdminIdSet,
    adminUsernameSet: cachedAdminUsernameSet,
  }
}

export function isAdminUser(user: AuthUser): boolean {
  const { adminIdSet, adminUsernameSet } = getAdminSets()
  if (adminIdSet.size === 0 && adminUsernameSet.size === 0) {
    // Fallback: allow default admin username in development
    if (process.env.NODE_ENV !== 'production') {
      return true
    }
    return user.username === 'admin'
  }

  return adminIdSet.has(user.id) || adminUsernameSet.has(user.username)
}

export function requireAdmin(user: AuthUser) {
  if (!isAdminUser(user)) {
    const error: any = new Error('Forbidden')
    error.statusCode = 403
    throw error
  }
}

