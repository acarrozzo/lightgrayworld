'use client'

import { useEffect, useState } from 'react'

const svgCache = new Map<string, string>()

const sanitizeColor = (color: string) => {
  const hexColor = color.trim()
  return /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(hexColor) ? hexColor : '#ffffff'
}

export function colorizeSvg(svg: string, color: string) {
  const safeColor = sanitizeColor(color)
  let output = svg

  output = output.replace(
    /<svg([^>]*)>/,
    (_, attrs) => {
      const filtered = attrs
        .replace(/\sfill="[^"]*"/g, '')
        .replace(/\sstroke="[^"]*"/g, '')
      return `<svg${filtered} fill="${safeColor}" stroke="${safeColor}">`
    }
  )

  output = output
    .replace(/fill="(?!none)[^"]*"/g, `fill="${safeColor}"`)
    .replace(/fill='(?!none)[^']*'/g, `fill='${safeColor}'`)
    .replace(/stroke="(?!none)[^"]*"/g, `stroke="${safeColor}"`)
    .replace(/stroke='(?!none)[^']*'/g, `stroke='${safeColor}'`)

  return output
}

export function useColoredAvatar(avatar: string, color: string) {
  const [svg, setSvg] = useState<string>('')

  useEffect(() => {
    if (!avatar) {
      setSvg('')
      return
    }

    const key = `${avatar}-${color}`
    if (svgCache.has(key)) {
      setSvg(svgCache.get(key) || '')
      return
    }

    let cancelled = false

    fetch(`/img/svg/npc/${avatar}.svg`)
      .then((res) => res.text())
      .then((text) => {
        if (cancelled) return
        const colored = colorizeSvg(text, color)
        svgCache.set(key, colored)
        setSvg(colored)
      })
      .catch(() => {
        if (!cancelled) {
          setSvg('')
        }
      })

    return () => {
      cancelled = true
    }
  }, [avatar, color])

  return svg
}

