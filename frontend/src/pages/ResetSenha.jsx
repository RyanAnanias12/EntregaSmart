import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const BASE = (import.meta.env.VITE_API_URL||'/api').replace(/\/api$/, '')

export default function ResetSenha() {
  const nav = useNavigate()
  const [params]  = useSearchParams()
  const token     = params.get('token') || ''

  const [senha,    setSenha]    = useState('')
  const [conf,     setConf]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [ok,       setOk]       = useState(false)
  const [erro,     setErro]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault(); setErro('')
    if (senha !== conf) { setErro('As senhas não coincidem'); return }
    if (senha.length < 6) { setErro('Senha mínima de 6 caracteres'); return }
    setLoading(true)
    try {
      const r = await fetch(BASE + '/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, senha })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setOk(true)
      setTimeout(() => nav('/login'), 2500)
    } catch(e) { setErro(e.message) }
    finally { setLoading(false) }
  }

  if (!token) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ textAlign:'center' }}>
        <p style={{ fontSize:20, marginBottom:12 }}>⚠️</p>
        <p style={{ fontSize:14, color:'var(--t2)', marginBottom:16 }}>Link inválido ou expirado.</p>
        <button className="btn btn-primary" onClick={() => nav('/esqueci-senha')}>Solicitar novo link</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <img src="/logo.png" alt="Smart Entregas" style={{ height:36, marginBottom:16 }}/>
          <h1 style={{ fontFamily:'var(--ff)', fontSize:20, fontWeight:800, marginBottom:6 }}>Nova senha</h1>
          <p style={{ fontSize:13, color:'var(--t2)' }}>Digite sua nova senha abaixo.</p>
        </div>

        {ok ? (
          <div style={{ background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)', borderRadius:'var(--r)', padding:'24px 20px', textAlign:'center' }}>
            <p style={{ fontSize:28, marginBottom:10 }}>✅</p>
            <p style={{ fontFamily:'var(--ff)', fontSize:15, fontWeight:700, color:'var(--gr2)', marginBottom:6 }}>Senha alterada!</p>
            <p style={{ fontSize:13, color:'var(--t2)' }}>Redirecionando para o login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="card">
              <div className="card-body">
                <div className="field" style={{ marginBottom:12 }}>
                  <label className="field-label">Nova senha</label>
                  <input className="input" type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" required autoFocus/>
                </div>
                <div className="field" style={{ marginBottom:16 }}>
                  <label className="field-label">Confirmar senha</label>
                  <input className="input" type="password" value={conf} onChange={e=>setConf(e.target.value)} placeholder="Repita a senha" required
                    style={{ borderColor: conf && senha !== conf ? 'var(--re)' : undefined }}/>
                  {conf && senha !== conf && <p style={{ fontSize:12, color:'var(--re)', marginTop:4 }}>As senhas não coincidem</p>}
                </div>
                {erro && <p style={{ fontSize:12, color:'var(--re)', marginBottom:12 }}>⚠ {erro}</p>}
                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar nova senha →'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
