import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { criarRota, criarVeiculo, salvarOnboarding, fetchUsuarios, fmtBRL, calcCombustivel } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const STEPS = [
  { num: 1, titulo: 'Bem-vindo ao Smart Entregas!', sub: 'Vamos configurar sua conta em 3 passos rápidos' },
  { num: 2, titulo: 'Cadastre seu veículo',         sub: 'O app usa o consumo do veículo para calcular o combustível automaticamente' },
  { num: 3, titulo: 'Registre sua primeira rota',   sub: 'Veja na prática como o lucro real é calculado' },
]

export default function Onboarding({ onConcluir }) {
  const nav = useNavigate()
  const { user } = useAuth()
  const [step,    setStep]    = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 2 — veículo
  const [veiculo, setVeiculo] = useState({ nome:'', consumo_kml:'10', combustivel:'gasolina' })

  // Step 3 — rota
  const [rota, setRota] = useState({ ponto_coleta:'', kms:'', pacotes_saida:'', valor_total:'', preco_combustivel:'6.00', data_rota: new Date().toISOString().slice(0,10) })

  const sv = (k,v) => setVeiculo(p=>({...p,[k]:v}))
  const sr = (k,v) => setRota(p=>({...p,[k]:v}))

  const lucroEstimado = rota.valor_total && rota.kms
    ? parseFloat(rota.valor_total) - calcCombustivel(rota.kms, 10, parseFloat(rota.preco_combustivel||6))
    : null

  async function pularStep() {
    await salvarOnboarding({ step, concluido: step === 3 }).catch(()=>{})
    if (step < 3) setStep(s=>s+1)
    else onConcluir()
  }

  async function handleStep2(e) {
    e.preventDefault()
    setLoading(true)
    try {
      if (veiculo.nome) await criarVeiculo({ ...veiculo, consumo_kml: parseFloat(veiculo.consumo_kml)||10 })
      await salvarOnboarding({ step: 2, concluido: false })
      setStep(3)
    } catch(e) { alert(e.message) }
    finally { setLoading(false) }
  }

  async function handleStep3(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const membros = await fetchUsuarios().catch(()=>[])
      const piloto  = membros[0]?.nome || user?.nome || 'Piloto'
      await criarRota({
        ...rota,
        piloto, copiloto: piloto,
        status: 'concluida',
        pacotes_entregues: rota.pacotes_saida,
        kms: parseFloat(rota.kms)||0,
        valor_total: parseFloat(rota.valor_total)||0,
        preco_combustivel: parseFloat(rota.preco_combustivel)||6,
      })
      await salvarOnboarding({ step: 3, concluido: true })
      onConcluir()
    } catch(e) { alert(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ width:'100%', maxWidth:480 }}>

        {/* PROGRESS */}
        <div style={{ display:'flex', gap:8, marginBottom:32, justifyContent:'center' }}>
          {STEPS.map(s => (
            <div key={s.num} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background: step>=s.num?'var(--or)':'var(--s2)', border:`1px solid ${step>=s.num?'var(--or)':'var(--b2)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color: step>=s.num?'#fff':'var(--t3)', transition:'all .3s' }}>
                {step>s.num ? '✓' : s.num}
              </div>
              {s.num < 3 && <div style={{ width:32, height:2, background: step>s.num?'var(--or)':'var(--s3)', borderRadius:2, transition:'all .3s' }}/>}
            </div>
          ))}
        </div>

        <div style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', overflow:'hidden' }}>
          <div style={{ padding:'24px 24px 0', marginBottom:20 }}>
            <h1 style={{ fontFamily:'var(--ff)', fontSize:20, fontWeight:800, marginBottom:6 }}>{STEPS[step-1].titulo}</h1>
            <p style={{ fontSize:13, color:'var(--t2)' }}>{STEPS[step-1].sub}</p>
          </div>

          {/* STEP 1 — boas-vindas */}
          {step === 1 && (
            <div style={{ padding:'0 24px 24px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:24 }}>
                {[
                  { icon:'⛽', title:'Lucro real', desc:'Desconta o combustível automaticamente' },
                  { icon:'📊', title:'Dashboard', desc:'Veja seu faturamento e performance' },
                  { icon:'🚗', title:'Veículos', desc:'Controle KMs, revisão e abastecimento' },
                  { icon:'👥', title:'Equipe', desc:'Rateio automático 60/40 no Pro' },
                ].map(f => (
                  <div key={f.title} style={{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:10, padding:'12px 14px' }}>
                    <p style={{ fontSize:18, marginBottom:5 }}>{f.icon}</p>
                    <p style={{ fontSize:12, fontWeight:600, color:'var(--t)', marginBottom:3 }}>{f.title}</p>
                    <p style={{ fontSize:11, color:'var(--t3)', lineHeight:1.4 }}>{f.desc}</p>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary btn-full" onClick={()=>setStep(2)} style={{ fontSize:14, padding:'13px' }}>
                Começar configuração →
              </button>
            </div>
          )}

          {/* STEP 2 — veículo */}
          {step === 2 && (
            <form onSubmit={handleStep2} style={{ padding:'0 24px 24px' }}>
              <div className="field" style={{ marginBottom:12 }}>
                <label className="field-label">Nome do veículo</label>
                <input className="input" placeholder="Ex: Fiat Strada 2022" value={veiculo.nome} onChange={e=>sv('nome',e.target.value)}/>
              </div>
              <div className="grid2" style={{ marginBottom:12 }}>
                <div className="field">
                  <label className="field-label">Consumo (km/L)</label>
                  <input className="input" type="number" step="0.1" min="1" value={veiculo.consumo_kml} onChange={e=>sv('consumo_kml',e.target.value)} required/>
                </div>
                <div className="field">
                  <label className="field-label">Combustível</label>
                  <select className="select" value={veiculo.combustivel} onChange={e=>sv('combustivel',e.target.value)}>
                    <option value="gasolina">Gasolina</option>
                    <option value="alcool">Álcool</option>
                    <option value="flex">Flex</option>
                    <option value="diesel">Diesel</option>
                  </select>
                </div>
              </div>
              <div style={{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:10, padding:'10px 14px', marginBottom:20, fontSize:12, color:'var(--t2)' }}>
                💡 Com {veiculo.consumo_kml} km/L e combustível a R$6,00, cada 100km custa aproximadamente <strong style={{ color:'var(--or)' }}>R${(100/parseFloat(veiculo.consumo_kml||10)*6).toFixed(2)}</strong>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button type="button" className="btn btn-ghost" style={{ flex:1 }} onClick={pularStep}>Pular</button>
                <button type="submit" className="btn btn-primary" style={{ flex:2, fontSize:14 }} disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar e continuar →'}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3 — primeira rota */}
          {step === 3 && (
            <form onSubmit={handleStep3} style={{ padding:'0 24px 24px' }}>
              <div className="field" style={{ marginBottom:12 }}>
                <label className="field-label">Ponto de coleta</label>
                <input className="input" placeholder="Ex: CD Guarulhos" value={rota.ponto_coleta} onChange={e=>sr('ponto_coleta',e.target.value)} required/>
              </div>
              <div className="grid2" style={{ marginBottom:12 }}>
                <div className="field">
                  <label className="field-label">KMs rodados</label>
                  <input className="input" type="number" min="0" placeholder="68" value={rota.kms} onChange={e=>sr('kms',e.target.value)} required/>
                </div>
                <div className="field">
                  <label className="field-label">Pacotes</label>
                  <input className="input" type="number" min="0" placeholder="80" value={rota.pacotes_saida} onChange={e=>sr('pacotes_saida',e.target.value)} required/>
                </div>
              </div>
              <div className="grid2" style={{ marginBottom:12 }}>
                <div className="field">
                  <label className="field-label">Valor recebido (R$)</label>
                  <input className="input" type="number" step="0.01" min="0" placeholder="145,00" value={rota.valor_total} onChange={e=>sr('valor_total',e.target.value)} required/>
                </div>
                <div className="field">
                  <label className="field-label">Preço combustível/L</label>
                  <input className="input" type="number" step="0.01" min="0" placeholder="6,00" value={rota.preco_combustivel} onChange={e=>sr('preco_combustivel',e.target.value)}/>
                </div>
              </div>

              {lucroEstimado !== null && (
                <div style={{ background: lucroEstimado >= 0 ? 'var(--gd)' : 'var(--rd)', border:`1px solid ${lucroEstimado>=0?'rgba(16,185,129,.2)':'rgba(239,68,68,.2)'}`, borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
                  <p style={{ fontSize:11, color:'var(--t3)', marginBottom:4, textTransform:'uppercase', letterSpacing:'.07em' }}>Seu lucro líquido nessa rota</p>
                  <p style={{ fontFamily:'var(--fm)', fontSize:24, fontWeight:800, color: lucroEstimado>=0?'var(--gr2)':'var(--re)' }}>
                    {fmtBRL(lucroEstimado)}
                  </p>
                  <p style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>Bruto {fmtBRL(rota.valor_total)} − combustível {fmtBRL(calcCombustivel(rota.kms, 10, parseFloat(rota.preco_combustivel||6)))}</p>
                </div>
              )}

              <div style={{ display:'flex', gap:8 }}>
                <button type="button" className="btn btn-ghost" style={{ flex:1 }} onClick={pularStep}>Pular</button>
                <button type="submit" className="btn btn-primary" style={{ flex:2, fontSize:14 }} disabled={loading}>
                  {loading ? 'Salvando...' : '🎉 Concluir e ir ao dashboard'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p style={{ textAlign:'center', fontSize:12, color:'var(--t3)', marginTop:16, cursor:'pointer' }} onClick={()=>{ salvarOnboarding({step:3,concluido:true}); onConcluir() }}>
          Pular tudo e ir direto ao app →
        </p>
      </div>
    </div>
  )
}
