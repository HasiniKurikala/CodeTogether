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
  onChange = () => {},
  readOnly = false
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
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
