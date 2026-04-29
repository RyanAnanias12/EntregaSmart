import { useState, useEffect } from 'react'
import { fetchStats, fmtBRL, buildQS, plataformaLabel, plataformaEmoji, fetchMeta, salvarMeta, fetchDespesas, fetchConfig, fetchComparativoInteligente, fetchAbastecimentosStats, fetchStreak, fetchComparativoSemanal, fetchBonificacoesStats } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--s3)', border:'1px solid var(--b2)', borderRadius:10, padding:'10px 14px', fontSize:12 }}>
      <p style={{ color:'var(--t2)', marginBottom:4 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color:p.color, fontFamily:'var(--fm)' }}>{p.name}: R$ {Number(p.value).toFixed(2)}</p>)}
    </div>
  )
}

const COLORS    = ['#f97316','#fb923c','#fdba74','#fed7aa']
const PIE_COLORS= ['#f97316','#3b82f6','#f59e0b','#10b981']

// Mapa de calor estilo GitHub
function MapaCalor({ dados }) {
  const hoje = new Date()
  const cells = []
  for (let i = 83; i >= 0; i--) {
    const d = new Date(hoje)
    d.setDate(hoje.getDate() - i)
    const key = d.toISOString().slice(0,10)
    const info = dados?.find(r => r.data === key)
    const lucro = parseFloat(info?.lucro || 0)
    let bg = 'var(--s2)'
    if (lucro > 0)   bg = 'rgba(249,115,22,.25)'
    if (lucro > 100) bg = 'rgba(249,115,22,.5)'
    if (lucro > 200) bg = 'rgba(249,115,22,.75)'
    if (lucro > 300) bg = 'var(--or)'
    cells.push({ key, lucro, bg, dia: d.getDate(), mes: d.getMonth() })
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
      <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:10, fontSize:11, color:'var(--t3)' }}>
        <span>Menos</span>
        {['var(--s2)','rgba(249,115,22,.25)','rgba(249,115,22,.5)','rgba(249,115,22,.75)','var(--or)'].map((bg,i) => (
          <div key={i} style={{ width:12, height:12, background:bg, borderRadius:2 }}/>
        ))}
        <span>Mais</span>
      </div>
    </div>
  )
}

// Streak badge
function StreakBadge({ streak }) {
  if (!streak || streak < 2) return null
  const emoji = streak >= 30 ? '🔥🔥🔥' : streak >= 14 ? '🔥🔥' : '🔥'
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.25)', borderRadius:99, padding:'4px 12px', fontSize:12, color:'var(--or2)', fontWeight:600 }}>
      {emoji} {streak} dia{streak!==1?'s':''} seguidos!
    </div>
  )
}

// Saudação personalizada
function saudacao(nome) {
  const h = new Date().getHours()
  const s = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${s}, ${(nome||'').split(' ')[0]} 👋`
}

export default function Dashboard() {
  const { tenant, user } = useAuth()
  const isPro  = tenant?.plano === 'pro'
  const isSolo = tenant?.plano === 'solo'
  const isPaid = isPro || isSolo

  const [stats,       setStats]       = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [period,      setPeriod]      = useState(() => {
    const hoje = new Date()
    return {
      data_inicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10),
      data_fim:    new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).toISOString().slice(0,10),
    }
  })
  const [meta,         setMeta]         = useState(0)
  const [despesas,     setDespesas]     = useState([])
  const [config,       setConfig]       = useState({ modo_solo:false, meta_diaria:0 })
  const [editMeta,     setEditMeta]     = useState(false)
  const [metaInput,    setMetaInput]    = useState('')
  const [comparativo,  setComparativo]  = useState(null)
  const [statsAbastec, setStatsAbastec] = useState(null)
  const [streakData,   setStreakData]   = useState(null)
  const [semanal,      setSemanal]      = useState(null)
  const [statsBonif,   setStatsBonif]   = useState(null)

  useEffect(() => {
    setLoading(true)
    fetchStats(buildQS(period)).then(setStats).catch(()=>{}).finally(()=>setLoading(false))
  }, [period])

  useEffect(() => {
    fetchMeta().then(d => { setMeta(d.meta_mensal||0); setMetaInput(d.meta_mensal||'') }).catch(()=>{})
    fetchDespesas().then(setDespesas).catch(()=>{})
    fetchConfig().then(setConfig).catch(()=>{})
    fetchStreak().then(setStreakData).catch(()=>{})
    fetchComparativoSemanal().then(setSemanal).catch(()=>{})
    fetchBonificacoesStats().then(setStatsBonif).catch(()=>{})
    if (isPaid) {
      fetchComparativoInteligente().then(setComparativo).catch(()=>{})
      fetchAbastecimentosStats().then(setStatsAbastec).catch(()=>{})
    }
  }, [])

  async function handleSalvarMeta() {
    const v = parseFloat(metaInput)||0
    await salvarMeta(v).catch(()=>{})
    setMeta(v); setEditMeta(false)
  }

  const setP = (k,v) => setPeriod(p=>({...p,[k]:v}))

  // Skeleton loader
  if (loading) return (
    <div style={{ padding:'28px 0 60px' }}>
      <div className="container">
        <div style={{ marginBottom:24 }}>
          <div style={{ width:220, height:32, background:'var(--s2)', borderRadius:8, marginBottom:8, animation:'pulse 1.5s ease-in-out infinite' }}/>
          <div style={{ width:140, height:16, background:'var(--s2)', borderRadius:6 }}/>
        </div>
        <div className="grid4" style={{ marginBottom:16 }}>
          {[1,2,3,4].map(i=>(
            <div key={i} style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', padding:'18px 20px', height:80 }}>
              <div style={{ width:'60%', height:10, background:'var(--s2)', borderRadius:4, marginBottom:12 }}/>
              <div style={{ width:'40%', height:24, background:'var(--s2)', borderRadius:6 }}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
  if (!stats) return null

  const g           = stats.geral
  const meses       = stats.porMes || []
  const rateio      = (stats.rateioAcumulado||[]).sort((a,b)=>b.valor-a.valor)
  const plataformas = (stats.porPlataforma||[]).map(p=>({...p,name:plataformaLabel(p.plataforma)}))
  const taxaGeral   = (() => {
    const tot = parseInt(g.total_entregues)+parseInt(g.total_devolvidos)
    if (!tot) return null
    return Math.round((parseInt(g.total_entregues)/tot)*100)
  })()

  // Lucro real com bonificações
  const totalDespesas = despesas.reduce((a,d)=>a+parseFloat(d.valor),0)
  const totalBonif    = parseFloat(statsBonif?.total_valor||0)
  const lucroReal     = parseFloat(g?.total_liquido||0) - totalDespesas + totalBonif

  return (
    <div style={{ padding:'28px 0 60px' }}>
      <div className="container">

        {/* SAUDAÇÃO */}
        <div style={{ marginBottom:20, display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontFamily:'var(--ff)', fontSize:24, fontWeight:800, letterSpacing:'-.02em', marginBottom:4 }}>
              {saudacao(user?.nome)}
            </h1>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <p style={{ color:'var(--t2)', fontSize:13 }}>Dashboard</p>
              {/* Badge de plano */}
              <span className={`badge ${isPro?'badge-pro':isSolo?'badge-orange':'badge-gray'}`} style={{ fontSize:10 }}>
                {isPro?'⭐ Pro':isSolo?'🚴 Solo':'Free'}
              </span>
              {streakData?.streak >= 2 && <StreakBadge streak={streakData.streak}/>}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div className="field">
              <label className="field-label">De</label>
              <input className="input" type="date" value={period.data_inicio} onChange={e=>setP('data_inicio',e.target.value)} style={{ width:150 }}/>
            </div>
            <div className="field">
              <label className="field-label">Até</label>
              <input className="input" type="date" value={period.data_fim} onChange={e=>setP('data_fim',e.target.value)} style={{ width:150 }}/>
            </div>
          </div>
        </div>

        {/* COMPARATIVO SEMANAL */}
        {semanal && parseFloat(semanal.anterior?.lucro||0) > 0 && (
          <div style={{ marginBottom:14, padding:'12px 18px', background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <p style={{ fontSize:11, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:3 }}>Esta semana vs semana passada</p>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontFamily:'var(--fm)', fontSize:18, fontWeight:700, color: semanal.diff>=0?'var(--gr2)':'var(--re)' }}>
                  {semanal.diff>=0?'+':''}{fmtBRL(semanal.diff)}
                </span>
                {semanal.pct !== null && (
                  <span style={{ background: semanal.pct>=0?'var(--gd)':'var(--rd)', color: semanal.pct>=0?'var(--gr2)':'var(--re)', border:`1px solid ${semanal.pct>=0?'rgba(16,185,129,.2)':'rgba(239,68,68,.2)'}`, borderRadius:99, padding:'2px 9px', fontSize:11, fontWeight:700 }}>
                    {semanal.pct>=0?'↑':'↓'}{Math.abs(semanal.pct)}%
                  </span>
                )}
              </div>
            </div>
            <div style={{ display:'flex', gap:16 }}>
              <div style={{ textAlign:'center' }}>
                <p style={{ fontSize:10, color:'var(--t3)', marginBottom:2 }}>Esta semana</p>
                <p style={{ fontFamily:'var(--fm)', fontSize:14, color:'var(--or)', fontWeight:700 }}>{fmtBRL(semanal.atual?.lucro||0)}</p>
              </div>
              <div style={{ textAlign:'center' }}>
                <p style={{ fontSize:10, color:'var(--t3)', marginBottom:2 }}>Semana passada</p>
                <p style={{ fontFamily:'var(--fm)', fontSize:14, color:'var(--t2)' }}>{fmtBRL(semanal.anterior?.lucro||0)}</p>
              </div>
            </div>
          </div>
        )}

        {/* ESTADO VAZIO MOTIVADOR */}
        {parseInt(g.total_rotas) === 0 && (
          <div style={{ marginBottom:16, padding:'28px 24px', background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', textAlign:'center' }}>
            <p style={{ fontSize:32, marginBottom:10 }}>🚚</p>
            <h2 style={{ fontFamily:'var(--ff)', fontSize:18, fontWeight:700, marginBottom:6 }}>Nenhuma rota ainda</h2>
            <p style={{ fontSize:13, color:'var(--t2)', marginBottom:20, maxWidth:360, margin:'0 auto 20px' }}>
              Registre a primeira rota e descubra seu lucro real depois do combustível. Leva menos de 1 minuto.
            </p>
            <a href="/rotas?nova=1" className="btn btn-primary" style={{ fontSize:14, padding:'11px 28px' }}>+ Registrar primeira rota →</a>
          </div>
        )}

        {/* BANNER FREE */}
        {!isPaid && parseInt(g.total_rotas) > 0 && (
          <div style={{ marginBottom:14, padding:'14px 18px', background:'linear-gradient(135deg,rgba(249,115,22,.1),rgba(251,146,60,.05))', border:'1px solid rgba(249,115,22,.25)', borderRadius:'var(--r)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:'var(--or2)', marginBottom:2 }}>⭐ Desbloqueie o Dashboard completo</p>
              <p style={{ fontSize:12, color:'var(--t3)' }}>Gráficos, mapa de calor, comparativo semanal e muito mais por R$ 9,90/mês.</p>
            </div>
            <a href="/precos" className="btn btn-primary btn-sm">Ver planos →</a>
          </div>
        )}

        {/* MÉTRICAS */}
        <div className="grid4" style={{ marginBottom:14 }}>
          <div className="metric"><p className="metric-label">Total bruto</p><p className="metric-value orange">{fmtBRL(g.total_bruto)}</p><p className="metric-sub">{g.total_rotas} rota{g.total_rotas!=1?'s':''}</p></div>
          <div className="metric"><p className="metric-label">Lucro líquido</p><p className="metric-value green">{fmtBRL(g.total_liquido)}</p><p className="metric-sub">após combustível</p></div>
          <div className="metric"><p className="metric-label">Combustível</p><p className="metric-value yellow">{fmtBRL(g.total_combustivel)}</p><p className="metric-sub">{Number(g.total_kms).toFixed(0)} km</p></div>
          <div className="metric">
            <p className="metric-label">Taxa entrega</p>
            {isPaid ? (
              <p className="metric-value">{taxaGeral!==null?`${taxaGeral}%`:'—'}</p>
            ) : (
              <p className="metric-value" style={{ filter:'blur(5px)', userSelect:'none', pointerEvents:'none' }}>89%</p>
            )}
            <p className="metric-sub">{g.total_entregues} entregues</p>
          </div>
        </div>

        {/* LUCRO REAL (com bonificações) */}
        {isPaid && (despesas.length > 0 || totalBonif > 0) && (
          <div className="card" style={{ marginBottom:14, border: lucroReal>=0?'1px solid rgba(16,185,129,.2)':'1px solid rgba(239,68,68,.2)' }}>
            <div className="card-header">
              <span className="card-title">💰 Lucro real do mês</span>
              <a href="/bonificacoes" style={{ fontSize:12, color:'var(--or2)', textDecoration:'none' }}>+ Bônus/desafios →</a>
            </div>
            <div className="card-body">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10 }}>
                <div style={{ background:'var(--s2)', borderRadius:8, padding:'10px 14px' }}>
                  <p style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>Lucro das rotas</p>
                  <p style={{ fontFamily:'var(--fm)', fontSize:14, color:'var(--gr2)' }}>{fmtBRL(g?.total_liquido)}</p>
                </div>
                {totalBonif > 0 && (
                  <div style={{ background:'var(--s2)', borderRadius:8, padding:'10px 14px' }}>
                    <p style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>Bônus / desafios</p>
                    <p style={{ fontFamily:'var(--fm)', fontSize:14, color:'var(--ye)' }}>+ {fmtBRL(totalBonif)}</p>
                  </div>
                )}
                {despesas.length > 0 && (
                  <div style={{ background:'var(--s2)', borderRadius:8, padding:'10px 14px' }}>
                    <p style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>Despesas fixas</p>
                    <p style={{ fontFamily:'var(--fm)', fontSize:14, color:'var(--re)' }}>− {fmtBRL(totalDespesas)}</p>
                  </div>
                )}
                <div style={{ background: lucroReal>=0?'var(--gd)':'var(--rd)', borderRadius:8, padding:'10px 14px', border:`1px solid ${lucroReal>=0?'rgba(16,185,129,.2)':'rgba(239,68,68,.2)'}` }}>
                  <p style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>Lucro real total</p>
                  <p style={{ fontFamily:'var(--fm)', fontSize:14, color: lucroReal>=0?'var(--gr2)':'var(--re)', fontWeight:700 }}>{fmtBRL(lucroReal)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* META MENSAL */}
        {(meta>0||editMeta) && (
          <div className="card" style={{ marginBottom:14 }}>
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
              ) : (() => {
                const atual = parseFloat(g?.total_bruto||0) + totalBonif
                const pct   = meta>0?Math.min(Math.round((atual/meta)*100),100):0
                const cor   = pct>=100?'var(--gr2)':pct>=70?'var(--or)':'var(--ye)'
                return (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <span style={{ fontSize:13, color:'var(--t2)' }}>{fmtBRL(atual)} de {fmtBRL(meta)}</span>
                      <span style={{ fontFamily:'var(--fm)', fontSize:14, color:cor, fontWeight:700 }}>{pct}%</span>
                    </div>
                    <div style={{ background:'var(--s3)', borderRadius:99, height:10, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:cor, borderRadius:99, transition:'width .6s ease' }}/>
                    </div>
                    <p style={{ fontSize:11, color:'var(--t3)', marginTop:8 }}>
                      {pct>=100?'🎉 Meta atingida!': `Faltam ${fmtBRL(meta-atual)} para atingir a meta`}
                    </p>
                  </div>
                )
              })()}
            </div>
          </div>
        )}
        {isPaid && !meta && !editMeta && (
          <div style={{ marginBottom:14, padding:'12px 16px', background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
            <p style={{ fontSize:13, color:'var(--t2)' }}>🎯 Defina uma meta mensal</p>
            <button className="btn btn-ghost btn-sm" onClick={()=>setEditMeta(true)}>Definir meta</button>
          </div>
        )}

        {/* MAPA DE CALOR */}
        {isPaid && streakData?.mapa && (
          <div className="card" style={{ marginBottom:14 }}>
            <div className="card-header">
              <span className="card-title">Atividade — últimos 84 dias</span>
              <StreakBadge streak={streakData.streak}/>
            </div>
            <div className="card-body">
              <MapaCalor dados={streakData.mapa}/>
            </div>
          </div>
        )}

        {/* FREE — seções desfocadas */}
        {!isPaid && parseInt(g.total_rotas)>0 && (
          <div style={{ position:'relative', marginBottom:14 }}>
            <div style={{ filter:'blur(6px)', pointerEvents:'none', userSelect:'none' }}>
              <div className="grid2">
                <div className="card" style={{ height:200 }}>
                  <div className="card-header"><span className="card-title">Faturamento mensal</span></div>
                  <div className="card-body" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:140 }}>
                    <div style={{ width:'100%', height:100, background:'linear-gradient(180deg,rgba(249,115,22,.3) 0%,transparent)', borderRadius:8 }}/>
                  </div>
                </div>
                <div className="card" style={{ height:200 }}>
                  <div className="card-header"><span className="card-title">Mapa de calor</span></div>
                  <div className="card-body">
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:3 }}>
                      {Array(84).fill(0).map((_,i) => <div key={i} style={{ aspectRatio:'1', background:`rgba(249,115,22,${Math.random()*.6})`, borderRadius:3 }}/>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(9,9,11,.5)', borderRadius:'var(--r)', backdropFilter:'blur(2px)' }}>
              <div style={{ textAlign:'center', padding:24 }}>
                <p style={{ fontSize:20, marginBottom:8 }}>🔒</p>
                <p style={{ fontSize:15, fontWeight:700, color:'var(--t)', marginBottom:6 }}>Disponível no Solo e Pro</p>
                <p style={{ fontSize:13, color:'var(--t2)', marginBottom:16 }}>Gráficos, mapa de calor, streak e comparativo semanal</p>
                <a href="/precos" className="btn btn-primary">Ver planos a partir de R$ 9,90</a>
              </div>
            </div>
          </div>
        )}

        {/* GRÁFICO */}
        {isPro && meses.length>0 && (
          <div className="card" style={{ marginBottom:14 }}>
            <div className="card-header">
              <span className="card-title">Faturamento mensal</span>
              <div style={{ display:'flex', gap:14 }}>
                {[{color:'#f97316',label:'Bruto'},{color:'#10b981',label:'Líquido'}].map(i=>(
                  <div key={i.label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--t2)' }}>
                    <span style={{ width:10, height:2, background:i.color, display:'inline-block', borderRadius:1 }}/>{i.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="card-body" style={{ paddingTop:6 }}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={meses} margin={{ top:10, right:8, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="gOr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={.22}/><stop offset="100%" stopColor="#f97316" stopOpacity={0}/></linearGradient>
                    <linearGradient id="gGr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={.18}/><stop offset="100%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,.035)" strokeDasharray="3 3"/>
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

        {isPaid && <div className="grid2" style={{ marginBottom:14 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">{isSolo?'💰 Seus ganhos':'Rateio acumulado'}</span></div>
            <div className="card-body">
              {isSolo ? (
                <div>
                  {[
                    { label:'Lucro líquido',  val:fmtBRL(g?.total_liquido), color:'var(--gr2)' },
                    { label:'Faturamento bruto', val:fmtBRL(g?.total_bruto), color:'var(--or)' },
                    { label:'KMs rodados',    val:`${Number(g?.total_kms||0).toFixed(0)} km`, color:'var(--t)' },
                    { label:'Pacotes',        val:g?.total_entregues||0, color:'var(--t)' },
                  ].map(item=>(
                    <div key={item.label} className="rateio-row">
                      <p style={{ fontSize:13, color:'var(--t2)' }}>{item.label}</p>
                      <span style={{ fontFamily:'var(--fm)', fontSize:15, color:item.color }}>{item.val}</span>
                    </div>
                  ))}
                </div>
              ) : rateio.length===0
                ? <p style={{ color:'var(--t3)', fontSize:13 }}>Nenhuma rota concluída ainda</p>
                : rateio.map(p=>(
                  <div key={p.nome} className="rateio-row">
                    <div className="rateio-left">
                      <div className="avatar sm">{p.nome.slice(0,2).toUpperCase()}</div>
                      <p className="rateio-nome">{p.nome}</p>
                    </div>
                    <span className="rateio-val">{fmtBRL(p.valor)}</span>
                  </div>
                ))
              }
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Rotas por plataforma</span></div>
            <div className="card-body">
              {plataformas.length===0
                ? <p style={{ color:'var(--t3)', fontSize:13 }}>Sem dados ainda</p>
                : (
                  <>
                    <ResponsiveContainer width="100%" height={130}>
                      <PieChart>
                        <Pie data={plataformas} dataKey="rotas" nameKey="name" cx="50%" cy="50%" outerRadius={55} innerRadius={30}>
                          {plataformas.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                        </Pie>
                        <Tooltip formatter={(v,n)=>[v+' rotas',n]}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:8 }}>
                      {plataformas.map((p,i)=>(
                        <div key={p.plataforma} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--t2)' }}>
                          <span style={{ width:8, height:8, borderRadius:'50%', background:PIE_COLORS[i%PIE_COLORS.length], display:'inline-block' }}/>
                          {plataformaEmoji(p.plataforma)} {p.name} ({p.rotas})
                        </div>
                      ))}
                    </div>
                  </>
                )}
            </div>
          </div>
        </div>}

        {/* COMPARATIVO INTELIGENTE */}
        {isPaid && comparativo && comparativo.rows?.length>=2 && (
          <div className="card" style={{ marginTop:14 }}>
            <div className="card-header">
              <span className="card-title">🧠 Comparativo inteligente</span>
              <span style={{ fontSize:11, color:'var(--t3)' }}>últimos 30 dias</span>
            </div>
            <div className="card-body">
              {comparativo.insights?.map((ins,i)=>(
                <div key={i} style={{ background:'var(--od)', border:'1px solid rgba(249,115,22,.2)', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
                  <p style={{ fontSize:13, color:'var(--t)', marginBottom:4 }}>{ins.msg}</p>
                  {ins.acao && <p style={{ fontSize:13, fontWeight:600, color:'var(--or2)' }}>💡 {ins.acao}</p>}
                </div>
              ))}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
                {comparativo.rows.map((p,i)=>(
                  <div key={p.plataforma} style={{ background:'var(--s2)', borderRadius:10, padding:'12px 14px', border:i===0?'1px solid rgba(249,115,22,.25)':'1px solid var(--b1)' }}>
                    <p style={{ fontSize:12, marginBottom:6 }}>{plataformaEmoji(p.plataforma)} {plataformaLabel(p.plataforma)}</p>
                    <p style={{ fontFamily:'var(--fm)', fontSize:17, color:i===0?'var(--or)':'var(--t)', fontWeight:700, marginBottom:2 }}>
                      {fmtBRL(p.valor_por_pacote)}<span style={{ fontSize:10, fontWeight:400, color:'var(--t3)' }}>/pct</span>
                    </p>
                    <p style={{ fontSize:11, color:'var(--t3)' }}>{p.rotas} rotas · {p.pacotes} pcts</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* COMBUSTÍVEL REAL */}
        {isPaid && statsAbastec && statsAbastec.total_abast>0 && (
          <div className="card" style={{ marginTop:14 }}>
            <div className="card-header">
              <span className="card-title">⛽ Combustível real vs estimado</span>
              <a href="/abastecimentos" style={{ fontSize:12, color:'var(--or2)', textDecoration:'none' }}>ver todos →</a>
            </div>
            <div className="card-body">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10, marginBottom:statsAbastec.diferenca!==0?12:0 }}>
                {[
                  { label:'Gasto real',        val:fmtBRL(statsAbastec.total_gasto),       color:'var(--or)' },
                  { label:'Estimado nas rotas', val:fmtBRL(statsAbastec.custo_estimado),    color:'var(--ye)' },
                  { label:'Preço médio/litro',  val:fmtBRL(statsAbastec.preco_medio_litro), color:'var(--t)' },
                  { label:'Litros abastecidos', val:Number(statsAbastec.total_litros).toFixed(1)+'L', color:'var(--t)' },
                ].map(item=>(
                  <div key={item.label} style={{ background:'var(--s2)', borderRadius:8, padding:'10px 12px' }}>
                    <p style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{item.label}</p>
                    <p style={{ fontFamily:'var(--fm)', fontSize:15, color:item.color, fontWeight:700 }}>{item.val}</p>
                  </div>
                ))}
              </div>
              {Math.abs(statsAbastec.diferenca)>1 && (
                <div style={{ background:statsAbastec.diferenca>0?'var(--rd)':'var(--gd)', border:`1px solid ${statsAbastec.diferenca>0?'rgba(239,68,68,.2)':'rgba(16,185,129,.2)'}`, borderRadius:8, padding:'10px 14px', fontSize:12, color:statsAbastec.diferenca>0?'var(--re)':'var(--gr2)' }}>
                  {statsAbastec.diferenca>0
                    ? `⚠️ Você gastou ${fmtBRL(statsAbastec.diferenca)} a mais que a estimativa.`
                    : `✅ Você economizou ${fmtBRL(Math.abs(statsAbastec.diferenca))} em relação à estimativa.`
                  }
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
