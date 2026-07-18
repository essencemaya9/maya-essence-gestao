import { useEffect, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import Modal from './Modal'
import SearchableSelect from './SearchableSelect'
import { supabase } from '../lib/supabase'
import { maskCurrencyDisplay, parseCurrencyInput, todayISO } from '../lib/format'
import { useToast } from '../context/ToastContext'

const emptyForm = {
  tipo: 'entrada',
  valorDigits: '',
  descricao: '',
  categoria_id: null,
  cliente_id: null,
  data: todayISO(),
}

export default function TransactionModal({ open, onClose, onSaved, editingTransaction }) {
  const toast = useToast()
  const [form, setForm] = useState(emptyForm)
  const [categorias, setCategorias] = useState([])
  const [clientes, setClientes] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    async function loadOptions() {
      const [{ data: cats }, { data: clis }] = await Promise.all([
        supabase.from('categorias').select('id, nome, tipo').order('nome'),
        supabase.from('clientes').select('id, nome').order('nome'),
      ])
      setCategorias(cats || [])
      setClientes(clis || [])
    }
    loadOptions()
  }, [open])

  useEffect(() => {
    if (!open) return
    if (editingTransaction) {
      setForm({
        tipo: editingTransaction.tipo,
        valorDigits: String(Math.round(Number(editingTransaction.valor) * 100)),
        descricao: editingTransaction.descricao || '',
        categoria_id: editingTransaction.categoria_id || null,
        cliente_id: editingTransaction.cliente_id || null,
        data: editingTransaction.data || todayISO(),
      })
    } else {
      setForm(emptyForm)
    }
  }, [open, editingTransaction])

  const valorNumerico = parseCurrencyInput(form.valorDigits)
  const categoriasFiltradas = categorias.filter((c) => c.tipo === form.tipo)

  function handleValorChange(e) {
    const digits = e.target.value.replace(/\D/g, '')
    setForm((f) => ({ ...f, valorDigits: digits }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (valorNumerico <= 0) {
      toast.error('Informe um valor válido.')
      return
    }
    if (!form.data) {
      toast.error('Informe a data.')
      return
    }

    setSaving(true)
    const payload = {
      tipo: form.tipo,
      valor: valorNumerico,
      descricao: form.descricao.trim() || null,
      categoria_id: form.categoria_id,
      cliente_id: form.cliente_id,
      data: form.data,
    }

    let error
    if (editingTransaction) {
      ;({ error } = await supabase.from('transacoes').update(payload).eq('id', editingTransaction.id))
    } else {
      ;({ error } = await supabase.from('transacoes').insert(payload))
    }
    setSaving(false)

    if (error) {
      toast.error('Erro ao salvar lançamento: ' + error.message)
      return
    }

    toast.success(editingTransaction ? 'Lançamento atualizado!' : 'Lançamento adicionado!')
    onSaved?.()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editingTransaction ? 'Editar lançamento' : 'Novo lançamento'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, tipo: 'entrada', categoria_id: null }))}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
              form.tipo === 'entrada'
                ? 'border-entrada bg-entrada/10 text-entrada'
                : 'border-border text-slate-500 hover:border-slate-600'
            }`}
          >
            <ArrowUpCircle size={18} /> Entrada
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, tipo: 'saida', categoria_id: null }))}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
              form.tipo === 'saida'
                ? 'border-saida bg-saida/10 text-saida'
                : 'border-border text-slate-500 hover:border-slate-600'
            }`}
          >
            <ArrowDownCircle size={18} /> Saída
          </button>
        </div>

        <div>
          <label className="label-field">Valor</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">R$</span>
            <input
              inputMode="numeric"
              className="input-field pl-9"
              placeholder="0,00"
              value={maskCurrencyDisplay(valorNumerico)}
              onChange={handleValorChange}
            />
          </div>
        </div>

        <div>
          <label className="label-field">Descrição</label>
          <input
            className="input-field"
            placeholder="Ex: Venda de difusor"
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          />
        </div>

        <div>
          <label className="label-field">Categoria</label>
          <SearchableSelect
            options={categoriasFiltradas.map((c) => ({ value: c.id, label: c.nome }))}
            value={form.categoria_id}
            onChange={(v) => setForm((f) => ({ ...f, categoria_id: v }))}
            placeholder="Selecionar categoria"
          />
        </div>

        <div>
          <label className="label-field">Cliente (opcional)</label>
          <SearchableSelect
            options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
            value={form.cliente_id}
            onChange={(v) => setForm((f) => ({ ...f, cliente_id: v }))}
            placeholder="Selecionar cliente"
          />
        </div>

        <div>
          <label className="label-field">Data</label>
          <input
            type="date"
            className="input-field"
            value={form.data}
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
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
