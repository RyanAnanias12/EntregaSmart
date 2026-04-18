import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { criarCheckout, abrirPortal } from '../lib/api'

export default function Precos() {
  const nav = useNavigate()
  const { user, tenant } = useAuth()
  const [loading, setLoading] = useState(false)

  async function handleUpgrade(plano = 'pro') {
    if (!user) { nav('/cadastro'); return }
    setLoading(true)
    try {
      const { url } = await criarCheckout(plano)
      window.location.href = url
    } catch (e) { alert(e.message) }
    finally { setLoading(false) }
  }

  async function handlePortal() {
    setLoading(true)
    try {
      const { url } = await abrirPortal()
      window.location.href = url
    } catch (e) { alert(e.message) }
    finally { setLoading(false) }
  }

  const isPro  = tenant?.plano === 'pro'
  const isSolo = tenant?.plano === 'solo'

  const PLANS = [
    {
      name: 'Gratuito', price: 0, sub: 'Para experimentar', plano: 'free',
      feats: [
        { ok: true,  txt: 'Até 10 rotas por mês' },
        { ok: true,  txt: '1 membro' },
        { ok: true,  txt: 'Cálculo de combustível' },
        { ok: false, txt: 'Dashboard com gráficos' },
        { ok: false, txt: 'Emails automáticos' },
        { ok: false, txt: 'Veículos próprios' },
        { ok: false, txt: 'Despesas fixas' },
        { ok: false, txt: 'Lucro real mensal' },
      ],
    },
    {
      name: 'Solo', price: 9.90, sub: 'por mês', featured: true, plano: 'solo',
      badge: '🚴 Para motoristas solo',
      feats: [
        { ok: true, txt: 'Rotas ilimitadas' },
        { ok: true, txt: '1 membro (você)' },
        { ok: true, txt: 'Modo solo — lucro 100% seu' },
        { ok: true, txt: 'Registro rápido de rota' },
        { ok: true, txt: 'Lucro por hora (R$/h)' },
        { ok: true, txt: 'Despesas fixas mensais' },
        { ok: true, txt: 'Lucro real (após despesas)' },
        { ok: true, txt: 'Meta diária e mensal' },
        { ok: true, txt: 'Comparativo de plataformas' },
        { ok: false, txt: 'Copiloto e rateio de equipe' },
      ],
    },
    {
      name: 'Pro', price: 14.90, sub: 'por mês', plano: 'pro',
      badge: '👥 Para equipes',
      feats: [
        { ok: true, txt: 'Rotas ilimitadas' },
        { ok: true, txt: 'Até 5 membros na equipe' },
        { ok: true, txt: 'Copiloto + rateio 60/40' },
        { ok: true, txt: 'Dashboard completo' },
        { ok: true, txt: 'Emails automáticos' },
        { ok: true, txt: 'Veículos com consumo próprio' },
        { ok: true, txt: 'Despesas fixas mensais' },
        { ok: true, txt: 'Meta diária e mensal' },
        { ok: true, txt: 'Resumo semanal por email' },
        { ok: true, txt: 'Filtros avançados' },
      ],
    },
  ]

  return (
    <div style={{ padding: '60px 0 80px' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div className="section-pill">Planos</div>
          <h1 className="section-title">Simples e transparente</h1>
          <p className="section-sub" style={{ margin: '0 auto' }}>Comece grátis. Faça upgrade quando precisar de mais.</p>
        </div>

        <div className="pricing-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", maxWidth: 900 }}>
          {PLANS.map(p => (
            <div key={p.name} className={`pricing-card ${p.featured ? 'featured' : ''}`}>
              {p.featured && <div className="pricing-badge">⭐ Mais popular</div>}
              {p.badge && <p style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6 }}>{p.badge}</p>}
              <p className="pricing-name">{p.name}</p>
              <p className="pricing-price">
                {p.price === 0 ? 'Grátis' : <>R$ {p.price.toLocaleString('pt-BR', {minimumFractionDigits:2})}<span>/mês</span></>}
              </p>
              <p className="pricing-sub">{p.sub}</p>

              {(() => {
                const current = tenant?.plano || 'free'
                if (p.plano === current || (p.plano === 'pro' && isPro) || (p.plano === 'solo' && isSolo)) {
                  return <button className="btn btn-ghost btn-full" style={{ marginBottom: 20 }} onClick={['pro','solo'].includes(current) ? handlePortal : undefined} disabled={loading}>
                    {loading ? 'Aguarde...' : current === p.plano ? '✓ Plano atual' : '⚙️ Gerenciar'}
                  </button>
                }
                if (p.plano === 'free') {
                  return <button className="btn btn-ghost btn-full" style={{ marginBottom: 20 }} onClick={() => !user && nav('/cadastro')}>
                    {user ? 'Fazer downgrade' : 'Começar grátis'}
                  </button>
                }
                return <button className="btn btn-primary btn-full" style={{ marginBottom: 20 }} onClick={() => handleUpgrade(p.plano)} disabled={loading}>
                  {loading ? 'Redirecionando...' : user ? `Assinar ${p.name} →` : 'Começar agora →'}
                </button>
              })()}

              {p.feats.map((f, i) => (
                <div key={i} className="pricing-feat">
                  <span style={{ color: f.ok ? 'var(--gr2)' : 'var(--t4)', fontSize: 12 }}>{f.ok ? '✓' : '✕'}</span>
                  <span style={{ color: f.ok ? 'var(--t2)' : 'var(--t4)' }}>{f.txt}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 40, padding: '28px', background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--r)' }}>
          <p style={{ fontFamily: 'var(--ff)', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Dúvidas? Fale com a gente</p>
          <p style={{ color: 'var(--t2)', fontSize: 13, marginBottom: 14 }}>Respondemos em até 24h</p>
          <a href="mailto:contato@ryanananias.com@gmail.com" className="btn btn-ghost">contato@ryanananias.com@gmail.com</a>
        </div>
      </div>
    </div>
  )
}
