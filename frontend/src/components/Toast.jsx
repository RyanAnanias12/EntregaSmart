import { useEffect } from 'react'
export function Toast({ msg, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`toast ${type}`}>
      <span>{type === 'success' ? '✓' : '✕'}</span>
      <span>{msg}</span>
    </div>
  )
}
