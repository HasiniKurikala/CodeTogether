// Local execution utility: frontend calls our local Node API,
// backend runs code in Docker containers.

const LANGUAGE_MAP = {
  python: 'python',
  javascript: 'javascript',
  java: 'java',
  cpp: 'c++',
  typescript: 'typescript',
  c: 'c',
  csharp: 'csharp',
  go: 'go',
  rust: 'rust',
  php: 'php',
  ruby: 'ruby',
  swift: 'swift'
}

const EXECUTOR_API_URL = '/api/execute'

/**
 * Run code using local Docker executor API
 * @param {string} languageName - e.g. "python", "javascript"
 * @param {string} sourceCode - the code to execute
 * @param {string} stdin - optional stdin input for the program
 * @returns {Promise<{stdout, stderr, output, status}>}
 */
export async function runCode(languageName, sourceCode, stdin = '') {
  const language = LANGUAGE_MAP[languageName.toLowerCase()]

  if (!language) {
    throw new Error(`Unsupported language: ${languageName}`)
  }

  console.log(`[executor] Executing ${language} code (${sourceCode.length} chars)${stdin ? ` with stdin` : ''}`)

  try {
    const response = await fetch(EXECUTOR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        language,
        sourceCode,
        stdin
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Executor API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('[executor] Execution result:', data)

    return {
      stdout: data.stdout || '',
      stderr: data.stderr || '',
      output: data.stdout || data.stderr || '(no output)',
      status: data.status || 'completed'
    }
  } catch (err) {
    console.error('[executor] Error:', err)
    throw err
  }
}

export { LANGUAGE_MAP }
export default { runCode, LANGUAGE_MAP }
