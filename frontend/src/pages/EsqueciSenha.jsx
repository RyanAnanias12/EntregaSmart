import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BASE = (import.meta.env.VITE_API_URL||'/api').replace(/\/api$/, '')

export default function EsqueciSenha() {
  const nav = useNavigate()
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro,    setErro]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault(); setErro(''); setLoading(true)
    try {
      const r = await fetch(BASE + '/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setEnviado(true)
    } catch(e) { setErro(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <img src="/logo.png" alt="Smart Entregas" style={{ height:36, marginBottom:16 }}/>
          <h1 style={{ fontFamily:'var(--ff)', fontSize:20, fontWeight:800, marginBottom:6 }}>Esqueceu a senha?</h1>
          <p style={{ fontSize:13, color:'var(--t2)' }}>Informe seu email e enviaremos um link para redefinir.</p>
        </div>

        {enviado ? (
          <div style={{ background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)', borderRadius:'var(--r)', padding:'24px 20px', textAlign:'center' }}>
            <p style={{ fontSize:28, marginBottom:10 }}>📧</p>
            <p style={{ fontFamily:'var(--ff)', fontSize:15, fontWeight:700, marginBottom:6, color:'var(--gr2)' }}>Email enviado!</p>
            <p style={{ fontSize:13, color:'var(--t2)', marginBottom:16 }}>
              Se esse email estiver cadastrado, você receberá um link em breve. Verifique sua caixa de entrada e spam.
            </p>
            <button className="btn btn-ghost btn-full" onClick={() => nav('/login')}>Voltar para o login</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="card">
              <div className="card-body">
                <div className="field" style={{ marginBottom:16 }}>
                  <label className="field-label">Email</label>
                  <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required autoFocus/>
                </div>
                {erro && <p style={{ fontSize:12, color:'var(--re)', marginBottom:12 }}>⚠ {erro}</p>}
                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar link de recuperação →'}
                </button>
              </div>
            </div>
            <p style={{ textAlign:'center', fontSize:13, color:'var(--t3)', marginTop:16, cursor:'pointer' }} onClick={() => nav('/login')}>
              ← Voltar para o login
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
