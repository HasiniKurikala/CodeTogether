import React from 'react'
import { useParams, Navigate } from 'react-router-dom'
import EditorPane from '../components/EditorPane'

export default function Editor(){
  const { roomId } = useParams()

  if (!roomId) {
    return <Navigate to="/" replace />
  }

  return (
    <main style={{display:'flex',height:'100vh'}}>
      <EditorPane roomId={roomId} />
    </main>
  )
}
