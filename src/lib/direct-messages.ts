export const DIRECT_MESSAGE_SNIPPET_LENGTH = 120
export const DIRECT_MESSAGE_HISTORY_LIMIT = 50

export function getCanonicalThreadPair(userOneId: string, userTwoId: string) {
  if (userOneId <= userTwoId) {
    return { userAId: userOneId, userBId: userTwoId, senderIsUserA: true }
  }
  return { userAId: userTwoId, userBId: userOneId, senderIsUserA: false }
}

export function buildDirectMessageSnippet(message: string) {
  const normalized = message.trim()
  if (normalized.length <= DIRECT_MESSAGE_SNIPPET_LENGTH) {
    return normalized
  }
  return `${normalized.slice(0, DIRECT_MESSAGE_SNIPPET_LENGTH - 1)}...`
}
