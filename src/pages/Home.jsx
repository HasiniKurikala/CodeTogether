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
    if (!auth) return undefined
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
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
      const templates = (await import('../utils/templates')).default
      const initialCode = templates[selectedLang] || '// Start coding'
      const { database } = await import('../firebase/config')
      if (database) {
        const { ref, set } = await import('firebase/database')
        const roomRef = ref(database, `rooms/${roomId}`)
        await set(roomRef, { code: initialCode, language: selectedLang, users: {} })
      } else {
        try {
          localStorage.setItem(`rooms/${roomId}`, JSON.stringify({
            code: initialCode,
            language: selectedLang,
            users: {}
          }))
        } catch {}
      }
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
    if (!auth) {
      alert('Firebase is not configured. Add your Firebase credentials in a .env file to enable Google Sign-In.')
      return
    }
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (err) {
      console.error('Google Sign-In failed:', err)
      alert(`Sign-in failed: ${err.message}`)
    }
  }

  const handleSignOut = async () => {
    if (!auth) return
    try {
      await signOut(auth)
    } catch (err) {
      console.error('Sign-out failed:', err)
    }
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
    <main className="home-page">
      <div className="home-stack">
        <section className="surface-card hero-panel">
          <div className="hero-shell">
            <h1 className="section-heading">CodeTogether</h1>
            <p className="section-copy">Create or join a room to code together in real time.</p>
          </div>

          {user ? (
            <div className="surface-panel" style={{ padding: 14, marginBottom: 20, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img
                  src={user.photoURL || 'https://www.gravatar.com/avatar/?d=mp&s=64'}
                  alt={user.displayName || 'User avatar'}
                  style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid var(--border)' }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user.displayName || 'Signed in user'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user.email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="secondary-button"
                style={{ padding: '6px 14px', fontSize: 13 }}
              >
                Sign out
              </button>
            </div>
          ) : null}

          <div className="hero-actions">
            <button
              type="button"
              onClick={() => handleCreateRoom(false)}
              className="primary-button"
              style={{ fontSize: 16, padding: '14px 20px' }}
            >
              <span>⚡</span>
              <span>Create Room</span>
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={roomInput}
                onChange={(event) => setRoomInput(event.target.value)}
                placeholder="Enter 6-char room ID"
                maxLength={6}
                className="home-input"
              />
              <button
                type="button"
                onClick={handleJoinRoom}
                className="secondary-button"
                style={{ whiteSpace: 'nowrap' }}
              >
                Join Room
              </button>
            </div>

            {!user && (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="auth-button"
                style={{ justifyContent: 'center' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign in with Google</span>
              </button>
            )}
          </div>

          {user && projects.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, color: 'var(--text-primary)' }}>Your Saved Projects</h3>
              <div className="projects-grid">
                {projects.map((project) => (
                  <div
                    key={project.projectId}
                    onClick={() => handleOpenProject(project.projectId)}
                    className="project-card"
                  >
                    <div>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
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
                            className="inline-edit-input"
                            style={{ padding: 4, width: 'auto' }}
                          />
                        ) : (
                          <>
                            <span>{project.name || project.projectId}</span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setEditingProjectId(project.projectId); setEditingName(project.name || project.projectId) }}
                              title="Edit project name"
                              className="ghost-button"
                              style={{ padding: 2 }}
                            >
                              ✏️
                            </button>
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {project.language || 'unknown'} • ID: {project.projectId}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteProject(project.projectId, e)}
                      className="ghost-button"
                      style={{ color: '#ef4444' }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {user && isLoading && (
            <div style={{ marginTop: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading projects...
            </div>
          )}
        </section>
      </div>

      {showCreateModal && (
        <div className="dialog-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--text-primary)' }}>Create Room</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
              Choose a starter language for your new collaborative room.
            </p>
            <div style={{ display: 'flex', gap: 8, margin: '14px 0' }}>
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="pill-select"
                style={{ width: '100%' }}
              >
                <option value="c">C</option>
                <option value="cpp">C++</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="secondary-button"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCreateRoom(true)}
                className="primary-button"
              >
                Create & Enter
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
