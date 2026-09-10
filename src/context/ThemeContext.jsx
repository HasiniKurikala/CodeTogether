import React, { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {}
})

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('codetogether-theme')
      return saved === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme)
      localStorage.setItem('codetogether-theme', theme)
    } catch {}
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export default ThemeContext
