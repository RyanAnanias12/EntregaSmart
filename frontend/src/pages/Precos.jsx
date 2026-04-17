import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { criarCheckout, abrirPortal } from '../lib/api'

export default function Precos() {
  const nav = useNavigate()
  const { user, tenant } = useAuth()
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    if (!user) { nav('/cadastro'); return }
    setLoading(true)
    try {
      const { url } = await criarCheckout()
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

  const isPro = tenant?.plano === 'pro'

  const PLANS = [
    {
      name: 'Gratuito', price: 0, sub: 'Para experimentar',
      feats: [
        { ok: true,  txt: 'Até 10 rotas por mês' },
        { ok: true,  txt: '1 membro na equipe' },
        { ok: true,  txt: 'Rateio automático' },
        { ok: false, txt: 'Dashboard com gráficos' },
        { ok: false, txt: 'Veículos com consumo próprio' },
        { ok: false, txt: 'Notificações por email' },
        { ok: false, txt: 'Resumo semanal' },
        { ok: false, txt: 'Filtros avançados' },
        { ok: false, txt: 'Meta mensal' },
      ],
    },
    {
      name: 'Pro', price: 14.90, sub: 'por mês', featured: true,
      feats: [
        { ok: true, txt: 'Rotas ilimitadas' },
        { ok: true, txt: 'Até 5 membros na equipe' },
        { ok: true, txt: 'Rateio automático (60% / 40%)' },
        { ok: true, txt: 'Dashboard completo com gráficos' },
        { ok: true, txt: 'Veículos ilimitados com consumo próprio' },
        { ok: true, txt: 'Notificações por email (rota criada/concluída)' },
        { ok: true, txt: 'Resumo semanal por email' },
        { ok: true, txt: 'Alerta de rotas não concluídas' },
        { ok: true, txt: 'Meta mensal com barra de progresso' },
        { ok: true, txt: 'Filtros avançados por data, piloto, plataforma' },
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

        <div className="pricing-grid">
          {PLANS.map(p => (
            <div key={p.name} className={`pricing-card ${p.featured ? 'featured' : ''}`}>
              {p.featured && <div className="pricing-badge">⭐ Mais popular</div>}
              <p className="pricing-name">{p.name}</p>
              <p className="pricing-price">
                {p.price === 0 ? 'Grátis' : <>R$ {p.price.toLocaleString('pt-BR', {minimumFractionDigits:2})}<span>/mês</span></>}
              </p>
              <p className="pricing-sub">{p.sub}</p>

              {p.featured ? (
                isPro ? (
                  <button className="btn btn-ghost btn-full" style={{ marginBottom: 20 }} onClick={handlePortal} disabled={loading}>
                    {loading ? 'Aguarde...' : '⚙️ Gerenciar assinatura'}
                  </button>
                ) : (
                  <button className="btn btn-primary btn-full" style={{ marginBottom: 20 }} onClick={handleUpgrade} disabled={loading}>
                    {loading ? 'Redirecionando...' : user ? 'Assinar Pro →' : 'Começar agora →'}
                  </button>
                )
              ) : (
                <button className="btn btn-ghost btn-full" style={{ marginBottom: 20 }} onClick={() => !user && nav('/cadastro')}>
                  {user ? (isPro ? 'Plano atual: Free' : '✓ Plano atual') : 'Começar grátis'}
                </button>
              )}

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
