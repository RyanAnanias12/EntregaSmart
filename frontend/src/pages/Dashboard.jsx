import { useState, useEffect } from 'react'
import { fetchStats, fmtBRL, buildQS, plataformaLabel, plataformaEmoji, fetchMeta, salvarMeta, fetchDespesas, fetchConfig, fetchComparativoInteligente, fetchAbastecimentosStats, fetchStreak, fetchComparativoSemanal, fetchBonificacoesStats } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useNavigate } from 'react-router-dom'

// ─── MICRO COMPONENTS ───────────────────────────────────────────────────────
const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--s3)', border:'1px solid var(--b2)', borderRadius:10, padding:'10px 14px', fontSize:12 }}>
      <p style={{ color:'var(--t2)', marginBottom:4 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color:p.color, fontFamily:'var(--fm)' }}>{p.name}: {fmtBRL(p.value)}</p>)}
    </div>
  )
}

function Card({ children, style={} }) {
  return <div className="card" style={{ marginBottom:12, ...style }}>{children}</div>
}

function SectionLabel({ children }) {
  return <p style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:600, marginBottom:10 }}>{children}</p>
}

function Divider() {
  return <div style={{ height:1, background:'var(--b1)', margin:'16px 0' }}/>
}

function saudacao(nome) {
  const h = new Date().getHours()
  const s = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${s}, ${(nome||'').split(' ')[0]} 👋`
}

function MapaCalor({ dados }) {
  const hoje    = new Date()
  const diasSem = hoje.getDay()
  const inicio  = new Date(hoje)
  inicio.setDate(hoje.getDate() - diasSem - 11*7)

  const semanas = []
  for (let s = 0; s < 12; s++) {
    const semana = []
    for (let d = 0; d < 7; d++) {
      const dt  = new Date(inicio)
      dt.setDate(inicio.getDate() + s*7 + d)
      const key   = dt.toISOString().slice(0,10)
      const info  = dados?.find(r => r.data === key)
      const lucro = parseFloat(info?.lucro || 0)
      const futuro = dt > hoje
      let bg = 'var(--s2)'
      if (!futuro && lucro > 0)   bg = 'rgba(249,115,22,.3)'
      if (!futuro && lucro > 100) bg = 'rgba(249,115,22,.55)'
      if (!futuro && lucro > 200) bg = 'rgba(249,115,22,.8)'
      if (!futuro && lucro > 300) bg = 'var(--or)'
      semana.push({ key, lucro, bg, futuro })
    }
    semanas.push(semana)
  }

  const SZ = 11
  const GAP = 3
  const totalW = 12 * SZ + 11 * GAP

  return (
    <div style={{ width: totalW, maxWidth: totalW }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(12, ${SZ}px)`,
        gridTemplateRows: `repeat(7, ${SZ}px)`,
        gap: GAP,
      }}>
        {Array.from({length:7}, (_,d) =>
          semanas.map((sem,s) => {
            const c = sem[d]
            return (
              <div key={`${s}-${d}`}
                title={c.futuro ? '' : `${c.key}: ${fmtBRL(c.lucro)}`}
                style={{ width:SZ, height:SZ, background:c.bg, borderRadius:2, opacity:c.futuro?0.2:1 }}
              />
            )
          })
        )}
      </div>
      <div style={{ display:'flex', gap:4, alignItems:'center', marginTop:6, fontSize:10, color:'var(--t3)' }}>
        <span>Menos</span>
        {['var(--s2)','rgba(249,115,22,.3)','rgba(249,115,22,.55)','rgba(249,115,22,.8)','var(--or)'].map((bg,i)=>(
          <div key={i} style={{ width:9, height:9, background:bg, borderRadius:2, flexShrink:0 }}/>
        ))}
        <span>Mais</span>
      </div>
    </div>
  )
}

// Tabs de período
const PERIODOS = [
  { key:'hoje',   label:'Hoje'   },
  { key:'semana', label:'Semana' },
  { key:'mes',    label:'Mês'    },
  { key:'custom', label:'Custom' },
]
function getPeriodo(key) {
  const n = () => new Date()
  const fmt = d => d.toISOString().slice(0,10)
  if (key === 'hoje')   return { data_inicio: fmt(n()), data_fim: fmt(n()) }
  if (key === 'semana') {
    const d = n(); const dow = d.getDay()||7
    const ini = new Date(d); ini.setDate(d.getDate()-dow+1)
    const fim = new Date(ini); fim.setDate(ini.getDate()+6)
    return { data_inicio: fmt(ini), data_fim: fmt(fim) }
  }
  if (key === 'mes') return {
    data_inicio: fmt(new Date(n().getFullYear(), n().getMonth(), 1)),
    data_fim:    fmt(new Date(n().getFullYear(), n().getMonth()+1, 0))
  }
  return null
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const nav = useNavigate()
  const { tenant, user } = useAuth()
  const isPro  = tenant?.plano === 'pro'
  const isSolo = tenant?.plano === 'solo'
  const isPaid = isPro || isSolo

  const [periodoKey,   setPeriodoKey]   = useState('mes')
  const [period,       setPeriod]       = useState(getPeriodo('mes'))
  const [stats,        setStats]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [meta,         setMeta]         = useState(0)
  const [editMeta,     setEditMeta]     = useState(false)
  const [metaInput,    setMetaInput]    = useState('')
  const [despesas,     setDespesas]     = useState([])
  const [streakData,   setStreakData]   = useState(null)
  const [semanal,      setSemanal]      = useState(null)
  const [statsBonif,   setStatsBonif]   = useState(null)
  const [comparativo,  setComparativo]  = useState(null)
  const [statsAbastec, setStatsAbastec] = useState(null)
  const [rotaHoje,     setRotaHoje]     = useState(null)

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
    if (isPaid) {
      fetchComparativoInteligente().then(setComparativo).catch(()=>{})
      fetchAbastecimentosStats().then(setStatsAbastec).catch(()=>{})
    }
    // Rota planejada hoje
    const hoje = new Date().toISOString().slice(0,10)
    const tok  = localStorage.getItem('token')||sessionStorage.getItem('token')||''
    fetch((import.meta.env.VITE_API_URL||'/api')+`/rotas?data_inicio=${hoje}&data_fim=${hoje}&status=planejada`, {
      headers:{ Authorization:`Bearer ${tok}` }
    }).then(r=>r.json()).then(d=>{ if(d?.rotas?.length) setRotaHoje(d.rotas[0]) }).catch(()=>{})
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

  // ── Skeleton ──
  if (loading && !stats) return (
    <div style={{ padding:'28px 0 60px' }}>
      <div className="container">
        <div style={{ marginBottom:24 }}>
          <div style={{ width:220, height:30, background:'var(--s2)', borderRadius:8, marginBottom:8, animation:'pulse 1.5s ease-in-out infinite' }}/>
          <div style={{ width:150, height:14, background:'var(--s2)', borderRadius:6 }}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10, marginBottom:12 }}>
          {[1,2,3].map(i=>(
            <div key={i} style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', padding:'20px', height:i===1?100:80 }}>
              <div style={{ width:'50%', height:10, background:'var(--s2)', borderRadius:4, marginBottom:12 }}/>
              <div style={{ width:'70%', height:i===1?26:20, background:'var(--s2)', borderRadius:6 }}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
  if (!stats) return null

  const g            = stats.geral
  const meses        = stats.porMes || []
  const rateio       = (stats.rateioAcumulado||[]).sort((a,b)=>b.valor-a.valor)
  const plataformas  = (stats.porPlataforma||[]).map(p=>({...p, name:plataformaLabel(p.plataforma)}))
  const totalDespesas = despesas.reduce((a,d)=>a+parseFloat(d.valor),0)
  const totalBonif    = parseFloat(statsBonif?.total_valor||0)
  const lucroRotas    = parseFloat(g?.total_liquido||0) - parseFloat(g?.total_bonificacao||0)
  const lucroReal     = lucroRotas + totalBonif - totalDespesas
  const streak        = streakData?.streak || 0

  // Meta
  const metaAtual = lucroRotas + totalBonif
  const metaPct   = meta > 0 ? Math.min(Math.round((metaAtual/meta)*100),100) : 0
  const metaCor   = metaPct >= 100 ? 'var(--gr2)' : metaPct >= 70 ? 'var(--or)' : 'var(--ye)'
  const diaAtual  = new Date().getDate()
  const ritmo     = diaAtual > 0 ? metaAtual/diaAtual : 0
  const previsao  = meta > 0 && ritmo > 0 ? Math.ceil((meta-metaAtual)/ritmo) : null

  return (
    <div style={{ padding:'24px 0 60px' }}>
      <div className="container">

        {/* ══ SEÇÃO 1 — HEADER ══════════════════════════════════════ */}
        <div style={{ marginBottom:18, display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <h1 style={{ fontFamily:'var(--ff)', fontSize:22, fontWeight:800, letterSpacing:'-.02em', marginBottom:6 }}>
              {saudacao(user?.nome)}
            </h1>
            <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
              <span className={`badge ${isPro&&!tenant?.trial?'badge-pro':isSolo?'badge-orange':'badge-gray'}`} style={{ fontSize:10 }}>
                {isPro&&tenant?.trial?'⏳ Trial':isPro?'⭐ Pro':isSolo?'🚴 Solo':'Free'}
              </span>
              {tenant?.trial && tenant?.plano_expira_em && (() => {
                const dias = Math.max(0, Math.ceil((new Date(tenant.plano_expira_em)-new Date())/86400000))
                return <span style={{ background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.2)', borderRadius:99, padding:'2px 9px', fontSize:11, color:'var(--or2)', fontWeight:600 }}>{dias}d de trial restantes</span>
              })()}
              {streak >= 1 && (
                <span style={{ background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.2)', borderRadius:99, padding:'1px 7px', fontSize:10, color:'var(--or2)', fontWeight:600 }}>
                  {streak >= 30?'🔥🔥🔥':streak >= 14?'🔥🔥':'🔥'} {streak}d
                </span>
              )}
            </div>
          </div>

          {/* Tabs de período */}
          <div style={{ display:'flex', gap:3, background:'var(--s2)', borderRadius:8, padding:3 }}>
            {PERIODOS.map(p => (
              <button key={p.key} onClick={()=>mudarPeriodo(p.key)}
                style={{ background:periodoKey===p.key?'var(--s1)':'transparent', border:periodoKey===p.key?'1px solid var(--b1)':'1px solid transparent', color:periodoKey===p.key?'var(--t)':'var(--t3)', borderRadius:6, padding:'5px 13px', fontSize:12, fontWeight:periodoKey===p.key?600:400, cursor:'pointer', transition:'all .15s' }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {periodoKey === 'custom' && (
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <input className="input" type="date" value={period.data_inicio} onChange={e=>setPeriod(p=>({...p,data_inicio:e.target.value}))} style={{ width:150 }}/>
            <input className="input" type="date" value={period.data_fim}    onChange={e=>setPeriod(p=>({...p,data_fim:e.target.value}))}    style={{ width:150 }}/>
          </div>
        )}

        {/* Rota planejada hoje */}
        {rotaHoje && (
          <div style={{ marginBottom:12, padding:'10px 16px', background:'var(--od)', border:'1px solid rgba(249,115,22,.2)', borderRadius:'var(--r)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span>📍</span>
              <div>
                <p style={{ fontSize:11, color:'var(--t3)' }}>Rota planejada hoje</p>
                <p style={{ fontSize:13, color:'var(--t)', fontWeight:600 }}>{rotaHoje.ponto_coleta}{rotaHoje.hora_inicio?` · ${rotaHoje.hora_inicio}`:''}</p>
              </div>
            </div>
            <button onClick={()=>nav('/rotas')} className="btn btn-ghost btn-sm">Ver →</button>
          </div>
        )}

        {/* Banner Free */}
        {!isPaid && parseInt(g.total_rotas) > 0 && (
          <div style={{ marginBottom:12, padding:'11px 16px', background:'rgba(249,115,22,.06)', border:'1px solid rgba(249,115,22,.2)', borderRadius:'var(--r)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
            <p style={{ fontSize:13, color:'var(--or2)', fontWeight:500 }}>⭐ Dashboard completo por R$ 9,90/mês</p>
            <a href="/precos" className="btn btn-primary btn-sm">Ver planos →</a>
          </div>
        )}

        {/* Estado vazio */}
        {parseInt(g.total_rotas) === 0 && (
          <div style={{ padding:'40px 24px', background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', textAlign:'center', marginBottom:12 }}>
            <p style={{ fontSize:36, marginBottom:12 }}>🚚</p>
            <h2 style={{ fontFamily:'var(--ff)', fontSize:17, fontWeight:700, marginBottom:6 }}>Nenhuma rota ainda</h2>
            <p style={{ fontSize:13, color:'var(--t2)', marginBottom:20, maxWidth:340, margin:'0 auto 20px' }}>
              Registre a primeira rota e veja seu lucro real depois do combustível.
            </p>
            <a href="/rotas?nova=1" className="btn btn-primary">+ Registrar primeira rota →</a>
          </div>
        )}

        {parseInt(g.total_rotas) > 0 && <>

        {/* ══ SEÇÃO 2 — NÚMEROS PRINCIPAIS ════════════════════════════ */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10, marginBottom:12 }}>

          {/* Card principal — Lucro */}
          <div style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', padding:'20px 22px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'var(--gr2)', borderRadius:'var(--r) var(--r) 0 0' }}/>
            <p style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Lucro líquido</p>
            <p style={{ fontFamily:'var(--fm)', fontSize:32, fontWeight:800, color:'var(--gr2)', letterSpacing:'-.02em', lineHeight:1, marginBottom:6 }}>{fmtBRL(lucroRotas)}</p>
            <p style={{ fontSize:12, color:'var(--t3)', marginBottom: (totalBonif>0||totalDespesas>0)?8:0 }}>{g.total_rotas} rota{g.total_rotas!=1?'s':''} · {Number(g.total_kms||0).toFixed(0)} km · {g.total_entregues} pacotes</p>
            {(totalBonif > 0 || totalDespesas > 0) && (
              <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:8, borderTop:'1px solid var(--b1)' }}>
                <p style={{ fontSize:11, color:'var(--t3)' }}>Lucro real</p>
                <p style={{ fontFamily:'var(--fm)', fontSize:13, fontWeight:700, color:lucroReal>=lucroRotas?'var(--gr2)':'var(--re)' }}>{fmtBRL(lucroReal)}</p>
                {totalBonif>0 && <span style={{ fontSize:11, color:'var(--ye)' }}>+{fmtBRL(totalBonif)} bônus</span>}
                {totalDespesas>0 && <span style={{ fontSize:11, color:'var(--re)' }}>−{fmtBRL(totalDespesas)} desp.</span>}
              </div>
            )}
          </div>

          {/* Bruto */}
          <div className="metric">
            <p className="metric-label">Faturamento bruto</p>
            <p className="metric-value orange">{fmtBRL(g.total_bruto)}</p>
            <p className="metric-sub">{g.total_rotas} rota{g.total_rotas!=1?'s':''}</p>
          </div>

          {/* Combustível */}
          <div className="metric">
            <p className="metric-label">Combustível</p>
            <p className="metric-value yellow">{fmtBRL(g.total_combustivel)}</p>
            <p className="metric-sub">{Number(g.total_kms||0).toFixed(0)} km rodados</p>
          </div>
        </div>

        {/* ══ SEÇÃO 3 — COMPARATIVO + META (lado a lado) ═══════════════ */}
        {isPaid && (
          <div style={{ display:'grid', gridTemplateColumns: semanal && parseFloat(semanal.anterior?.lucro||0)>0 ? '1fr 1fr' : '1fr', gap:10, marginBottom:12 }}>

            {/* Comparativo semanal */}
            {semanal && parseFloat(semanal.anterior?.lucro||0) > 0 && (
              <div style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', padding:'16px 18px' }}>
                <SectionLabel>Esta semana vs semana passada</SectionLabel>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <span style={{ fontFamily:'var(--fm)', fontSize:24, fontWeight:800, color:semanal.diff>=0?'var(--gr2)':'var(--re)' }}>
                    {semanal.diff>=0?'+':''}{fmtBRL(semanal.diff)}
                  </span>
                  {semanal.pct !== null && (
                    <span style={{ background:semanal.pct>=0?'var(--gd)':'var(--rd)', color:semanal.pct>=0?'var(--gr2)':'var(--re)', border:`1px solid ${semanal.pct>=0?'rgba(16,185,129,.2)':'rgba(239,68,68,.2)'}`, borderRadius:99, padding:'2px 10px', fontSize:12, fontWeight:700 }}>
                      {semanal.pct>=0?'↑':'↓'}{Math.abs(semanal.pct)}%
                    </span>
                  )}
                </div>
                <div style={{ display:'flex', gap:16 }}>
                  <div>
                    <p style={{ fontSize:10, color:'var(--t3)', marginBottom:3 }}>Esta semana</p>
                    <p style={{ fontFamily:'var(--fm)', fontSize:14, color:'var(--or)', fontWeight:700 }}>{fmtBRL(semanal.atual?.lucro||0)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize:10, color:'var(--t3)', marginBottom:3 }}>Semana passada</p>
                    <p style={{ fontFamily:'var(--fm)', fontSize:14, color:'var(--t2)' }}>{fmtBRL(semanal.anterior?.lucro||0)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Meta */}
            <div style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', padding:'16px 18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <SectionLabel>Meta mensal</SectionLabel>
                <button className="btn btn-ghost btn-sm" style={{ fontSize:10 }} onClick={()=>{ setEditMeta(e=>!e); setMetaInput(meta) }}>
                  {editMeta?'Cancelar':'✏️ Editar'}
                </button>
              </div>
              {editMeta ? (
                <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                  <div className="field" style={{ flex:1 }}>
                    <input className="input" type="number" min="0" step="100" value={metaInput} onChange={e=>setMetaInput(e.target.value)} placeholder="Ex: 3000"/>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleSalvarMeta}>Salvar</button>
                </div>
              ) : meta > 0 ? (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:8 }}>
                    <p style={{ fontFamily:'var(--fm)', fontSize:18, fontWeight:700, color:metaCor }}>{fmtBRL(metaAtual)}<span style={{ fontSize:12, fontWeight:400, color:'var(--t3)' }}> / {fmtBRL(meta)}</span></p>
                    <span style={{ fontFamily:'var(--fm)', fontSize:20, fontWeight:800, color:metaCor }}>{metaPct}%</span>
                  </div>
                  <div style={{ background:'var(--s3)', borderRadius:99, height:8, overflow:'hidden', marginBottom:8 }}>
                    <div style={{ height:'100%', width:`${metaPct}%`, background:metaCor, borderRadius:99, transition:'width .6s ease' }}/>
                  </div>
                  <p style={{ fontSize:11, color:'var(--t3)' }}>
                    {metaPct >= 100 ? '🎉 Meta atingida!' : previsao && previsao > 0 ? `Faltam ${fmtBRL(meta-metaAtual)} — ~${previsao} dia${previsao!==1?'s':''}` : `Faltam ${fmtBRL(meta-metaAtual)}`}
                  </p>
                </>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:70, gap:8 }}>
                  <p style={{ fontSize:12, color:'var(--t3)' }}>🎯 Nenhuma meta definida</p>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setEditMeta(true)}>Definir meta →</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FREE blur */}
        {!isPaid && (
          <div style={{ position:'relative', marginBottom:12 }}>
            <div style={{ filter:'blur(5px)', pointerEvents:'none', userSelect:'none' }}>
              <div className="card" style={{ height:160 }}>
                <div className="card-header"><span className="card-title">Faturamento mensal</span></div>
                <div className="card-body" style={{ display:'flex', alignItems:'flex-end', gap:3, paddingTop:8 }}>
                  {[55,75,45,90,65,100,80].map((h,i)=><div key={i} style={{ flex:1, height:`${h}%`, background:'rgba(249,115,22,.4)', borderRadius:'3px 3px 0 0' }}/>)}
                </div>
              </div>
            </div>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(9,9,11,.6)', borderRadius:'var(--r)', backdropFilter:'blur(2px)' }}>
              <div style={{ textAlign:'center', padding:20 }}>
                <p style={{ fontSize:14, fontWeight:700, color:'var(--t)', marginBottom:5 }}>🔒 Solo e Pro</p>
                <p style={{ fontSize:12, color:'var(--t2)', marginBottom:14 }}>Gráficos, meta mensal e comparativo semanal</p>
                <a href="/precos" className="btn btn-primary btn-sm">Ver planos →</a>
              </div>
            </div>
          </div>
        )}

        {/* ══ SEÇÃO 5 — GRÁFICO + RATEIO ═══════════════════════════════ */}
        {isPaid && (meses.length > 1 || rateio.length > 0) && (
          <div style={{ display:'grid', gridTemplateColumns: meses.length>1 && rateio.length>0 ? '3fr 2fr' : '1fr', gap:10, marginBottom:12 }}>

            {/* Gráfico faturamento */}
            {meses.length > 1 && (
              <Card style={{ marginBottom:0 }}>
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
                  <ResponsiveContainer width="100%" height={190}>
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
              </Card>
            )}

            {/* Rateio */}
            {rateio.length > 0 && (
              <Card style={{ marginBottom:0 }}>
                <div className="card-header">
                  <span className="card-title">{isSolo?'Resumo':'Rateio acumulado'}</span>
                </div>
                <div className="card-body">
                  {isSolo ? (
                    [
                      { l:'Lucro líquido',  v:fmtBRL(lucroRotas),                      c:'var(--gr2)' },
                      { l:'Bruto',          v:fmtBRL(g.total_bruto),                   c:'var(--or)' },
                      { l:'KMs rodados',    v:Number(g.total_kms||0).toFixed(0)+' km', c:'var(--t)' },
                      { l:'Pacotes',        v:String(g.total_entregues||0),            c:'var(--t)' },
                    ].map(i=>(
                      <div key={i.l} className="rateio-row">
                        <p style={{ fontSize:12, color:'var(--t2)' }}>{i.l}</p>
                        <span style={{ fontFamily:'var(--fm)', fontSize:14, color:i.c, fontWeight:600 }}>{i.v}</span>
                      </div>
                    ))
                  ) : rateio.map(p=>(
                    <div key={p.nome} className="rateio-row">
                      <div className="rateio-left">
                        <div className="avatar sm">{p.nome.slice(0,2).toUpperCase()}</div>
                        <p className="rateio-nome">{p.nome}</p>
                      </div>
                      <span className="rateio-val">{fmtBRL(p.valor)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ══ SEÇÃO 6 — COMPARATIVO INTELIGENTE ═══════════════════════ */}
        {isPaid && comparativo && comparativo.rows?.length >= 2 && (
          <Card>
            <div className="card-header">
              <span className="card-title">🧠 Plataformas — qual rende mais</span>
              <span style={{ fontSize:11, color:'var(--t3)' }}>últimos 30 dias</span>
            </div>
            <div className="card-body">
              {comparativo.insights?.length > 0 && (
                <div style={{ background:'var(--od)', border:'1px solid rgba(249,115,22,.15)', borderRadius:8, padding:'10px 14px', marginBottom:12 }}>
                  {comparativo.insights.map((ins,i)=>(
                    <div key={i} style={{ marginBottom: i<comparativo.insights.length-1?8:0 }}>
                      <p style={{ fontSize:13, color:'var(--t)' }}>{ins.msg}</p>
                      {ins.acao && <p style={{ fontSize:12, color:'var(--or2)', fontWeight:600, marginTop:2 }}>💡 {ins.acao}</p>}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8 }}>
                {comparativo.rows.map((p,i)=>(
                  <div key={p.plataforma} style={{ background:'var(--s2)', borderRadius:8, padding:'11px 12px', border:i===0?'1px solid rgba(249,115,22,.2)':'1px solid var(--b1)' }}>
                    <p style={{ fontSize:12, color:'var(--t2)', marginBottom:5 }}>{plataformaEmoji(p.plataforma)} {plataformaLabel(p.plataforma)}</p>
                    <p style={{ fontFamily:'var(--fm)', fontSize:16, color:i===0?'var(--or)':'var(--t)', fontWeight:700, marginBottom:2 }}>
                      {fmtBRL(p.valor_por_pacote)}<span style={{ fontSize:10, fontWeight:400, color:'var(--t3)' }}>/pct</span>
                    </p>
                    <p style={{ fontSize:11, color:'var(--t3)' }}>{p.rotas} rotas · {p.pacotes} pcts</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* ══ SEÇÃO 7 — COMBUSTÍVEL REAL ═══════════════════════════════ */}
        {isPaid && statsAbastec && statsAbastec.total_abast > 0 && (
          <Card>
            <div className="card-header">
              <span className="card-title">⛽ Combustível real vs estimado</span>
              <a href="/combustivel" style={{ fontSize:12, color:'var(--or2)', textDecoration:'none' }}>ver histórico →</a>
            </div>
            <div className="card-body">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:8, marginBottom: Math.abs(statsAbastec.diferenca)>1?10:0 }}>
                {[
                  { l:'Gasto real',         v:fmtBRL(statsAbastec.total_gasto),       c:'var(--or)' },
                  { l:'Estimado nas rotas', v:fmtBRL(statsAbastec.custo_estimado),    c:'var(--ye)' },
                  { l:'Preço médio/L',      v:`R$ ${parseFloat(statsAbastec.preco_medio_litro).toFixed(2)}`, c:'var(--t)' },
                  { l:'Litros abast.',      v:`${parseFloat(statsAbastec.total_litros).toFixed(1)}L`,        c:'var(--t)' },
                ].map(i=>(
                  <div key={i.l} style={{ background:'var(--s2)', borderRadius:8, padding:'9px 12px' }}>
                    <p style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{i.l}</p>
                    <p style={{ fontFamily:'var(--fm)', fontSize:14, color:i.c, fontWeight:600 }}>{i.v}</p>
                  </div>
                ))}
              </div>
              {Math.abs(statsAbastec.diferenca) > 1 && (
                <div style={{ background:statsAbastec.diferenca>0?'var(--rd)':'var(--gd)', border:`1px solid ${statsAbastec.diferenca>0?'rgba(239,68,68,.2)':'rgba(16,185,129,.2)'}`, borderRadius:8, padding:'9px 12px', fontSize:12, color:statsAbastec.diferenca>0?'var(--re)':'var(--gr2)' }}>
                  {statsAbastec.diferenca > 0
                    ? `⚠️ Você gastou ${fmtBRL(statsAbastec.diferenca)} a mais que a estimativa`
                    : `✅ Você economizou ${fmtBRL(Math.abs(statsAbastec.diferenca))} em relação à estimativa`
                  }
                </div>
              )}
            </div>
          </Card>
        )}

        </>}
      </div>
    </div>
  )
}
