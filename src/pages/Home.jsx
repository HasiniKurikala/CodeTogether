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
  const { projects, isLoading, deleteProject, saveProject } = useUserProjects()
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [editingName, setEditingName] = useState('')

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

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedLang, setSelectedLang] = useState('javascript')

  const handleCreateRoom = async (force = false) => {
    if (!user && !force) {
      setShowCreateModal(true)
      return
    }

    const roomId = createRoomId()
    // initialize room with language template
    try {
      const { database } = await import('../firebase/config')
      const { ref, set } = await import('firebase/database')
      const roomRef = ref(database, `rooms/${roomId}`)
      const templates = (await import('../utils/templates')).default
      await set(roomRef, { code: templates[selectedLang] || '// Start coding', language: selectedLang, users: {} })
    } catch (e) {
      console.error('Failed to initialize room', e)
    }

    setShowCreateModal(false)
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
    <main style={{minHeight:'100vh',padding:'32px 20px',display:'grid',placeItems:'center',background:'#0b0f14',color:'#fff'}}>
      <section style={{width:'100%',maxWidth:720,border:'1px solid #1f2630',borderRadius:16,padding:24,background:'#0f1117',boxShadow:'0 20px 50px rgba(0,0,0,0.25)'}}>
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
            onClick={() => handleCreateRoom(false)}
            style={{padding:'12px 16px',border:0,borderRadius:10,background:'#2aa198',color:'#fff',fontWeight:700,cursor:'pointer',fontSize:16}}
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
                    <div style={{fontWeight:600,display:'flex',alignItems:'center',gap:8}}>
                      {editingProjectId === project.projectId ? (
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={async () => {
                            try {
                              await saveProject(project.projectId, { ...project, name: (editingName.trim() || project.projectId) })
                            } catch (err) {
                              console.error('Failed to save project name', err)
                            }
                            setEditingProjectId(null)
                            setEditingName('')
                          }}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              try {
                                await saveProject(project.projectId, { ...project, name: (editingName.trim() || project.projectId) })
                              } catch (err) {
                                console.error('Failed to save project name', err)
                              }
                              setEditingProjectId(null)
                              setEditingName('')
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{padding:6,background:'#0b0f14',color:'#fff',border:'1px solid #333',borderRadius:6}}
                        />
                      ) : (
                        <>
                          <span>{project.name || project.projectId}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingProjectId(project.projectId); setEditingName(project.name || project.projectId) }}
                            title="Edit project name"
                            style={{background:'transparent',border:'none',color:'#9aa6b2',cursor:'pointer'}}
                          >
                            ✏️
                          </button>
                        </>
                      )}
                    </div>
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

      {showCreateModal && (
        <div style={{position:'fixed',inset:0,display:'grid',placeItems:'center',background:'rgba(2,6,23,0.6)'}}>
          <div style={{width:420,background:'#0f1117',padding:20,borderRadius:12,border:'1px solid #222'}}>
            <h3 style={{marginTop:0}}>Create Room</h3>
            <p style={{color:'#a7b0c0'}}>Choose a language for the new room. If you continue as guest your work will not be saved.</p>
            <div style={{display:'flex',gap:8,margin:'12px 0'}}>
              <select value={selectedLang} onChange={(e)=>setSelectedLang(e.target.value)} style={{flex:1,padding:8,background:'#0b0f14',color:'#fff',border:'1px solid #222'}}>
                <option value="c">C</option>
                <option value="cpp">C++</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="typescript">TypeScript</option>
              </select>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
              <button onClick={()=>{setShowCreateModal(false)}} style={{padding:'8px 12px',background:'transparent',border:'1px solid #333',color:'#fff'}}>Cancel</button>
              <button onClick={()=>handleCreateRoom(true)} style={{padding:'8px 12px',background:'#2aa198',border:'none',color:'#fff'}}>Sign In & Create</button>
              <button onClick={()=>handleCreateRoom(true)} style={{padding:'8px 12px',background:'#4f7cff',border:'none',color:'#fff'}}>Continue as Guest</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
