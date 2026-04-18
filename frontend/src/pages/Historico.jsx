import { useState, useEffect } from 'react'
import { fetchHistorico, fetchComparativo, fmtBRL, fmtData, plataformaLabel, plataformaEmoji } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--s3)', border:'1px solid var(--b2)', borderRadius:10, padding:'10px 14px', fontSize:12 }}>
      <p style={{ color:'var(--t2)', marginBottom:4 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color:p.color, fontFamily:'var(--fm)' }}>{p.name}: {fmtBRL(p.value)}</p>)}
    </div>
  )
}

function getMeses() {
  const meses = []
  const hoje = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    meses.push({
      val: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    })
  }
  return meses
}

export default function Historico() {
  const { tenant } = useAuth()
  const isPaid = ['pro','solo'].includes(tenant?.plano)
  const meses  = getMeses()
  const [mesSel, setMesSel]       = useState(meses[0].val)
  const [historico, setHistorico] = useState([])
  const [comparativo, setComparativo] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchHistorico(mesSel),
      fetchComparativo()
    ]).then(([h, c]) => { setHistorico(h); setComparativo(c) })
    .catch(() => {})
    .finally(() => setLoading(false))
  }, [mesSel])

  const totalMes   = historico.reduce((a, d) => a + parseFloat(d.liquido), 0)
  const totalBruto = historico.reduce((a, d) => a + parseFloat(d.bruto), 0)
  const totalPacotes = historico.reduce((a, d) => a + parseInt(d.pacotes), 0)
  const diasTrabalhados = historico.length
  const mediadiaria = diasTrabalhados > 0 ? totalMes / diasTrabalhados : 0

  const chartData = historico.map(d => ({
    dia: d.data.slice(8),
    bruto: parseFloat(d.bruto),
    liquido: parseFloat(d.liquido),
    pacotes: parseInt(d.pacotes),
  }))

  if (!isPaid) return (
    <div style={{ padding:'60px 0', textAlign:'center' }}>
      <div className="container">
        <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
        <h1 style={{ fontFamily:'var(--ff)', fontSize:22, marginBottom:8 }}>Histórico de ganhos</h1>
        <p style={{ color:'var(--t2)', fontSize:14, marginBottom:24 }}>Disponível nos planos Solo e Pro.</p>
        <a href="/precos" className="btn btn-primary">Ver planos →</a>
      </div>
    </div>
  )

  return (
    <div style={{ padding:'28px 0 60px' }}>
      <div className="container">
        <div className="pg-header">
          <div>
            <h1 className="pg-title">Histórico de ganhos</h1>
            <p className="pg-sub">Extrato diário de faturamento</p>
          </div>
          <select className="select" style={{ width:'auto' }} value={mesSel} onChange={e => setMesSel(e.target.value)}>
            {meses.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
        </div>

        {/* RESUMO DO MÊS */}
        <div className="grid4" style={{ marginBottom:16 }}>
          <div className="metric"><p className="metric-label">Lucro líquido</p><p className="metric-value green" style={{ fontSize:20 }}>{fmtBRL(totalMes)}</p></div>
          <div className="metric"><p className="metric-label">Faturamento bruto</p><p className="metric-value orange" style={{ fontSize:20 }}>{fmtBRL(totalBruto)}</p></div>
          <div className="metric"><p className="metric-label">Dias trabalhados</p><p className="metric-value" style={{ fontSize:20 }}>{diasTrabalhados}</p><p className="metric-sub">média {fmtBRL(mediadiaria)}/dia</p></div>
          <div className="metric"><p className="metric-label">Pacotes entregues</p><p className="metric-value" style={{ fontSize:20 }}>{totalPacotes}</p></div>
        </div>

        {/* GRÁFICO */}
        {chartData.length > 0 && (
          <div className="card" style={{ marginBottom:14 }}>
            <div className="card-header"><span className="card-title">Ganho por dia</span></div>
            <div className="card-body" style={{ paddingTop:8 }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top:5, right:5, left:0, bottom:0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.035)" strokeDasharray="3 3"/>
                  <XAxis dataKey="dia" tick={{ fill:'#4a4a62', fontSize:11 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:'#4a4a62', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`}/>
                  <Tooltip content={<TT/>}/>
                  <Bar dataKey="liquido" name="Líquido" radius={[4,4,0,0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={i === chartData.length - 1 ? '#f97316' : '#34d399'}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* EXTRATO DIÁRIO */}
        <div className="card" style={{ marginBottom:14 }}>
          <div className="card-header"><span className="card-title">Extrato diário</span></div>
          {loading ? (
            <div className="empty"><div className="spinner" style={{ margin:'0 auto' }}/></div>
          ) : historico.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📭</div>
              <p className="empty-title">Nenhuma rota concluída neste mês</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Data</th><th>Rotas</th><th>Pacotes</th><th>KMs</th><th>Bruto</th><th>Líquido</th></tr></thead>
                <tbody>
                  {historico.map(d => (
                    <tr key={d.data} style={{ cursor:'default' }}>
                      <td className="hl">{fmtData(d.data)}</td>
                      <td>{d.rotas}</td>
                      <td>{d.pacotes}</td>
                      <td>{Number(d.kms).toFixed(0)} km</td>
                      <td style={{ color:'var(--or)', fontFamily:'var(--fm)' }}>{fmtBRL(d.bruto)}</td>
                      <td style={{ color:'var(--gr2)', fontFamily:'var(--fm)', fontWeight:600 }}>{fmtBRL(d.liquido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* COMPARATIVO PLATAFORMAS */}
        {comparativo.length > 1 && (
          <div className="card">
            <div className="card-header"><span className="card-title">Comparativo de plataformas</span></div>
            <div className="card-body">
              {comparativo.map((p, i) => {
                const melhor = comparativo[0]
                const pct = melhor.valor_por_pacote > 0 ? Math.round((p.valor_por_pacote / melhor.valor_por_pacote) * 100) : 0
                return (
                  <div key={p.plataforma} style={{ marginBottom: i < comparativo.length - 1 ? 16 : 0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:18 }}>{plataformaEmoji(p.plataforma)}</span>
                        <div>
                          <p style={{ fontSize:13, fontWeight:600, color:'var(--t)' }}>{plataformaLabel(p.plataforma)}</p>
                          <p style={{ fontSize:11, color:'var(--t3)' }}>{p.rotas} rotas · {p.total_pacotes} pacotes</p>
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <p style={{ fontFamily:'var(--fm)', fontSize:14, color: i === 0 ? 'var(--gr2)' : 'var(--t)', fontWeight: i === 0 ? 700 : 400 }}>
                          {fmtBRL(p.valor_por_pacote)}/pacote
                        </p>
                        {i === 0 && <p style={{ fontSize:10, color:'var(--gr2)' }}>↑ melhor plataforma</p>}
                        {i > 0 && <p style={{ fontSize:10, color:'var(--t3)' }}>{pct}% do ML</p>}
                      </div>
                    </div>
                    <div style={{ background:'var(--s3)', borderRadius:99, height:6, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background: i === 0 ? 'var(--gr2)' : 'var(--or)', borderRadius:99, transition:'width .5s ease' }}/>
                    </div>
                  </div>
                )
              })}
              <div style={{ marginTop:16, padding:'12px 14px', background:'var(--s2)', borderRadius:'var(--rsm)', fontSize:12, color:'var(--t2)' }}>
                💡 Baseado em todas as rotas concluídas do seu histórico
              </div>
            </div>
          </div>
        )}

        {comparativo.length === 1 && (
          <div className="card">
            <div className="card-header"><span className="card-title">Comparativo de plataformas</span></div>
            <div className="card-body">
              <p style={{ fontSize:13, color:'var(--t3)' }}>Use mais de uma plataforma para ver o comparativo aqui.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
