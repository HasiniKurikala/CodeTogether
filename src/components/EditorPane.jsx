import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import Editor from './Editor'
import useRoom from '../hooks/useRoom'
import { useUserProjects } from '../hooks/useUserProjects'
import { useTheme } from '../context/ThemeContext'
import Navbar from './Navbar'

export default function EditorPane({ roomId }) {
  const { theme } = useTheme()
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

  // Font size control
  const [fontSize, setFontSize] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('codetogether-fontsize'))
      return saved >= 10 && saved <= 24 ? saved : 14
    } catch {
      return 14
    }
  })

  // Copy code feedback
  const [copiedCode, setCopiedCode] = useState(false)

  // Run history (last 3 runs)
  const [runHistory, setRunHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  // Save font size
  useEffect(() => {
    try {
      localStorage.setItem('codetogether-fontsize', fontSize)
    } catch {}
  }, [fontSize])

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

    const isDark = theme === 'dark'
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', Consolas, Menlo, Monaco, monospace",
      fontSize: 13,
      scrollback: 5000,
      convertEol: true,
      disableStdin: false,
      theme: {
        background: isDark ? '#0f0a05' : '#2a1008',
        foreground: '#FFD6A6',
        cursor: '#FF9A86',
        selectionBackground: isDark ? '#3a2418' : '#5a3020'
      }
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(terminalMountRef.current)
    terminal.writeln('\x1b[2mPress Run (or Ctrl+Enter) to execute your code.\x1b[0m')

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

      // Printable characters
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

  // Update terminal theme when theme changes
  useEffect(() => {
    if (!terminalRef.current) return
    const isDark = theme === 'dark'
    terminalRef.current.options.theme = {
      background: isDark ? '#0f0a05' : '#2a1008',
      foreground: '#FFD6A6',
      cursor: '#FF9A86',
      selectionBackground: isDark ? '#3a2418' : '#5a3020'
    }
  }, [theme])

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

  const handleRunCode = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal) return

    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }

    inputBufferRef.current = ''
    setHasBufferedInput(false)
    terminal.clear()
    terminal.writeln(`\x1b[2mStarting ${language} execution...\x1b[0m`)
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
        const duration = runStartRef.current !== null ? Date.now() - runStartRef.current : null
        if (duration !== null) {
          setLastExecutionMs(duration)
        }

        // Add to run history
        setRunHistory((prev) => [
          {
            id: Date.now(),
            time: new Date().toLocaleTimeString(),
            language,
            durationMs: duration,
            code: parsed.code ?? 0
          },
          ...prev
        ].slice(0, 3))

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
      terminal.writeln('\r\n\x1b[31m[connection error — is the backend server running?]\x1b[0m')
      setRunning(false)
      runningRef.current = false
    }

    terminal.focus()
  }, [roomId, language, code])

  // Ctrl+Enter / Cmd+Enter shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleRunCode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleRunCode])

  const handleClearTerminal = () => {
    try { terminalRef.current?.clear() } catch (e) {}
    terminalRef.current?.writeln('\x1b[2mTerminal cleared.\x1b[0m')
    inputBufferRef.current = ''
    setHasBufferedInput(false)
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {}
  }

  const handleDownloadCode = () => {
    const extMap = {
      javascript: 'main.js',
      python: 'main.py',
      cpp: 'main.cpp',
      c: 'main.c',
      java: 'Main.java'
    }
    const filename = extMap[language] || 'main.txt'
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--background)' }}>
      <Navbar roomId={roomId} onRun={handleRunCode} />

      {/* Editor Sub-toolbar */}
      <div style={{
        height: 40,
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        fontSize: 13,
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="lang-badge">{language.toUpperCase()}</span>
          <span>{code.split('\n').length} lines</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Font size control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 6 }}>
            <button
              type="button"
              className="icon-button"
              style={{ width: 28, height: 28, fontSize: 11, fontWeight: 700 }}
              onClick={() => setFontSize((f) => Math.max(10, f - 1))}
              title="Decrease font size"
            >
              A-
            </button>
            <span style={{ fontSize: 12, minWidth: 28, textAlign: 'center', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {fontSize}px
            </span>
            <button
              type="button"
              className="icon-button"
              style={{ width: 28, height: 28, fontSize: 11, fontWeight: 700 }}
              onClick={() => setFontSize((f) => Math.min(24, f + 1))}
              title="Increase font size"
            >
              A+
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className="secondary-button"
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            {copiedCode ? '✓ Copied!' : 'Copy Code'}
          </button>

          <button
            type="button"
            onClick={handleDownloadCode}
            className="secondary-button"
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            Download
          </button>

          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="secondary-button"
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            History ({runHistory.length})
          </button>
        </div>
      </div>

      {/* Collapsible Run History Panel */}
      {showHistory && (
        <div style={{
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
          padding: '10px 16px',
          fontSize: 13,
          color: 'var(--text-primary)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>Recent Executions (Last 3)</span>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="ghost-button"
              style={{ padding: '2px 6px', fontSize: 11 }}
            >
              Close
            </button>
          </div>

          {runHistory.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>No code runs yet in this session.</div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {runHistory.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: 'var(--surface)',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    fontSize: 12
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{item.language}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{item.time}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {item.durationMs !== null && <span>{item.durationMs}ms</span>}
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: item.code === 0 ? 'rgba(46, 160, 67, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: item.code === 0 ? '#4ade80' : '#f87171',
                      fontWeight: 600
                    }}>
                      exit: {item.code}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main split view */}
      <main
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: `calc(100vh - ${NAVBAR_HEIGHT + 40}px)`
        }}
      >
        <div style={{ height: `${editorHeightPct}%`, overflow: 'hidden' }}>
          <Editor
            code={code}
            language={language}
            fontSize={fontSize}
            onChange={handleEditorChange}
            readOnly={false}
          />
        </div>

        <div ref={dragRef} className="divider-handle" />

        <div className="terminal-panel" style={{ flex: 1, minHeight: 120 }}>
          <div className="terminal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700 }}>Terminal Output</span>
              {hasBufferedInput && running && (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>
                  Input buffered — click Send
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {running && <div style={{ color: 'var(--accent)' }}>Running…</div>}
              {lastExecutionMs !== null && !running && (
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Last: {lastExecutionMs}ms</div>
              )}
              {hasBufferedInput && running && (
                <button
                  type="button"
                  onClick={handleSendInput}
                  className="send-button"
                >
                  Send Input ↵
                </button>
              )}
              <button
                type="button"
                onClick={handleClearTerminal}
                className="secondary-button"
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                Clear
              </button>
            </div>
          </div>
          <div ref={terminalMountRef} className="terminal-output" style={{ flex: 1, minHeight: 0 }} />
        </div>
      </main>
    </div>
  )
}
