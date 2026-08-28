// Reusable style classes for consistent theming across the application

export const inputStyles = {
  // Base input styles for dark theme
  base: "appearance-none relative block w-full px-4 py-2.5 border border-gray-700/40 placeholder-gray-500 text-white bg-gray-800/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/40 transition-all duration-200 text-sm",

  // Login form specific styles
  login: {
    username: "appearance-none relative block w-full px-4 py-2.5 border border-gray-700/40 placeholder-gray-500 text-white bg-gray-800/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/40 focus:z-10 transition-all duration-200 text-sm",
    email: "appearance-none relative block w-full px-4 py-2.5 border border-gray-700/40 placeholder-gray-500 text-white bg-gray-800/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/40 focus:z-10 transition-all duration-200 text-sm",
    password: "appearance-none relative block w-full px-4 py-2.5 border border-gray-700/40 placeholder-gray-500 text-white bg-gray-800/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/40 focus:z-10 transition-all duration-200 text-sm"
  },

  // Chat input styles
  chat: "flex-1 px-4 py-2.5 bg-gray-800/40 text-white border border-gray-700/40 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 text-sm transition-all duration-200",

  // Button styles
  button: {
    primary: "group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200 shadow-md shadow-indigo-950/40 hover:shadow-lg active:scale-[0.98]",
    chat: "px-4 py-2.5 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-r-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]",
    link: "text-indigo-400 hover:text-indigo-300 transition-colors duration-200"
  }
}

// Utility function to combine base styles with additional classes
export const combineStyles = (base: string, additional: string = "") => {
  return `${base} ${additional}`.trim()
}
