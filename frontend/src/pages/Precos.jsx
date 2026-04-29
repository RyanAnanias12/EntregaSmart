import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const BASE = (import.meta.env.VITE_API_URL||'').replace(/\/api$/,'')
const tok  = () => localStorage.getItem('token')||sessionStorage.getItem('token')||''
async function criarCheckout(plano, periodo) {
  const r = await fetch(BASE+'/api/billing/checkout', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${tok()}` },
    body: JSON.stringify({ plano, periodo })
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error||'Erro')
  return d
}

export default function Precos() {
  const nav = useNavigate()
  const { user, tenant } = useAuth()
  const [loading,  setLoading]  = useState(false)
  const [periodo,  setPeriodo]  = useState('mensal') // mensal | anual

  const isPro  = tenant?.plano === 'pro'
  const isSolo = tenant?.plano === 'solo'

  async function handleUpgrade(plano) {
    if (!user) { nav('/cadastro'); return }
    setLoading(true)
    try {
      const { url } = await criarCheckout(plano, periodo)
      window.location.href = url
    } catch(e) { alert(e.message) }
    finally { setLoading(false) }
  }

  const PRECOS = {
    solo: { mensal: 9.90,   anual: 89.00  },
    pro:  { mensal: 14.90,  anual: 134.00 },
  }
  const economia = (plano) => {
    const anual    = PRECOS[plano].mensal * 12
    const desconto = PRECOS[plano].anual
    return Math.round(((anual - desconto) / anual) * 100)
  }

  const PLANS = [
    {
      name: 'Gratuito', plano: 'free', price: 0, sub: 'Para experimentar',
      feats: [
        { ok: true,  txt: 'Até 30 rotas por mês' },
        { ok: true,  txt: '1 membro' },
        { ok: true,  txt: 'Cálculo de combustível' },
        { ok: true,  txt: 'Dashboard com métricas básicas' },
        { ok: true,  txt: 'Email de confirmação de rota' },
        { ok: false, txt: 'Gráficos e mapa de calor' },
        { ok: false, txt: 'Histórico de combustível' },
        { ok: false, txt: 'Veículos próprios' },
        { ok: false, txt: 'Despesas fixas' },
        { ok: false, txt: 'Meta mensal' },
      ],
    },
    {
      name: 'Solo', plano: 'solo', featured: true,
      badge: '🚴 Para motoristas solo',
      price: periodo === 'anual' ? (PRECOS.solo.anual/12).toFixed(2) : PRECOS.solo.mensal,
      priceTotal: periodo === 'anual' ? PRECOS.solo.anual : null,
      feats: [
        { ok: true, txt: 'Rotas ilimitadas' },
        { ok: true, txt: 'Lucro 100% seu, sem rateio' },
        { ok: true, txt: 'Dashboard completo + mapa de calor' },
        { ok: true, txt: 'Streak de dias consecutivos' },
        { ok: true, txt: 'Veículos com KM e manutenção' },
        { ok: true, txt: 'Calculadora de combustível' },
        { ok: true, txt: 'Histórico de preço do combustível' },
        { ok: true, txt: 'Despesas fixas mensais' },
        { ok: true, txt: 'Meta diária e mensal' },
        { ok: true, txt: 'Bônus e desafios dos apps' },
        { ok: true, txt: 'Comparativo de plataformas' },
        { ok: false, txt: 'Copiloto e rateio de equipe' },
      ],
    },
    {
      name: 'Pro', plano: 'pro',
      badge: '👥 Para equipes',
      price: periodo === 'anual' ? (PRECOS.pro.anual/12).toFixed(2) : PRECOS.pro.mensal,
      priceTotal: periodo === 'anual' ? PRECOS.pro.anual : null,
      feats: [
        { ok: true, txt: 'Rotas ilimitadas' },
        { ok: true, txt: 'Até 5 membros na equipe' },
        { ok: true, txt: 'Copiloto + rateio automático 60/40' },
        { ok: true, txt: 'Dashboard completo + mapa de calor' },
        { ok: true, txt: 'Streak e comparativo semanal' },
        { ok: true, txt: 'Veículos com KM e manutenção' },
        { ok: true, txt: 'Calculadora de combustível' },
        { ok: true, txt: 'Despesas fixas mensais' },
        { ok: true, txt: 'Meta diária e mensal' },
        { ok: true, txt: 'Bônus e desafios dos apps' },
        { ok: true, txt: 'Resumo semanal por email' },
        { ok: true, txt: 'Comparativo inteligente de plataformas' },
      ],
    },
  ]

  return (
    <div style={{ padding:'60px 0 80px' }}>
      <div className="container">
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div className="section-pill">Planos</div>
          <h1 className="section-title">Simples e transparente</h1>
          <p className="section-sub" style={{ margin:'0 auto' }}>Comece grátis. Faça upgrade quando precisar de mais.</p>

          {/* TOGGLE MENSAL/ANUAL */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:0, background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:99, padding:4, marginTop:24 }}>
            {[['mensal','Mensal'],['anual','Anual']].map(([v,l]) => (
              <button key={v} onClick={()=>setPeriodo(v)}
                style={{ padding:'8px 22px', borderRadius:99, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, background:periodo===v?'var(--or)':'transparent', color:periodo===v?'#fff':'var(--t2)', transition:'all .2s', position:'relative' }}>
                {l}
                {v==='anual' && periodo!=='anual' && (
                  <span style={{ position:'absolute', top:-8, right:-4, background:'var(--gr2)', color:'#fff', borderRadius:99, fontSize:9, fontWeight:700, padding:'2px 6px', whiteSpace:'nowrap' }}>
                    -{economia('solo')}%
                  </span>
                )}
              </button>
            ))}
          </div>
          {periodo==='anual' && (
            <p style={{ fontSize:12, color:'var(--gr2)', marginTop:10 }}>
              ✓ Economize até {economia('solo')}% pagando anualmente
            </p>
          )}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:16, maxWidth:900, margin:'0 auto' }}>
          {PLANS.map(p => {
            const current = tenant?.plano||'free'
            const isActive = p.plano === current
            return (
              <div key={p.name} className={`pricing-card ${p.featured?'featured':''}`}>
                {p.featured && <div className="pricing-badge">⭐ Mais popular</div>}
                {p.badge && <p style={{ fontSize:11, color:'var(--t3)', marginBottom:6 }}>{p.badge}</p>}
                <p className="pricing-name">{p.name}</p>
                <p className="pricing-price">
                  {p.price===0 ? 'Grátis' : (
                    <>R$ {parseFloat(p.price).toLocaleString('pt-BR',{minimumFractionDigits:2})}<span>/mês</span></>
                  )}
                </p>
                {p.priceTotal && (
                  <p style={{ fontSize:12, color:'var(--gr2)', marginBottom:4 }}>
                    R$ {p.priceTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})} cobrado anualmente
                  </p>
                )}
                {!p.priceTotal && p.price > 0 && (
                  <p className="pricing-sub">por mês · cancele quando quiser</p>
                )}

                {/* BOTÃO */}
                {isActive ? (
                  <button className="btn btn-ghost btn-full" style={{ marginBottom:20 }} disabled>
                    ✓ Plano atual
                  </button>
                ) : p.plano === 'free' ? (
                  <button className="btn btn-ghost btn-full" style={{ marginBottom:20 }} onClick={()=>!user&&nav('/cadastro')}>
                    {user ? 'Plano atual' : 'Começar grátis'}
                  </button>
                ) : (
                  <button className="btn btn-primary btn-full" style={{ marginBottom:12 }} onClick={()=>handleUpgrade(p.plano)} disabled={loading}>
                    {loading ? 'Redirecionando...' : periodo==='anual' ? '💳 PIX ou Cartão →' : '💳 Cartão ou Boleto →'}
                  </button>
                )}

                {/* TAG de método de pagamento */}
                {p.plano !== 'free' && !isActive && (
                  <div style={{ marginBottom:16, fontSize:11, color:'var(--t3)', textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    {periodo === 'anual' ? (
                      <>
                        <span style={{ background:'rgba(0,157,60,.1)', color:'#009d3c', border:'1px solid rgba(0,157,60,.2)', borderRadius:4, padding:'2px 7px', fontWeight:600 }}>PIX</span>
                        <span>ou</span>
                        <span style={{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:4, padding:'2px 7px' }}>Cartão</span>
                        <span style={{ color:'var(--gr2)', fontWeight:600 }}>· pagamento único</span>
                      </>
                    ) : (
                      <>
                        <span style={{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:4, padding:'2px 7px' }}>Cartão</span>
                        <span>ou</span>
                        <span style={{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:4, padding:'2px 7px' }}>Boleto</span>
                        <span>· recorrente</span>
                      </>
                    )}
                  </div>
                )}
                {p.feats.map((f,i) => (
                  <div key={i} className="pricing-feat">
                    <span style={{ color:f.ok?'var(--gr2)':'var(--t4)', fontSize:12 }}>{f.ok?'✓':'✕'}</span>
                    <span style={{ color:f.ok?'var(--t2)':'var(--t4)' }}>{f.txt}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* PAGAMENTO INFO */}
        <div style={{ textAlign:'center', marginTop:32, padding:'20px', background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)' }}>
          <p style={{ fontSize:13, color:'var(--t2)', marginBottom:8 }}>
            {periodo === 'anual'
              ? <>💳 Plano anual via <strong style={{ color:'var(--t)' }}>Mercado Pago</strong> — <strong style={{ color:'#009d3c' }}>PIX</strong>, cartão ou débito · pagamento único</>
              : <>💳 Plano mensal via <strong style={{ color:'var(--t)' }}>Stripe</strong> — cartão de crédito ou boleto · cobrança automática mensal</>
            }
          </p>
          <p style={{ fontSize:12, color:'var(--t3)' }}>
            Transação segura · Cancele a qualquer momento · Suporte em até 24h
          </p>
        </div>

        <div style={{ textAlign:'center', marginTop:24 }}>
          <a href="mailto:contato@smartentregas.online" className="btn btn-ghost">Dúvidas? Fale com a gente</a>
        </div>
      </div>
    </div>
  )
}
