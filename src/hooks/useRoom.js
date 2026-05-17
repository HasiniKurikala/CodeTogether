import { useEffect, useState, useRef, useCallback } from 'react'
import { ref, onValue, set, update, onDisconnect } from 'firebase/database'
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

  const debounceRef = useRef(null)
  const unsubscribeRef = useRef(null)

  useEffect(() => {
    if (!roomId) return undefined

    // If Firebase realtime `database` is not configured, fall back to local in-memory/localStorage room state.
    if (!database) {
      // Try to read a cached room from localStorage
      try {
        const cached = localStorage.getItem(`rooms/${roomId}`)
        if (cached) {
          const val = JSON.parse(cached)
          setCode(val.code ?? DEFAULT_ROOM.code)
          setLanguage(val.language ?? DEFAULT_ROOM.language)
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

      // No realtime listener; just provide a cleanup function
      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
          debounceRef.current = null
        }
      }
    }

    const roomRef = ref(database, `rooms/${roomId}`)

    // Listen for realtime updates
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) {
        // create the room with default values if it doesn't exist
        set(roomRef, DEFAULT_ROOM).catch((err) => console.error('Failed to create room', err))
        setCode(DEFAULT_ROOM.code)
        setLanguage(DEFAULT_ROOM.language)
        setUsers(DEFAULT_ROOM.users)
          setName(null)
        return
      }

      const val = snap.val()
      setCode(val.code ?? DEFAULT_ROOM.code)
      setLanguage(val.language ?? DEFAULT_ROOM.language)
      setUsers(val.users ?? DEFAULT_ROOM.users)
        setName(val.name ?? null)
    })

    unsubscribeRef.current = unsub

    return () => {
      // cleanup listener and pending debounce
      unsubscribeRef.current?.()
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [roomId])

  // Presence tracking effect
  useEffect(() => {
    if (!roomId) return undefined

    const currentUser = auth.currentUser
    
    // Generate user ID: authenticated users use uid, guests use session storage ID
    let userId
    if (currentUser) {
      userId = currentUser.uid
    } else {
      // Generate or retrieve guest session ID
      const sessionKey = `guest_${roomId}`
      let guestId = sessionStorage.getItem(sessionKey)
      if (!guestId) {
        guestId = 'guest_' + Math.random().toString(36).substr(2, 9)
        sessionStorage.setItem(sessionKey, guestId)
      }
      userId = guestId
    }

    const userPresenceRef = ref(database, `rooms/${roomId}/users/${userId}`)
    const displayName = currentUser?.displayName || 'Guest'

    // Write presence data and set up auto-cleanup on disconnect
    set(userPresenceRef, {
      online: true,
      joinedAt: new Date().toISOString(),
      displayName: displayName
    }).catch((err) => console.error('Failed to set user presence', err))

    // Set up auto-removal on disconnect
    onDisconnect(userPresenceRef)
      .remove()
      .catch((err) => console.error('Failed to set onDisconnect', err))

    return () => {
      // Clean up presence on unmount
      set(userPresenceRef, null).catch(() => {})
    }
  }, [roomId])

  const updateCode = useCallback(
    (newCode) => {
      setCode(newCode)
      // debounce writes to firebase (or localStorage fallback)
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
      if (database) {
        const roomRef = ref(database, `rooms/${roomId}`)
        update(roomRef, { language: newLanguage }).catch((err) => console.error('Failed to update language', err))
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
      try {
        const roomRef = ref(database, `rooms/${roomId}`)
        await update(roomRef, { name: newName })
      } catch (err) {
        console.error('Failed to update room name', err)
      }

      try {
        const user = auth.currentUser
        if (user) {
          const userRoomRef = ref(database, `users/${user.uid}/rooms/${roomId}`)
          await update(userRoomRef, { name: newName })
          const userProjectRef = ref(database, `users/${user.uid}/projects/${roomId}`)
          await update(userProjectRef, { name: newName }).catch(() => {})
        }
      } catch (err) {
        console.error('Failed to update user-saved room name', err)
      }

      setName(newName)
    },
    [roomId]
  )

  return { code, language, users, name, updateCode, updateLanguage, updateRoomName }
}
