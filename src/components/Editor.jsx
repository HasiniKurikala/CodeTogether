import React, { useRef, useEffect } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { useTheme } from '../context/ThemeContext'

export default function Editor({
  code = '// Start coding here...\n',
  language = 'javascript',
  fontSize = 14,
  onChange = () => { },
  readOnly = false,
  onMount = () => { }
}) {
  const { theme } = useTheme()
  const editorRef = useRef(null)
  const monacoRef = useRef(null)

  const handleBeforeMount = (monaco) => {
    // Dark Theme - Warm Coral
    monaco.editor.defineTheme('codetogether-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', foreground: 'FFF0BE', background: '1a1008' },
        { token: 'comment', foreground: 'FFB399', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'FF9A86', fontStyle: 'bold' },
        { token: 'string', foreground: 'FFD6A6' },
        { token: 'number', foreground: 'FF9A86' },
        { token: 'type', foreground: 'FFD6A6' }
      ],
      colors: {
        'editor.background': '#1a1008',
        'editor.foreground': '#FFF0BE',
        'editorCursor.foreground': '#FF9A86',
        'editor.lineHighlightBackground': '#2a1a10',
        'editorLineNumber.foreground': '#5a3424',
        'editorLineNumber.activeForeground': '#FF9A86',
        'editor.selectionBackground': '#3a2418',
        'editor.inactiveSelectionBackground': '#2a1a10'
      }
    })

    // Light Theme - Warm Coral
    monaco.editor.defineTheme('codetogether-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: '', foreground: '2a1008', background: 'FFFAF5' },
        { token: 'comment', foreground: '8a5038', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'e05538', fontStyle: 'bold' },
        { token: 'string', foreground: 'b84820' },
        { token: 'number', foreground: 'd05030' },
        { token: 'type', foreground: '9c4020' }
      ],
      colors: {
        'editor.background': '#FFFAF5',
        'editor.foreground': '#2a1008',
        'editorCursor.foreground': '#FF9A86',
        'editor.lineHighlightBackground': '#FFF0BE',
        'editorLineNumber.foreground': '#c99a85',
        'editorLineNumber.activeForeground': '#e05538',
        'editor.selectionBackground': '#FFD6A6',
        'editor.inactiveSelectionBackground': '#FFF0BE'
      }
    })
  }

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    onMount(editor, monaco)
  }

  // Ensure model language updates whenever the language prop changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel()
      if (model) {
        monacoRef.current.editor.setModelLanguage(model, language)
      }
    }
  }, [language])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <MonacoEditor
          height="100%"
          language={language}
          value={code}
          beforeMount={handleBeforeMount}
          onMount={handleEditorDidMount}
          onChange={(value) => onChange({ code: value || '', language })}
          theme={theme === 'light' ? 'codetogether-light' : 'codetogether-dark'}
          options={{
            fontSize: fontSize,
            fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            readOnly: readOnly,
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            padding: { top: 12, bottom: 12 }
          }}
        />
      </div>
    </div>
  )
}
