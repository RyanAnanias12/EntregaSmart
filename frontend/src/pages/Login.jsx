import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login as apiLogin } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [form, setForm] = useState({ email: '', senha: '' })
  const [err, setErr]   = useState('')
  const [loading, setLoading] = useState(false)
  const s = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function submit(e) {
    e.preventDefault(); setErr(''); setLoading(true)
    try {
      const data = await apiLogin(form)
      login(data.token, data.user, data.tenant)
      nav('/')
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg"/>
      <div className="auth-card">
        <div className="auth-logo"><div className="icon">🚚</div>Entregas<span>ML</span></div>
        <h1 className="auth-title">Bem-vindo de volta</h1>
        <p className="auth-sub">Entre na sua conta para continuar</p>
        {err && <div style={{ background:'var(--rd)', border:'1px solid rgba(239,68,68,.25)', borderRadius:'var(--rsm)', padding:'10px 14px', fontSize:13, color:'var(--re)', marginBottom:16 }}>{err}</div>}
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field">
            <label className="field-label">Email</label>
            <input className="input" type="email" placeholder="seu@email.com" value={form.email} onChange={e => s('email', e.target.value)} required autoComplete="email"/>
          </div>
          <div className="field">
            <label className="field-label">Senha</label>
            <input className="input" type="password" placeholder="••••••••" value={form.senha} onChange={e => s('senha', e.target.value)} required autoComplete="current-password"/>
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop:4 }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p style={{ textAlign:'center', fontSize:13, color:'var(--t2)', marginTop:20 }}>
          Não tem conta? <Link to="/cadastro" className="auth-link">Cadastre-se grátis</Link>
        </p>
      </div>
    </div>
  )
}
