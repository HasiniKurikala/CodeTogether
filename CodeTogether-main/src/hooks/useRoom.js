import { useEffect, useState, useRef, useCallback } from 'react'
import { ref, onValue, set, update } from 'firebase/database'
import { database } from '../firebase/config'

const DEFAULT_ROOM = {
  code: '// Start coding...\n',
  language: 'javascript',
  users: {}
}

export default function useRoom(roomId) {
  const [code, setCode] = useState(DEFAULT_ROOM.code)
  const [language, setLanguage] = useState(DEFAULT_ROOM.language)
  const [users, setUsers] = useState(DEFAULT_ROOM.users)

  const debounceRef = useRef(null)
  const unsubscribeRef = useRef(null)

  useEffect(() => {
    if (!roomId) return undefined

    const roomRef = ref(database, `rooms/${roomId}`)

    // Listen for realtime updates
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) {
        // create the room with default values if it doesn't exist
        set(roomRef, DEFAULT_ROOM).catch((err) => console.error('Failed to create room', err))
        setCode(DEFAULT_ROOM.code)
        setLanguage(DEFAULT_ROOM.language)
        setUsers(DEFAULT_ROOM.users)
        return
      }

      const val = snap.val()
      setCode(val.code ?? DEFAULT_ROOM.code)
      setLanguage(val.language ?? DEFAULT_ROOM.language)
      setUsers(val.users ?? DEFAULT_ROOM.users)
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

  const updateCode = useCallback(
    (newCode) => {
      setCode(newCode)
      // debounce writes to firebase
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const roomRef = ref(database, `rooms/${roomId}`)
        update(roomRef, { code: newCode }).catch((err) => console.error('Failed to update code', err))
        debounceRef.current = null
      }, 300)
    },
    [roomId]
  )

  const updateLanguage = useCallback(
    (newLanguage) => {
      setLanguage(newLanguage)
      const roomRef = ref(database, `rooms/${roomId}`)
      update(roomRef, { language: newLanguage }).catch((err) => console.error('Failed to update language', err))
    },
    [roomId]
  )

  return { code, language, users, updateCode, updateLanguage }
}
