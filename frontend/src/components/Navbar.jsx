import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { iniciais } from '../lib/api'
import { useTheme } from '../hooks/useTheme'

export default function Navbar() {
  const { user, tenant, logout } = useAuth()
  const { tema, toggle: toggleTema } = useTheme()
  const nav = useNavigate()
  const loc = useLocation()
  const [open, setOpen]       = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const is = p => loc.pathname === p
  const go = p => { nav(p); setOpen(false); setUserMenu(false) }

  const links = user ? [
    { label: 'Início',    path: '/' },
    { label: 'Rotas',     path: '/rotas' },
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Equipe',    path: '/equipe' },
    { label: 'Veículos',        path: '/veiculos' },
    { label: 'Abastecimentos',  path: '/abastecimentos' },
    { label: 'Despesas',        path: '/despesas' },
    { label: 'Histórico',     path: '/historico' },
    { label: '🏆 Bônus',      path: '/bonificacoes' },
  ] : [
    { label: 'Início',  path: '/' },
    { label: 'Preços',  path: '/precos' },
  ]

  return (
    <>
      <header className="nav">
        <div className="container">
          <div className="nav-inner">
            <div className="nav-logo" onClick={() => go('/')}>
              <img src="/logo.png" alt="Smart Entregas" style={{ height: 34, width: 'auto', display: 'block' }}/>
            </div>
            <nav className="nav-links">
              {links.map(l => (
                <button key={l.path} className={`nav-link ${is(l.path) ? 'active' : ''}`} onClick={() => go(l.path)}>
                  {l.label}
                </button>
              ))}
            </nav>
            <div className="nav-right">
              {user ? (
                <div style={{ position: 'relative' }}>
                  <button className="nav-user" onClick={() => setUserMenu(m => !m)}>
                    <div className="nav-avatar">{iniciais(user.nome)}</div>
                    <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.nome}</span>
                    {tenant?.plano === 'pro' && <span className="badge badge-pro" style={{ fontSize: 9, padding: '2px 6px' }}>PRO</span>}
                    {tenant?.plano === 'solo' && <span className="badge badge-pro" style={{ fontSize: 9, padding: '2px 6px', background:'rgba(59,130,246,.15)', color:'#60a5fa', border:'1px solid rgba(59,130,246,.3)' }}>SOLO</span>}
                    <span style={{ fontSize: 10 }}>▾</span>
                  </button>
                  {userMenu && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 'var(--rsm)', minWidth: 200, overflow: 'hidden', zIndex: 300, animation: 'fadeUp .2s ease', boxShadow: '0 16px 40px rgba(0,0,0,.4)' }}>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--b1)' }}>
                        <p style={{ fontSize: 13, fontWeight: 500 }}>{user.nome}</p>
                        <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{tenant?.nome}</p>
                        <span className={`badge ${tenant?.plano === 'pro' ? 'badge-pro' : tenant?.plano === 'solo' ? '' : 'badge-gray'}`} style={{ fontSize: 10, marginTop: 6, display: 'inline-flex', ...(tenant?.plano === 'solo' ? { background:'rgba(59,130,246,.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,.25)' } : {}) }}>
                          {tenant?.plano === 'pro' ? '⭐ Pro' : tenant?.plano === 'solo' ? '🚴 Solo' : 'Free'}
                        </span>
                      </div>
                      {!['pro','solo'].includes(tenant?.plano) && (
                        <button style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'var(--od)', border: 'none', color: 'var(--or2)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--fb)', fontWeight: 600 }} onClick={() => go('/precos')}>
                          ⭐ Fazer upgrade
                        </button>
                      )}
                      <button style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'transparent', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--fb)', display:'flex', alignItems:'center', justifyContent:'space-between' }}
                        onMouseOver={e => e.currentTarget.style.background = 'var(--s3)'}
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        onClick={toggleTema}>
                        <span>{tema === 'dark' ? '☀️ Modo claro' : '🌙 Modo escuro'}</span>
                        <span style={{ fontSize:10, color:'var(--t3)', background:'var(--s3)', borderRadius:4, padding:'2px 6px' }}>{tema === 'dark' ? 'DARK' : 'LIGHT'}</span>
                      </button>
                      <button style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'transparent', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--fb)' }}
                        onMouseOver={e => e.currentTarget.style.background = 'var(--s3)'}
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        onClick={() => { go('/combustivel'); setUserMenu(false) }}>
                        ⛽ Combustível
                      </button>
                      <button style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'transparent', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--fb)' }}
                        onMouseOver={e => e.target.style.background = 'var(--s3)'}
                        onMouseOut={e => e.target.style.background = 'transparent'}
                        onClick={() => { logout(); go('/login') }}>
                        Sair
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={() => go('/login')}>Entrar</button>
                  <button className="btn btn-primary btn-sm" onClick={() => go('/cadastro')}>Cadastrar grátis</button>
                </>
              )}
              <button className="nav-burger" onClick={() => setOpen(o => !o)} aria-label="Menu">
                <span style={{ transform: open ? 'rotate(45deg) translate(5px,5px)' : 'none' }}/>
                <span style={{ opacity: open ? 0 : 1 }}/>
                <span style={{ transform: open ? 'rotate(-45deg) translate(5px,-5px)' : 'none' }}/>
              </button>
            </div>
          </div>
        </div>
      </header>
      <div className={`nav-mobile ${open ? 'open' : ''}`}>
        {links.map(l => (
          <button key={l.path} className={`nav-link ${is(l.path) ? 'active' : ''}`} onClick={() => go(l.path)}>{l.label}</button>
        ))}
        {user
          ? <button className="nav-link" onClick={() => { logout(); go('/login') }}>Sair</button>
          : <>
              <button className="nav-link" onClick={() => go('/login')}>Entrar</button>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 4 }} onClick={() => go('/cadastro')}>Cadastrar grátis</button>
            </>}
      </div>
    </>
  )
}
