'use client'

import { useEffect } from 'react'
import { useFontPreferenceStore } from '@/store/fontPreferenceStore'

export default function FontPreferenceApplier() {
  const fontFamily = useFontPreferenceStore((state) => state.fontFamily)

  useEffect(() => {
    const body = document.body
    // Remove both classes first
    body.classList.remove('font-regular', 'font-mono')
    // Add the active class
    body.classList.add(`font-${fontFamily}`)
  }, [fontFamily])

  return null
}

