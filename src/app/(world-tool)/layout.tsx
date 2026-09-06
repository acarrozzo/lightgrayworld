/**
 * The scroll container for every World Tool page.
 *
 * `globals.css` gives the game shell `html, body { height: 100%; overflow: hidden }`,
 * so nothing scrolls unless a layout says it does. This used to be a three-line
 * file copied into each route, which meant a new page silently clipped at the
 * fold until someone noticed the missing copy — `/skills` and `/spells` both
 * shipped that way. The route group exists so a World Tool page cannot forget.
 *
 * `(world-tool)` is a route group: it shapes the layout tree without appearing
 * in any URL, so these pages stay at `/enemies`, `/rooms`, `/room-desc` and so on.
 */
export default function WorldToolLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ overflow: 'auto', height: '100%' }}>{children}</div>
}
