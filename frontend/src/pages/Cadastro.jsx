import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register as apiRegister } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function Cadastro() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [form, setForm] = useState({ nomeEquipe: '', nomeAdmin: '', email: '', senha: '' })
  const [err, setErr]   = useState('')
  const [loading, setLoading] = useState(false)
  const s = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function submit(e) {
    e.preventDefault(); setErr(''); setLoading(true)
    try {
      const data = await apiRegister(form)
      login(data.token, data.user, data.tenant)
      nav('/')
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg"/>
      <div className="auth-card">
        <div className="auth-logo"><div className="icon">🚚</div>Smart<span>Entregas</span></div>
        <h1 className="auth-title">Criar conta grátis</h1>
        <p className="auth-sub">Configure sua equipe em menos de 1 minuto</p>
        {err && <div style={{ background:'var(--rd)', border:'1px solid rgba(239,68,68,.25)', borderRadius:'var(--rsm)', padding:'10px 14px', fontSize:13, color:'var(--re)', marginBottom:16 }}>{err}</div>}
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field">
            <label className="field-label">Nome da equipe / empresa</label>
            <input className="input" placeholder="Ex: Ananias Entregas" value={form.nomeEquipe} onChange={e => s('nomeEquipe', e.target.value)} required/>
          </div>
          <div className="field">
            <label className="field-label">Seu nome</label>
            <input className="input" placeholder="Ex: Ryan" value={form.nomeAdmin} onChange={e => s('nomeAdmin', e.target.value)} required/>
          </div>
          <div className="field">
            <label className="field-label">Email</label>
            <input className="input" type="email" placeholder="seu@email.com" value={form.email} onChange={e => s('email', e.target.value)} required autoComplete="email"/>
          </div>
          <div className="field">
            <label className="field-label">Senha</label>
            <input className="input" type="password" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={e => s('senha', e.target.value)} required autoComplete="new-password"/>
          </div>
          <div style={{ background:'var(--od)', border:'1px solid rgba(249,115,22,.18)', borderRadius:'var(--rsm)', padding:'10px 14px', fontSize:12, color:'var(--or2)' }}>
            ✓ Plano gratuito — até 30 rotas/mês, sem cartão de crédito
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop:4 }}>
            {loading ? 'Criando conta...' : 'Criar conta grátis'}
          </button>
        </form>
        <p style={{ textAlign:'center', fontSize:13, color:'var(--t2)', marginTop:20 }}>
          Já tem conta? <Link to="/login" className="auth-link">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
