import { useEffect, useState } from 'react'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import { maskCurrencyDisplay, parseCurrencyInput } from '../lib/format'
import { useToast } from '../context/ToastContext'

const CATEGORIAS = ['Essência', 'Aromatizador', 'Kit', 'Embalagem', 'Outros']
const UNIDADES = ['unidade', 'ml', 'g', 'kit']

const emptyForm = {
  nome: '',
  descricao: '',
  categoria: CATEGORIAS[0],
  unidade: UNIDADES[0],
  quantidade_atual: '0',
  quantidade_minima: '5',
  custoDigits: '',
  vendaDigits: '',
  ativo: true,
}

export default function ProdutoModal({ open, onClose, onSaved, editingProduto }) {
  const toast = useToast()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editingProduto) {
      setForm({
        nome: editingProduto.nome || '',
        descricao: editingProduto.descricao || '',
        categoria: editingProduto.categoria || CATEGORIAS[0],
        unidade: editingProduto.unidade || UNIDADES[0],
        quantidade_atual: String(editingProduto.quantidade_atual ?? 0),
        quantidade_minima: String(editingProduto.quantidade_minima ?? 5),
        custoDigits: String(Math.round(Number(editingProduto.preco_custo || 0) * 100)),
        vendaDigits: String(Math.round(Number(editingProduto.preco_venda || 0) * 100)),
        ativo: editingProduto.ativo ?? true,
      })
    } else {
      setForm(emptyForm)
    }
  }, [open, editingProduto])

  const precoCusto = parseCurrencyInput(form.custoDigits)
  const precoVenda = parseCurrencyInput(form.vendaDigits)
  const margem = precoVenda > 0 ? ((precoVenda - precoCusto) / precoVenda) * 100 : 0

  function handlePriceChange(field) {
    return (e) => {
      const digits = e.target.value.replace(/\D/g, '')
      setForm((f) => ({ ...f, [field]: digits }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) {
      toast.error('O nome é obrigatório.')
      return
    }

    setSaving(true)
    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      categoria: form.categoria,
      unidade: form.unidade,
      quantidade_atual: Number(form.quantidade_atual) || 0,
      quantidade_minima: Number(form.quantidade_minima) || 0,
      preco_custo: precoCusto,
      preco_venda: precoVenda,
      ativo: form.ativo,
    }

    let error
    if (editingProduto) {
      ;({ error } = await supabase.from('produtos').update(payload).eq('id', editingProduto.id))
    } else {
      ;({ error } = await supabase.from('produtos').insert(payload))
    }
    setSaving(false)

    if (error) {
      toast.error('Erro ao salvar produto: ' + error.message)
      return
    }

    toast.success(editingProduto ? 'Produto atualizado!' : 'Produto cadastrado!')
    onSaved?.()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editingProduto ? 'Editar produto' : 'Novo produto'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-field">Nome *</label>
          <input
            className="input-field"
            placeholder="Ex: Difusor de bambu 200ml"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          />
        </div>

        <div>
          <label className="label-field">Descrição</label>
          <textarea
            className="input-field resize-none"
            rows={2}
            placeholder="Detalhes do produto"
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-field">Categoria</label>
            <select
              className="input-field"
              value={form.categoria}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Unidade</label>
            <select
              className="input-field"
              value={form.unidade}
              onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
            >
              {UNIDADES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-field">Quantidade atual</label>
            <input
              type="number"
              step="0.01"
              className="input-field"
              value={form.quantidade_atual}
              onChange={(e) => setForm((f) => ({ ...f, quantidade_atual: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-field">Quantidade mínima</label>
            <input
              type="number"
              step="0.01"
              className="input-field"
              value={form.quantidade_minima}
              onChange={(e) => setForm((f) => ({ ...f, quantidade_minima: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-field">Preço de custo</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">R$</span>
              <input
                inputMode="numeric"
                className="input-field pl-9"
                placeholder="0,00"
                value={maskCurrencyDisplay(precoCusto)}
                onChange={handlePriceChange('custoDigits')}
              />
            </div>
          </div>
          <div>
            <label className="label-field">Preço de venda</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">R$</span>
              <input
                inputMode="numeric"
                className="input-field pl-9"
                placeholder="0,00"
                value={maskCurrencyDisplay(precoVenda)}
                onChange={handlePriceChange('vendaDigits')}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-slate-800/60 px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Margem de lucro</span>
          <span className={`text-lg font-bold ${margem >= 0 ? 'text-entrada' : 'text-saida'}`}>{margem.toFixed(1)}%</span>
        </div>

        {editingProduto && (
          <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              className="w-4 h-4 rounded accent-primary"
            />
            Produto ativo (desmarque para arquivar sem excluir)
          </label>
        )}

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

export { CATEGORIAS, UNIDADES }
