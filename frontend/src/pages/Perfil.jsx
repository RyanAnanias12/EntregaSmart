import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Toast } from '../components/Toast'

const BASE = (import.meta.env.VITE_API_URL||'/api').replace(/\/api$/, '')
const tok  = () => localStorage.getItem('token') || sessionStorage.getItem('token') || ''

async function atualizarPerfil(dados) {
  const r = await fetch(BASE + '/api/auth/perfil', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
    body: JSON.stringify(dados)
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error || 'Erro')
  return d
}

export default function Perfil() {
  const nav = useNavigate()
  const { user, tenant, logout, updateTenant } = useAuth()

  const [nome,        setNome]        = useState(user?.nome || '')
  const [email,       setEmail]       = useState(user?.email || '')
  const [senhaAtual,  setSenhaAtual]  = useState('')
  const [senhaNova,   setSenhaNova]   = useState('')
  const [senhaConf,   setSenhaConf]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState(null)
  const notify = (msg, type='success') => setToast({ msg, type })

  async function handleSalvar(e) {
    e.preventDefault()
    if (senhaNova && senhaNova !== senhaConf) { notify('As senhas não coincidem', 'error'); return }
    if (senhaNova && senhaNova.length < 6)    { notify('Senha mínima de 6 caracteres', 'error'); return }

    setSaving(true)
    try {
      const payload = { nome, email }
      if (senhaNova) { payload.senha_atual = senhaAtual; payload.senha_nova = senhaNova }
      await atualizarPerfil(payload)
      notify('Perfil atualizado! Faça login novamente para aplicar as mudanças.')
      setSenhaAtual(''); setSenhaNova(''); setSenhaConf('')
      // Se email ou nome mudou, força novo login
      if (email !== user?.email || senhaNova) {
        setTimeout(() => { logout(); nav('/login') }, 2000)
      }
    } catch(e) { notify(e.message, 'error') }
    finally { setSaving(false) }
  }

  const inp = { className:'input' }
  const lbl = { className:'field-label' }

  const PLANO_INFO = {
    free:  { label:'Free',   cor:'var(--t3)',  desc:'30 rotas/mês' },
    solo:  { label:'Solo',   cor:'var(--or)',  desc:'Rotas ilimitadas, sem equipe' },
    pro:   { label:'Pro ⭐', cor:'var(--or)',  desc:'Tudo do Solo + equipe e rateio' },
  }
  const planoInfo = PLANO_INFO[tenant?.plano] || PLANO_INFO.free

  return (
    <div style={{ padding:'28px 0 60px' }}>
      <div className="container" style={{ maxWidth:560 }}>

        <div className="pg-header">
          <div>
            <h1 className="pg-title">Meu perfil</h1>
            <p className="pg-sub">Edite suas informações pessoais e senha</p>
          </div>
        </div>

        {/* PLANO ATUAL */}
        <div style={{ marginBottom:20, padding:'16px 20px', background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:'var(--od)', border:'1px solid rgba(249,115,22,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
              {(user?.nome||'U').slice(0,2).toUpperCase()}
            </div>
            <div>
              <p style={{ fontFamily:'var(--ff)', fontSize:15, fontWeight:700, marginBottom:2 }}>{user?.nome}</p>
              <p style={{ fontSize:12, color:'var(--t3)' }}>{user?.email}</p>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ background:'var(--od)', color:planoInfo.cor, border:'1px solid rgba(249,115,22,.2)', borderRadius:99, padding:'2px 10px', fontSize:12, fontWeight:700 }}>
                {planoInfo.label}
              </span>
              {tenant?.trial && (
                <span style={{ background:'var(--s2)', color:'var(--t3)', borderRadius:99, padding:'2px 8px', fontSize:11 }}>
                  Trial
                </span>
              )}
            </div>
            <p style={{ fontSize:11, color:'var(--t3)' }}>{planoInfo.desc}</p>
            {tenant?.plano === 'free' && (
              <button className="btn btn-primary btn-sm" style={{ marginTop:6, fontSize:11 }} onClick={() => nav('/precos')}>
                Fazer upgrade →
              </button>
            )}
            {tenant?.plano_expira_em && tenant?.trial && (() => {
              const dias = Math.max(0, Math.ceil((new Date(tenant.plano_expira_em) - new Date()) / 86400000))
              return <p style={{ fontSize:11, color:'var(--or2)', marginTop:4, fontWeight:600 }}>{dias}d de trial restantes</p>
            })()}
          </div>
        </div>

        {/* FORMULÁRIO */}
        <form onSubmit={handleSalvar}>
          <div className="card" style={{ marginBottom:14 }}>
            <div className="card-header"><span className="card-title">Informações pessoais</span></div>
            <div className="card-body">
              <div className="field" style={{ marginBottom:12 }}>
                <label {...lbl}>Nome</label>
                <input {...inp} value={nome} onChange={e=>setNome(e.target.value)} placeholder="Seu nome completo" required/>
              </div>
              <div className="field">
                <label {...lbl}>Email</label>
                <input {...inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required/>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header">
              <span className="card-title">Alterar senha</span>
              <span style={{ fontSize:11, color:'var(--t3)' }}>deixe em branco para não alterar</span>
            </div>
            <div className="card-body">
              <div className="field" style={{ marginBottom:12 }}>
                <label {...lbl}>Senha atual</label>
                <input {...inp} type="password" value={senhaAtual} onChange={e=>setSenhaAtual(e.target.value)} placeholder="••••••••" autoComplete="current-password"/>
              </div>
              <div className="grid2">
                <div className="field">
                  <label {...lbl}>Nova senha</label>
                  <input {...inp} type="password" value={senhaNova} onChange={e=>setSenhaNova(e.target.value)} placeholder="••••••••" autoComplete="new-password"/>
                </div>
                <div className="field">
                  <label {...lbl}>Confirmar senha</label>
                  <input {...inp} type="password" value={senhaConf} onChange={e=>setSenhaConf(e.target.value)} placeholder="••••••••" autoComplete="new-password"
                    style={{ borderColor: senhaConf && senhaNova !== senhaConf ? 'var(--re)' : undefined }}/>
                </div>
              </div>
              {senhaConf && senhaNova !== senhaConf && (
                <p style={{ fontSize:12, color:'var(--re)', marginTop:6 }}>As senhas não coincidem</p>
              )}
            </div>
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => nav(-1)}>Voltar</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex:1 }}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>

        {/* ZONA DE PERIGO */}
        <div style={{ marginTop:28, padding:'16px 20px', background:'var(--rd)', border:'1px solid rgba(239,68,68,.2)', borderRadius:'var(--r)' }}>
          <p style={{ fontSize:13, fontWeight:600, color:'var(--re)', marginBottom:4 }}>Sair da conta</p>
          <p style={{ fontSize:12, color:'var(--t3)', marginBottom:12 }}>Você será redirecionado para a tela de login.</p>
          <button className="btn btn-danger btn-sm" onClick={() => { logout(); nav('/login') }}>Sair da conta</button>
        </div>
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}
