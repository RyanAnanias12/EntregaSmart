import { useState, useEffect } from 'react'
import { fetchDespesas, criarDespesa, editarDespesa, deletarDespesa, fmtBRL, CATEGORIAS_DESPESA } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Toast } from '../components/Toast'

const EMPTY = { categoria: 'cnpj', descricao: '', valor: '' }

export default function Despesas() {
  const { tenant } = useAuth()
  const isPaid = ['pro','solo'].includes(tenant?.plano)
  const [despesas, setDespesas] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState(null)
  const notify = (msg, type = 'success') => setToast({ msg, type })
  const s = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function load() {
    setLoading(true)
    try { setDespesas(await fetchDespesas()) }
    catch { notify('Erro ao carregar', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (isPaid) load() else setLoading(false) }, [])

  function openAdd()   { setEditando(null); setForm(EMPTY); setShowForm(true) }
  function openEdit(d) { setEditando(d); setForm({ categoria: d.categoria, descricao: d.descricao, valor: d.valor }); setShowForm(true) }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editando) { await editarDespesa(editando.id, form); notify('Despesa atualizada!') }
      else          { await criarDespesa(form);                notify('Despesa adicionada!') }
      setShowForm(false); load()
    } catch (e) { notify(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Remover esta despesa?')) return
    try { await deletarDespesa(id); notify('Removida'); load() }
    catch (e) { notify(e.message, 'error') }
  }

  const total = despesas.reduce((acc, d) => acc + parseFloat(d.valor), 0)
  const catInfo = v => CATEGORIAS_DESPESA.find(c => c.v === v) || CATEGORIAS_DESPESA[5]

  if (!isPaid) return (
    <div style={{ padding: '60px 0', textAlign: 'center' }}>
      <div className="container">
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <h1 style={{ fontFamily: 'var(--ff)', fontSize: 22, marginBottom: 8 }}>Despesas fixas</h1>
        <p style={{ color: 'var(--t2)', fontSize: 14, marginBottom: 24 }}>Disponível nos planos Solo e Pro.</p>
        <a href="/precos" className="btn btn-primary">Ver planos →</a>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '28px 0 60px' }}>
      <div className="container">
        <div className="pg-header">
          <div>
            <h1 className="pg-title">Despesas fixas</h1>
            <p className="pg-sub">Custos mensais recorrentes — CNPJ, seguro, manutenção</p>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>+ Adicionar despesa</button>
        </div>

        {/* TOTAL */}
        {despesas.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div className="metric">
              <p className="metric-label">Total mensal</p>
              <p className="metric-value" style={{ color: 'var(--re)', fontSize: 22 }}>{fmtBRL(total)}</p>
              <p className="metric-sub">sai todo mês</p>
            </div>
            <div className="metric">
              <p className="metric-label">Por dia</p>
              <p className="metric-value" style={{ fontSize: 22 }}>{fmtBRL(total / 30)}</p>
              <p className="metric-sub">custo diário</p>
            </div>
            <div className="metric">
              <p className="metric-label">Por rota (estimativa)</p>
              <p className="metric-value" style={{ fontSize: 22 }}>{fmtBRL(total / 22)}</p>
              <p className="metric-sub">baseado em 22 dias úteis</p>
            </div>
          </div>
        )}

        {/* LISTA */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="spinner"/></div>
        ) : despesas.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="empty-icon">💰</div>
              <p className="empty-title">Nenhuma despesa cadastrada</p>
              <p className="empty-sub">Adicione seus custos fixos para ver o lucro real</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>+ Adicionar primeira despesa</button>
            </div>
          </div>
        ) : (
          <div className="card">
            {despesas.map((d, i) => {
              const cat = catInfo(d.categoria)
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < despesas.length - 1 ? '1px solid var(--b1)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, background: 'var(--rd)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      {cat.l.split(' ')[0]}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--t)' }}>{d.descricao}</p>
                      <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{cat.l.split(' ').slice(1).join(' ')}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'var(--fm)', fontSize: 14, color: 'var(--re)', fontWeight: 500 }}>− {fmtBRL(d.valor)}/mês</span>
                    <button className="btn-icon" style={{ fontSize: 11 }} onClick={() => openEdit(d)}>✏️</button>
                    <button className="btn-icon" style={{ fontSize: 11, color: 'var(--re)', borderColor: 'rgba(239,68,68,.2)' }} onClick={() => handleDelete(d.id)}>🗑️</button>
                  </div>
                </div>
              )
            })}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--b1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Total mensal</span>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 16, color: 'var(--re)', fontWeight: 700 }}>{fmtBRL(total)}</span>
            </div>
          </div>
        )}

        {/* INFO */}
        <div style={{ marginTop: 16, padding: '14px 18px', background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--t2)' }}>
          💡 Esses valores são subtraídos do faturamento bruto mensal no Dashboard para mostrar seu <strong style={{ color: 'var(--t)' }}>lucro real</strong>.
        </div>
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editando ? '✏️ Editar despesa' : '+ Nova despesa fixa'}</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="field">
                  <label className="field-label">Categoria</label>
                  <select className="select" value={form.categoria} onChange={e => s('categoria', e.target.value)}>
                    {CATEGORIAS_DESPESA.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Descrição</label>
                  <input className="input" value={form.descricao} onChange={e => s('descricao', e.target.value)} placeholder="Ex: Seguro Fiat Uno 2019" required/>
                </div>
                <div className="field">
                  <label className="field-label">Valor mensal (R$)</label>
                  <input className="input" type="number" step="0.01" min="0" value={form.valor} onChange={e => s('valor', e.target.value)} placeholder="0,00" required/>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : editando ? 'Salvar' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}
