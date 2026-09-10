const express = require('express')
const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')
const WebSocket = require('ws')

const app = express()
const PORT = process.env.PORT || 3001
const EXEC_TIMEOUT_MS = Number(process.env.EXEC_TIMEOUT_MS || 30000)
const server = http.createServer(app)
const terminalRooms = new Map()

const GCC_PATH = 'C:\\MinGW\\bin\\gcc.exe'
const GPP_PATH = 'C:\\MinGW\\bin\\g++.exe'

app.use(express.json({ limit: '100kb' }))
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }
  next()
})

function createTerminalRoom(roomId) {
  const room = { clients: new Set(), activeRun: null }
  terminalRooms.set(roomId, room)
  return room
}

function getTerminalRoom(roomId) {
  return terminalRooms.get(roomId) || createTerminalRoom(roomId)
}

function broadcastToRoom(room, payload) {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
  for (const client of room.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data)
  }
}

function stopActiveRun(room, reason = 'replaced') {
  if (!room?.activeRun?.process) return
  const { process: proc } = room.activeRun
  room.activeRun = null
  try {
    if (proc.exitCode === null) proc.kill('SIGKILL')
  } catch (e) {}
  if (reason === 'replaced') {
    broadcastToRoom(room, { type: 'status', status: 'stopped' })
  }
}

// --- Native MinGW execution for C and C++ ---
function startNativeRun(roomId, language, sourceCode) {
  const room = getTerminalRoom(roomId)
  stopActiveRun(room, 'replaced')

  const tmpDir = os.tmpdir()
  const isC = language === 'c'
  const srcFile = path.join(tmpDir, isC ? 'main.c' : 'main.cpp')
  const outFile = path.join(tmpDir, 'main.exe')
  const compiler = isC ? GCC_PATH : GPP_PATH
  const compileArgs = isC
    ? [srcFile, '-o', outFile]
    : [srcFile, '-O2', '-std=c++17', '-o', outFile]

  fs.writeFileSync(srcFile, sourceCode, 'utf8')

  broadcastToRoom(room, { type: 'status', status: 'running', language })

  // Step 1: compile
  const compile = spawn(compiler, compileArgs, { stdio: ['pipe', 'pipe', 'pipe'] })

  let compileErr = ''
  compile.stderr.on('data', (chunk) => { compileErr += chunk.toString() })

  compile.on('error', (err) => {
    broadcastToRoom(room, { type: 'error', message: `Compiler not found: ${err.message}` })
    if (room.activeRun === runState) room.activeRun = null
  })

  const runState = { process: compile, roomId, language }
  room.activeRun = runState

  compile.on('close', (code) => {
    if (room.activeRun !== runState) return

    if (code !== 0) {
      broadcastToRoom(room, { type: 'output', stream: 'stderr', data: compileErr })
      broadcastToRoom(room, { type: 'exit', code })
      if (room.activeRun === runState) room.activeRun = null
      return
    }

    // Step 2: run the compiled exe
    const run = spawn(outFile, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    runState.process = run

    run.stdout.on('data', (chunk) => {
      broadcastToRoom(room, { type: 'output', stream: 'stdout', data: chunk.toString() })
    })

    run.stderr.on('data', (chunk) => {
      broadcastToRoom(room, { type: 'output', stream: 'stderr', data: chunk.toString() })
    })

    run.on('error', (err) => {
      if (room.activeRun !== runState) return
      broadcastToRoom(room, { type: 'error', message: err.message })
      if (room.activeRun === runState) room.activeRun = null
    })

    run.on('close', (exitCode) => {
      if (room.activeRun !== runState) return
      if (room.activeRun === runState) room.activeRun = null
      broadcastToRoom(room, { type: 'exit', code: exitCode })
      // Clean up exe
      try { fs.unlinkSync(outFile) } catch (e) {}
    })
  })

  return runState
}

function startNodeRun(roomId, sourceCode) {
  const room = getTerminalRoom(roomId)
  stopActiveRun(room, 'replaced')

  const tmpFile = path.join(os.tmpdir(), 'main.js')
  fs.writeFileSync(tmpFile, sourceCode, 'utf8')

  broadcastToRoom(room, { type: 'status', status: 'running', language: 'javascript' })

  const node = spawn('C:\\Program Files\\node.exe', [tmpFile], {
    stdio: ['pipe', 'pipe', 'pipe']
  })

  const runState = { process: node, roomId, language: 'javascript' }
  room.activeRun = runState

  node.stdout.on('data', (chunk) => {
    broadcastToRoom(room, { type: 'output', stream: 'stdout', data: chunk.toString() })
  })

  node.stderr.on('data', (chunk) => {
    broadcastToRoom(room, { type: 'output', stream: 'stderr', data: chunk.toString() })
  })

  node.on('error', (err) => {
    if (room.activeRun !== runState) return
    broadcastToRoom(room, { type: 'error', message: err.message })
    if (room.activeRun === runState) room.activeRun = null
  })

  node.on('close', (code) => {
    if (room.activeRun !== runState) return
    if (room.activeRun === runState) room.activeRun = null
    broadcastToRoom(room, { type: 'exit', code })
    try { fs.unlinkSync(tmpFile) } catch (e) {}
  })

  return runState
}

// --- Docker execution for Python, JavaScript, Java ---
function startInteractiveDockerRun(roomId, language, sourceCode) {
  const room = getTerminalRoom(roomId)
  stopActiveRun(room, 'replaced')

  const imageMap = {
    python: 'python:3.11-alpine',
    javascript: 'node:20-alpine',
    java: 'eclipse-temurin:21-jdk-alpine' 
  }

  const image = imageMap[language]
  if (!image) {
    broadcastToRoom(room, { type: 'error', message: `Unsupported language: ${language}` })
    return
  }

  const encoded = Buffer.from(sourceCode).toString('base64')

  const runCmdMap = {
    python: `echo '${encoded}' | base64 -d > /tmp/main.py && python -u /tmp/main.py`,
    javascript: `printf '%s' '${encoded}' | base64 -d > /tmp/main.js && node /tmp/main.js`,
    java: `echo '${encoded}' | base64 -d > /tmp/source.java && CLASS=$(sed -n 's/.*public class \\([A-Za-z0-9_]*\\).*/\\1/p' /tmp/source.java | head -1) && cp /tmp/source.java /tmp/$CLASS.java && javac /tmp/$CLASS.java && java -cp /tmp $CLASS`
  }

  const runCmd = runCmdMap[language]

  const args = [
    'run', '--rm', '--interactive',
    '--network', 'none',
    image,
    'sh', '-c', runCmd
  ]

  const docker = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] })

  const runState = { process: docker, roomId, language }
  room.activeRun = runState
  broadcastToRoom(room, { type: 'status', status: 'running', language })

  docker.stdout.on('data', (chunk) => {
    broadcastToRoom(room, { type: 'output', stream: 'stdout', data: chunk.toString() })
  })

  docker.stderr.on('data', (chunk) => {
    const text = chunk.toString()
    const ignorePatterns = [
      /Pulling/i, /Pull complete/i, /Unable to find image/i,
      /Digest:/i, /Status:/i, /layer/i, /Downloading/i,
      /Download complete/i, /Extracting/i, /Already exists/i
    ]
    const filtered = text.split('\n')
      .filter(l => l && !ignorePatterns.some(p => p.test(l)))
      .join('\n')
    if (filtered.trim()) {
      broadcastToRoom(room, { type: 'output', stream: 'stderr', data: filtered })
    }
  })

  docker.on('error', (error) => {
    if (room.activeRun !== runState) return
    broadcastToRoom(room, { type: 'error', message: error.message || 'Docker execution failed' })
    if (room.activeRun === runState) room.activeRun = null
  })

  docker.on('close', (code, signal) => {
    if (room.activeRun !== runState) return
    if (room.activeRun === runState) room.activeRun = null
    broadcastToRoom(room, { type: 'exit', code, signal })
  })

  return runState
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'local-executor' })
})

const wss = new WebSocket.Server({ server, path: '/terminal' })

wss.on('connection', (socket, request) => {
  const requestUrl = new URL(request.url, `http://localhost:${PORT}`)
  const roomId = requestUrl.searchParams.get('roomId') || 'default'
  const room = getTerminalRoom(roomId)

  room.clients.add(socket)

  socket.on('message', (message) => {
    const payload = message.toString()
    try {
      const parsed = JSON.parse(payload)

      if (parsed?.type === 'run' && typeof parsed.language === 'string' && typeof parsed.sourceCode === 'string') {
        const lang = parsed.language.toLowerCase()
if (lang === 'c' || lang === 'cpp') {
          startNativeRun(roomId, lang, parsed.sourceCode)
        } else if (lang === 'javascript') {
          startNodeRun(roomId, parsed.sourceCode)
        } else {
          startInteractiveDockerRun(roomId, lang, parsed.sourceCode)
        }
        return
      }

      if (parsed?.type === 'input' && typeof parsed.data === 'string') {
        if (room.activeRun?.process?.stdin?.writable) {
          room.activeRun.process.stdin.write(parsed.data, 'utf8')
        }
        return
      }

      if (parsed?.type === 'resize') return

    } catch {
      // ignore parse errors
    }
  })

  socket.on('close', () => {
    room.clients.delete(socket)
    if (room.clients.size === 0) {
      stopActiveRun(room, 'no-clients')
    }
  })

  socket.on('error', () => {
    room.clients.delete(socket)
  })
})

// Pre-warm docker containers for faster first-run execution
try {
  spawn('docker', ['run', '--rm', 'python:3.11-alpine', 'python', '--version'], { stdio: 'ignore' })
  spawn('docker', ['run', '--rm', 'eclipse-temurin:21-jdk-alpine', 'java', '--version'], { stdio: 'ignore' })
} catch (err) {
  // Docker Desktop may not be running
}

server.listen(PORT, () => {
  console.log(`[executor] API listening on http://localhost:${PORT}`)
})
