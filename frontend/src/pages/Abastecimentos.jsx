import { useState, useEffect } from 'react'
import { fetchAbastecimentos, fetchAbastecimentosStats, criarAbastecimento, editarAbastecimento, deletarAbastecimento, fetchVeiculos, fmtBRL } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Toast } from '../components/Toast'

const COMBS = [{ v: 'gasolina', l: 'Gasolina' }, { v: 'alcool', l: 'Álcool' }, { v: 'diesel', l: 'Diesel' }, { v: 'eletrico', l: 'Elétrico' }]
const EMPTY = { veiculo_id: '', data: new Date().toISOString().slice(0,10), litros: '', valor_total: '', km_momento: '', combustivel: 'gasolina', posto: '', observacoes: '' }

function fmtData(d) {
  if (!d) return '—'
  return new Date(d.slice(0,10) + 'T12:00:00').toLocaleDateString('pt-BR')
}

export default function Abastecimentos() {
  const { tenant } = useAuth()
  const isPaid = ['solo','pro'].includes(tenant?.plano)
  const [lista,    setLista]    = useState([])
  const [stats,    setStats]    = useState(null)
  const [veiculos, setVeiculos] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form,     setForm]     = useState(EMPTY)
  const [toast,    setToast]    = useState(null)

  const notify = (msg, type='success') => setToast({ msg, type })
  const s = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function load() {
    setLoading(true)
    try {
      const [l, st] = await Promise.all([fetchAbastecimentos(), fetchAbastecimentosStats()])
      setLista(l); setStats(st)
    } catch { notify('Erro ao carregar', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (isPaid) {
      load()
      fetchVeiculos().then(setVeiculos).catch(() => {})
    } else {
      setLoading(false)
    }
  }, [isPaid])

  function openAdd()   { setEditando(null); setForm(EMPTY); setShowForm(true) }
  function openEdit(a) {
    setEditando(a)
    setForm({ veiculo_id: a.veiculo_id||'', data: a.data?.slice(0,10)||'', litros: a.litros, valor_total: a.valor_total, km_momento: a.km_momento||'', combustivel: a.combustivel, posto: a.posto||'', observacoes: a.observacoes||'' })
    setShowForm(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editando) { await editarAbastecimento(editando.id, form); notify('Atualizado!') }
      else          { await criarAbastecimento(form);                notify('Abastecimento registrado!') }
      setShowForm(false); load()
    } catch (err) { notify(err.message, 'error') }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Remover este abastecimento?')) return
    try { await deletarAbastecimento(id); notify('Removido'); load() }
    catch (err) { notify(err.message, 'error') }
  }

  const precoPorLitro = (a) => {
    const l = parseFloat(a.litros), v = parseFloat(a.valor_total)
    if (!l) return '—'
    return fmtBRL(v / l) + '/L'
  }

  if (!isPaid) return (
    <div style={{ padding: '28px 0 60px' }}>
      <div className="container">
        <div className="pg-header"><div><h1 className="pg-title">Abastecimentos</h1></div></div>
        <div className="card"><div className="empty">
          <div className="empty-icon">⛽</div>
          <p className="empty-title">Disponível nos planos Solo e Pro</p>
          <p className="empty-sub">Registre abastecimentos e compare o custo real com a estimativa das rotas.</p>
          <a href="/precos" className="btn btn-primary" style={{ marginTop: 16, display:'inline-flex' }}>Ver planos →</a>
        </div></div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '28px 0 60px' }}>
      <div className="container">
        <div className="pg-header">
          <div>
            <h1 className="pg-title">Abastecimentos</h1>
            <p className="pg-sub">{lista.length} registro{lista.length !== 1 ? 's' : ''}</p>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>+ Registrar</button>
        </div>

        {/* STATS */}
        {stats && (
          <div className="grid4" style={{ marginBottom: 16 }}>
            <div className="metric">
              <p className="metric-label">Gasto real</p>
              <p className="metric-value orange">{fmtBRL(stats.total_gasto)}</p>
              <p className="metric-sub">no período</p>
            </div>
            <div className="metric">
              <p className="metric-label">Litros abastecidos</p>
              <p className="metric-value">{Number(stats.total_litros).toFixed(1)} L</p>
              <p className="metric-sub">{stats.total_abast} abastecimentos</p>
            </div>
            <div className="metric">
              <p className="metric-label">Preço médio/litro</p>
              <p className="metric-value yellow">{fmtBRL(stats.preco_medio_litro)}</p>
              <p className="metric-sub">média do período</p>
            </div>
            <div className="metric">
              <p className="metric-label">
                {stats.diferenca >= 0 ? 'Gasto a mais' : 'Economia'}
              </p>
              <p className="metric-value" style={{ color: stats.diferenca > 0 ? 'var(--re)' : 'var(--gr2)' }}>
                {fmtBRL(Math.abs(stats.diferenca))}
              </p>
              <p className="metric-sub">vs estimativa das rotas</p>
            </div>
          </div>
        )}

        {/* DIFERENÇA DESTAQUE */}
        {stats && Math.abs(stats.diferenca) > 1 && (
          <div style={{ marginBottom: 14, padding: '12px 18px', background: stats.diferenca > 0 ? 'var(--rd)' : 'var(--gd)', border: `1px solid ${stats.diferenca > 0 ? 'rgba(239,68,68,.2)' : 'rgba(16,185,129,.2)'}`, borderRadius: 'var(--r)', fontSize: 13, color: stats.diferenca > 0 ? 'var(--re)' : 'var(--gr2)' }}>
            {stats.diferenca > 0
              ? `⚠️ Você gastou ${fmtBRL(stats.diferenca)} a mais com combustível do que a estimativa das rotas indica. Considere revisar o consumo médio dos seus veículos.`
              : `✅ Você gastou ${fmtBRL(Math.abs(stats.diferenca))} a menos com combustível do que a estimativa. Seus veículos estão performando melhor que o esperado.`
            }
          </div>
        )}

        {/* LISTA */}
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}><div className="spinner"/></div>
        ) : lista.length === 0 ? (
          <div className="card"><div className="empty">
            <div className="empty-icon">⛽</div>
            <p className="empty-title">Nenhum abastecimento registrado</p>
            <p className="empty-sub">Registre seus abastecimentos para comparar o custo real com as estimativas</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>+ Registrar primeiro</button>
          </div></div>
        ) : (
          <div className="card table-desktop">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Data</th><th>Veículo</th><th>Combustível</th><th>Litros</th><th>Valor total</th><th>R$/litro</th><th>KM</th><th>Posto</th><th></th></tr>
                </thead>
                <tbody>
                  {lista.map(a => (
                    <tr key={a.id}>
                      <td className="hl">{fmtData(a.data)}</td>
                      <td>{a.veiculo_nome || '—'}</td>
                      <td><span className="badge badge-gray">{COMBS.find(c=>c.v===a.combustivel)?.l || a.combustivel}</span></td>
                      <td>{Number(a.litros).toFixed(1)} L</td>
                      <td style={{ color:'var(--or)', fontFamily:'var(--fm)' }}>{fmtBRL(a.valor_total)}</td>
                      <td style={{ color:'var(--ye)', fontSize:12 }}>{precoPorLitro(a)}</td>
                      <td style={{ fontSize:12, color:'var(--t3)' }}>{a.km_momento > 0 ? Number(a.km_momento).toLocaleString('pt-BR') + ' km' : '—'}</td>
                      <td style={{ fontSize:12, color:'var(--t3)' }}>{a.posto || '—'}</td>
                      <td>
                        <div style={{ display:'flex', gap:5 }}>
                          <button className="btn-icon" onClick={() => openEdit(a)}>✏️</button>
                          <button className="btn-icon" style={{ color:'var(--re)', borderColor:'rgba(239,68,68,.2)' }} onClick={() => handleDelete(a.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MOBILE */}
        {!loading && lista.map(a => (
          <div key={a.id} className="rota-mobile">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                <span className="badge badge-gray">{COMBS.find(c=>c.v===a.combustivel)?.l}</span>
                {a.veiculo_nome && <span className="badge badge-orange">{a.veiculo_nome}</span>}
              </div>
              <span style={{ fontFamily:'var(--fm)', color:'var(--or)', fontWeight:700 }}>{fmtBRL(a.valor_total)}</span>
            </div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:12, color:'var(--t2)', marginBottom:10 }}>
              <span>📅 {fmtData(a.data)}</span>
              <span>⛽ {Number(a.litros).toFixed(1)} L</span>
              <span style={{ color:'var(--ye)' }}>{precoPorLitro(a)}</span>
              {a.km_momento > 0 && <span>🛣️ {Number(a.km_momento).toLocaleString('pt-BR')} km</span>}
              {a.posto && <span>📍 {a.posto}</span>}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>✏️ Editar</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a.id)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL FORM */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ maxWidth:460 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editando ? '✏️ Editar abastecimento' : '⛽ Novo abastecimento'}</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="grid2">
                  <div className="field">
                    <label className="field-label">Data</label>
                    <input className="input" type="date" value={form.data} onChange={e=>s('data',e.target.value)} required/>
                  </div>
                  <div className="field">
                    <label className="field-label">Combustível</label>
                    <select className="select" value={form.combustivel} onChange={e=>s('combustivel',e.target.value)}>
                      {COMBS.map(c=><option key={c.v} value={c.v}>{c.l}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid2">
                  <div className="field">
                    <label className="field-label">Litros abastecidos</label>
                    <input className="input" type="number" step="0.001" min="0.1" placeholder="Ex: 30.5" value={form.litros} onChange={e=>s('litros',e.target.value)} required/>
                  </div>
                  <div className="field">
                    <label className="field-label">Valor total (R$)</label>
                    <input className="input" type="number" step="0.01" min="0.01" placeholder="Ex: 180,00" value={form.valor_total} onChange={e=>s('valor_total',e.target.value)} required/>
                  </div>
                </div>
                {form.litros > 0 && form.valor_total > 0 && (
                  <div style={{ background:'var(--s2)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'var(--t2)', marginBottom:4 }}>
                    Preço por litro: <strong style={{ color:'var(--ye)' }}>{fmtBRL(form.valor_total / form.litros)}</strong>
                  </div>
                )}
                <div className="grid2">
                  <div className="field">
                    <label className="field-label">Veículo (opcional)</label>
                    <select className="select" value={form.veiculo_id} onChange={e=>s('veiculo_id',e.target.value)}>
                      <option value="">Sem veículo</option>
                      {veiculos.map(v=><option key={v.id} value={v.id}>{v.nome}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">KM no momento (opcional)</label>
                    <input className="input" type="number" min="0" placeholder="Ex: 87500" value={form.km_momento} onChange={e=>s('km_momento',e.target.value)}/>
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Posto (opcional)</label>
                  <input className="input" placeholder="Ex: Shell Av. Paulista" value={form.posto} onChange={e=>s('posto',e.target.value)}/>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : editando ? 'Salvar' : 'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  )
}
