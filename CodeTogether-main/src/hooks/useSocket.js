import { useEffect, useRef } from 'react'

export default function useSocket(){
  const socketRef = useRef(null)

  useEffect(()=>{
    // Placeholder for real-time socket or WebRTC init
    return ()=>{
      if(socketRef.current) socketRef.current.close?.()
    }
  },[])

  return { socketRef }
}
