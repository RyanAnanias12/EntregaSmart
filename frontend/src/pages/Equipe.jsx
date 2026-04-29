import { useState, useEffect } from 'react'
import { fetchUsuarios, criarUsuario, editarUsuario, deletarUsuario, iniciais } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Toast } from '../components/Toast'

export default function Equipe() {
  const { user } = useAuth()
  const [membros, setMembros] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form,    setForm]    = useState({ nome: '', email: '', senha: '', papel: 'membro' })
  const notify = (msg, type = 'success') => setToast({ msg, type })
  const s = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function load() {
    setLoading(true)
    try { setMembros(await fetchUsuarios()) }
    catch(e) {
      // Não mostra erro genérico — pode ser plano Free sem permissão
      if (!e.message?.includes('403')) notify('Erro ao carregar', 'error')
    }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e) {
    e.preventDefault()
    try {
      await criarUsuario(form)
      notify('Membro adicionado! Um email de boas-vindas foi enviado.')
      setShowAdd(false)
      setForm({ nome: '', email: '', senha: '', papel: 'membro' })
      load()
    } catch (e) { notify(e.message, 'error') }
  }

  async function toggleAtivo(m) {
    try {
      await editarUsuario(m.id, { ativo: !m.ativo })
      notify(m.ativo ? 'Membro desativado' : 'Membro reativado')
      load()
    } catch (e) { notify(e.message, 'error') }
  }

  async function handleDelete(id) {
    if (!confirm('Remover este membro permanentemente?')) return
    try { await deletarUsuario(id); notify('Membro removido'); load() }
    catch (e) { notify(e.message, 'error') }
  }

  const { tenant } = useAuth()
  const isAdmin = user?.papel === 'admin'
  const isPro   = tenant?.plano === 'pro'

  return (
    <div style={{ padding: '28px 0 60px' }}>
      <div className="container">
        <div className="pg-header">
          <div>
            <h1 className="pg-title">Equipe</h1>
            <p className="pg-sub">Gerencie os membros da equipe</p>
          </div>
          {isAdmin && isPro && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Adicionar membro</button>}
        </div>

        {!isPro && (
          <div style={{ marginBottom:16, padding:'20px 24px', background:'var(--s1)', border:'1px solid rgba(249,115,22,.2)', borderRadius:'var(--r)', textAlign:'center' }}>
            <p style={{ fontSize:20, marginBottom:8 }}>👥</p>
            <p style={{ fontFamily:'var(--ff)', fontSize:15, fontWeight:700, marginBottom:6 }}>Equipe disponível no plano Pro</p>
            <p style={{ fontSize:13, color:'var(--t2)', marginBottom:16 }}>Adicione até 5 membros, copiloto e rateio automático 60/40</p>
            <a href="/precos" className="btn btn-primary" style={{ fontSize:13 }}>Ver plano Pro — R$ 14,90/mês →</a>
          </div>
        )}

        <div className="card">
          {loading ? (
            <div className="empty"><div className="spinner" style={{ margin: '0 auto' }}/></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Membro</th><th>Email</th><th>Papel</th><th>Status</th>{isAdmin && <th></th>}</tr></thead>
                <tbody>
                  {membros.map(m => (
                    <tr key={m.id} style={{ cursor: 'default' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar sm" style={{ opacity: m.ativo ? 1 : 0.4 }}>{iniciais(m.nome)}</div>
                          <span style={{ color: 'var(--t)', fontWeight: 500 }}>{m.nome}</span>
                          {m.id === user?.id && <span className="badge badge-orange" style={{ fontSize: 10 }}>você</span>}
                        </div>
                      </td>
                      <td>{m.email}</td>
                      <td><span className={`badge ${m.papel === 'admin' ? 'badge-orange' : 'badge-gray'}`}>{m.papel}</span></td>
                      <td><span className={`badge ${m.ativo ? 'badge-green' : 'badge-red'}`}>{m.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      {isAdmin && (
                        <td>
                          {m.id !== user?.id && (
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button className="btn-icon" style={{ fontSize: 12 }} onClick={() => toggleAtivo(m)} title={m.ativo ? 'Desativar' : 'Reativar'}>
                                {m.ativo ? '🔴' : '🟢'}
                              </button>
                              <button className="btn-icon" style={{ color: 'var(--re)', borderColor: 'rgba(239,68,68,.2)', fontSize: 12 }} onClick={() => handleDelete(m.id)}>🗑️</button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title">+ Adicionar membro</h2>
              <button className="btn-icon" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body">
                <div className="field"><label className="field-label">Nome</label><input className="input" value={form.nome} onChange={e => s('nome', e.target.value)} placeholder="Ex: William" required/></div>
                <div className="field"><label className="field-label">Email</label><input className="input" type="email" value={form.email} onChange={e => s('email', e.target.value)} placeholder="membro@email.com" required/></div>
                <div className="field"><label className="field-label">Senha inicial</label><input className="input" type="password" value={form.senha} onChange={e => s('senha', e.target.value)} placeholder="Mínimo 6 caracteres" required/></div>
                <div className="field">
                  <label className="field-label">Papel</label>
                  <select className="select" value={form.papel} onChange={e => s('papel', e.target.value)}>
                    <option value="membro">Membro</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <p style={{ fontSize: 12, color: 'var(--t3)' }}>Um email de boas-vindas será enviado automaticamente.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}
