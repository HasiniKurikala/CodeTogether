import React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useUserProjects } from '../hooks/useUserProjects'

export default function Home(){
  const navigate = useNavigate()
  const [roomInput, setRoomInput] = useState('')
  const [user, setUser] = useState(null)
  const { projects, isLoading, deleteProject } = useUserProjects()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
    })

    return () => unsubscribe()
  }, [])

  const roomIdPattern = useMemo(() => /^[a-zA-Z0-9]{6}$/, [])

  const createRoomId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let index = 0; index < 6; index += 1) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const handleCreateRoom = () => {
    if (!user) {
      alert('You can create a room without signing in. Sign in later to save and access projects.')
    }
    const roomId = createRoomId()
    navigate(`/room/${roomId}`)
  }

  const handleJoinRoom = () => {
    const trimmedRoomId = roomInput.trim()
    if (!roomIdPattern.test(trimmedRoomId)) return
    navigate(`/room/${trimmedRoomId}`)
  }

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  const handleSignOut = async () => {
    await signOut(auth)
  }

  const handleOpenProject = (projectId) => {
    navigate(`/room/${projectId}`)
  }

  const handleDeleteProject = async (projectId, event) => {
    event.stopPropagation()
    if (confirm('Delete this project?')) {
      try {
        await deleteProject(projectId)
      } catch (err) {
        console.error('Failed to delete project:', err)
      }
    }
  }

  return (
    <main style={{minHeight:'100vh',padding:'32px 20px',display:'grid',placeItems:'center',background:'#0f1117',color:'#fff'}}>
      <section style={{width:'100%',maxWidth:720,border:'1px solid #2a2f3a',borderRadius:16,padding:24,background:'#151922',boxShadow:'0 20px 50px rgba(0,0,0,0.25)'}}>
        <div style={{marginBottom:20}}>
          <h1 style={{margin:'0 0 8px',fontSize:32}}>CodeTogether</h1>
          <p style={{margin:0,color:'#a7b0c0'}}>Create or join a room to code together in real time.</p>
        </div>

        {user ? (
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,padding:12,borderRadius:12,background:'#1b2130'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <img
                src={user.photoURL || 'https://www.gravatar.com/avatar/?d=mp&s=64'}
                alt={user.displayName || 'User avatar'}
                style={{width:44,height:44,borderRadius:'50%'}}
              />
              <div>
                <div style={{fontWeight:600}}>{user.displayName || 'Signed in user'}</div>
                <div style={{fontSize:13,color:'#a7b0c0'}}>{user.email}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              style={{padding:'6px 12px',border:'1px solid #444',borderRadius:8,background:'transparent',color:'#a7b0c0',fontWeight:600,cursor:'pointer',fontSize:12}}
            >
              Sign out
            </button>
          </div>
        ) : null}

        <div style={{display:'grid',gap:12}}>
          <button
            type="button"
            onClick={handleCreateRoom}
            style={{padding:'12px 16px',border:0,borderRadius:10,background:'#4f7cff',color:'#fff',fontWeight:600,cursor:'pointer'}}
          >
            Create Room
          </button>

          <div style={{display:'flex',gap:10}}>
            <input
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value)}
              placeholder="Enter room ID"
              maxLength={6}
              style={{flex:1,padding:'12px 14px',borderRadius:10,border:'1px solid #2a2f3a',background:'#0f1117',color:'#fff',outline:'none'}}
            />
            <button
              type="button"
              onClick={handleJoinRoom}
              style={{padding:'12px 16px',border:'1px solid #2a2f3a',borderRadius:10,background:'#1b2130',color:'#fff',fontWeight:600,cursor:'pointer'}}
            >
              Join Room
            </button>
          </div>

          {!user && (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              style={{padding:'12px 16px',border:'1px solid #2a2f3a',borderRadius:10,background:'#fff',color:'#111',fontWeight:600,cursor:'pointer'}}
            >
              Sign in with Google
            </button>
          )}
        </div>

        {user && projects.length > 0 && (
          <div style={{marginTop:24}}>
            <h3 style={{margin:'0 0 12px',fontSize:16,color:'#fff'}}>Your Projects</h3>
            <div style={{display:'grid',gap:8}}>
              {projects.map((project) => (
                <div
                  key={project.projectId}
                  onClick={() => handleOpenProject(project.projectId)}
                  style={{padding:12,borderRadius:10,border:'1px solid #2a2f3a',background:'#0f1117',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',transition:'all 0.2s'}}
                  onMouseOver={(e) => e.currentTarget.style.background = '#1b2130'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#0f1117'}
                >
                  <div>
                    <div style={{fontWeight:600}}>{project.name || project.projectId}</div>
                    <div style={{fontSize:12,color:'#a7b0c0'}}>{project.language || 'unknown'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteProject(project.projectId, e)}
                    style={{padding:'4px 8px',border:'1px solid #444',borderRadius:6,background:'transparent',color:'#f85149',fontWeight:600,cursor:'pointer',fontSize:11}}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {user && isLoading && (
          <div style={{marginTop:24,textAlign:'center',color:'#a7b0c0'}}>
            Loading projects...
          </div>
        )}
      </section>
    </main>
  )
}
