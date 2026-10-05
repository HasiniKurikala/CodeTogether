import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useRoom from '../hooks/useRoom'
import { useTheme } from '../context/ThemeContext'
import { database } from '../firebase/config'
import { ref, get, set, remove } from 'firebase/database'

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export default function Navbar({
  roomId,
  language: propLanguage,
  users: propUsers,
  updateLanguage: propUpdateLanguage,
  onRun,
  onShare
}) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const room = useRoom(!propLanguage ? roomId : null)
  const language = propLanguage ?? room.language
  const users = propUsers ?? room.users
  const updateLanguage = propUpdateLanguage ?? room.updateLanguage
  const code = room.code

  const [isEditingRoomId, setIsEditingRoomId] = useState(false)
  const [newRoomIdInput, setNewRoomIdInput] = useState('')
  const [renameError, setRenameError] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      if (onShare) onShare()
    } catch {
      // Fallback
    }
  }

  const handleOpenRenameModal = () => {
    setNewRoomIdInput(roomId || '')
    setRenameError('')
    setIsEditingRoomId(true)
  }

  const handleConfirmRename = async () => {
    const trimmed = newRoomIdInput.trim()
    if (!/^[a-zA-Z0-9]{6}$/.test(trimmed)) {
      setRenameError('Room ID must be exactly 6 alphanumeric characters.')
      return
    }

    if (trimmed === roomId) {
      setIsEditingRoomId(false)
      return
    }

    setIsRenaming(true)
    setRenameError('')

    try {
      if (database) {
        const oldRef = ref(database, `rooms/${roomId}`)
        const newRef = ref(database, `rooms/${trimmed}`)

        const snap = await get(oldRef)
        const roomData = snap.exists() ? snap.val() : { code, language, users: {} }

        // Copy to new room ID
        await set(newRef, roomData)
        // Clean up old room ID
        await remove(oldRef)
      } else {
        // Fallback localStorage
        try {
          const cached = localStorage.getItem(`rooms/${roomId}`)
          if (cached) {
            localStorage.setItem(`rooms/${trimmed}`, cached)
            localStorage.removeItem(`rooms/${roomId}`)
          } else {
            localStorage.setItem(`rooms/${trimmed}`, JSON.stringify({ code, language, users: {} }))
          }
        } catch { }
      }

      setIsEditingRoomId(false)
      navigate(`/room/${trimmed}`, { replace: true })
    } catch (err) {
      console.error('Failed to rename room ID:', err)
      setRenameError(err.message || 'Failed to rename room')
    } finally {
      setIsRenaming(false)
    }
  }

  // Active user array for avatars
  const activeUserList = Object.entries(users || {}).filter(([_, u]) => u && u.online !== false)

  if (!roomId) {
    return (
      <header className="navbar-shell">
        <div className="navbar-brand">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <span>CodeTogether</span>
          </Link>
        </div>

        <div className="navbar-meta">
          <button
            type="button"
            className="icon-button theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>
    )
  }

  return (
    <>
      <header className="navbar-shell">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/" className="navbar-brand">
            <span style={{ fontSize: 20 }}>⚡</span>
            <span>CodeTogether</span>
          </Link>

          <div className="room-title surface-panel" style={{ padding: '8px 12px', minWidth: 0 }}>
            <span className="badge" style={{ background: 'color-mix(in srgb, var(--surface-2) 84%, transparent)', color: 'var(--text-secondary)' }}>
              Room ID: {roomId}
            </span>
            <button type="button" className="icon-button" onClick={handleOpenRenameModal} title="Edit room ID" aria-label="Edit room ID">
              <PencilIcon />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={language}
              onChange={(e) => updateLanguage(e.target.value)}
              className="pill-select"
              aria-label="Select language"
            >
              <option value="c">C</option>
              <option value="cpp">C++</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
            </select>

            <button
              type="button"
              onClick={onRun}
              className="run-button"
              title="Run code (Ctrl + Enter)"
            >
              <span>▶</span>
              <span>Run</span>
            </button>
          </div>
        </div>

        <div className="navbar-meta">
          {/* Collaborator Avatars */}
          <div className="avatar-stack" title={`${activeUserList.length} user(s) online`}>
            {activeUserList.map(([uid, u]) => {
              const name = u?.displayName || 'Guest'
              const initial = (name[0] || 'G').toUpperCase()
              return (
                <div key={uid} className="avatar-circle user-avatar" title={name}>
                  {initial}
                </div>
              )
            })}
          </div>

          <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            {activeUserList.length} {activeUserList.length === 1 ? 'user' : 'users'}
          </span>

          <button
            type="button"
            onClick={handleShare}
            className="secondary-button"
            style={{ padding: '7px 14px', fontSize: 13 }}
          >
            {copied ? '✓ Copied!' : 'Share'}
          </button>

          <button
            type="button"
            className="icon-button theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      {/* Rename Room ID Modal */}
      {isEditingRoomId && (
        <div className="dialog-backdrop" onClick={() => !isRenaming && setIsEditingRoomId(false)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--text-primary)' }}>
              Rename Room ID
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
              Enter a new 6-character alphanumeric ID. This will move the current room code and redirect you to the new URL.
            </p>

            <div style={{ marginBottom: 14 }}>
              <input
                autoFocus
                className="inline-edit-input"
                value={newRoomIdInput}
                onChange={(e) => setNewRoomIdInput(e.target.value)}
                maxLength={6}
                placeholder="e.g. ABC123"
                disabled={isRenaming}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmRename()
                  if (e.key === 'Escape') setIsEditingRoomId(false)
                }}
              />
              {renameError && (
                <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>
                  {renameError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsEditingRoomId(false)}
                disabled={isRenaming}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleConfirmRename}
                disabled={isRenaming}
              >
                {isRenaming ? 'Renaming...' : 'Rename & Redirect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
