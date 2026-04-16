import { createContext, useContext, useState, useEffect } from 'react'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [tenant,  setTenant]  = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem('token')
    if (!t) { setLoading(false); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setUser({ id: d.id, nome: d.nome, email: d.email, papel: d.papel })
          setTenant({ id: d.tenant_id, nome: d.tenant_nome, plano: d.plano })
        } else { localStorage.removeItem('token') }
      })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false))
  }, [])

  function login(token, u, t) {
    localStorage.setItem('token', token)
    setUser(u); setTenant(t)
  }
  function logout() {
    localStorage.removeItem('token')
    setUser(null); setTenant(null)
  }
  function updateTenant(updates) {
    setTenant(t => ({ ...t, ...updates }))
  }

  return <Ctx.Provider value={{ user, tenant, loading, login, logout, updateTenant }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
