import { useEffect, useState } from 'react'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import { maskPhone } from '../lib/format'
import { useToast } from '../context/ToastContext'

const emptyForm = {
  nome: '',
  telefone: '',
  email: '',
  essencia_favorita: '',
  observacoes: '',
  data_ultima_compra: '',
}

export default function ClientModal({ open, onClose, onSaved, editingClient }) {
  const toast = useToast()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editingClient) {
      setForm({
        nome: editingClient.nome || '',
        telefone: editingClient.telefone || '',
        email: editingClient.email || '',
        essencia_favorita: editingClient.essencia_favorita || '',
        observacoes: editingClient.observacoes || '',
        data_ultima_compra: editingClient.data_ultima_compra || '',
      })
    } else {
      setForm(emptyForm)
    }
  }, [open, editingClient])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) {
      toast.error('O nome é obrigatório.')
      return
    }

    setSaving(true)
    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone || null,
      email: form.email.trim() || null,
      essencia_favorita: form.essencia_favorita.trim() || null,
      observacoes: form.observacoes.trim() || null,
      data_ultima_compra: form.data_ultima_compra || null,
    }

    let error
    if (editingClient) {
      ;({ error } = await supabase.from('clientes').update(payload).eq('id', editingClient.id))
    } else {
      ;({ error } = await supabase.from('clientes').insert(payload))
    }
    setSaving(false)

    if (error) {
      toast.error('Erro ao salvar cliente: ' + error.message)
      return
    }

    toast.success(editingClient ? 'Cliente atualizado!' : 'Cliente cadastrado!')
    onSaved?.()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editingClient ? 'Editar cliente' : 'Novo cliente'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-field">Nome *</label>
          <input
            className="input-field"
            placeholder="Nome completo"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          />
        </div>

        <div>
          <label className="label-field">Telefone</label>
          <input
            className="input-field"
            placeholder="(99) 99999-9999"
            value={form.telefone}
            onChange={(e) => setForm((f) => ({ ...f, telefone: maskPhone(e.target.value) }))}
          />
        </div>

        <div>
          <label className="label-field">Email</label>
          <input
            type="email"
            className="input-field"
            placeholder="email@exemplo.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>

        <div>
          <label className="label-field">Essência favorita</label>
          <input
            className="input-field"
            placeholder="Ex: Lavanda"
            value={form.essencia_favorita}
            onChange={(e) => setForm((f) => ({ ...f, essencia_favorita: e.target.value }))}
          />
        </div>

        <div>
          <label className="label-field">Observações</label>
          <textarea
            className="input-field resize-none"
            rows={3}
            placeholder="Notas sobre o cliente"
            value={form.observacoes}
            onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
          />
        </div>

        <div>
          <label className="label-field">Data da última compra</label>
          <input
            type="date"
            className="input-field"
            value={form.data_ultima_compra}
            onChange={(e) => setForm((f) => ({ ...f, data_ultima_compra: e.target.value }))}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
