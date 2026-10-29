/**
 * The little grammar the feed needs and the data does not carry.
 *
 * Enemy names are stored bare ("Ogre", "Fox", "Ice Elemental") and the lines
 * that announce them used to glue "a" in front of every one, which is how
 * "A Ogre is here!" got onto the screen. One helper, shared by the server's
 * spawn and room-broadcast lines, so the article is decided in one place.
 */

/** "an Ogre", "a Fox". Capitalise the article with `{ cap: true }` at a sentence start. */
function withArticle(name, { cap = false } = {}) {
  const text = String(name ?? '').trim()
  const vowel = /^[aeiou]/i.test(text)
  const article = vowel ? 'an' : 'a'
  return `${cap ? article[0].toUpperCase() + article.slice(1) : article} ${text}`
}

module.exports = { withArticle }
