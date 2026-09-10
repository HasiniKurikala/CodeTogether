import React from 'react'
import { Link } from 'react-router-dom'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('CodeTogether ErrorBoundary caught:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0f14',
          color: '#f8fafc',
          padding: 24,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: 560,
            width: '100%',
            background: '#111827',
            border: '1px solid #1f2937',
            borderRadius: 16,
            padding: 28,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ margin: '0 0 8px', color: '#f87171', fontSize: 22 }}>Something went wrong</h2>
            <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 14 }}>
              An unexpected error occurred while rendering the page.
            </p>
            {this.state.error?.message && (
              <pre style={{
                background: '#030712',
                border: '1px solid #374151',
                borderRadius: 8,
                padding: 12,
                color: '#ef4444',
                fontSize: 13,
                overflowX: 'auto',
                marginBottom: 20
              }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Back to Home
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  background: '#374151',
                  color: '#f3f4f6',
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
