import React from 'react'
import { Link } from 'react-router-dom'

export default function Navbar(){
  return (
    <nav style={{padding:12,display:'flex',gap:12,borderBottom:'1px solid #eee'}}>
      <Link to="/">CodeTogether</Link>
      <Link to="/editor">Editor</Link>
    </nav>
  )
}
