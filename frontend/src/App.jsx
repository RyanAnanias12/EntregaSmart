import { Routes, Route, Navigate, useState, useEffect } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar        from './components/Navbar'
import Home          from './pages/Home'
import Login         from './pages/Login'
import Cadastro      from './pages/Cadastro'
import Rotas         from './pages/Rotas'
import Dashboard     from './pages/Dashboard'
import Equipe        from './pages/Equipe'
import Abastecimentos from './pages/Abastecimentos'
import Veiculos      from './pages/Veiculos'
import Despesas      from './pages/Despesas'
import Historico     from './pages/Historico'
import Precos        from './pages/Precos'
import Onboarding    from './pages/Onboarding'
import Bonificacoes  from './pages/Bonificacoes'
import Combustivel   from './pages/Combustivel'
import { fetchOnboarding } from './lib/api'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}><div className="spinner"/></div>
  if (!user) return <Navigate to="/login" replace/>
  return children
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace/>
  return children
}

function UpgradeNotice() {
  const { tenant } = useAuth()
  const params = new URLSearchParams(window.location.search)
  if (params.get('upgrade') !== 'ok' || !tenant) return null
  return (
    <div style={{ background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.3)', borderRadius:'var(--rsm)', padding:'12px 20px', margin:'0 0 16px', fontSize:13, color:'var(--or2)', display:'flex', alignItems:'center', gap:8 }}>
      ⭐ Bem-vindo ao plano {tenant.plano === 'pro' ? 'Pro' : 'Solo'}! Todos os recursos liberados.
    </div>
  )
}

function AppContent() {
  const { user } = useAuth()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onbChecked,     setOnbChecked]     = useState(false)

  useEffect(() => {
    if (!user) { setOnbChecked(true); return }
    fetchOnboarding()
      .then(d => { if (!d.onboarding_concluido) setShowOnboarding(true) })
      .catch(()=>{})
      .finally(()=>setOnbChecked(true))
  }, [user])

  if (!onbChecked) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}><div className="spinner"/></div>

  if (showOnboarding && user) return <Onboarding onConcluir={()=>setShowOnboarding(false)}/>

  const noNav = ['/login','/cadastro']
  const path  = window.location.pathname
  const showNav = !noNav.includes(path)

  return (
    <div className="page-wrap">
      {showNav && <Navbar/>}
      <Routes>
        <Route path="/"              element={<Home/>}/>
        <Route path="/precos"        element={<Precos/>}/>
        <Route path="/login"         element={<PublicOnly><Login/></PublicOnly>}/>
        <Route path="/cadastro"      element={<PublicOnly><Cadastro/></PublicOnly>}/>
        <Route path="/rotas"         element={<PrivateRoute><Rotas/></PrivateRoute>}/>
        <Route path="/dashboard"     element={<PrivateRoute><Dashboard/></PrivateRoute>}/>
        <Route path="/equipe"        element={<PrivateRoute><Equipe/></PrivateRoute>}/>
        <Route path="/veiculos"      element={<PrivateRoute><Veiculos/></PrivateRoute>}/>
        <Route path="/abastecimentos" element={<PrivateRoute><Abastecimentos/></PrivateRoute>}/>
        <Route path="/despesas"      element={<PrivateRoute><Despesas/></PrivateRoute>}/>
        <Route path="/historico"     element={<PrivateRoute><Historico/></PrivateRoute>}/>
        <Route path="/bonificacoes"  element={<PrivateRoute><Bonificacoes/></PrivateRoute>}/>
        <Route path="/combustivel"   element={<PrivateRoute><Combustivel/></PrivateRoute>}/>
        <Route path="*"              element={<Navigate to="/" replace/>}/>
      </Routes>
    </div>
  )
}

export default function App() {
  return <AuthProvider><AppContent/></AuthProvider>
}
