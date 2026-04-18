import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchRecentes, fmtBRL, fmtData, calcRateio, statusLabel, plataformaEmoji, criarRota, fetchUsuarios, calcCombustivel } from '../lib/api'

function RegistroRapido({ onSalvo }) {
  const [show,   setShow]   = useState(false)
  const [form,   setForm]   = useState({ ponto_coleta:'', kms:'', pacotes_saida:'', valor_total:'', data_rota: new Date().toISOString().slice(0,10) })
  const [saving, setSaving] = useState(false)
  const [membros, setMembros] = useState([])
  const { user } = useAuth()
  const s = (k,v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (show) fetchUsuarios().then(l => setMembros(l.filter(u => u.ativo))).catch(() => {})
  }, [show])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const piloto = membros[0]?.nome || user?.nome || ''
      await criarRota({ ...form, piloto, copiloto: piloto, status: 'concluida', pacotes_entregues: form.pacotes_saida })
      setShow(false)
      setForm({ ponto_coleta:'', kms:'', pacotes_saida:'', valor_total:'', data_rota: new Date().toISOString().slice(0,10) })
      onSalvo?.()
    } catch(e) { alert(e.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <button
        onClick={() => setShow(true)}
        style={{ position:'fixed', bottom:24, right:24, width:56, height:56, borderRadius:'50%', background:'var(--or)', border:'none', color:'#fff', fontSize:24, cursor:'pointer', boxShadow:'0 8px 24px rgba(249,115,22,.45)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}
        title="Registro rápido"
      >+</button>
      {show && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShow(false)}>
          <div className="modal" style={{ maxWidth:400 }}>
            <div className="modal-header">
              <h2 className="modal-title">⚡ Registro rápido</h2>
              <button className="btn-icon" onClick={() => setShow(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <p style={{ fontSize:12, color:'var(--t3)', marginBottom:4 }}>Cria rota concluída com 4 campos.</p>
                <div className="field">
                  <label className="field-label">Ponto de coleta</label>
                  <input className="input" value={form.ponto_coleta} onChange={e => s('ponto_coleta', e.target.value)} placeholder="Ex: CD Guarulhos" required/>
                </div>
                <div className="grid2">
                  <div className="field">
                    <label className="field-label">KMs rodados</label>
                    <input className="input" type="number" min="0" value={form.kms} onChange={e => s('kms', e.target.value)} placeholder="0" required/>
                  </div>
                  <div className="field">
                    <label className="field-label">Pacotes</label>
                    <input className="input" type="number" min="0" value={form.pacotes_saida} onChange={e => s('pacotes_saida', e.target.value)} placeholder="0" required/>
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Valor recebido (R$)</label>
                  <input className="input" type="number" step="0.01" min="0" value={form.valor_total} onChange={e => s('valor_total', e.target.value)} placeholder="0,00" required/>
                </div>
                <div className="field">
                  <label className="field-label">Data</label>
                  <input className="input" type="date" value={form.data_rota} onChange={e => s('data_rota', e.target.value)} required/>
                </div>
                {form.kms > 0 && form.valor_total > 0 && (
                  <div style={{ background:'var(--s2)', borderRadius:8, padding:'10px 13px', fontSize:12, color:'var(--t2)' }}>
                    Combustível: <strong style={{ color:'var(--ye)' }}>{fmtBRL(calcCombustivel(form.kms))}</strong> →
                    Líquido: <strong style={{ color:'var(--gr2)' }}>{fmtBRL(form.valor_total - calcCombustivel(form.kms))}</strong>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShow(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : '⚡ Salvar rota'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function HomeLogado({ user, tenant }) {
  const nav = useNavigate()
  const [recentes, setRecentes] = useState([])
  const [loading,  setLoading]  = useState(true)

  function load() {
    setLoading(true)
    fetchRecentes().then(setRecentes).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const concluidas = recentes.filter(r => r.status === 'concluida')

  return (
    <>
      <div style={{ padding: '28px 0 60px' }}>
        <div className="container">
          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: 'var(--ff)', fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4 }}>
                Olá, {user.nome.split(' ')[0]} 👋
              </h1>
              <p style={{ color: 'var(--t2)', fontSize: 13 }}>{tenant?.nome}</p>
            </div>
            {tenant?.plano !== 'pro' && (
              <button className="btn btn-ghost btn-sm" style={{ borderColor: 'rgba(249,115,22,.3)', color: 'var(--or2)' }} onClick={() => nav('/precos')}>
                ⭐ Upgrade Pro — R$ 14,90/mês
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => nav('/rotas?nova=1')}>+ Nova rota</button>
            <button className="btn btn-ghost" onClick={() => nav('/rotas')}>Ver todas as rotas</button>
            <button className="btn btn-ghost" onClick={() => nav('/dashboard')}>Dashboard →</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontFamily: 'var(--ff)', fontSize: 16, fontWeight: 700 }}>Rotas recentes</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/rotas')}>ver todas →</button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><div className="spinner"/></div>
          ) : recentes.length === 0 ? (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="empty">
                <div className="empty-icon">📭</div>
                <p className="empty-title">Nenhuma rota ainda</p>
                <p className="empty-sub">Crie a primeira rota para começar</p>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => nav('/rotas?nova=1')}>+ Criar primeira rota</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12, marginBottom: 24 }}>
              {recentes.map(r => {
                const taxa = r.pacotes_saida > 0 ? Math.round((r.pacotes_entregues / r.pacotes_saida) * 100) : null
                return (
                  <div key={r.id} className="rota-recente" onClick={() => nav(`/rotas?detalhe=${r.id}`)}>
                    <div className="rota-recente-top">
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className={`badge status-${r.status}`}>{statusLabel(r.status)}</span>
                        <span className="badge badge-orange">▶ {r.piloto}</span>
                        <span style={{ fontSize: 12 }}>{plataformaEmoji(r.plataforma)}</span>
                      </div>
                      {r.status === 'concluida' && <span className="rota-recente-val">{fmtBRL(r.lucro_liquido)}</span>}
                    </div>
                    <div className="rota-recente-meta">
                      <span>📍 {r.ponto_coleta}</span>
                      <span>📅 {fmtData(r.data_rota)}</span>
                      {r.kms > 0 && <span>🛣️ {r.kms} km</span>}
                      {r.veiculo_nome && <span>🚗 {r.veiculo_nome}</span>}
                      {taxa !== null && <span className={`badge ${taxa >= 80 ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 10 }}>{taxa}%</span>}
                    </div>
                    {r.status === 'planejada' && (
                      <div style={{ marginTop: 10 }}>
                        <button className="btn btn-sm" style={{ background: 'var(--bld)', color: 'var(--bl)', border: '1px solid rgba(59,130,246,.2)', fontSize: 11 }}
                          onClick={e => { e.stopPropagation(); nav(`/rotas?editar=${r.id}`) }}>
                          ✏️ Iniciar / editar
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {concluidas.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Rateio das rotas recentes</span></div>
              <div className="card-body">
                {(() => {
                  const acc = {}
                  concluidas.forEach(r => {
                    calcRateio(parseFloat(r.lucro_liquido), r.piloto, r.copiloto).forEach(p => {
                      acc[p.nome] = (acc[p.nome] || 0) + p.valor
                    })
                  })
                  return Object.entries(acc).sort((a, b) => b[1] - a[1]).map(([nome, valor]) => (
                    <div key={nome} className="rateio-row">
                      <div className="rateio-left">
                        <div className="avatar sm">{nome.slice(0, 2).toUpperCase()}</div>
                        <p className="rateio-nome">{nome}</p>
                      </div>
                      <span className="rateio-val">{fmtBRL(valor)}</span>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
      <RegistroRapido onSalvo={load}/>
    </>
  )
}

function Landing() {
  const nav = useNavigate()
  const FEATURES = [
    { icon: '📦', title: 'Controle de pacotes',   desc: 'Registre saídas, entregas e devoluções por rota com precisão.' },
    { icon: '⛽', title: 'Multi-veículo',          desc: 'Cadastre carros e motos com consumos diferentes. Cálculo automático por veículo.' },
    { icon: '💸', title: 'Rateio automático',      desc: 'Divisão justa: piloto 60% e copiloto 40% do lucro líquido.' },
    { icon: '📊', title: 'Dashboard completo',     desc: 'Gráficos de faturamento, KMs e performance por pessoa.' },
    { icon: '📧', title: 'Notificações por email', desc: 'Email automático quando rota é criada ou concluída. Resumo semanal.' },
    { icon: '🛒', title: 'Multi-plataforma',       desc: 'Suporte a Mercado Livre, Shopee e Amazon Logistics.' },
  ]

  return (
    <div>
      <section className="hero">
        <div className="hero-bg"/><div className="hero-grid"/>
        <div className="container">
          <div className="hero-content">
            <div className="hero-pill"><span className="hero-pill-dot"/>Sistema para motoristas de logística</div>
            <h1 className="hero-title">Organiza as entregas,<br/><span className="accent">divide o lucro.</span></h1>
            <p className="hero-sub">Registre rotas, calcule combustível por veículo e faça o rateio automático entre a equipe. Suporte a ML, Shopee e Amazon.</p>
            <div className="hero-btns">
              <button className="btn btn-primary" style={{ padding: '12px 28px', fontSize: 14 }} onClick={() => nav('/cadastro')}>Criar conta grátis →</button>
              <button className="btn btn-ghost"   style={{ padding: '12px 22px', fontSize: 14 }} onClick={() => nav('/precos')}>Ver planos</button>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--bg2)', borderTop: '1px solid var(--b1)', borderBottom: '1px solid var(--b1)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div className="section-pill">Funcionalidades</div>
            <h2 className="section-title">Tudo para sua operação logística</h2>
          </div>
          <div className="feature-grid">
            {FEATURES.map((f, i) => (
              <div className="feature-card" key={i}>
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--bg2)', borderTop: '1px solid var(--b1)', padding: '64px 0', textAlign: 'center' }}>
        <div className="container">
          <h2 className="section-title" style={{ marginBottom: 10 }}>Comece grátis agora</h2>
          <p style={{ color: 'var(--t2)', fontSize: 15, marginBottom: 28, fontWeight: 300 }}>Sem cartão. Configura em 1 minuto.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ fontSize: 15, padding: '13px 30px' }} onClick={() => nav('/cadastro')}>Criar conta grátis →</button>
            <button className="btn btn-ghost"   style={{ fontSize: 15, padding: '13px 24px' }} onClick={() => nav('/precos')}>Ver planos e preços</button>
          </div>
        </div>
      </section>
      <footer>Smart Entregas — controle de rotas para motoristas de logística 🚚</footer>
    </div>
  )
}

export default function Home() {
  const { user, tenant, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="spinner"/></div>
  return user ? <HomeLogado user={user} tenant={tenant}/> : <Landing/>
}
