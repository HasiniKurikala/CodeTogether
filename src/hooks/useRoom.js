import { useEffect, useState, useRef, useCallback } from 'react'
import { ref, onValue, set, update, remove, onDisconnect } from 'firebase/database'
import { onAuthStateChanged } from 'firebase/auth'
import { database, auth } from '../firebase/config'

const DEFAULT_ROOM = {
  code: '// Start coding...\n',
  language: 'javascript',
  users: {}
}

export default function useRoom(roomId) {
  const [code, setCode] = useState(DEFAULT_ROOM.code)
  const [language, setLanguage] = useState(DEFAULT_ROOM.language)
  const [users, setUsers] = useState(DEFAULT_ROOM.users)
  const [name, setName] = useState(null)

  const isLocalChange = useRef(false)
  const codeRef = useRef(DEFAULT_ROOM.code)
  const languageRef = useRef(DEFAULT_ROOM.language)
  const debounceRef = useRef(null)
  const unsubscribeRef = useRef(null)

  // Keep refs updated with current state
  useEffect(() => {
    codeRef.current = code
  }, [code])

  useEffect(() => {
    languageRef.current = language
  }, [language])

  useEffect(() => {
    if (!roomId) return undefined

    // If Firebase realtime database is not configured, fall back to localStorage
    if (!database) {
      try {
        const cached = localStorage.getItem(`rooms/${roomId}`)
        if (cached) {
          const val = JSON.parse(cached)
          const nextCode = val.code ?? DEFAULT_ROOM.code
          const nextLang = val.language ?? DEFAULT_ROOM.language
          codeRef.current = nextCode
          languageRef.current = nextLang
          setCode(nextCode)
          setLanguage(nextLang)
          setUsers(val.users ?? DEFAULT_ROOM.users)
        } else {
          setCode(DEFAULT_ROOM.code)
          setLanguage(DEFAULT_ROOM.language)
          setUsers(DEFAULT_ROOM.users)
        }
      } catch (err) {
        setCode(DEFAULT_ROOM.code)
        setLanguage(DEFAULT_ROOM.language)
        setUsers(DEFAULT_ROOM.users)
      }

      // Storage event listener for cross-tab collaboration in guest mode
      const handleStorage = (e) => {
        if (e.key === `rooms/${roomId}` && e.newValue) {
          try {
            const val = JSON.parse(e.newValue)
            if (val.language && val.language !== languageRef.current) {
              languageRef.current = val.language
              setLanguage(val.language)
            }
            if (val.code !== undefined && !isLocalChange.current && val.code !== codeRef.current) {
              codeRef.current = val.code
              setCode(val.code)
            }
            if (val.users) {
              setUsers(val.users)
            }
          } catch {}
        }
      }
      window.addEventListener('storage', handleStorage)

      return () => {
        window.removeEventListener('storage', handleStorage)
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
          debounceRef.current = null
        }
      }
    }

    const roomRef = ref(database, 'rooms/' + roomId)

    // Listen for realtime updates from Firebase
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) {
        set(roomRef, DEFAULT_ROOM).catch((err) => console.error('Failed to create room', err))
        setCode(DEFAULT_ROOM.code)
        codeRef.current = DEFAULT_ROOM.code
        setLanguage(DEFAULT_ROOM.language)
        languageRef.current = DEFAULT_ROOM.language
        setUsers(DEFAULT_ROOM.users)
        setName(null)
        return
      }

      const val = snap.val() || {}

      // Update language when changed remotely
      if (val.language && val.language !== languageRef.current) {
        languageRef.current = val.language
        setLanguage(val.language)
      }

      // Update code when changed remotely (only if not local change)
      if (val.code !== undefined) {
        if (isLocalChange.current) {
          // If the Firebase update reflects our local code, clear the local change flag
          if (val.code === codeRef.current) {
            isLocalChange.current = false
          }
        } else {
          // Remote update from another user
          if (val.code !== codeRef.current) {
            codeRef.current = val.code
            setCode(val.code)
          }
        }
      }

      // Update users and name
      if (val.users !== undefined) {
        setUsers(val.users || {})
      }
      setName(val.name ?? null)
    })

    unsubscribeRef.current = unsub

    return () => {
      // Ensure listener is cleaned up properly on unmount
      if (typeof unsubscribeRef.current === 'function') {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [roomId])

  // Presence tracking effect
  useEffect(() => {
    if (!roomId) return undefined

    // For guests generate a session ID: 'guest_' + Math.random().toString(36).substr(2, 9)
    // stored in sessionStorage so it persists across re-renders
    const sessionKey = 'guest_session_id'
    let guestId = sessionStorage.getItem(sessionKey)
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substr(2, 9)
      sessionStorage.setItem(sessionKey, guestId)
    }

    let userPresenceRef = null

    const writePresence = (currentUser) => {
      // For signed-in users use auth.currentUser.uid as userId, else guestId
      const userId = currentUser?.uid || guestId
      const displayName = currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Guest')
      const presenceData = {
        online: true,
        displayName,
        joinedAt: new Date().toISOString()
      }

      if (!database) {
        setUsers((prev) => ({
          ...(prev || {}),
          [userId]: presenceData
        }))
        return () => {}
      }

      userPresenceRef = ref(database, `rooms/${roomId}/users/${userId}`)

      // On mount write to rooms/{roomId}/users/{userId} with { online: true, displayName, joinedAt }
      set(userPresenceRef, presenceData).catch((err) => console.error('Failed to set user presence', err))

      // Use onDisconnect().remove() to clean up
      onDisconnect(userPresenceRef)
        .remove()
        .catch((err) => console.error('Failed to set onDisconnect', err))

      return () => {
        if (userPresenceRef) {
          remove(userPresenceRef).catch(() => {})
        }
      }
    }

    let cleanupPresence = () => {}

    if (auth) {
      const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
        cleanupPresence()
        cleanupPresence = writePresence(currentUser)
      })

      return () => {
        unsubscribeAuth()
        cleanupPresence()
      }
    } else {
      cleanupPresence = writePresence(null)
      return () => {
        cleanupPresence()
      }
    }
  }, [roomId])

  const updateCode = useCallback(
    (newCode) => {
      isLocalChange.current = true
      codeRef.current = newCode
      setCode(newCode)

      // Debounce writes to 300ms — does not block reads
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        if (database) {
          const roomRef = ref(database, `rooms/${roomId}`)
          update(roomRef, { code: newCode }).catch((err) => console.error('Failed to update code', err))
        } else {
          try {
            const cached = JSON.parse(localStorage.getItem(`rooms/${roomId}`) || '{}')
            cached.code = newCode
            localStorage.setItem(`rooms/${roomId}`, JSON.stringify(cached))
          } catch (err) {
            // ignore storage errors
          }
        }
        debounceRef.current = null
      }, 300)
    },
    [roomId]
  )

  const updateLanguage = useCallback(
    (newLanguage) => {
      setLanguage(newLanguage)
      languageRef.current = newLanguage

      if (database) {
        // Writes new language to Firebase at rooms/{roomId}/language
        const langRef = ref(database, `rooms/${roomId}/language`)
        set(langRef, newLanguage).catch((err) => console.error('Failed to update language', err))
      } else {
        try {
          const cached = JSON.parse(localStorage.getItem(`rooms/${roomId}`) || '{}')
          cached.language = newLanguage
          localStorage.setItem(`rooms/${roomId}`, JSON.stringify(cached))
        } catch (err) {
          // ignore storage errors
        }
      }
    },
    [roomId]
  )

  const updateRoomName = useCallback(
    async (newName) => {
      if (database) {
        try {
          const roomRef = ref(database, `rooms/${roomId}`)
          await update(roomRef, { name: newName })
        } catch (err) {
          console.error('Failed to update room name', err)
        }

        try {
          const user = auth?.currentUser
          if (user) {
            const userRoomRef = ref(database, `users/${user.uid}/rooms/${roomId}`)
            await update(userRoomRef, { name: newName })
            const userProjectRef = ref(database, `users/${user.uid}/projects/${roomId}`)
            await update(userProjectRef, { name: newName }).catch(() => {})
          }
        } catch (err) {
          console.error('Failed to update user-saved room name', err)
        }
      } else {
        try {
          const cached = JSON.parse(localStorage.getItem(`rooms/${roomId}`) || '{}')
          cached.name = newName
          localStorage.setItem(`rooms/${roomId}`, JSON.stringify(cached))
        } catch (err) {
          // ignore storage errors
        }
      }

      setName(newName)
    },
    [roomId]
  )

  return { code, language, users, name, updateCode, updateLanguage, updateRoomName, isLocalChange }
}
