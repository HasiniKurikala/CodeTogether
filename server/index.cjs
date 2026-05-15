const express = require('express')
const { spawn } = require('child_process')

const app = express()
const PORT = process.env.PORT || 3001
const EXEC_TIMEOUT_MS = Number(process.env.EXEC_TIMEOUT_MS || 30000)

app.use(express.json({ limit: '100kb' }))

const LANGUAGE_CONFIG = {
  python: {
    image: 'python:3.11-alpine',
    command: (code) => `printf %s "${Buffer.from(code).toString('base64')}" | base64 -d > /tmp/main.py && python /tmp/main.py`
  },
  javascript: {
    image: 'node:20-alpine',
    command: (code) => `printf %s "${Buffer.from(code).toString('base64')}" | base64 -d > /tmp/main.js && node /tmp/main.js`
  },
  cpp: {
    image: 'gcc:14',
    command: (code) => `printf %s "${Buffer.from(code).toString('base64')}" | base64 -d > /tmp/main.cpp && g++ /tmp/main.cpp -O2 -std=c++17 -o /tmp/main && /tmp/main`
  },
  java: {
    image: 'openjdk:21-jdk-slim',
    command: (code) => `printf %s "${Buffer.from(code).toString('base64')}" | base64 -d > /tmp/Main.java && javac /tmp/Main.java && java -cp /tmp Main`
  }
}

function runInDocker(language, sourceCode, stdin = '') {
  return new Promise((resolve, reject) => {
    const config = LANGUAGE_CONFIG[language]

    if (!config) {
      reject(new Error(`Unsupported language: ${language}`))
      return
    }

    const command = typeof config.command === 'function' ? config.command(sourceCode) : config.command

    const args = [
      'run',
      '--rm',
      '-i',
      '--network',
      'none',
      '--memory',
      '256m',
      '--cpus',
      '0.5',
      '--pids-limit',
      '64',
      config.image,
      'sh',
      '-lc',
      command
    ]

    const docker = spawn('docker', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timeout = setTimeout(() => {
      timedOut = true
      docker.kill('SIGKILL')
    }, EXEC_TIMEOUT_MS)

    docker.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    docker.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    docker.on('error', (err) => {
      clearTimeout(timeout)
      if (err.code === 'ENOENT') {
        reject(new Error('Docker is not installed or not available in PATH'))
        return
      }
      reject(err)
    })

    docker.on('close', (code) => {
      clearTimeout(timeout)
      if (timedOut) {
        resolve({
          status: 'timeout',
          stdout,
          stderr: stderr || `Execution timed out after ${EXEC_TIMEOUT_MS}ms`
        })
        return
      }

      resolve({
        status: code === 0 ? 'success' : 'error',
        stdout,
        stderr,
        exitCode: code
      })
    })

    if (stdin) {
      docker.stdin.write(stdin)
    }
    docker.stdin.end()
  })
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'local-executor' })
})

app.post('/api/execute', async (req, res) => {
  try {
    const { language, sourceCode, stdin } = req.body

    if (!language || typeof language !== 'string') {
      res.status(400).json({ error: 'language is required' })
      return
    }

    if (!sourceCode || typeof sourceCode !== 'string') {
      res.status(400).json({ error: 'sourceCode is required' })
      return
    }

    if (sourceCode.length > 20000) {
      res.status(400).json({ error: 'sourceCode exceeds limit (20000 chars)' })
      return
    }

    const result = await runInDocker(language.toLowerCase(), sourceCode, stdin || '')
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message || 'Execution failed' })
  }
})

app.listen(PORT, () => {
  console.log(`[executor] API listening on http://localhost:${PORT}`)
})
