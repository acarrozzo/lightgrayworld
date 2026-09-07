export const runtime = 'nodejs'

import ThemeReference from './ThemeReference'

export const metadata = {
  title: 'Terminal Themes — Light Gray World Tool',
  description:
    'Every semantic colour role in Light Gray RPG, shown across all terminal themes, with what each role means and where it is used.',
}

export default function ThemesPage() {
  return <ThemeReference />
}
