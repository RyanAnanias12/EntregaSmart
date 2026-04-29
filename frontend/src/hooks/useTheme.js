import { useState, useEffect } from 'react'

export function useTheme() {
  const [tema, setTema] = useState(() => localStorage.getItem('tema') || 'dark')

  useEffect(() => {
    localStorage.setItem('tema', tema)
    if (tema === 'light') {
      document.documentElement.style.setProperty('--bg',  '#f8f8fa')
      document.documentElement.style.setProperty('--bg2', '#f0f0f4')
      document.documentElement.style.setProperty('--s1',  '#ffffff')
      document.documentElement.style.setProperty('--s2',  '#f4f4f8')
      document.documentElement.style.setProperty('--s3',  '#ebebf0')
      document.documentElement.style.setProperty('--b1',  'rgba(0,0,0,.08)')
      document.documentElement.style.setProperty('--b2',  'rgba(0,0,0,.12)')
      document.documentElement.style.setProperty('--b3',  'rgba(0,0,0,.18)')
      document.documentElement.style.setProperty('--t',   '#0d0d12')
      document.documentElement.style.setProperty('--t2',  '#4a4a62')
      document.documentElement.style.setProperty('--t3',  '#7c7c96')
      document.documentElement.style.setProperty('--t4',  '#a0a0b8')
      document.documentElement.style.setProperty('--od',  'rgba(249,115,22,.06)')
    } else {
      ['--bg','--bg2','--s1','--s2','--s3','--b1','--b2','--b3','--t','--t2','--t3','--t4','--od']
        .forEach(v => document.documentElement.style.removeProperty(v))
    }
  }, [tema])

  const toggle = () => setTema(t => t === 'dark' ? 'light' : 'dark')
  return { tema, toggle }
}
