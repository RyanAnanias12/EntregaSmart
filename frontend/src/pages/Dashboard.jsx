import { useState, useEffect } from 'react'
import { fetchStats, fmtBRL, buildQS, plataformaLabel, plataformaEmoji } from '../lib/api'
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
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [period,  setPeriod]  = useState({ data_inicio: '', data_fim: '' })

  useEffect(() => {
    setLoading(true)
    fetchStats(buildQS(period)).then(setStats).catch(() => {}).finally(() => setLoading(false))
  }, [period])

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

        {/* MÉTRICAS */}
        <div className="grid4" style={{ marginBottom: 16 }}>
          <div className="metric"><p className="metric-label">Total bruto</p><p className="metric-value orange">{fmtBRL(g.total_bruto)}</p><p className="metric-sub">{g.total_rotas} rota{g.total_rotas != 1 ? 's' : ''}</p></div>
          <div className="metric"><p className="metric-label">Lucro líquido</p><p className="metric-value green">{fmtBRL(g.total_liquido)}</p><p className="metric-sub">após combustível</p></div>
          <div className="metric"><p className="metric-label">Combustível</p><p className="metric-value yellow">{fmtBRL(g.total_combustivel)}</p><p className="metric-sub">{Number(g.total_kms).toFixed(0)} km rodados</p></div>
          <div className="metric"><p className="metric-label">Taxa entrega</p><p className="metric-value">{taxaGeral !== null ? `${taxaGeral}%` : '—'}</p><p className="metric-sub">{g.total_entregues} entregues</p></div>
        </div>

        {/* GRÁFICO ÁREA */}
        {meses.length > 0 && (
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

        <div className="grid2" style={{ marginBottom: 14 }}>
          {/* RATEIO */}
          <div className="card">
            <div className="card-header"><span className="card-title">Rateio acumulado</span></div>
            <div className="card-body">
              {rateio.length === 0
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
            <div className="card-header"><span className="card-title">Rotas por plataforma</span></div>
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
        </div>

        {/* GANHO POR PESSOA */}
        {rateio.length > 0 && (
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
        {(stats.porPiloto || []).length > 0 && (
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
