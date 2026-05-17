import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import Editor from './Editor'
import useRoom from '../hooks/useRoom'
import { useUserProjects } from '../hooks/useUserProjects'
import Navbar from './Navbar'

export default function EditorPane({ roomId }) {
  const { code, language, users, updateCode, updateLanguage } = useRoom(roomId)
  const { saveProject, user } = useUserProjects()
  const saveTimeoutRef = useRef(null)
  const terminalMountRef = useRef(null)
  const terminalRef = useRef(null)
  const fitAddonRef = useRef(null)
  const socketRef = useRef(null)
  const runningRef = useRef(false)
  const runStartRef = useRef(null)
  const inputBufferRef = useRef('')
  const [running, setRunning] = useState(false)
  const [editorHeightPct, setEditorHeightPct] = useState(65)
  const dragRef = useRef(null)
  const NAVBAR_HEIGHT = 64
  const containerRef = useRef(null)
  const [lastExecutionMs, setLastExecutionMs] = useState(null)
  const [hasBufferedInput, setHasBufferedInput] = useState(false)

  // Auto-save on code/language change
  useEffect(() => {
    if (!user) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveProject(roomId, { roomId, code, language, name: `Room ${roomId}` })
      } catch (err) {
        console.error('[EditorPane] Failed to save project:', err)
      }
    }, 2000)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [code, language, user, roomId, saveProject])

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!user) return undefined
    const id = setInterval(async () => {
      try { await saveProject(roomId, { roomId, code, language, name: `Room ${roomId}` }) } catch (e) {}
    }, 30000)
    return () => clearInterval(id)
  }, [user, roomId, code, language, saveProject])

  // Drag resize handler
  useEffect(() => {
    const handleMove = (e) => {
      const containerH = window.innerHeight - NAVBAR_HEIGHT
      const y = e.clientY - NAVBAR_HEIGHT
      const pct = Math.max(20, Math.min(80, (y / containerH) * 100))
      setEditorHeightPct(pct)
    }
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
    const el = dragRef.current
    if (!el) return undefined
    const onDown = (ev) => {
      ev.preventDefault()
      document.addEventListener('mousemove', handleMove)
      document.addEventListener('mouseup', handleUp)
    }
    el.addEventListener('mousedown', onDown)
    return () => el.removeEventListener('mousedown', onDown)
  }, [])

  // Terminal init
  useEffect(() => {
    if (!terminalMountRef.current) return undefined

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'Consolas, Menlo, Monaco, monospace',
      fontSize: 13,
      scrollback: 5000,
      convertEol: true,
      disableStdin: false,
      theme: {
        background: '#000000',
        foreground: '#dfffb0',
        cursor: '#dfffb0',
        selectionBackground: '#1f2937'
      }
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(terminalMountRef.current)
    terminal.writeln('\x1b[2mPress Run to execute your code.\x1b[0m')

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const dataDisposable = terminal.onData((data) => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return

      // Ctrl+C
      if (data === '\u0003') {
        socketRef.current.send(JSON.stringify({ type: 'input', data: '\u0003' }))
        return
      }

      // Backspace
      if (data === '\u007f' || data === '\b') {
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1)
          terminal.write('\b \b')
          setHasBufferedInput(inputBufferRef.current.length > 0)
        }
        return
      }

      // Enter
      if (data === '\r') {
        inputBufferRef.current += '\n'
        terminal.write('\r\n')
        setHasBufferedInput(true)
        return
      }

      // Only allow printable characters
      if (data.length === 1 && data >= ' ') {
        inputBufferRef.current += data
        terminal.write(data)
        setHasBufferedInput(true)
      }
    })

    const onResize = () => {
      requestAnimationFrame(() => {
        try { fitAddon.fit() } catch (e) {}
        if (socketRef.current?.readyState === WebSocket.OPEN && terminal.cols && terminal.rows) {
          socketRef.current.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }))
        }
      })
    }

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
    resizeObserver?.observe(terminalMountRef.current)
    window.addEventListener('resize', onResize)
    requestAnimationFrame(onResize)

    return () => {
      dataDisposable.dispose()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', onResize)
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
      try { terminal.dispose() } catch (e) {}
      terminalRef.current = null
      fitAddonRef.current = null
      runningRef.current = false
    }
  }, [roomId])

  // Refit when editor height changes
  useEffect(() => {
    requestAnimationFrame(() => {
      try { fitAddonRef.current?.fit() } catch (e) {}
    })
  }, [editorHeightPct])

  const handleEditorChange = ({ code: newCode, language: newLang }) => {
    if (newCode !== undefined) updateCode(newCode)
    if (newLang) updateLanguage(newLang)
  }

  const handleSendInput = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return
    if (!inputBufferRef.current) return
    const toSend = inputBufferRef.current.endsWith('\n')
      ? inputBufferRef.current
      : inputBufferRef.current + '\n'
    socketRef.current.send(JSON.stringify({ type: 'input', data: toSend }))
    inputBufferRef.current = ''
    setHasBufferedInput(false)
  }

  const handleRunCode = () => {
    const terminal = terminalRef.current
    if (!terminal) return

    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }

    inputBufferRef.current = ''
    setHasBufferedInput(false)
    terminal.clear()
    terminal.writeln(`\x1b[2mStarting ${language} container...\x1b[0m`)
    setLastExecutionMs(null)
    setRunning(true)
    runningRef.current = true
    runStartRef.current = Date.now()

    const socket = new WebSocket(`ws://localhost:3001/terminal?roomId=${encodeURIComponent(roomId)}`)
    socketRef.current = socket

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'run', roomId, language, sourceCode: code }))
      if (terminal.cols && terminal.rows) {
        socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }))
      }
    }

    socket.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : ''
      let parsed = null
      if (raw && raw.trim().startsWith('{')) {
        try { parsed = JSON.parse(raw) } catch (e) {}
      }

      if (parsed?.type === 'output' && typeof parsed.data === 'string') {
        terminal.write(parsed.data)
        return
      }
      if (parsed?.type === 'status') return
      if (parsed?.type === 'exit') {
        setRunning(false)
        runningRef.current = false
        inputBufferRef.current = ''
        setHasBufferedInput(false)
        if (runStartRef.current !== null) {
          setLastExecutionMs(Date.now() - runStartRef.current)
        }
        terminal.writeln(`\r\n\x1b[2m[process exited with code ${parsed.code ?? 'unknown'}]\x1b[0m`)
        return
      }
      if (parsed?.type === 'error') {
        terminal.writeln(`\r\n\x1b[31m${parsed.message || 'Execution failed'}\x1b[0m`)
        setRunning(false)
        runningRef.current = false
        return
      }
      if (raw && !raw.trim().startsWith('{')) terminal.write(raw)
    }

    socket.onclose = () => {
      setRunning(false)
      runningRef.current = false
    }

    socket.onerror = () => {
      terminal.writeln('\r\n\x1b[31m[connection error — is the server running?]\x1b[0m')
      setRunning(false)
      runningRef.current = false
    }

    terminal.focus()
  }

  const handleClearTerminal = () => {
    try { terminalRef.current?.clear() } catch (e) {}
    terminalRef.current?.writeln('\x1b[2mTerminal cleared.\x1b[0m')
    inputBufferRef.current = ''
    setHasBufferedInput(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0b0f14' }}>
      <Navbar roomId={roomId} onRun={handleRunCode} />

      <main ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: `calc(100vh - ${NAVBAR_HEIGHT}px)` }}>
        <div style={{ height: `${editorHeightPct}%`, overflow: 'hidden' }}>
          <Editor
            code={code}
            language={language}
            onChange={handleEditorChange}
            readOnly={false}
          />
        </div>

        <div ref={dragRef} style={{ height: 8, cursor: 'row-resize', background: '#0f1117' }} />

        <div style={{ flex: 1, minHeight: 120, background: '#000', display: 'flex', flexDirection: 'column', borderTop: '1px solid #111' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #111', color: '#fff', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>Output</span>
              {hasBufferedInput && running && (
                <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>
                  Type inputs then click Send
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {running && <div style={{ color: '#9cc3ff' }}>Running…</div>}
              {lastExecutionMs !== null && !running && <div style={{ color: '#9cc3ff' }}>Last: {lastExecutionMs}ms</div>}
              {hasBufferedInput && running && (
                <button
                  onClick={handleSendInput}
                  style={{ padding: '6px 12px', background: '#1f6feb', color: '#fff', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                >
                  Send Input ↵
                </button>
              )}
              <button onClick={handleClearTerminal} style={{ padding: '6px 10px', background: '#222', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>Clear</button>
            </div>
          </div>
          <div ref={terminalMountRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '4px 8px' }} />
        </div>
      </main>
    </div>
  )
}
