import React, { useState, useEffect } from 'react'
import useRoom from '../hooks/useRoom'
import { Link } from 'react-router-dom'

export default function Navbar({ roomId, onRun, onShare }){
  const { language, users, updateLanguage, name, updateRoomName } = useRoom(roomId)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  useEffect(() => {
    setNameInput(name ?? roomId)
  }, [name, roomId])

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); if (onShare) onShare(); } catch {}
  }

  if (!roomId) {
    return (
      <header style={{height:64,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',background:'#0b0f14',borderBottom:'1px solid #222',color:'#fff'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <Link to="/" style={{fontWeight:800,fontSize:18,color:'#fff',textDecoration:'none'}}>CodeTogether</Link>
          <div style={{display:'flex',alignItems:'center',gap:12,marginLeft:12}}>
            <Link to="/editor" style={{color:'#9aa6b2',textDecoration:'none',fontSize:14}}>Editor</Link>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header style={{height:64,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',background:'#0b0f14',borderBottom:'1px solid #222',color:'#fff'}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <Link to="/" style={{fontWeight:800,fontSize:18,color:'#fff',textDecoration:'none'}}>CodeTogether</Link>
        <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:12}}>
          <select value={language} onChange={(e) => updateLanguage(e.target.value)} style={{padding:8,background:'#111218',color:'#fff',border:'1px solid #222',borderRadius:6}}>
            <option value="c">C</option>
            <option value="cpp">C++</option>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="typescript">TypeScript</option>
          </select>
          <button onClick={onRun} style={{background:'#238636',color:'#fff',padding:'8px 14px',borderRadius:8,border:'none',fontWeight:700}}>Run</button>
        </div>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{fontSize:13,color:'#9aa6b2',display:'flex',alignItems:'center',gap:8}}>
          <div style={{fontWeight:600}}>
            {isEditingName ? (
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={async () => { await updateRoomName(nameInput.trim() || roomId); setIsEditingName(false) }}
                onKeyDown={async (e) => { if (e.key === 'Enter') { await updateRoomName(nameInput.trim() || roomId); setIsEditingName(false) } }}
                style={{padding:6,background:'#0b0f14',color:'#fff',border:'1px solid #333',borderRadius:6}}
              />
            ) : (
              <span onDoubleClick={() => setIsEditingName(true)} style={{cursor:'default'}}>
                {name || roomId}
              </span>
            )}
          </div>
          {!isEditingName && (
            <button onClick={() => setIsEditingName(true)} title="Edit room name" style={{background:'transparent',border:'none',color:'#9aa6b2',cursor:'pointer'}}>✏️</button>
          )}
        </div>
        <div style={{fontSize:13,color:'#9aa6b2'}}>{Object.keys(users||{}).length} users</div>
        <button onClick={handleCopy} style={{padding:'6px 10px',borderRadius:6,background:'#111218',color:'#cbd5e1',border:'1px solid #222'}}>Share</button>
        <button style={{width:40,height:40,borderRadius:20,background:'#222',border:'none'}}>&#128100;</button>
      </div>
    </header>
  )
}
