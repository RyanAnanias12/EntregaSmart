import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchRecentes, fmtBRL, fmtData, calcRateio, statusLabel, plataformaEmoji, criarRota, fetchUsuarios, calcCombustivel } from '../lib/api'

// ─── REGISTRO RÁPIDO ────────────────────────────────────────────────────────
function RegistroRapido({ onSalvo }) {
  const [show,    setShow]   = useState(false)
  const [form,    setForm]   = useState({ ponto_coleta:'', kms:'', pacotes_saida:'', valor_total:'', data_rota: new Date().toISOString().slice(0,10) })
  const [saving,  setSaving] = useState(false)
  const [membros, setMembros]= useState([])
  const { user } = useAuth()
  const s = (k,v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (show) fetchUsuarios().then(l => setMembros(l.filter(u => u.ativo))).catch(() => {})
  }, [show])

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
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
      <button onClick={() => setShow(true)}
        style={{ position:'fixed', bottom:24, right:24, width:56, height:56, borderRadius:'50%', background:'var(--or)', border:'none', color:'#fff', fontSize:24, cursor:'pointer', boxShadow:'0 8px 24px rgba(249,115,22,.45)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}
        title="Registro rápido">+</button>
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

// ─── HOME LOGADO ─────────────────────────────────────────────────────────────
function HomeLogado({ user, tenant }) {
  const nav = useNavigate()
  const [recentes, setRecentes] = useState([])
  const [loading,  setLoading]  = useState(true)
  function load() { setLoading(true); fetchRecentes().then(setRecentes).catch(() => {}).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])
  const concluidas = recentes.filter(r => r.status === 'concluida')

  return (
    <>
      <div style={{ padding:'28px 0 60px' }}>
        <div className="container">
          <div style={{ marginBottom:24, display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <h1 style={{ fontFamily:'var(--ff)', fontSize:26, fontWeight:800, letterSpacing:'-.02em', marginBottom:4 }}>Olá, {user.nome.split(' ')[0]} 👋</h1>
              <p style={{ color:'var(--t2)', fontSize:13 }}>{tenant?.nome}</p>
            </div>
            {!['pro','solo'].includes(tenant?.plano) && (
              <button className="btn btn-ghost btn-sm" style={{ borderColor:'rgba(249,115,22,.3)', color:'var(--or2)' }} onClick={() => nav('/precos')}>
                ⭐ Upgrade Pro — R$ 14,90/mês
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:10, marginBottom:28, flexWrap:'wrap' }}>
            <button className="btn btn-primary" onClick={() => nav('/rotas?nova=1')}>+ Nova rota</button>
            <button className="btn btn-ghost" onClick={() => nav('/rotas')}>Ver todas as rotas</button>
            <button className="btn btn-ghost" onClick={() => nav('/dashboard')}>Dashboard →</button>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <h2 style={{ fontFamily:'var(--ff)', fontSize:16, fontWeight:700 }}>Rotas recentes</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/rotas')}>ver todas →</button>
          </div>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'32px 0' }}><div className="spinner"/></div>
          ) : recentes.length === 0 ? (
            <div className="card" style={{ marginBottom:24 }}>
              <div className="empty">
                <div className="empty-icon">📭</div>
                <p className="empty-title">Nenhuma rota ainda</p>
                <p className="empty-sub">Crie a primeira rota para começar</p>
                <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => nav('/rotas?nova=1')}>+ Criar primeira rota</button>
              </div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12, marginBottom:24 }}>
              {recentes.map(r => {
                const taxa = r.pacotes_saida > 0 ? Math.round((r.pacotes_entregues / r.pacotes_saida) * 100) : null
                return (
                  <div key={r.id} className="rota-recente" onClick={() => nav(`/rotas?detalhe=${r.id}`)}>
                    <div className="rota-recente-top">
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                        <span className={`badge status-${r.status}`}>{statusLabel(r.status)}</span>
                        <span className="badge badge-orange">▶ {r.piloto}</span>
                        <span style={{ fontSize:12 }}>{plataformaEmoji(r.plataforma)}</span>
                      </div>
                      {r.status === 'concluida' && <span className="rota-recente-val">{fmtBRL(r.lucro_liquido)}</span>}
                    </div>
                    <div className="rota-recente-meta">
                      <span>📍 {r.ponto_coleta}</span>
                      <span>📅 {fmtData(r.data_rota)}</span>
                      {r.kms > 0 && <span>🛣️ {r.kms} km</span>}
                      {r.veiculo_nome && <span>🚗 {r.veiculo_nome}</span>}
                      {taxa !== null && <span className={`badge ${taxa >= 80 ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize:10 }}>{taxa}%</span>}
                    </div>
                    {r.status === 'planejada' && (
                      <div style={{ marginTop:10 }}>
                        <button className="btn btn-sm" style={{ background:'var(--bld)', color:'var(--bl)', border:'1px solid rgba(59,130,246,.2)', fontSize:11 }}
                          onClick={e => { e.stopPropagation(); nav(`/rotas?editar=${r.id}`) }}>✏️ Iniciar / editar</button>
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
                  concluidas.forEach(r => { calcRateio(parseFloat(r.lucro_liquido), r.piloto, r.copiloto).forEach(p => { acc[p.nome] = (acc[p.nome]||0) + p.valor }) })
                  return Object.entries(acc).sort((a,b) => b[1]-a[1]).map(([nome, valor]) => (
                    <div key={nome} className="rateio-row">
                      <div className="rateio-left"><div className="avatar sm">{nome.slice(0,2).toUpperCase()}</div><p className="rateio-nome">{nome}</p></div>
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

// ─── CALCULADORA INTERATIVA ──────────────────────────────────────────────────
function Calculadora() {
  const nav = useNavigate()
  const [km,     setKm]     = useState(80)
  const [preco,  setPreco]  = useState(6.0)
  const [valor,  setValor]  = useState(145)
  const consumo  = 8
  const combustivel = (km / consumo) * preco
  const lucro       = valor - combustivel
  const perda       = valor * 0.12 // estimativa de erro sem controle

  return (
    <div style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:16, padding:'28px 32px', maxWidth:520, margin:'0 auto' }}>
      <p style={{ fontSize:11, color:'var(--or2)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700, marginBottom:16 }}>
        Simule sua rota
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:20 }}>
        {[
          { label:'KMs rodados', val:km, set:setKm, min:10, max:300, step:5, suf:'km' },
          { label:'Preço do combustível', val:preco, set:setPreco, min:4, max:9, step:0.1, suf:'R$/L' },
          { label:'Valor recebido', val:valor, set:setValor, min:50, max:400, step:5, suf:'R$' },
        ].map(f => (
          <div key={f.label}>
            <p style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>{f.label}</p>
            <input type="range" min={f.min} max={f.max} step={f.step} value={f.val} onChange={e=>f.set(parseFloat(e.target.value))} style={{ width:'100%', marginBottom:4 }}/>
            <p style={{ fontFamily:'var(--fm)', fontSize:14, color:'var(--t)', fontWeight:700, textAlign:'center' }}>{f.suf === 'R$' || f.suf === 'R$/L' ? `R$ ${parseFloat(f.val).toFixed(2)}` : `${f.val} ${f.suf}`}</p>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
        <div style={{ background:'var(--s2)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
          <p style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Combustível</p>
          <p style={{ fontFamily:'var(--fm)', fontSize:18, color:'var(--ye)', fontWeight:800 }}>R$ {combustivel.toFixed(2)}</p>
        </div>
        <div style={{ background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
          <p style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Lucro real</p>
          <p style={{ fontFamily:'var(--fm)', fontSize:18, color:'var(--gr2)', fontWeight:800 }}>R$ {lucro.toFixed(2)}</p>
        </div>
        <div style={{ background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.15)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
          <p style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Sem controle perde</p>
          <p style={{ fontFamily:'var(--fm)', fontSize:18, color:'var(--re)', fontWeight:800 }}>R$ {perda.toFixed(2)}</p>
        </div>
      </div>
      <p style={{ fontSize:12, color:'var(--t3)', textAlign:'center', marginBottom:16 }}>
        Com {Math.round(km/consumo * 10)/10}L de combustível a R${preco.toFixed(2)}/L você gasta R${combustivel.toFixed(2)} para fazer essa rota.
        Sem controle, muitos motoristas perdem até 12% do faturamento sem perceber.
      </p>
      <button className="btn btn-primary btn-full" style={{ fontSize:14 }} onClick={() => nav('/cadastro')}>
        Quero controlar meu lucro grátis →
      </button>
    </div>
  )
}

// ─── LANDING ─────────────────────────────────────────────────────────────────
function Landing() {
  const nav = useNavigate()
  const [faqAberto, setFaqAberto] = useState(null)

  const PASSOS = [
    { num:'01', icon:'📝', titulo:'Registra a rota', desc:'Ponto de coleta, KMs rodados, pacotes e valor recebido. Menos de 1 minuto.' },
    { num:'02', icon:'⛽', titulo:'App desconta o combustível', desc:'Calculado automaticamente pelo consumo do seu veículo e o preço atual do litro.' },
    { num:'03', icon:'💰', titulo:'Vê o lucro real', desc:'Dashboard com faturamento, lucro líquido, comparativo semanal e histórico completo.' },
  ]

  const FEATURES = [
    { icon:'⛽', title:'Combustível calculado na hora',       desc:'Informa os KMs, o app desconta o combustível e mostra seu lucro real. Sem chute.' },
    { icon:'📊', title:'Dashboard completo',                  desc:'Faturamento, lucro líquido, mapa de calor, streak de dias e comparativo semanal.' },
    { icon:'💸', title:'Rateio automático 60/40',             desc:'Piloto e copiloto veem o quanto cada um recebeu em cada rota, sem discussão.' },
    { icon:'🏆', title:'Bônus e desafios dos apps',           desc:'Registre os desafios do ML, Shopee e Amazon. Tudo entra no lucro real.' },
    { icon:'🚗', title:'Controle de veículos',                desc:'KM atual, histórico de abastecimentos e alerta de revisão automático.' },
    { icon:'🎯', title:'Meta mensal com previsão',            desc:'Define a meta e o app mostra quantos dias faltam no ritmo atual.' },
    { icon:'🔥', title:'Streak de dias consecutivos',         desc:'Gamificação que cria o hábito de registrar toda rota. Vê quantos dias seguidos você rodou.' },
    { icon:'📧', title:'Resumo semanal por email',            desc:'Todo domingo chega um email com o resumo da semana: rotas, lucro e rateio.' },
  ]

  const DEPOIMENTOS = [
    { nome:'Felipe A.', cargo:'Motorista ML — São Paulo', texto:'Antes eu achava que ganhava R$200 por dia. Com o app descobri que era R$158 depois da gasolina. Mudou como eu escolho as rotas.', avatar:'FA' },
    { nome:'Ruan S.',   cargo:'Motorista Shopee — ABC',   texto:'O rateio automático acabou com a confusão no final da semana. Cada um sabe exatamente o que recebeu.', avatar:'RS' },
    { nome:'Nildo T.',  cargo:'Equipe de 3 — Guarulhos',  texto:'A gente usava planilha. Agora em 30 segundos a rota está registrada e todo mundo recebeu o email de confirmação.', avatar:'NT' },
  ]

  const FAQ = [
    { p:'Precisa de cartão de crédito para começar?',            r:'Não. O plano gratuito não pede cartão. Você cria a conta e já começa a usar agora.' },
    { p:'Funciona para quem trabalha sozinho?',                  r:'Sim! O plano Solo foi feito para motoristas individuais. O lucro vai 100% para você, sem rateio de equipe.' },
    { p:'Funciona no celular?',                                  r:'Sim. O app é totalmente responsivo e funciona direto no celular, sem precisar instalar nada.' },
    { p:'Quantas rotas posso criar no plano gratuito?',          r:'Até 30 rotas por mês. Para rotas ilimitadas, planos a partir de R$ 9,90/mês.' },
    { p:'Funciona para ML, Shopee e Amazon ao mesmo tempo?',     r:'Sim. Cada rota tem campo de plataforma e você filtra o dashboard por plataforma para comparar qual rende mais.' },
    { p:'Como funciona o rateio automático?',                    r:'Quando você marca a rota como concluída, o sistema divide o lucro líquido: 60% para o piloto e 40% para o copiloto. Disponível no plano Pro.' },
    { p:'E se eu não gostar?',                                   r:'Nos primeiros 7 dias você pode cancelar e não pagamos nada. Sem burocracia.' },
    { p:'Meus dados ficam seguros?',                             r:'Sim. Todos os dados ficam em banco de dados criptografado. Nunca compartilhamos com terceiros.' },
  ]

  return (
    <div>

      {/* ══ HERO ══════════════════════════════════════════════════════ */}
      <section className="hero">
        <div className="hero-bg"/><div className="hero-grid"/>
        <div className="container">
          <div className="hero-content">
            <div className="hero-pill"><span className="hero-pill-dot"/>7 dias grátis no Pro — sem cartão</div>
            <h1 className="hero-title">
              Você sabe quanto<br/>
              <span className="accent">realmente lucrou hoje?</span>
            </h1>
            <p className="hero-sub">
              A maioria dos motoristas acha que ganhou R$200. Depois da gasolina, são R$147.
              O Smart Entregas mostra o número real — rota por rota.
            </p>
            <div className="hero-btns">
              <button className="btn btn-primary" style={{ padding:'13px 30px', fontSize:15 }} onClick={() => nav('/cadastro')}>
                Ver meu lucro real grátis →
              </button>
              <button className="btn btn-ghost" style={{ padding:'13px 22px', fontSize:14 }} onClick={() => nav('/precos')}>
                Ver planos
              </button>
            </div>
            <p style={{ fontSize:12, color:'var(--t3)', marginTop:14 }}>
              ✓ 7 dias Pro grátis &nbsp;·&nbsp; ✓ Sem cartão &nbsp;·&nbsp; ✓ Configura em 1 minuto &nbsp;·&nbsp; ✓ Cancela quando quiser
            </p>
          </div>
        </div>
      </section>

      {/* ══ ANTES / DEPOIS ════════════════════════════════════════════ */}
      <section style={{ background:'var(--bg2)', borderTop:'1px solid var(--b1)', borderBottom:'1px solid var(--b1)', padding:'48px 0' }}>
        <div className="container">
          <div style={{ textAlign:'center', marginBottom:36 }}>
            <div className="section-pill">O problema</div>
            <h2 className="section-title">Sem controle, o dinheiro some</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:16, maxWidth:680, margin:'0 auto', alignItems:'center' }}>
            {/* Antes */}
            <div style={{ background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', borderRadius:14, padding:'20px 22px' }}>
              <p style={{ fontSize:11, color:'var(--re)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700, marginBottom:12 }}>❌ Sem o app</p>
              {['Você acha que ganhou R$200','Não sabe quanto gastou de gasolina','Discussão no rateio da equipe','Planilha desatualizada','Não sabe qual plataforma rende mais'].map(t=>(
                <div key={t} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{ color:'var(--re)', fontSize:12, flexShrink:0 }}>✕</span>
                  <p style={{ fontSize:13, color:'var(--t2)' }}>{t}</p>
                </div>
              ))}
            </div>
            {/* Seta */}
            <div style={{ fontSize:24, color:'var(--or)', textAlign:'center' }}>→</div>
            {/* Depois */}
            <div style={{ background:'rgba(16,185,129,.06)', border:'1px solid rgba(16,185,129,.2)', borderRadius:14, padding:'20px 22px' }}>
              <p style={{ fontSize:11, color:'var(--gr2)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700, marginBottom:12 }}>✅ Com o app</p>
              {['Lucro real: R$158 após gasolina','Combustível calculado por rota','Rateio automático 60/40','Cada rota registrada em 30s','Comparativo ML vs Shopee vs Amazon'].map(t=>(
                <div key={t} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{ color:'var(--gr2)', fontSize:12, flexShrink:0 }}>✓</span>
                  <p style={{ fontSize:13, color:'var(--t2)' }}>{t}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ CALCULADORA ═══════════════════════════════════════════════ */}
      <section style={{ padding:'56px 0', borderBottom:'1px solid var(--b1)' }}>
        <div className="container">
          <div style={{ textAlign:'center', marginBottom:36 }}>
            <div className="section-pill">Simulador</div>
            <h2 className="section-title">Calcule o lucro real da sua rota</h2>
            <p style={{ color:'var(--t2)', fontSize:14, marginTop:8 }}>Arraste os controles e veja quanto você realmente lucra</p>
          </div>
          <Calculadora/>
        </div>
      </section>

      {/* ══ COMO FUNCIONA ════════════════════════════════════════════ */}
      <section style={{ background:'var(--bg2)', borderTop:'1px solid var(--b1)', borderBottom:'1px solid var(--b1)', padding:'56px 0' }}>
        <div className="container">
          <div style={{ textAlign:'center', marginBottom:40 }}>
            <div className="section-pill">Como funciona</div>
            <h2 className="section-title">3 passos. 1 minuto.</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:20, maxWidth:720, margin:'0 auto', position:'relative' }}>
            {PASSOS.map((p,i) => (
              <div key={i} style={{ textAlign:'center', padding:'24px 20px' }}>
                <div style={{ width:48, height:48, borderRadius:'50%', background:'var(--od)', border:'1px solid rgba(249,115,22,.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, margin:'0 auto 14px' }}>
                  {p.icon}
                </div>
                <p style={{ fontSize:11, color:'var(--or2)', fontWeight:700, letterSpacing:'.06em', marginBottom:6 }}>PASSO {p.num}</p>
                <p style={{ fontFamily:'var(--ff)', fontSize:15, fontWeight:700, marginBottom:8 }}>{p.titulo}</p>
                <p style={{ fontSize:13, color:'var(--t2)', lineHeight:1.6 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ DEPOIMENTOS ══════════════════════════════════════════════ */}
      <section style={{ padding:'56px 0', borderBottom:'1px solid var(--b1)' }}>
        <div className="container">
          <div style={{ textAlign:'center', marginBottom:36 }}>
            <div className="section-pill">Quem usa</div>
            <h2 className="section-title">Motoristas que pararam de chutar</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:16 }}>
            {DEPOIMENTOS.map((d,i) => (
              <div key={i} style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:14, padding:'22px 24px' }}>
                <p style={{ fontSize:13, color:'var(--t2)', lineHeight:1.7, marginBottom:18, fontStyle:'italic' }}>"{d.texto}"</p>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--od)', border:'1px solid rgba(249,115,22,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'var(--or2)', fontWeight:700, flexShrink:0 }}>
                    {d.avatar}
                  </div>
                  <div>
                    <p style={{ fontSize:13, fontWeight:600, color:'var(--t)' }}>{d.nome}</p>
                    <p style={{ fontSize:11, color:'var(--t3)' }}>{d.cargo}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══════════════════════════════════════════════════ */}
      <section style={{ background:'var(--bg2)', borderTop:'1px solid var(--b1)', borderBottom:'1px solid var(--b1)', padding:'56px 0' }}>
        <div className="container">
          <div style={{ textAlign:'center', marginBottom:44 }}>
            <div className="section-pill">Funcionalidades</div>
            <h2 className="section-title">Tudo que você precisa, nada que não precisa</h2>
          </div>
          <div className="feature-grid">
            {FEATURES.map((f,i) => (
              <div className="feature-card" key={i}>
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PREÇOS RESUMIDOS ══════════════════════════════════════════ */}
      <section style={{ padding:'56px 0', borderBottom:'1px solid var(--b1)' }}>
        <div className="container">
          <div style={{ textAlign:'center', marginBottom:36 }}>
            <div className="section-pill">Preços</div>
            <h2 className="section-title">Comece grátis. Pague só se precisar.</h2>
            <p style={{ fontSize:14, color:'var(--t2)', marginTop:8 }}>7 dias no Pro grátis para todo novo cadastro. Sem cartão.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14, maxWidth:680, margin:'0 auto 28px' }}>
            {[
              { plano:'Free',   preco:'R$ 0',    sub:'para sempre', feats:['30 rotas/mês','Dashboard básico','Cálculo de combustível'], cta:'Começar grátis', ghost:true },
              { plano:'Solo',   preco:'R$ 9,90', sub:'por mês',     feats:['Rotas ilimitadas','Dashboard completo','Mapa de calor + streak','Meta mensal','Bônus e desafios'], cta:'Testar 7 dias grátis', featured:true },
              { plano:'Pro',    preco:'R$14,90', sub:'por mês',     feats:['Tudo do Solo','Equipe com rateio','Comparativo de plataformas','Resumo semanal por email'], cta:'Testar 7 dias grátis', featured:true },
            ].map(p => (
              <div key={p.plano} style={{ background:'var(--s1)', border:`1px solid ${p.featured?'rgba(249,115,22,.3)':'var(--b1)'}`, borderRadius:14, padding:'22px 20px', position:'relative' }}>
                {p.featured && <div style={{ position:'absolute', top:-1, left:0, right:0, height:3, background:'var(--or)', borderRadius:'14px 14px 0 0' }}/>}
                <p style={{ fontFamily:'var(--ff)', fontSize:15, fontWeight:700, marginBottom:4 }}>{p.plano}</p>
                <p style={{ fontFamily:'var(--fm)', fontSize:22, fontWeight:800, color:p.featured?'var(--or)':'var(--t)', marginBottom:2 }}>{p.preco}</p>
                <p style={{ fontSize:11, color:'var(--t3)', marginBottom:16 }}>{p.sub}</p>
                {p.feats.map(f=>(
                  <div key={f} style={{ display:'flex', gap:7, alignItems:'flex-start', marginBottom:7 }}>
                    <span style={{ color:'var(--gr2)', fontSize:12, flexShrink:0, marginTop:1 }}>✓</span>
                    <p style={{ fontSize:12, color:'var(--t2)' }}>{f}</p>
                  </div>
                ))}
                <button
                  className={`btn ${p.ghost?'btn-ghost':'btn-primary'} btn-full`}
                  style={{ marginTop:16, fontSize:13 }}
                  onClick={() => nav('/cadastro')}>
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
          <p style={{ textAlign:'center', fontSize:13, color:'var(--t3)' }}>
            Quer pagar anualmente? Solo R$89/ano · Pro R$134/ano — economize 25% →{' '}
            <span style={{ color:'var(--or2)', cursor:'pointer', textDecoration:'underline' }} onClick={() => nav('/precos')}>ver planos</span>
          </p>
        </div>
      </section>

      {/* ══ FAQ ═══════════════════════════════════════════════════════ */}
      <section style={{ background:'var(--bg2)', borderTop:'1px solid var(--b1)', borderBottom:'1px solid var(--b1)', padding:'56px 0' }}>
        <div className="container">
          <div style={{ textAlign:'center', marginBottom:36 }}>
            <div className="section-pill">Dúvidas</div>
            <h2 className="section-title">Perguntas frequentes</h2>
          </div>
          <div style={{ maxWidth:640, margin:'0 auto', display:'flex', flexDirection:'column', gap:8 }}>
            {FAQ.map((item,i) => (
              <div key={i} style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:10, overflow:'hidden' }}>
                <button onClick={() => setFaqAberto(faqAberto===i?null:i)}
                  style={{ width:'100%', padding:'14px 18px', background:'none', border:'none', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, textAlign:'left' }}>
                  <span style={{ fontSize:14, fontWeight:500, color:'var(--t)' }}>{item.p}</span>
                  <span style={{ fontSize:18, color:'var(--t3)', flexShrink:0, transition:'transform .2s', transform:faqAberto===i?'rotate(45deg)':'none' }}>+</span>
                </button>
                {faqAberto === i && (
                  <div style={{ padding:'0 18px 14px', fontSize:13, color:'var(--t2)', lineHeight:1.6, borderTop:'1px solid var(--b1)' }}>
                    <p style={{ marginTop:12 }}>{item.r}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA FINAL ══════════════════════════════════════════════════ */}
      <section style={{ padding:'72px 0', textAlign:'center' }}>
        <div className="container">
          <p style={{ fontSize:13, color:'var(--or2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>Comece agora</p>
          <h2 style={{ fontFamily:'var(--ff)', fontSize:32, fontWeight:800, letterSpacing:'-.02em', marginBottom:12, lineHeight:1.2 }}>
            Descubra quanto você<br/>realmente lucra por rota
          </h2>
          <p style={{ color:'var(--t2)', fontSize:15, marginBottom:6 }}>7 dias no Pro grátis. Sem cartão. Cancela quando quiser.</p>
          <p style={{ color:'var(--t3)', fontSize:13, marginBottom:32 }}>Depois, a partir de R$ 9,90/mês. Menos que um abastecimento parcial.</p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginBottom:20 }}>
            <button className="btn btn-primary" style={{ fontSize:15, padding:'13px 36px' }} onClick={() => nav('/cadastro')}>
              Ver meu lucro real grátis →
            </button>
            <button className="btn btn-ghost" style={{ fontSize:14, padding:'13px 24px' }} onClick={() => nav('/precos')}>
              Ver planos e preços
            </button>
          </div>
          <div style={{ display:'flex', gap:20, justifyContent:'center', flexWrap:'wrap' }}>
            {['✓ 7 dias Pro grátis','✓ Sem cartão','✓ Configura em 1 minuto','✓ Cancela quando quiser'].map(t=>(
              <span key={t} style={{ fontSize:12, color:'var(--t3)' }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ borderTop:'1px solid var(--b1)', padding:'20px 0', textAlign:'center', fontSize:12, color:'var(--t3)' }}>
        Smart Entregas — controle de rotas para motoristas de logística 🚚
        <span style={{ margin:'0 12px' }}>·</span>
        <span style={{ cursor:'pointer' }} onClick={() => window.location.href = '/precos'}>Preços</span>
        <span style={{ margin:'0 12px' }}>·</span>
        <a href="mailto:contato@smartentregas.online" style={{ color:'var(--t3)', textDecoration:'none' }}>Contato</a>
      </footer>
    </div>
  )
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
export default function Home() {
  const { user, tenant, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}><div className="spinner"/></div>
  return user ? <HomeLogado user={user} tenant={tenant}/> : <Landing/>
}
