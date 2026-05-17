const express = require('express')
const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')
const path = require('path')
const WebSocket = require('ws')

const app = express()
const PORT = process.env.PORT || 3001
const EXEC_TIMEOUT_MS = Number(process.env.EXEC_TIMEOUT_MS || 30000)
const server = http.createServer(app)
const terminalRooms = new Map()

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
  const { process: docker } = room.activeRun
  room.activeRun = null
  try {
    if (docker.exitCode === null) docker.kill('SIGKILL')
  } catch (e) {}
  if (reason === 'replaced') {
    broadcastToRoom(room, { type: 'status', status: 'stopped' })
  }
}

function startInteractiveDockerRun(roomId, language, sourceCode) {
  const room = getTerminalRoom(roomId)
  stopActiveRun(room, 'replaced')

  const imageMap = {
    python: 'python:3.11-alpine',
    javascript: 'node:20-alpine',
    c: 'gcc:14',
    cpp: 'gcc:14',
    java: 'openjdk:21-jdk-slim'
  }

  const image = imageMap[language]
  if (!image) {
    broadcastToRoom(room, { type: 'error', message: `Unsupported language: ${language}` })
    return
  }

  // Pass code via base64 — avoids slow Windows volume mounts
  const encoded = Buffer.from(sourceCode).toString('base64')

  const runCmdMap = {
    python: `echo '${encoded}' | base64 -d > /tmp/main.py && python -u /tmp/main.py`,
    javascript: `echo '${encoded}' | base64 -d > /tmp/main.js && node /tmp/main.js`,
    c: `echo '${encoded}' | base64 -d > /tmp/main.c && gcc /tmp/main.c -o /tmp/out && /tmp/out`,
    cpp: `echo '${encoded}' | base64 -d > /tmp/main.cpp && g++ /tmp/main.cpp -O2 -std=c++17 -o /tmp/out && /tmp/out`,
    java: `echo '${encoded}' | base64 -d > /tmp/Main.java && javac /tmp/Main.java && java -cp /tmp Main`
  }

  const runCmd = runCmdMap[language]

 const args = [
    'run', '--rm', '--interactive',
    '--network', 'none',
    image,
    'sh', '-c', runCmd
  ]

  const docker = spawn('docker', args, {
    stdio: ['pipe', 'pipe', 'pipe']
  })

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
        startInteractiveDockerRun(roomId, parsed.language.toLowerCase(), parsed.sourceCode)
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

server.listen(PORT, () => {
  console.log(`[executor] API listening on http://localhost:${PORT}`)
})
