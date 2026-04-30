import { useState, useEffect } from 'react'
import { fetchStats, fmtBRL, buildQS, plataformaLabel, plataformaEmoji, fetchMeta, salvarMeta, fetchDespesas, fetchConfig, fetchStreak, fetchComparativoSemanal, fetchBonificacoesStats } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useNavigate } from 'react-router-dom'

// ─── HELPERS ────────────────────────────────────────────────────────────────
const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--s3)', border:'1px solid var(--b2)', borderRadius:10, padding:'10px 14px', fontSize:12 }}>
      <p style={{ color:'var(--t2)', marginBottom:4 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color:p.color, fontFamily:'var(--fm)' }}>{p.name}: {fmtBRL(p.value)}</p>)}
    </div>
  )
}

function saudacao(nome) {
  const h = new Date().getHours()
  const s = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${s}, ${(nome||'').split(' ')[0]} 👋`
}

function MapaCalor({ dados }) {
  const hoje = new Date()
  const cells = []
  for (let i = 83; i >= 0; i--) {
    const d = new Date(hoje); d.setDate(hoje.getDate() - i)
    const key  = d.toISOString().slice(0,10)
    const info = dados?.find(r => r.data === key)
    const lucro = parseFloat(info?.lucro || 0)
    let bg = 'var(--s2)'
    if (lucro > 0)   bg = 'rgba(249,115,22,.25)'
    if (lucro > 100) bg = 'rgba(249,115,22,.5)'
    if (lucro > 200) bg = 'rgba(249,115,22,.75)'
    if (lucro > 300) bg = 'var(--or)'
    cells.push({ key, lucro, bg })
  }
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:3 }}>
        {cells.map(c => (
          <div key={c.key} title={`${c.key}: ${fmtBRL(c.lucro)}`}
            style={{ aspectRatio:'1', background:c.bg, borderRadius:3, cursor:'default', transition:'transform .1s' }}
            onMouseEnter={e=>e.currentTarget.style.transform='scale(1.3)'}
            onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
          />
        ))}
      </div>
      <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:8, fontSize:11, color:'var(--t3)' }}>
        <span>Menos</span>
        {['var(--s2)','rgba(249,115,22,.25)','rgba(249,115,22,.5)','rgba(249,115,22,.75)','var(--or)'].map((bg,i)=>(
          <div key={i} style={{ width:11, height:11, background:bg, borderRadius:2 }}/>
        ))}
        <span>Mais</span>
      </div>
    </div>
  )
}

const PERIODOS = [
  { key:'hoje',    label:'Hoje' },
  { key:'semana',  label:'Semana' },
  { key:'mes',     label:'Mês' },
  { key:'custom',  label:'Custom' },
]

function getPeriodo(key) {
  const hoje = new Date()
  const fmt  = d => d.toISOString().slice(0,10)
  if (key === 'hoje')   return { data_inicio: fmt(hoje),                                       data_fim: fmt(hoje) }
  if (key === 'semana') return { data_inicio: fmt(new Date(hoje.setDate(hoje.getDate()-hoje.getDay()+1))), data_fim: fmt(new Date(new Date().setDate(new Date().getDate()-new Date().getDay()+7))) }
  if (key === 'mes')    return { data_inicio: fmt(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), data_fim: fmt(new Date(new Date().getFullYear(), new Date().getMonth()+1, 0)) }
  return null
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────
export default function Dashboard() {
  const nav = useNavigate()
  const { tenant, user } = useAuth()
  const isPro  = tenant?.plano === 'pro'
  const isSolo = tenant?.plano === 'solo'
  const isPaid = isPro || isSolo

  const [periodoKey, setPeriodoKey] = useState('mes')
  const [period, setPeriod] = useState(getPeriodo('mes'))
  const [stats,       setStats]      = useState(null)
  const [loading,     setLoading]    = useState(true)
  const [meta,        setMeta]       = useState(0)
  const [editMeta,    setEditMeta]   = useState(false)
  const [metaInput,   setMetaInput]  = useState('')
  const [despesas,    setDespesas]   = useState([])
  const [streakData,  setStreakData]  = useState(null)
  const [semanal,     setSemanal]    = useState(null)
  const [statsBonif,  setStatsBonif] = useState(null)
  const [rotaHoje,    setRotaHoje]   = useState(null)

  useEffect(() => {
    setLoading(true)
    fetchStats(buildQS(period)).then(setStats).catch(()=>{}).finally(()=>setLoading(false))
  }, [period])

  useEffect(() => {
    fetchMeta().then(d => { setMeta(d.meta_mensal||0); setMetaInput(d.meta_mensal||'') }).catch(()=>{})
    fetchDespesas().then(setDespesas).catch(()=>{})
    fetchStreak().then(setStreakData).catch(()=>{})
    fetchComparativoSemanal().then(setSemanal).catch(()=>{})
    fetchBonificacoesStats().then(setStatsBonif).catch(()=>{})
    // Próxima rota planejada hoje
    const hoje = new Date().toISOString().slice(0,10)
    fetch((import.meta.env.VITE_API_URL||'/api') + `/rotas?data_inicio=${hoje}&data_fim=${hoje}&status=planejada`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')||sessionStorage.getItem('token')||''}` }
    }).then(r=>r.json()).then(d=>{ if (d?.rotas?.length) setRotaHoje(d.rotas[0]) }).catch(()=>{})
  }, [])

  function mudarPeriodo(key) {
    setPeriodoKey(key)
    if (key !== 'custom') setPeriod(getPeriodo(key))
  }

  async function handleSalvarMeta() {
    const v = parseFloat(metaInput)||0
    await salvarMeta(v).catch(()=>{})
    setMeta(v); setEditMeta(false)
  }

  // Skeleton
  if (loading && !stats) return (
    <div style={{ padding:'28px 0 60px' }}>
      <div className="container">
        <div style={{ marginBottom:24 }}>
          <div style={{ width:220, height:32, background:'var(--s2)', borderRadius:8, marginBottom:8, animation:'pulse 1.5s ease-in-out infinite' }}/>
          <div style={{ width:140, height:16, background:'var(--s2)', borderRadius:6 }}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:14 }}>
          {[1,2,3].map(i=>(
            <div key={i} style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', padding:'20px', height:90 }}>
              <div style={{ width:'50%', height:10, background:'var(--s2)', borderRadius:4, marginBottom:14 }}/>
              <div style={{ width:'70%', height:26, background:'var(--s2)', borderRadius:6 }}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
  if (!stats) return null

  const g = stats.geral
  const meses = stats.porMes || []
  const totalDespesas = despesas.reduce((a,d)=>a+parseFloat(d.valor),0)
  const totalBonif    = parseFloat(statsBonif?.total_valor||0)
  const lucroRotas    = parseFloat(g?.total_liquido||0) - parseFloat(g?.total_bonificacao||0)
  const lucroReal     = lucroRotas + totalBonif - totalDespesas
  const streak        = streakData?.streak || 0

  // META
  const metaAtual = lucroRotas + totalBonif
  const metaPct   = meta > 0 ? Math.min(Math.round((metaAtual/meta)*100), 100) : 0
  const metaCor   = metaPct >= 100 ? 'var(--gr2)' : metaPct >= 70 ? 'var(--or)' : 'var(--ye)'
  const diasMes   = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate()
  const diaAtual  = new Date().getDate()
  const diasRest  = diasMes - diaAtual
  const ritmo     = diaAtual > 0 ? metaAtual / diaAtual : 0
  const previsao  = meta > 0 && ritmo > 0 ? Math.ceil((meta - metaAtual) / ritmo) : null

  // RESUMO SEMANA PASSADA
  const resumoSemana = semanal?.anterior
    ? `Na semana passada você fez ${semanal.anterior.rotas} rota${semanal.anterior.rotas!=1?'s':''} e lucrou ${fmtBRL(semanal.anterior.lucro)}`
    : null

  return (
    <div style={{ padding:'24px 0 60px' }}>
      <div className="container">

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:6 }}>
            <div>
              <h1 style={{ fontFamily:'var(--ff)', fontSize:22, fontWeight:800, letterSpacing:'-.02em', marginBottom:4 }}>
                {saudacao(user?.nome)}
              </h1>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                <span className={`badge ${isPro&&!tenant?.trial?'badge-pro':isSolo?'badge-orange':'badge-gray'}`} style={{ fontSize:10 }}>
                  {isPro&&tenant?.trial?'⏳ Trial':isPro?'⭐ Pro':isSolo?'🚴 Solo':'Free'}
                </span>
                {tenant?.trial && tenant?.plano_expira_em && (() => {
                  const dias = Math.max(0, Math.ceil((new Date(tenant.plano_expira_em) - new Date()) / 86400000))
                  return <span style={{ background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.2)', borderRadius:99, padding:'2px 9px', fontSize:11, color:'var(--or2)', fontWeight:600 }}>{dias}d de trial</span>
                })()}
                {streak >= 1 && (
                  <span style={{ background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.2)', borderRadius:99, padding:'2px 9px', fontSize:11, color:'var(--or2)', fontWeight:600 }}>
                    {streak >= 30 ? '🔥🔥🔥' : streak >= 14 ? '🔥🔥' : '🔥'} {streak}d seguidos
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Resumo semana passada — 1 linha */}
          {resumoSemana && (
            <p style={{ fontSize:12, color:'var(--t3)', marginTop:4 }}>{resumoSemana}</p>
          )}
        </div>

        {/* PRÓXIMA ROTA PLANEJADA HOJE */}
        {rotaHoje && (
          <div style={{ marginBottom:12, padding:'10px 16px', background:'var(--od)', border:'1px solid rgba(249,115,22,.2)', borderRadius:'var(--r)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:14 }}>📍</span>
              <div>
                <p style={{ fontSize:12, color:'var(--t3)', marginBottom:1 }}>Rota planejada hoje</p>
                <p style={{ fontSize:13, color:'var(--t)', fontWeight:600 }}>{rotaHoje.ponto_coleta}{rotaHoje.hora_inicio?` · ${rotaHoje.hora_inicio}`:''}</p>
              </div>
            </div>
            <button onClick={()=>nav('/rotas')} className="btn btn-ghost btn-sm">Ver →</button>
          </div>
        )}

        {/* TABS DE PERÍODO */}
        <div style={{ display:'flex', gap:4, marginBottom:14, background:'var(--s2)', borderRadius:'var(--r)', padding:4, width:'fit-content' }}>
          {PERIODOS.map(p => (
            <button key={p.key} onClick={()=>mudarPeriodo(p.key)}
              style={{ background:periodoKey===p.key?'var(--s1)':'transparent', border:periodoKey===p.key?'1px solid var(--b1)':'1px solid transparent', color:periodoKey===p.key?'var(--t)':'var(--t3)', borderRadius:6, padding:'5px 14px', fontSize:12, fontWeight:periodoKey===p.key?600:400, cursor:'pointer', transition:'all .15s' }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {periodoKey === 'custom' && (
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            <input className="input" type="date" value={period.data_inicio} onChange={e=>setPeriod(p=>({...p,data_inicio:e.target.value}))} style={{ width:150 }}/>
            <input className="input" type="date" value={period.data_fim}    onChange={e=>setPeriod(p=>({...p,data_fim:e.target.value}))}    style={{ width:150 }}/>
          </div>
        )}

        {/* ESTADO VAZIO */}
        {parseInt(g.total_rotas) === 0 && (
          <div style={{ marginBottom:16, padding:'32px 24px', background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', textAlign:'center' }}>
            <p style={{ fontSize:32, marginBottom:10 }}>🚚</p>
            <h2 style={{ fontFamily:'var(--ff)', fontSize:17, fontWeight:700, marginBottom:6 }}>Nenhuma rota ainda</h2>
            <p style={{ fontSize:13, color:'var(--t2)', marginBottom:20, maxWidth:340, margin:'0 auto 20px' }}>
              Registre a primeira rota e descubra seu lucro real depois do combustível.
            </p>
            <a href="/rotas?nova=1" className="btn btn-primary" style={{ fontSize:13, padding:'10px 24px' }}>+ Registrar primeira rota →</a>
          </div>
        )}

        {/* BANNER FREE */}
        {!isPaid && parseInt(g.total_rotas) > 0 && (
          <div style={{ marginBottom:12, padding:'12px 16px', background:'rgba(249,115,22,.06)', border:'1px solid rgba(249,115,22,.2)', borderRadius:'var(--r)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <p style={{ fontSize:13, color:'var(--or2)', fontWeight:500 }}>⭐ Dashboard completo por R$ 9,90/mês</p>
            <a href="/precos" className="btn btn-primary btn-sm">Ver planos →</a>
          </div>
        )}

        {/* ── 3 CARDS PRINCIPAIS ────────────────────────────────────── */}
        {parseInt(g.total_rotas) > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:12 }}>
            {/* LUCRO LÍQUIDO — destaque */}
            <div style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', padding:'18px 20px', gridColumn:'1', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'var(--gr2)', borderRadius:'var(--r) var(--r) 0 0' }}/>
              <p style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Lucro líquido</p>
              <p style={{ fontFamily:'var(--fm)', fontSize:28, fontWeight:800, color:'var(--gr2)', letterSpacing:'-.02em', marginBottom:4 }}>{fmtBRL(lucroRotas)}</p>
              <p style={{ fontSize:11, color:'var(--t3)' }}>{g.total_rotas} rota{g.total_rotas!=1?'s':''} concluída{g.total_rotas!=1?'s':''}</p>
              {(totalBonif > 0 || totalDespesas > 0) && (
                <p style={{ fontSize:11, color:lucroReal>=lucroRotas?'var(--gr2)':'var(--re)', marginTop:4, fontWeight:600 }}>
                  real: {fmtBRL(lucroReal)}
                  {totalBonif>0 && <span style={{ color:'var(--ye)', fontWeight:400 }}> +{fmtBRL(totalBonif)} bônus</span>}
                </p>
              )}
            </div>

            {/* BRUTO */}
            <div className="metric">
              <p className="metric-label">Faturamento bruto</p>
              <p className="metric-value orange">{fmtBRL(g.total_bruto)}</p>
              <p className="metric-sub">{Number(g.total_kms||0).toFixed(0)} km rodados</p>
            </div>

            {/* COMBUSTÍVEL */}
            <div className="metric">
              <p className="metric-label">Combustível</p>
              <p className="metric-value yellow">{fmtBRL(g.total_combustivel)}</p>
              <p className="metric-sub">{g.total_entregues} pacotes entregues</p>
            </div>
          </div>
        )}

        {/* ── COMPARATIVO SEMANAL ──────────────────────────────────── */}
        {isPaid && semanal && parseFloat(semanal.anterior?.lucro||0) > 0 && (
          <div style={{ marginBottom:12, padding:'14px 18px', background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', justifyContent:'space-between' }}>
            <div>
              <p style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Esta semana vs semana passada</p>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontFamily:'var(--fm)', fontSize:22, fontWeight:800, color:semanal.diff>=0?'var(--gr2)':'var(--re)' }}>
                  {semanal.diff>=0?'+':''}{fmtBRL(semanal.diff)}
                </span>
                {semanal.pct !== null && (
                  <span style={{ background:semanal.pct>=0?'var(--gd)':'var(--rd)', color:semanal.pct>=0?'var(--gr2)':'var(--re)', border:`1px solid ${semanal.pct>=0?'rgba(16,185,129,.2)':'rgba(239,68,68,.2)'}`, borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700 }}>
                    {semanal.pct>=0?'↑':'↓'}{Math.abs(semanal.pct)}%
                  </span>
                )}
              </div>
            </div>
            <div style={{ display:'flex', gap:20 }}>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontSize:10, color:'var(--t3)', marginBottom:3 }}>Esta semana</p>
                <p style={{ fontFamily:'var(--fm)', fontSize:15, color:'var(--or)', fontWeight:700 }}>{fmtBRL(semanal.atual?.lucro||0)}</p>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontSize:10, color:'var(--t3)', marginBottom:3 }}>Semana passada</p>
                <p style={{ fontFamily:'var(--fm)', fontSize:15, color:'var(--t2)' }}>{fmtBRL(semanal.anterior?.lucro||0)}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── META MENSAL ─────────────────────────────────────────── */}
        {isPaid && (meta > 0 || editMeta) && (
          <div className="card" style={{ marginBottom:12 }}>
            <div className="card-header">
              <span className="card-title">Meta mensal</span>
              <button className="btn btn-ghost btn-sm" onClick={()=>{ setEditMeta(e=>!e); setMetaInput(meta) }}>{editMeta?'Cancelar':'✏️ Editar'}</button>
            </div>
            <div className="card-body">
              {editMeta ? (
                <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                  <div className="field" style={{ flex:1 }}>
                    <label className="field-label">Meta (R$)</label>
                    <input className="input" type="number" min="0" step="100" value={metaInput} onChange={e=>setMetaInput(e.target.value)} placeholder="Ex: 3000"/>
                  </div>
                  <button className="btn btn-primary" onClick={handleSalvarMeta}>Salvar</button>
                </div>
              ) : (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:10 }}>
                    <div>
                      <p style={{ fontFamily:'var(--fm)', fontSize:20, fontWeight:700, color:metaCor }}>{fmtBRL(metaAtual)}</p>
                      <p style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>de {fmtBRL(meta)}</p>
                    </div>
                    <span style={{ fontFamily:'var(--fm)', fontSize:24, fontWeight:800, color:metaCor }}>{metaPct}%</span>
                  </div>
                  <div style={{ background:'var(--s3)', borderRadius:99, height:12, overflow:'hidden', marginBottom:8 }}>
                    <div style={{ height:'100%', width:`${metaPct}%`, background:metaCor, borderRadius:99, transition:'width .6s ease' }}/>
                  </div>
                  <p style={{ fontSize:12, color:'var(--t3)' }}>
                    {metaPct >= 100
                      ? '🎉 Meta atingida!'
                      : previsao !== null && previsao > 0
                        ? `Faltam ${fmtBRL(meta-metaAtual)} — no ritmo atual você bate em ~${previsao} dia${previsao!==1?'s':''}`
                        : `Faltam ${fmtBRL(meta-metaAtual)} para atingir a meta`
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        {isPaid && !meta && !editMeta && (
          <div style={{ marginBottom:12, padding:'10px 16px', background:'var(--s1)', border:'1px dashed var(--b2)', borderRadius:'var(--r)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <p style={{ fontSize:13, color:'var(--t3)' }}>🎯 Defina uma meta mensal</p>
            <button className="btn btn-ghost btn-sm" onClick={()=>setEditMeta(true)}>Definir →</button>
          </div>
        )}

        {/* ── MAPA DE CALOR ───────────────────────────────────────── */}
        {isPaid && streakData?.mapa && streakData.mapa.length > 0 && (
          <div className="card" style={{ marginBottom:12 }}>
            <div className="card-header">
              <span className="card-title">Atividade — 12 semanas</span>
              {streak >= 1 && (
                <span style={{ background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.2)', borderRadius:99, padding:'3px 10px', fontSize:11, color:'var(--or2)', fontWeight:600 }}>
                  {streak >= 30 ? '🔥🔥🔥' : streak >= 14 ? '🔥🔥' : '🔥'} {streak} dia{streak!==1?'s':''} seguido{streak!==1?'s':''}
                </span>
              )}
            </div>
            <div className="card-body">
              <MapaCalor dados={streakData.mapa}/>
            </div>
          </div>
        )}

        {/* FREE — blur preview */}
        {!isPaid && parseInt(g.total_rotas) > 0 && (
          <div style={{ position:'relative', marginBottom:12 }}>
            <div style={{ filter:'blur(5px)', pointerEvents:'none', userSelect:'none', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div className="card" style={{ height:180 }}>
                <div className="card-header"><span className="card-title">Faturamento mensal</span></div>
                <div className="card-body" style={{ display:'flex', alignItems:'flex-end', gap:4, paddingTop:8 }}>
                  {[60,80,45,90,70,100,85].map((h,i)=>(
                    <div key={i} style={{ flex:1, height:`${h}%`, background:'rgba(249,115,22,.4)', borderRadius:'4px 4px 0 0' }}/>
                  ))}
                </div>
              </div>
              <div className="card" style={{ height:180 }}>
                <div className="card-header"><span className="card-title">Atividade 12 semanas</span></div>
                <div className="card-body">
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:3 }}>
                    {Array(84).fill(0).map((_,i)=><div key={i} style={{ aspectRatio:'1', background:`rgba(249,115,22,${Math.random()*.6+.1})`, borderRadius:3 }}/>)}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(9,9,11,.6)', borderRadius:'var(--r)', backdropFilter:'blur(2px)' }}>
              <div style={{ textAlign:'center', padding:24 }}>
                <p style={{ fontSize:15, fontWeight:700, color:'var(--t)', marginBottom:6 }}>🔒 Disponível no Solo e Pro</p>
                <p style={{ fontSize:12, color:'var(--t2)', marginBottom:16 }}>Mapa de calor, comparativo semanal, meta mensal e gráficos</p>
                <a href="/precos" className="btn btn-primary btn-sm">Ver planos a partir de R$ 9,90 →</a>
              </div>
            </div>
          </div>
        )}

        {/* ── GRÁFICO FATURAMENTO (Pro) ────────────────────────────── */}
        {isPaid && meses.length > 1 && (
          <div className="card" style={{ marginBottom:12 }}>
            <div className="card-header">
              <span className="card-title">Faturamento mensal</span>
              <div style={{ display:'flex', gap:12 }}>
                {[{color:'#f97316',label:'Bruto'},{color:'#10b981',label:'Líquido'}].map(i=>(
                  <div key={i.label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--t2)' }}>
                    <span style={{ width:10, height:2, background:i.color, display:'inline-block', borderRadius:1 }}/>{i.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="card-body" style={{ paddingTop:6 }}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={meses} margin={{ top:10, right:8, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="gOr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={.2}/><stop offset="100%" stopColor="#f97316" stopOpacity={0}/></linearGradient>
                    <linearGradient id="gGr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={.15}/><stop offset="100%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,.03)" strokeDasharray="3 3"/>
                  <XAxis dataKey="mes" tick={{ fill:'#4a4a62', fontSize:11 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:'#4a4a62', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v=>`R$${v}`}/>
                  <Tooltip content={<TT/>}/>
                  <Area type="monotone" dataKey="bruto"   name="Bruto"   stroke="#f97316" strokeWidth={2} fill="url(#gOr)" dot={false}/>
                  <Area type="monotone" dataKey="liquido" name="Líquido" stroke="#10b981" strokeWidth={2} fill="url(#gGr)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
