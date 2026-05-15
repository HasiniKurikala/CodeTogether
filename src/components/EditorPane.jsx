import React, { useState, useEffect, useRef } from 'react'
import Editor from './Editor'
import useRoom from '../hooks/useRoom'
import { useUserProjects } from '../hooks/useUserProjects'
import { runCode } from '../utils/piston'

export default function EditorPane({ roomId }){
  const { code, language, users, updateCode, updateLanguage } = useRoom(roomId)
  const { saveProject, user } = useUserProjects()
  const [showOutput, setShowOutput] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [stdin, setStdin] = useState('')
  const saveTimeoutRef = useRef(null)

  // Auto-save project when code/language changes
  useEffect(() => {
    if (!user) return

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce save by 2 seconds
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveProject(roomId, {
          roomId,
          code,
          language,
          name: `Room ${roomId}`
        })
      } catch (err) {
        console.error('[EditorPane] Failed to save project:', err)
      }
    }, 2000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [code, language, user, roomId, saveProject])

  const handleEditorChange = ({ code: newCode, language: newLang }) => {
    if (newCode !== undefined) updateCode(newCode)
    if (newLang) updateLanguage(newLang)
  }

  const handleRunCode = async () => {
    console.log('[EditorPane] Run button clicked')
    setShowOutput(true)
    setIsRunning(true)
    setOutput('')
    setError('')

    // small delay to let output panel render, then scroll into view
    setTimeout(() => {
      const el = document.getElementById('output-panel')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 50)

    try {
      const result = await runCode(language, code, stdin)
      // result.output contains combined stdout/stderr
      setOutput(result.output || result.stdout || '')
    } catch (err) {
      console.error('[EditorPane] runCode error', err)
      setError(err.message || String(err))
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <section style={{flex:1,display:'flex',flexDirection:'column',height:'100vh'}}>
      <div style={{padding:12,borderBottom:'1px solid #333',backgroundColor:'#1e1e1e',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h3 style={{margin:0,color:'#fff'}}>Collaborative Editor</h3>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <div style={{color:'#ccc',fontSize:13}}>Room: {roomId} • Users: {Object.keys(users || {}).length}</div>
          <button
            onClick={handleRunCode}
            style={{padding:'8px 16px',borderRadius:8,border:'none',background:'#238636',color:'#fff',fontWeight:600,cursor:'pointer'}}
          >
            Run
          </button>
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}}>
        <div style={{flex:1,overflow:'hidden'}}>
          <Editor
            code={code}
            language={language}
            onChange={handleEditorChange}
            readOnly={false}
          />
        </div>

        {showOutput && (
          <div style={{display:'flex',flexDirection:'column',borderTop:'1px solid #333',minHeight:60,maxHeight:240}}>
            <div style={{flex:0,borderBottom:'1px solid #333',background:'#0f1117'}}>
              <div style={{padding:12,fontWeight:600,color:'#fff',fontSize:13}}>
                Stdin Input (optional)
              </div>
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Enter program input here (one item per line)..."
                style={{width:'100%',padding:8,borderTop:'1px solid #333',background:'#151922',color:'#a7b0c0',border:'none',fontFamily:'monospace',fontSize:12,resize:'none',outline:'none',height:60}}
              />
            </div>
          </div>
        )}

        {showOutput && (
          <div id="output-panel" style={{borderTop:'1px solid #333',background:'#0f1117',display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
            <div style={{padding:12,borderBottom:'1px solid #333',fontWeight:600,color:'#fff',fontSize:13}}>
              Output {isRunning && '(running...)'}
            </div>
            <pre style={{flex:1,overflow:'auto',margin:0,padding:12,color:error?'#f85149':'#a7b0c0',fontFamily:'monospace',fontSize:12,whiteSpace:'pre-wrap',wordWrap:'break-word'}}>
              {error ? error : (output || '(no output)')}
            </pre>
          </div>
        )}
      </div>
    </section>
  )
}
