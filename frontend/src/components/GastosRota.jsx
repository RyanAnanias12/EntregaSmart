import { useState, useEffect } from 'react'
import { fetchGastos, criarGasto, editarGasto, deletarGasto, fmtBRL, CATEGORIAS_GASTO } from '../lib/api'

const EMPTY_FORM = { categoria: 'pedagio', descricao: '', valor: '' }

export default function GastosRota({ rotaId, onGastoChange }) {
  const [gastos,   setGastos]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)
  const [editando, setEditando] = useState(null)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)

  const s = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function load() {
    setLoading(true)
    try {
      const lista = await fetchGastos(rotaId)
      setGastos(lista)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [rotaId])

  function openAdd() { setEditando(null); setForm(EMPTY_FORM); setShowAdd(true) }
  function openEdit(g) {
    setEditando(g)
    setForm({ categoria: g.categoria, descricao: g.descricao || '', valor: g.valor })
    setShowAdd(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editando) {
        await editarGasto(editando.id, form)
      } else {
        await criarGasto(rotaId, form)
      }
      setShowAdd(false); setEditando(null)
      await load()
      onGastoChange?.()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Remover este gasto?')) return
    try {
      await deletarGasto(id)
      await load()
      onGastoChange?.()
    } catch (e) { alert(e.message) }
  }

  const total = gastos.reduce((acc, g) => acc + parseFloat(g.valor), 0)
  const catInfo = v => CATEGORIAS_GASTO.find(c => c.v === v) || CATEGORIAS_GASTO[6]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--t3)' }}>
          Gastos extras {total > 0 && <span style={{ color: 'var(--re)', fontFamily: 'var(--fm)' }}>− {fmtBRL(total)}</span>}
        </p>
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={openAdd}>+ Adicionar</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><div className="spinner"/></div>
      ) : gastos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--t3)', fontSize: 12 }}>
          Nenhum gasto extra registrado
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {gastos.map(g => {
            const cat = catInfo(g.categoria)
            return (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--s2)', borderRadius: 8, padding: '9px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{cat.l.split(' ')[0]}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--t)' }}>{cat.l.split(' ').slice(1).join(' ')}</p>
                    {g.descricao && <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{g.descricao}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--re)' }}>− {fmtBRL(g.valor)}</span>
                  <button className="btn-icon" style={{ padding: '4px 6px', fontSize: 11 }} onClick={() => openEdit(g)}>✏️</button>
                  <button className="btn-icon" style={{ padding: '4px 6px', fontSize: 11, color: 'var(--re)', borderColor: 'rgba(239,68,68,.2)' }} onClick={() => handleDelete(g.id)}>🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* FORM INLINE */}
      {showAdd && (
        <form onSubmit={handleSave} style={{ marginTop: 10, background: 'var(--s2)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--b2)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 10 }}>
            {editando ? 'Editar gasto' : 'Novo gasto'}
          </p>
          <div className="grid2" style={{ marginBottom: 8 }}>
            <div className="field">
              <label className="field-label">Categoria</label>
              <select className="select" value={form.categoria} onChange={e => s('categoria', e.target.value)}>
                {CATEGORIAS_GASTO.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Valor (R$)</label>
              <input className="input" type="number" step="0.01" min="0.01" value={form.valor} onChange={e => s('valor', e.target.value)} placeholder="0,00" required/>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label className="field-label">Descrição (opcional)</label>
            <input className="input" value={form.descricao} onChange={e => s('descricao', e.target.value)} placeholder="Ex: Rodovia dos Bandeirantes"/>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Salvando...' : editando ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
