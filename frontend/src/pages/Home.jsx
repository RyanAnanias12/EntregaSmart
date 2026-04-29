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

          {concluidas.length > 0 && tenant?.plano === 'pro' && (
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
  const [faqAberto, setFaqAberto] = useState(null)

  const FEATURES = [
    { icon: '📦', title: 'Fim da planilha bagunçada', desc: 'Registre rotas em segundos. Saídas, entregas e devoluções organizados automaticamente.' },
    { icon: '⛽', title: 'Combustível calculado na hora', desc: 'Informa os KMs, o app desconta o combustível e mostra seu lucro real. Sem chute.' },
    { icon: '💸', title: 'Sem briga de dinheiro na equipe', desc: 'O rateio é automático: piloto 60%, copiloto 40%. Todo mundo vê o quanto recebeu.' },
    { icon: '📊', title: 'Saiba quanto você ganhou esse mês', desc: 'Dashboard com faturamento, KMs e performance. Tudo num lugar só.' },
    { icon: '📧', title: 'Email a cada rota registrada', desc: 'Toda a equipe recebe confirmação quando uma rota é criada ou concluída.' },
    { icon: '🛒', title: 'ML, Shopee e Amazon', desc: 'Funciona para as principais plataformas de entrega do Brasil.' },
  ]

  const FAQ = [
    { p: 'Precisa de cartão de crédito para começar?', r: 'Não. O plano gratuito não pede cartão. Você cria a conta e já começa a usar.' },
    { p: 'Funciona para quem trabalha sozinho?', r: 'Sim! O plano Solo foi feito para motoristas individuais. O lucro vai 100% para você, sem rateio de equipe.' },
    { p: 'Funciona no celular?', r: 'Sim. O app é totalmente responsivo e funciona bem no celular, sem precisar instalar nada.' },
    { p: 'Quantas rotas posso criar no plano gratuito?', r: 'Até 30 rotas por mês. Para rotas ilimitadas, os planos Solo e Pro a partir de R$ 9,90/mês.' },
    { p: 'Posso usar para Mercado Livre, Shopee e Amazon ao mesmo tempo?', r: 'Sim. Cada rota tem um campo de plataforma e você pode filtrar o dashboard por plataforma.' },
    { p: 'Como funciona o rateio automático?', r: 'Quando você marca a rota como concluída, o sistema divide o lucro líquido: 60% para o piloto e 40% para o copiloto. Disponível no plano Pro.' },
  ]

  return (
    <div>
      {/* HERO */}
      <section className="hero">
        <div className="hero-bg"/><div className="hero-grid"/>
        <div className="container">
          <div className="hero-content">
            <div className="hero-pill"><span className="hero-pill-dot"/>Criado por motoristas, para motoristas</div>
            <h1 className="hero-title">Pare de perder dinheiro<br/><span className="accent">sem saber por quê.</span></h1>
            <p className="hero-sub">Registre rotas, veja seu lucro real após o combustível e divida os ganhos com a equipe automaticamente. Funciona para ML, Shopee e Amazon.</p>
            <div className="hero-btns">
              <button className="btn btn-primary" style={{ padding: '13px 30px', fontSize: 15 }} onClick={() => nav('/cadastro')}>
                Criar conta grátis — sem cartão →
              </button>
              <button className="btn btn-ghost" style={{ padding: '13px 22px', fontSize: 14 }} onClick={() => nav('/precos')}>
                Ver planos
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 14 }}>✓ 30 rotas/mês grátis &nbsp;·&nbsp; ✓ Sem cartão &nbsp;·&nbsp; ✓ Configura em 1 minuto</p>
          </div>
        </div>
      </section>

      {/* MOCKUP VISUAL */}
      <section style={{ background: 'var(--bg2)', borderTop: '1px solid var(--b1)', padding: '56px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div className="section-pill">Como funciona</div>
            <h2 className="section-title">Simples como deve ser</h2>
            <p style={{ color: 'var(--t2)', fontSize: 14, marginTop: 8 }}>Veja como uma rota completa fica organizada no app</p>
          </div>

          {/* CARD MOCKUP */}
          <div style={{ maxWidth: 560, margin: '0 auto', background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 16, overflow: 'hidden' }}>
            {/* Header do card */}
            <div style={{ background: 'var(--s2)', padding: '14px 20px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ background: 'rgba(16,185,129,.15)', color: 'var(--gr2)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>✓ Concluída</span>
                <span style={{ background: 'rgba(249,115,22,.1)', color: 'var(--or2)', border: '1px solid rgba(249,115,22,.2)', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>▶ Ryan</span>
              </div>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 20, color: 'var(--gr2)', fontWeight: 800 }}>R$ 109,34</span>
            </div>

            {/* Detalhes */}
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Bruto', val: 'R$ 145,00', color: 'var(--or)' },
                { label: 'Combustível', val: '− R$ 35,66', color: 'var(--ye)' },
                { label: 'Lucro líquido', val: 'R$ 109,34', color: 'var(--gr2)' },
                { label: 'Ponto de coleta', val: 'CD Guarulhos', color: 'var(--t)' },
                { label: 'KMs rodados', val: '68 km', color: 'var(--t)' },
                { label: 'Taxa entrega', val: '100%', color: 'var(--gr2)' },
              ].map(item => (
                <div key={item.label} style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px' }}>
                  <p style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{item.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.val}</p>
                </div>
              ))}
            </div>

            {/* Rateio */}
            <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--b1)' }}>
              <p style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Rateio automático</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(249,115,22,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--or2)', fontWeight: 700 }}>RY</div>
                  <span style={{ fontSize: 13, color: 'var(--t)' }}>Ryan <span style={{ color: 'var(--t3)', fontSize: 11 }}>(piloto 60%)</span></span>
                </div>
                <span style={{ fontFamily: 'var(--fm)', color: 'var(--gr2)', fontWeight: 700 }}>R$ 65,60</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--t2)', fontWeight: 700 }}>IR</div>
                  <span style={{ fontSize: 13, color: 'var(--t)' }}>Irmão <span style={{ color: 'var(--t3)', fontSize: 11 }}>(copiloto 40%)</span></span>
                </div>
                <span style={{ fontFamily: 'var(--fm)', color: 'var(--gr2)', fontWeight: 700 }}>R$ 43,74</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section" style={{ borderTop: '1px solid var(--b1)', borderBottom: '1px solid var(--b1)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div className="section-pill">Funcionalidades</div>
            <h2 className="section-title">Tudo que você precisa, nada que não precisa</h2>
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

      {/* SOCIAL PROOF */}
      <section style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--b1)', padding: '48px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div className="section-pill">A história</div>
            <h2 className="section-title" style={{ marginBottom: 10 }}>Feito por quem vive a rotina</h2>
            <p style={{ color: 'var(--t2)', fontSize: 14, maxWidth: 520, margin: '0 auto' }}>
              Criado por um desenvolvedor que trabalha com entregas junto com os 3 irmãos. A necessidade real virou um sistema real.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
            {[
              { num: '30', label: 'rotas/mês no plano grátis' },
              { num: '3', label: 'plataformas suportadas' },
              { num: '1 min', label: 'para configurar a conta' },
              { num: 'R$ 0', label: 'para começar a usar' },
            ].map(item => (
              <div key={item.label} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, padding: '20px 12px' }}>
                <p style={{ fontFamily: 'var(--fm)', fontSize: 26, fontWeight: 800, color: 'var(--or)', marginBottom: 4 }}>{item.num}</p>
                <p style={{ fontSize: 12, color: 'var(--t2)' }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '56px 0', borderBottom: '1px solid var(--b1)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div className="section-pill">Dúvidas</div>
            <h2 className="section-title">Perguntas frequentes</h2>
          </div>
          <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FAQ.map((item, i) => (
              <div key={i} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 10, overflow: 'hidden' }}>
                <button
                  onClick={() => setFaqAberto(faqAberto === i ? null : i)}
                  style={{ width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textAlign: 'left' }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--t)' }}>{item.p}</span>
                  <span style={{ fontSize: 18, color: 'var(--t3)', flexShrink: 0, transition: 'transform .2s', transform: faqAberto === i ? 'rotate(45deg)' : 'none' }}>+</span>
                </button>
                {faqAberto === i && (
                  <div style={{ padding: '0 18px 14px', fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, borderTop: '1px solid var(--b1)' }}>
                    <p style={{ marginTop: 12 }}>{item.r}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ background: 'var(--bg2)', borderTop: '1px solid var(--b1)', padding: '64px 0', textAlign: 'center' }}>
        <div className="container">
          <h2 className="section-title" style={{ marginBottom: 10 }}>Comece agora, grátis</h2>
          <p style={{ color: 'var(--t2)', fontSize: 15, marginBottom: 8, fontWeight: 300 }}>30 rotas por mês sem pagar nada. Sem cartão, sem complicação.</p>
          <p style={{ color: 'var(--t3)', fontSize: 13, marginBottom: 28 }}>Quando precisar de mais, planos a partir de R$ 9,90/mês.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ fontSize: 15, padding: '13px 32px' }} onClick={() => nav('/cadastro')}>
              Criar conta grátis →
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 14, padding: '13px 24px' }} onClick={() => nav('/precos')}>
              Ver planos e preços
            </button>
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