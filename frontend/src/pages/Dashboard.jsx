import { useState, useEffect } from 'react'
import { fetchStats, fmtBRL, buildQS, plataformaLabel, plataformaEmoji, fetchMeta, salvarMeta, fetchDespesas, fetchConfig, calcLucroPorHora } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--s3)', border: '1px solid var(--b2)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ color: 'var(--t2)', marginBottom: 4 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.color, fontFamily: 'var(--fm)' }}>{p.name}: R$ {Number(p.value).toFixed(2)}</p>)}
    </div>
  )
}

const COLORS = ['#f97316', '#fb923c', '#fdba74', '#fed7aa']
const PIE_COLORS = ['#f97316', '#3b82f6', '#f59e0b', '#10b981']

export default function Dashboard() {
  const { tenant } = useAuth()
  const isPro = tenant?.plano === 'pro'
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [period,  setPeriod]  = useState(() => {
    const hoje = new Date()
    const ini  = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10)
    const fim  = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0,10)
    return { data_inicio: ini, data_fim: fim }
  })
  const [meta,    setMeta]    = useState(0)
  const [despesas, setDespesas] = useState([])
  const [config,   setConfig]   = useState({ modo_solo: false, meta_diaria: 0 })
  const [editMeta, setEditMeta] = useState(false)
  const [metaInput, setMetaInput] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchStats(buildQS(period)).then(setStats).catch(() => {}).finally(() => setLoading(false))
  }, [period])

  useEffect(() => {
    fetchMeta().then(d => { setMeta(d.meta_mensal || 0); setMetaInput(d.meta_mensal || '') }).catch(() => {})
    fetchDespesas().then(setDespesas).catch(() => {})
    fetchConfig().then(setConfig).catch(() => {})
  }, [])

  async function handleSalvarMeta() {
    const v = parseFloat(metaInput) || 0
    await salvarMeta(v).catch(() => {})
    setMeta(v); setEditMeta(false)
  }

  const setP = (k, v) => setPeriod(p => ({ ...p, [k]: v }))

  if (loading) return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner"/></div>
  if (!stats) return null

  const g    = stats.geral
  const meses = stats.porMes || []
  const rateio = (stats.rateioAcumulado || []).sort((a, b) => b.valor - a.valor)
  const plataformas = (stats.porPlataforma || []).map(p => ({ ...p, name: plataformaLabel(p.plataforma) }))

  const taxaGeral = (() => {
    const tot = parseInt(g.total_entregues) + parseInt(g.total_devolvidos)
    if (!tot) return null
    return Math.round((parseInt(g.total_entregues) / tot) * 100)
  })()

  return (
    <div style={{ padding: '28px 0 60px' }}>
      <div className="container">
        <div className="pg-header">
          <div>
            <h1 className="pg-title">Dashboard</h1>
            <p className="pg-sub">Visão geral do faturamento e desempenho</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field">
              <label className="field-label">De</label>
              <input className="input" type="date" value={period.data_inicio} onChange={e => setP('data_inicio', e.target.value)} style={{ width: 150 }}/>
            </div>
            <div className="field">
              <label className="field-label">Até</label>
              <input className="input" type="date" value={period.data_fim} onChange={e => setP('data_fim', e.target.value)} style={{ width: 150 }}/>
            </div>
            {(period.data_inicio || period.data_fim) && (
              <button className="btn btn-ghost btn-sm" onClick={() => setPeriod({ data_inicio: '', data_fim: '' })}>Limpar</button>
            )}
          </div>
        </div>

        {/* LUCRO REAL — deduz despesas fixas (Solo/Pro) */}
        {despesas.length > 0 && stats && (() => {
          const totalDespesas = despesas.reduce((acc, d) => acc + parseFloat(d.valor), 0)
          const lucroReal = parseFloat(g?.total_liquido || 0) - totalDespesas
          return (
            <div className="card" style={{ marginBottom: 14, border: lucroReal >= 0 ? '1px solid rgba(16,185,129,.2)' : '1px solid rgba(239,68,68,.2)' }}>
              <div className="card-header">
                <span className="card-title">💰 Lucro real (após despesas fixas)</span>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 14px' }}>
                    <p style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Lucro líquido rotas</p>
                    <p style={{ fontFamily: 'var(--fm)', fontSize: 16, color: 'var(--gr2)' }}>{fmtBRL(g?.total_liquido)}</p>
                  </div>
                  <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 14px' }}>
                    <p style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Despesas fixas</p>
                    <p style={{ fontFamily: 'var(--fm)', fontSize: 16, color: 'var(--re)' }}>− {fmtBRL(totalDespesas)}</p>
                  </div>
                  <div style={{ background: lucroReal >= 0 ? 'var(--gd)' : 'var(--rd)', borderRadius: 8, padding: '10px 14px', border: `1px solid ${lucroReal >= 0 ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)'}` }}>
                    <p style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Lucro real</p>
                    <p style={{ fontFamily: 'var(--fm)', fontSize: 16, color: lucroReal >= 0 ? 'var(--gr2)' : 'var(--re)', fontWeight: 700 }}>{fmtBRL(lucroReal)}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* BANNER UPGRADE FREE */}
        {!isPro && (
          <div style={{ marginBottom:16, padding:'14px 18px', background:'linear-gradient(135deg,rgba(249,115,22,.1),rgba(251,146,60,.05))', border:'1px solid rgba(249,115,22,.25)', borderRadius:'var(--r)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:'var(--or2)', marginBottom:2 }}>⭐ Desbloqueie o Dashboard completo</p>
              <p style={{ fontSize:12, color:'var(--t3)' }}>Gráficos avançados, meta mensal, plataformas e muito mais no plano Pro.</p>
            </div>
            <a href="/precos" className="btn btn-primary btn-sm">Ver plano Pro →</a>
          </div>
        )}

        {/* MÉTRICAS */}
        <div className="grid4" style={{ marginBottom: 16 }}>
          <div className="metric"><p className="metric-label">Total bruto</p><p className="metric-value orange">{fmtBRL(g.total_bruto)}</p><p className="metric-sub">{g.total_rotas} rota{g.total_rotas != 1 ? 's' : ''}</p></div>
          <div className="metric"><p className="metric-label">Lucro líquido</p><p className="metric-value green">{fmtBRL(g.total_liquido)}</p><p className="metric-sub">após combustível</p></div>
          <div className="metric"><p className="metric-label">Combustível</p><p className="metric-value yellow">{fmtBRL(g.total_combustivel)}</p><p className="metric-sub">{Number(g.total_kms).toFixed(0)} km rodados</p></div>
          <div className="metric"><p className="metric-label">Taxa entrega</p><p className="metric-value">{taxaGeral !== null ? `${taxaGeral}%` : '—'}</p><p className="metric-sub">{g.total_entregues} entregues</p></div>
        </div>
        <div className="grid4" style={{ marginBottom: 14 }}>
          <div className="metric">
            <p className="metric-label">Valor por pacote</p>
            <p className="metric-value orange" style={{ fontSize:20 }}>
              {parseInt(g.total_entregues) > 0 ? fmtBRL(parseFloat(g.total_bruto) / parseInt(g.total_entregues)) : '—'}
            </p>
            <p className="metric-sub">média por entrega</p>
          </div>
          <div className="metric">
            <p className="metric-label">Custo combustível</p>
            <p className="metric-value yellow" style={{ fontSize:20 }}>{fmtBRL(g.total_combustivel)}</p>
            <p className="metric-sub">{Number(g.total_kms).toFixed(0)} km rodados</p>
          </div>
          <div className="metric">
            <p className="metric-label">Total de rotas</p>
            <p className="metric-value" style={{ fontSize:20 }}>{g.total_rotas}</p>
            <p className="metric-sub">no período</p>
          </div>
          <div className="metric">
            <p className="metric-label">Devolvidos</p>
            <p className="metric-value" style={{ fontSize:20, color: parseInt(g.total_devolvidos) > 0 ? 'var(--re)' : 'var(--t)' }}>{g.total_devolvidos}</p>
            <p className="metric-sub">pacotes</p>
          </div>
        </div>

        {/* UPGRADE BANNER FREE */}
        {!isPro && (
          <div style={{ background:'var(--od)', border:'1px solid rgba(249,115,22,.2)', borderRadius:'var(--r)', padding:'16px 20px', marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div>
              <p style={{ fontWeight:600, fontSize:13, color:'var(--or2)', marginBottom:3 }}>⭐ Gráficos e análises completas no plano Pro</p>
              <p style={{ fontSize:12, color:'var(--t2)' }}>Faturamento mensal, rateio acumulado, análise por plataforma e mais.</p>
            </div>
            <a href="/precos" className="btn btn-primary btn-sm">Assinar Pro — R$ 14,90/mês</a>
          </div>
        )}

        {/* META MENSAL */}
        {(meta > 0 || editMeta) && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header">
              <span className="card-title">Meta mensal de faturamento</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditMeta(e => !e); setMetaInput(meta) }}>
                {editMeta ? 'Cancelar' : '✏️ Editar'}
              </button>
            </div>
            <div className="card-body">
              {editMeta ? (
                <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                  <div className="field" style={{ flex:1 }}>
                    <label className="field-label">Meta (R$)</label>
                    <input className="input" type="number" min="0" step="100" value={metaInput} onChange={e => setMetaInput(e.target.value)} placeholder="Ex: 3000"/>
                  </div>
                  <button className="btn btn-primary" onClick={handleSalvarMeta}>Salvar</button>
                </div>
              ) : (() => {
                const atual = parseFloat(g?.total_bruto || 0)
                const pct   = meta > 0 ? Math.min(Math.round((atual / meta) * 100), 100) : 0
                const cor   = pct >= 100 ? 'var(--gr2)' : pct >= 70 ? 'var(--or)' : 'var(--ye)'
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
                      {pct >= 100 ? '🎉 Meta atingida!' : `Faltam ${fmtBRL(meta - atual)} para atingir a meta`}
                    </p>
                  </div>
                )
              })()}
            </div>
          </div>
        )}
        {isPaid && !meta && !editMeta && (
          <div style={{ marginBottom:14, padding:'12px 16px', background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
            <p style={{ fontSize:13, color:'var(--t2)' }}>🎯 Defina uma meta mensal de faturamento</p>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditMeta(true)}>Definir meta</button>
          </div>
        )}

        {/* GRÁFICO ÁREA */}
        {isPro && meses.length > 0 && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header">
              <span className="card-title">Faturamento mensal</span>
              <div style={{ display: 'flex', gap: 14 }}>
                {[{ color: '#f97316', label: 'Bruto' }, { color: '#10b981', label: 'Líquido' }].map(i => (
                  <div key={i.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--t2)' }}>
                    <span style={{ width: 10, height: 2, background: i.color, display: 'inline-block', borderRadius: 1 }}/>{i.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="card-body" style={{ paddingTop: 6 }}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={meses} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gOr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={.22}/><stop offset="100%" stopColor="#f97316" stopOpacity={0}/></linearGradient>
                    <linearGradient id="gGr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={.18}/><stop offset="100%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,.035)" strokeDasharray="3 3"/>
                  <XAxis dataKey="mes" tick={{ fill: '#4a4a62', fontSize: 11 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill: '#4a4a62', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`}/>
                  <Tooltip content={<TT/>}/>
                  <Area type="monotone" dataKey="bruto"   name="Bruto"   stroke="#f97316" strokeWidth={2} fill="url(#gOr)" dot={false}/>
                  <Area type="monotone" dataKey="liquido" name="Líquido" stroke="#10b981" strokeWidth={2} fill="url(#gGr)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {isPaid && <div className="grid2" style={{ marginBottom: 14 }}>
          {/* RATEIO ou SOLO LUCRO */}
          <div className="card">
            <div className="card-header"><span className="card-title">{isSolo ? '💰 Seus ganhos' : 'Rateio acumulado'}</span></div>
            <div className="card-body">
              {isSolo ? (
                <div>
                  {[
                    { label: 'Lucro líquido total', val: fmtBRL(g?.total_liquido), color: 'var(--gr2)' },
                    { label: 'Faturamento bruto',   val: fmtBRL(g?.total_bruto),   color: 'var(--or)' },
                    { label: 'KMs rodados',          val: `${Number(g?.total_kms || 0).toFixed(0)} km`, color: 'var(--t)' },
                    { label: 'Pacotes entregues',    val: g?.total_entregues || 0,  color: 'var(--t)' },
                  ].map(item => (
                    <div key={item.label} className="rateio-row">
                      <p style={{ fontSize:13, color:'var(--t2)' }}>{item.label}</p>
                      <span style={{ fontFamily:'var(--fm)', fontSize:15, color: item.color }}>{item.val}</span>
                    </div>
                  ))}
                </div>
              ) : rateio.length === 0
                ? <p style={{ color: 'var(--t3)', fontSize: 13 }}>Nenhuma rota concluída ainda</p>
                : rateio.map(p => (
                  <div key={p.nome} className="rateio-row">
                    <div className="rateio-left">
                      <div className="avatar sm">{p.nome.slice(0, 2).toUpperCase()}</div>
                      <p className="rateio-nome">{p.nome}</p>
                    </div>
                    <span className="rateio-val">{fmtBRL(p.valor)}</span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* POR PLATAFORMA */}
          <div className="card">
            <div className="card-header"><span className="card-title">Rotas por plataforma</span>{!isPaid && <span className="badge badge-orange" style={{fontSize:10}}>⭐ Pro/Solo</span>}</div>
            <div className="card-body">
              {plataformas.length === 0
                ? <p style={{ color: 'var(--t3)', fontSize: 13 }}>Sem dados ainda</p>
                : (
                  <>
                    <ResponsiveContainer width="100%" height={130}>
                      <PieChart>
                        <Pie data={plataformas} dataKey="rotas" nameKey="name" cx="50%" cy="50%" outerRadius={55} innerRadius={30}>
                          {plataformas.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [v + ' rotas', n]}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      {plataformas.map((p, i) => (
                        <div key={p.plataforma} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--t2)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], display: 'inline-block' }}/>
                          {plataformaEmoji(p.plataforma)} {p.name} ({p.rotas})
                        </div>
                      ))}
                    </div>
                  </>
                )}
            </div>
          </div>
        </div>}

        {/* GANHO POR PESSOA */}
        {isPaid && !isSolo && rateio.length > 0 && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header"><span className="card-title">Ganho por pessoa</span></div>
            <div className="card-body" style={{ paddingTop: 4 }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={rateio} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.035)" strokeDasharray="3 3"/>
                  <XAxis dataKey="nome" tick={{ fill: '#4a4a62', fontSize: 11 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill: '#4a4a62', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`}/>
                  <Tooltip content={<TT/>}/>
                  <Bar dataKey="valor" name="Ganho" radius={[5, 5, 0, 0]}>
                    {rateio.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TABELA POR PILOTO */}
        {isPaid && !isSolo && (stats.porPiloto || []).length > 0 && (
          <div className="card">
            <div className="card-header"><span className="card-title">Participação como piloto</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nome</th><th>Rotas pilotadas</th><th>Faturamento bruto</th><th>Lucro líquido</th></tr></thead>
                <tbody>
                  {stats.porPiloto.map(row => (
                    <tr key={row.nome} style={{ cursor: 'default' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar sm">{row.nome.slice(0, 2).toUpperCase()}</div>
                          <span style={{ color: 'var(--t)', fontWeight: 500 }}>{row.nome}</span>
                        </div>
                      </td>
                      <td>{row.rotas}</td>
                      <td style={{ color: 'var(--or)', fontFamily: 'var(--fm)' }}>{fmtBRL(row.bruto)}</td>
                      <td style={{ color: 'var(--gr2)', fontFamily: 'var(--fm)' }}>{fmtBRL(row.liquido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
