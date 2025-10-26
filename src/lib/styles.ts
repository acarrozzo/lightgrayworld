// Reusable style classes for consistent theming across the application

export const inputStyles = {
  // Base input styles for dark theme
  base: "appearance-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm",
  
  // Login form specific styles
  login: {
    username: "appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white bg-gray-700 rounded-t-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm",
    email: "appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm",
    password: "appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white bg-gray-700 rounded-b-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
  },
  
  // Chat input styles
  chat: "flex-1 px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm",
  
  // Button styles
  button: {
    primary: "group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500",
    chat: "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-r-md text-sm",
    link: "text-indigo-400 hover:text-indigo-300"
  }
}

// Utility function to combine base styles with additional classes
export const combineStyles = (base: string, additional: string = "") => {
  return `${base} ${additional}`.trim()
}
