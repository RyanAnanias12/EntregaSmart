import { useState, useEffect } from 'react'
import { fetchVeiculos, criarVeiculo, editarVeiculo, deletarVeiculo } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useAuth } from '../context/AuthContext'
import { Toast } from '../components/Toast'

const TIPOS = [{ v: 'carro', l: '🚗 Carro' }, { v: 'moto', l: '🏍️ Moto' }, { v: 'van', l: '🚐 Van' }]
const COMBS = [{ v: 'alcool', l: 'Álcool' }, { v: 'gasolina', l: 'Gasolina' }, { v: 'diesel', l: 'Diesel' }, { v: 'eletrico', l: 'Elétrico' }]
const EMPTY = { nome: '', placa: '', tipo: 'carro', consumo_kml: '', combustivel: 'alcool' }

export default function Veiculos() {
  const { tenant } = useAuth()
  const isPro = tenant?.plano === 'pro'
  const [veiculos, setVeiculos] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form,     setForm]     = useState(EMPTY)
  const [toast,    setToast]    = useState(null)

  const notify = (msg, type = 'success') => setToast({ msg, type })
  const s = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function load() {
    setLoading(true)
    try { setVeiculos(await fetchVeiculos()) }
    catch { notify('Erro ao carregar veículos', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function openAdd()  { setEditando(null); setForm(EMPTY); setShowForm(true) }
  function openEdit(v) { setEditando(v); setForm({ nome: v.nome, placa: v.placa || '', tipo: v.tipo, consumo_kml: v.consumo_kml, combustivel: v.combustivel }); setShowForm(true) }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editando) { await editarVeiculo(editando.id, form); notify('Veículo atualizado!') }
      else          { await criarVeiculo(form);                notify('Veículo adicionado!') }
      setShowForm(false); load()
    } catch (e) { notify(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Remover este veículo?')) return
    try { await deletarVeiculo(id); notify('Veículo removido'); load() }
    catch (e) { notify(e.message, 'error') }
  }

  const tipoEmoji = t => ({ carro: '🚗', moto: '🏍️', van: '🚐' }[t] || '🚗')

  return (
    <div style={{ padding: '28px 0 60px' }}>
      <div className="container">
        <div className="pg-header">
          <div>
            <h1 className="pg-title">Veículos</h1>
            <p className="pg-sub">Gerencie os veículos da equipe com consumos específicos</p>
          </div>
          {isPro ? <button className="btn btn-primary" onClick={openAdd}>+ Adicionar veículo</button> : <a href="/precos" className="btn btn-ghost btn-sm" style={{ borderColor:'rgba(249,115,22,.3)', color:'var(--or2)' }}>⭐ Plano Pro para adicionar</a>}
        </div>

        {!isPro && (
          <div style={{ background:'var(--od)', border:'1px solid rgba(249,115,22,.2)', borderRadius:'var(--r)', padding:'16px 20px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div>
              <p style={{ fontWeight:600, fontSize:13, color:'var(--or2)', marginBottom:3 }}>🔒 Veículos disponíveis no plano Pro</p>
              <p style={{ fontSize:12, color:'var(--t2)' }}>Cadastre diferentes veículos com consumos específicos para calcular o combustível corretamente.</p>
            </div>
            <a href="/precos" className="btn btn-primary btn-sm">⭐ Assinar Pro — R$ 14,90/mês</a>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="spinner"/></div>
        ) : veiculos.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="empty-icon">🚗</div>
              <p className="empty-title">Nenhum veículo cadastrado</p>
              <p className="empty-sub">Adicione os veículos da equipe para calcular o combustível corretamente</p>
              {isPro
                ? <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>+ Adicionar primeiro veículo</button>
                : <a href="/precos" className="btn btn-primary" style={{ marginTop: 16, display:'inline-flex' }}>⭐ Upgrade Pro para cadastrar veículos</a>
              }
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
            {veiculos.map(v => (
              <div key={v.id} className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, background: 'var(--od)', border: '1px solid rgba(249,115,22,.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {tipoEmoji(v.tipo)}
                    </div>
                    <div>
                      <p style={{ fontFamily: 'var(--ff)', fontSize: 14, fontWeight: 700 }}>{v.nome}</p>
                      {v.placa && <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{v.placa}</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button className="btn-icon" onClick={() => openEdit(v)}>✏️</button>
                    <button className="btn-icon" style={{ color: 'var(--re)', borderColor: 'rgba(239,68,68,.2)' }} onClick={() => handleDelete(v.id)}>🗑️</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Consumo',     val: `${v.consumo_kml} km/L` },
                    { label: 'Combustível', val: COMBS.find(c => c.v === v.combustivel)?.l || v.combustivel },
                  ].map(item => (
                    <div key={item.label} style={{ background: 'var(--s2)', borderRadius: 8, padding: '8px 12px' }}>
                      <p style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}>{item.label}</p>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{item.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editando ? '✏️ Editar veículo' : '+ Novo veículo'}</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="grid2">
                  <div className="field">
                    <label className="field-label">Nome</label>
                    <input className="input" value={form.nome} onChange={e => s('nome', e.target.value)} placeholder="Ex: Uno 2019" required/>
                  </div>
                  <div className="field">
                    <label className="field-label">Placa (opcional)</label>
                    <input className="input" value={form.placa} onChange={e => s('placa', e.target.value)} placeholder="ABC-1234"/>
                  </div>
                </div>
                <div className="grid2">
                  <div className="field">
                    <label className="field-label">Tipo</label>
                    <select className="select" value={form.tipo} onChange={e => s('tipo', e.target.value)}>
                      {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Combustível</label>
                    <select className="select" value={form.combustivel} onChange={e => s('combustivel', e.target.value)}>
                      {COMBS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Consumo médio (km/L)</label>
                  <input className="input" type="number" step="0.1" min="1" value={form.consumo_kml} onChange={e => s('consumo_kml', e.target.value)} placeholder="Ex: 6.5" required/>
                  <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Padrão geral é 6,5 km/L. Ajuste conforme o veículo real.</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : editando ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}
