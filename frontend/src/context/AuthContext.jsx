import { createContext, useContext, useState, useEffect } from 'react'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [tenant,  setTenant]  = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verifica localStorage (lembrar) e sessionStorage (sessão)
    const t = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!t) { setLoading(false); return }
    const base = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '')
    fetch(base + '/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setUser({ id: d.id, nome: d.nome, email: d.email, papel: d.papel })
          setTenant({ id: d.tenant_id, nome: d.tenant_nome, plano: d.plano })
        } else {
          localStorage.removeItem('token')
          sessionStorage.removeItem('token')
        }
      })
      .catch(() => { localStorage.removeItem('token'); sessionStorage.removeItem('token') })
      .finally(() => setLoading(false))
  }, [])

  function login(token, u, t, lembrar = false) {
    // lembrar=true → localStorage (persiste), false → sessionStorage (fecha aba = desloga)
    if (lembrar) {
      localStorage.setItem('token', token)
      sessionStorage.removeItem('token')
    } else {
      sessionStorage.setItem('token', token)
      localStorage.removeItem('token')
    }
    setUser(u); setTenant(t)
  }
  function logout() {
    localStorage.removeItem('token')
    sessionStorage.removeItem('token')
    setUser(null); setTenant(null)
  }
  function updateTenant(updates) {
    setTenant(t => ({ ...t, ...updates }))
  }

  return <Ctx.Provider value={{ user, tenant, loading, login, logout, updateTenant }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
