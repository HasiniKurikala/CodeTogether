export function highlightLanguage(ext){
  if(ext === 'js') return 'javascript'
  if(ext === 'py') return 'python'
  return 'plaintext'
}
