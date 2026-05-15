import React from 'react'
import MonacoEditor from '@monaco-editor/react'

const LANGUAGES = [
  { label: 'JavaScript', value: 'javascript' },
  { label: 'Python', value: 'python' },
  { label: 'C++', value: 'cpp' },
  { label: 'Java', value: 'java' },
  { label: 'TypeScript', value: 'typescript' }
]

export default function Editor({
  code = '// Start coding here...\n',
  language = 'javascript',
  onChange = () => { },
  readOnly = false
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Language Selector */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid #333',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        backgroundColor: '#1e1e1e'
      }}>
        <label style={{ color: '#fff', fontSize: '14px' }}>Language:</label>
        <select
          value={language}
          onChange={(e) => onChange({ language: e.target.value })}
          disabled={readOnly}
          style={{
            padding: '6px 10px',
            borderRadius: '4px',
            border: '1px solid #555',
            backgroundColor: '#252526',
            color: '#fff',
            fontSize: '14px',
            cursor: readOnly ? 'not-allowed' : 'pointer'
          }}
        >
          {LANGUAGES.map(lang => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* Monaco Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <MonacoEditor
          height="100%"
          language={language}
          value={code}
          onChange={(value) => onChange({ code: value || '', language })}
          theme="vs-dark"
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            readOnly: readOnly,
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true
          }}
        />
      </div>
    </div>
  )
}
