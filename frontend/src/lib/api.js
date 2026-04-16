export const PLATAFORMAS = [
  { v: 'mercado_livre', l: 'Mercado Livre' },
  { v: 'shopee',        l: 'Shopee' },
  { v: 'amazon',        l: 'Amazon Logistics' },
  { v: 'outros',        l: 'Outros' },
]

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '')

function token() { return localStorage.getItem('token') || '' }
function headers(extra = {}) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...extra }
}
async function req(url, opts = {}) {
  const r = await fetch(BASE + url, { ...opts, headers: headers(opts.headers) })
  const json = await r.json()
  if (!r.ok) throw new Error(json.error || `Erro ${r.status}`)
  return json
}

// AUTH
export const login    = d  => req('/api/auth/login',    { method: 'POST', body: JSON.stringify(d) })
export const register = d  => req('/api/auth/register', { method: 'POST', body: JSON.stringify(d) })
export const fetchMe  = () => req('/api/auth/me')

// ROTAS
export const fetchRotas    = (qs = '') => req(`/api/rotas?${qs}`)
export const fetchRecentes = ()        => req('/api/rotas/recentes')
export const fetchStats    = (qs = '') => req(`/api/rotas/stats?${qs}`)
export const fetchRota     = id        => req(`/api/rotas/${id}`)
export const criarRota     = d         => req('/api/rotas',        { method: 'POST',   body: JSON.stringify(d) })
export const editarRota    = (id, d)   => req(`/api/rotas/${id}`,  { method: 'PUT',    body: JSON.stringify(d) })
export const deletarRota   = id        => req(`/api/rotas/${id}`,  { method: 'DELETE' })

// VEÍCULOS
export const fetchVeiculos  = ()       => req('/api/veiculos')
export const criarVeiculo   = d        => req('/api/veiculos',       { method: 'POST',   body: JSON.stringify(d) })
export const editarVeiculo  = (id, d)  => req(`/api/veiculos/${id}`, { method: 'PUT',    body: JSON.stringify(d) })
export const deletarVeiculo = id       => req(`/api/veiculos/${id}`, { method: 'DELETE' })

// GASTOS EXTRAS
export const fetchGastos  = rotaId      => req(`/api/gastos/${rotaId}`)
export const criarGasto   = (rotaId, d) => req(`/api/gastos/${rotaId}`,  { method: 'POST',   body: JSON.stringify(d) })
export const editarGasto  = (id, d)     => req(`/api/gastos/item/${id}`, { method: 'PUT',    body: JSON.stringify(d) })
export const deletarGasto = id          => req(`/api/gastos/item/${id}`, { method: 'DELETE' })

export const CATEGORIAS_GASTO = [
  { v: 'pedagio',     l: '🛣️ Pedágio',     cor: '#f59e0b' },
  { v: 'alimentacao', l: '🍔 Alimentação',  cor: '#10b981' },
  { v: 'manutencao',  l: '🔧 Manutenção',   cor: '#ef4444' },
  { v: 'lavagem',     l: '🚿 Lavagem',      cor: '#3b82f6' },
  { v: 'multa',       l: '📋 Multa',        cor: '#ef4444' },
  { v: 'material',    l: '📦 Material',     cor: '#8b5cf6' },
  { v: 'outros',      l: '💬 Outros',       cor: '#7c7c96' },
]

// USUÁRIOS
export const fetchUsuarios  = ()       => req('/api/usuarios')
export const criarUsuario   = d        => req('/api/usuarios',       { method: 'POST',   body: JSON.stringify(d) })
export const editarUsuario  = (id, d)  => req(`/api/usuarios/${id}`, { method: 'PUT',    body: JSON.stringify(d) })
export const deletarUsuario = id       => req(`/api/usuarios/${id}`, { method: 'DELETE' })

// BILLING
export const criarCheckout  = ()       => req('/api/billing/checkout', { method: 'POST' })
export const abrirPortal    = ()       => req('/api/billing/portal')
export const fetchBillingStatus = ()   => req('/api/billing/status')

// CÁLCULOS
export function calcCombustivel(kms, consumo = 6.5, preco = 4.69) {
  return parseFloat(((kms / consumo) * preco).toFixed(2))
}

export function calcRateio(lucroLiquido, piloto, copiloto) {
  const liq = parseFloat(lucroLiquido) || 0
  return [
    { nome: piloto,   valor: parseFloat((liq * 0.60).toFixed(2)), role: 'Piloto'   },
    { nome: copiloto, valor: parseFloat((liq * 0.40).toFixed(2)), role: 'Copiloto' },
  ]
}

export function fmtBRL(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

export function fmtData(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return '—'
  return new Date(d.getTime() + d.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR')
}

export function calcDuracao(inicio, fim) {
  if (!inicio || !fim) return null
  const [h1, m1] = inicio.split(':').map(Number)
  const [h2, m2] = fim.split(':').map(Number)
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1)
  if (mins < 0) mins += 1440
  return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? (mins % 60) + 'min' : ''}`
}

export function iniciais(nome) { return (nome || '?').slice(0, 2).toUpperCase() }

export function statusLabel(s) {
  return { planejada: 'Planejada', em_andamento: 'Em andamento', concluida: 'Concluída' }[s] || s
}

export function plataformaLabel(p) {
  return PLATAFORMAS.find(x => x.v === p)?.l || p
}

export function plataformaEmoji(p) {
  return { mercado_livre: '🛒', shopee: '🟠', amazon: '📦', outros: '🚚' }[p] || '🚚'
}

export function buildQS(f) {
  const p = new URLSearchParams()
  Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v) })
  return p.toString()
}
