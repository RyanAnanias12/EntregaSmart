import { createContext, useContext, useState, useEffect } from 'react'

const Ctx = createContext(null)

const BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/api$/, '')

async function fetchMe(token) {
  const r = await fetch(BASE + '/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) return null
  return r.json()
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [tenant,  setTenant]  = useState(null)
  const [loading, setLoading] = useState(true)

  function applyUser(d) {
    if (!d) return false
    setUser({ id: d.id, nome: d.nome, email: d.email, papel: d.papel })
    setTenant({ id: d.tenant_id, nome: d.tenant_nome, plano: d.plano })
    return true
  }

  useEffect(() => {
    const t = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!t) { setLoading(false); return }
    fetchMe(t)
      .then(d => { if (!applyUser(d)) { localStorage.removeItem('token'); sessionStorage.removeItem('token') } })
      .catch(() => { localStorage.removeItem('token'); sessionStorage.removeItem('token') })
      .finally(() => setLoading(false))
  }, [])

  async function login(token, u, t, lembrar = false) {
    if (lembrar) { localStorage.setItem('token', token); sessionStorage.removeItem('token') }
    else         { sessionStorage.setItem('token', token); localStorage.removeItem('token') }
    // Sempre busca plano atualizado do banco
    const fresh = await fetchMe(token).catch(() => null)
    if (fresh) {
      setUser({ id: fresh.id, nome: fresh.nome, email: fresh.email, papel: fresh.papel })
      setTenant({ id: fresh.tenant_id, nome: fresh.tenant_nome, plano: fresh.plano })
    } else {
      setUser(u); setTenant(t)
    }
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
