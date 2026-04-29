import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtBRL } from '../lib/api'
import { Toast } from '../components/Toast'

const BASE = (import.meta.env.VITE_API_URL||'').replace(/\/api$/,'')
const tok  = () => localStorage.getItem('token')||sessionStorage.getItem('token')||''
const req  = async (url, opts={}) => {
  const r = await fetch(BASE+url, { ...opts, headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...opts.headers }})
  const d = await r.json()
  if (!r.ok) throw new Error(d.error||'Erro')
  return d
}

export default function Combustivel() {
  const nav = useNavigate()
  const [preco,       setPreco]       = useState('')
  const [combustivel, setCombustivel] = useState('gasolina')
  const [recalcular,  setRecalcular]  = useState(true)
  const [historico,   setHistorico]   = useState([])
  const [impacto,     setImpacto]     = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState(null)
  const notify = (msg, type='success') => setToast({ msg, type })

  useEffect(() => {
    req('/api/combustivel/historico').then(setHistorico).catch(()=>{})
  }, [])

  useEffect(() => {
    if (!preco || parseFloat(preco) <= 0) { setImpacto(null); return }
    const t = setTimeout(() => {
      req(`/api/combustivel/impacto?preco_novo=${preco}`).then(setImpacto).catch(()=>{})
    }, 600)
    return () => clearTimeout(t)
  }, [preco])

  async function salvar(e) {
    e.preventDefault()
    if (!preco || parseFloat(preco) <= 0) { notify('Informe um preço válido','error'); return }
    setSaving(true)
    try {
      const r = await req('/api/combustivel/preco', {
        method: 'POST',
        body: JSON.stringify({ preco: parseFloat(preco), combustivel, recalcular })
      })
      notify(`✓ Preço salvo${r.rotas_atualizadas>0?` · ${r.rotas_atualizadas} rota${r.rotas_atualizadas!==1?'s':''} recalculada${r.rotas_atualizadas!==1?'s':''}!`:'!'}`)
      req('/api/combustivel/historico').then(setHistorico).catch(()=>{})
      setPreco(''); setImpacto(null)
    } catch(e) { notify(e.message,'error') }
    finally { setSaving(false) }
  }

  // Detectar alta de preço
  const ultimoPreco = historico[0]?.preco
  const penultimo   = historico[1]?.preco
  const variacao    = ultimoPreco && penultimo ? parseFloat(ultimoPreco) - parseFloat(penultimo) : null

  return (
    <div style={{ padding:'28px 0 60px' }}>
      <div className="container" style={{ maxWidth:720 }}>
        <div className="pg-header">
          <div>
            <h1 className="pg-title">⛽ Calculadora de Combustível</h1>
            <p className="pg-sub">Atualize o preço e o app recalcula o custo de todas as rotas do mês automaticamente</p>
          </div>
        </div>

        {/* ALERTA DE VARIAÇÃO */}
        {variacao !== null && Math.abs(variacao) >= 0.10 && (
          <div style={{ marginBottom:16, padding:'13px 18px', background: variacao>0?'var(--rd)':'var(--gd)', border:`1px solid ${variacao>0?'rgba(239,68,68,.25)':'rgba(16,185,129,.25)'}`, borderRadius:'var(--r)', display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:20 }}>{variacao>0?'📈':'📉'}</span>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:variacao>0?'var(--re)':'var(--gr2)', marginBottom:2 }}>
                {variacao>0?`Combustível subiu R$${variacao.toFixed(2)} desde o último registro`:`Combustível caiu R$${Math.abs(variacao).toFixed(2)} desde o último registro`}
              </p>
              <p style={{ fontSize:12, color:'var(--t2)' }}>
                {variacao>0
                  ? 'Atualize o preço e recalcule suas rotas para ver o impacto real no lucro'
                  : 'Atualize o preço para refletir a economia nas suas rotas'
                }
              </p>
            </div>
          </div>
        )}

        <div className="grid2" style={{ gap:16 }}>
          {/* FORM */}
          <div className="card">
            <div className="card-header"><span className="card-title">Atualizar preço</span></div>
            <form onSubmit={salvar}>
              <div className="card-body">
                <div className="field" style={{ marginBottom:12 }}>
                  <label className="field-label">Tipo de combustível</label>
                  <select className="select" value={combustivel} onChange={e=>setCombustivel(e.target.value)}>
                    <option value="gasolina">Gasolina</option>
                    <option value="alcool">Álcool</option>
                    <option value="diesel">Diesel</option>
                    <option value="gnv">GNV</option>
                  </select>
                </div>
                <div className="field" style={{ marginBottom:12 }}>
                  <label className="field-label">Preço por litro (R$)</label>
                  <input className="input" type="number" step="0.01" min="0" placeholder="Ex: 6,49" value={preco} onChange={e=>setPreco(e.target.value)} required
                    style={{ fontFamily:'var(--fm)', fontSize:22, fontWeight:700, textAlign:'center', color:'var(--or)' }}/>
                </div>

                {/* IMPACTO PREVIEW */}
                {impacto && impacto.rotas > 0 && (
                  <div style={{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
                    <p style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10 }}>
                      Impacto nas {impacto.rotas} rota{impacto.rotas!==1?'s':''} deste mês
                    </p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <div style={{ background:'var(--s3)', borderRadius:8, padding:'8px 10px' }}>
                        <p style={{ fontSize:10, color:'var(--t3)', marginBottom:3 }}>Custo atual</p>
                        <p style={{ fontFamily:'var(--fm)', fontSize:14, color:'var(--ye)' }}>{fmtBRL(impacto.custo_atual)}</p>
                      </div>
                      <div style={{ background:'var(--s3)', borderRadius:8, padding:'8px 10px' }}>
                        <p style={{ fontSize:10, color:'var(--t3)', marginBottom:3 }}>Custo novo</p>
                        <p style={{ fontFamily:'var(--fm)', fontSize:14, color:'var(--or)' }}>{fmtBRL(impacto.custo_novo)}</p>
                      </div>
                    </div>
                    <div style={{ marginTop:8, background: impacto.diferenca>0?'var(--rd)':'var(--gd)', border:`1px solid ${impacto.diferenca>0?'rgba(239,68,68,.2)':'rgba(16,185,129,.2)'}`, borderRadius:8, padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <p style={{ fontSize:12, color:'var(--t2)' }}>
                        {impacto.diferenca>0?'Você vai gastar mais':'Você vai economizar'}
                      </p>
                      <p style={{ fontFamily:'var(--fm)', fontSize:14, fontWeight:700, color:impacto.diferenca>0?'var(--re)':'var(--gr2)' }}>
                        {impacto.diferenca>0?'+':''}{fmtBRL(impacto.diferenca)} ({impacto.impacto_pct>0?'+':''}{impacto.impacto_pct}%)
                      </p>
                    </div>
                  </div>
                )}
                {impacto && impacto.rotas === 0 && (
                  <div style={{ background:'var(--s2)', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:12, color:'var(--t3)' }}>
                    Nenhuma rota concluída este mês para recalcular.
                  </div>
                )}

                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, padding:'10px 14px', background:'var(--s2)', borderRadius:10, cursor:'pointer' }}
                  onClick={()=>setRecalcular(r=>!r)}>
                  <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${recalcular?'var(--or)':'var(--b2)'}`, background:recalcular?'var(--or)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s' }}>
                    {recalcular && <span style={{ color:'#fff', fontSize:11, lineHeight:1 }}>✓</span>}
                  </div>
                  <div>
                    <p style={{ fontSize:13, color:'var(--t)', fontWeight:500 }}>Recalcular rotas do mês</p>
                    <p style={{ fontSize:11, color:'var(--t3)' }}>Atualiza custo e lucro de todas as rotas concluídas este mês</p>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-full" disabled={saving||!preco}>
                  {saving ? 'Salvando...' : `Salvar preço ${preco?`— R$ ${parseFloat(preco).toFixed(2)}`:''}${recalcular?' + recalcular':''}`}
                </button>
              </div>
            </form>
          </div>

          {/* HISTÓRICO */}
          <div className="card">
            <div className="card-header"><span className="card-title">Histórico de preços</span></div>
            <div className="card-body" style={{ padding:0 }}>
              {historico.length === 0 ? (
                <div style={{ padding:'24px 20px', textAlign:'center' }}>
                  <p style={{ fontSize:28, marginBottom:8 }}>⛽</p>
                  <p style={{ fontSize:13, color:'var(--t3)' }}>Nenhum preço registrado ainda</p>
                </div>
              ) : historico.map((h, i) => {
                const prev = historico[i+1]
                const diff = prev ? parseFloat(h.preco) - parseFloat(prev.preco) : null
                return (
                  <div key={h.id} style={{ padding:'12px 20px', borderBottom:'1px solid var(--b1)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <p style={{ fontSize:13, color:'var(--t)', fontWeight:500 }}>
                        {new Date(h.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}
                      </p>
                      <p style={{ fontSize:11, color:'var(--t3)' }}>{h.combustivel}</p>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ fontFamily:'var(--fm)', fontSize:16, fontWeight:700, color: i===0?'var(--or)':'var(--t2)' }}>
                        R$ {parseFloat(h.preco).toFixed(2)}
                      </p>
                      {diff !== null && (
                        <p style={{ fontSize:11, color: diff>0?'var(--re)':diff<0?'var(--gr2)':'var(--t3)' }}>
                          {diff>0?'↑':diff<0?'↓':'='} {diff!==0?`R$ ${Math.abs(diff).toFixed(2)}`:'sem variação'}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  )
}
