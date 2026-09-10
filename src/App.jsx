import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Editor from './pages/Editor'
import Navbar from './components/Navbar'
import ErrorBoundary from './components/ErrorBoundary'
import { ThemeProvider } from './context/ThemeContext'

export default function App(){
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <div className="app-shell">
          <Routes>
            <Route path='/' element={<><Navbar /><Home /></>} />
            <Route path='/room/:roomId' element={<Editor />} />
          </Routes>
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  )
}


