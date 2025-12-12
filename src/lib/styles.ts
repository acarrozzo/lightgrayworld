// Reusable style classes for consistent theming across the application

export const inputStyles = {
  // Base input styles for dark theme - refined and modern
  base: "appearance-none relative block w-full px-4 py-2.5 border border-gray-700/50 placeholder-gray-500 text-white bg-gray-800/50 backdrop-blur-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 text-sm",
  
  // Login form specific styles
  login: {
    username: "appearance-none relative block w-full px-4 py-2.5 border border-gray-700/50 placeholder-gray-500 text-white bg-gray-800/50 backdrop-blur-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 focus:z-10 transition-all duration-200 text-sm",
    email: "appearance-none relative block w-full px-4 py-2.5 border border-gray-700/50 placeholder-gray-500 text-white bg-gray-800/50 backdrop-blur-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 focus:z-10 transition-all duration-200 text-sm",
    password: "appearance-none relative block w-full px-4 py-2.5 border border-gray-700/50 placeholder-gray-500 text-white bg-gray-800/50 backdrop-blur-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 focus:z-10 transition-all duration-200 text-sm"
  },
  
  // Chat input styles
  chat: "flex-1 px-4 py-2.5 bg-gray-800/50 text-white border border-gray-700/50 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 text-sm transition-all duration-200",
  
  // Button styles - refined and modern
  button: {
    primary: "group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200 shadow-sm hover:shadow",
    chat: "px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-r-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow",
    link: "text-indigo-400 hover:text-indigo-300 transition-colors duration-200"
  }
}

// Utility function to combine base styles with additional classes
export const combineStyles = (base: string, additional: string = "") => {
  return `${base} ${additional}`.trim()
}
