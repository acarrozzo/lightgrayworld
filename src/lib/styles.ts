/**
 * Shared control styles.
 *
 * Every value here is a semantic theme utility, so a control looks correct in
 * whichever terminal theme is selected without this file knowing which one.
 */

export const inputStyles = {
  // Base input styles for dark theme
  base: "appearance-none relative block w-full px-4 py-2.5 border border-line-subtle placeholder-fg-muted text-fg-bright bg-surface-sunken rounded-lg focus:outline-none focus:ring-2 focus:ring-line-focus/40 focus:border-line-focus transition-all duration-200 text-sm",

  // Login form specific styles
  login: {
    username: "appearance-none relative block w-full px-4 py-2.5 border border-line-subtle placeholder-fg-muted text-fg-bright bg-surface-sunken rounded-lg focus:outline-none focus:ring-2 focus:ring-line-focus/40 focus:border-line-focus focus:z-10 transition-all duration-200 text-sm",
    email: "appearance-none relative block w-full px-4 py-2.5 border border-line-subtle placeholder-fg-muted text-fg-bright bg-surface-sunken rounded-lg focus:outline-none focus:ring-2 focus:ring-line-focus/40 focus:border-line-focus focus:z-10 transition-all duration-200 text-sm",
    password: "appearance-none relative block w-full px-4 py-2.5 border border-line-subtle placeholder-fg-muted text-fg-bright bg-surface-sunken rounded-lg focus:outline-none focus:ring-2 focus:ring-line-focus/40 focus:border-line-focus focus:z-10 transition-all duration-200 text-sm"
  },

  // Chat input styles
  chat: "flex-1 px-4 py-2.5 bg-surface-raised/40 text-fg-bright border border-line-subtle/40 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-line-focus/40 focus:border-line-focus text-sm transition-all duration-200",

  // Button styles
  button: {
    primary: "group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-fg-on-accent bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-line-focus/50 focus:ring-offset-2 focus:ring-offset-surface-canvas transition-all duration-200 shadow-md shadow-shadow hover:shadow-lg active:scale-[0.98] disabled:bg-surface-disabled disabled:text-fg-disabled",
    chat: "px-4 py-2.5 bg-accent hover:bg-accent-hover text-fg-on-accent rounded-r-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]",
    link: "text-accent hover:text-accent-hover transition-colors duration-200"
  }
}

// Utility function to combine base styles with additional classes
export const combineStyles = (base: string, additional: string = "") => {
  return `${base} ${additional}`.trim()
}
