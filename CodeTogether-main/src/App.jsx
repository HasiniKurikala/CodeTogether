import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Editor from './pages/Editor'
import Navbar from './components/Navbar'

export default function App(){
  return (
    <>
      <Navbar />
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/room/:roomId' element={<Editor />} />
      </Routes>
    </>
  )
}
