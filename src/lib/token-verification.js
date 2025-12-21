const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for socket authentication')
}

/**
 * Verify a JWT sent via Socket.IO auth and return stable identity fields.
 * Returns null if verification fails.
 */
function verifySocketToken(token) {
  if (!token || typeof token !== 'string') {
    return null
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)

    if (!decoded?.id || !decoded?.username) {
      return null
    }

    return {
      userId: decoded.id,
      username: decoded.username,
      scopes: decoded.scopes,
    }
  } catch (error) {
    return null
  }
}

module.exports = {
  verifySocketToken,
}

