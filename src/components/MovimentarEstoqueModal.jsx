import { useEffect, useState } from 'react'
import { ArrowUpCircle, ArrowDownCircle, SlidersHorizontal } from 'lucide-react'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import { todayISO } from '../lib/format'
import { useToast } from '../context/ToastContext'

const TIPOS = [
  { value: 'entrada', label: 'Entrada', hint: 'Comprei mais', icon: ArrowUpCircle, color: 'entrada' },
  { value: 'saida', label: 'Saída', hint: 'Venda manual', icon: ArrowDownCircle, color: 'saida' },
  { value: 'ajuste', label: 'Ajuste', hint: 'Corrigi o estoque', icon: SlidersHorizontal, color: 'accent' },
]

export default function MovimentarEstoqueModal({ open, onClose, onSaved, produto }) {
  const toast = useToast()
  const [tipo, setTipo] = useState('entrada')
  const [quantidade, setQuantidade] = useState('')
  const [motivo, setMotivo] = useState('')
  const [data, setData] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTipo('entrada')
    setQuantidade('')
    setMotivo('')
    setData(todayISO())
  }, [open, produto])

  async function handleSubmit(e) {
    e.preventDefault()
    const qtd = Number(quantidade)
    if (!qtd || qtd <= 0) {
      toast.error('Informe uma quantidade válida.')
      return
    }

    let novaQuantidade = Number(produto.quantidade_atual)
    if (tipo === 'entrada') novaQuantidade += qtd
    else if (tipo === 'saida') novaQuantidade -= qtd
    else novaQuantidade = qtd

    if (novaQuantidade < 0) {
      toast.error('Essa saída deixaria o estoque negativo.')
      return
    }

    setSaving(true)
    const { error: movError } = await supabase.from('movimentacoes_estoque').insert({
      produto_id: produto.id,
      tipo,
      quantidade: qtd,
      motivo: motivo.trim() || null,
      data,
    })

    if (movError) {
      setSaving(false)
      toast.error('Erro ao registrar movimentação: ' + movError.message)
      return
    }

    const { error: prodError } = await supabase
      .from('produtos')
      .update({ quantidade_atual: novaQuantidade })
      .eq('id', produto.id)
    setSaving(false)

    if (prodError) {
      toast.error('Erro ao atualizar estoque: ' + prodError.message)
      return
    }

    toast.success('Estoque atualizado!')
    onSaved?.()
    onClose()
  }

  if (!produto) return null

  return (
    <Modal open={open} onClose={onClose} title={`Movimentar — ${produto.nome}`} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500">
          Estoque atual: <span className="font-semibold text-slate-300">{produto.quantidade_atual} {produto.unidade}</span>
        </p>

        <div className="grid grid-cols-3 gap-2">
          {TIPOS.map((t) => {
            const toneClasses = {
              entrada: 'border-entrada bg-entrada/10 text-entrada',
              saida: 'border-saida bg-saida/10 text-saida',
              accent: 'border-accent bg-accent/10 text-accent-light',
            }
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                  tipo === t.value ? toneClasses[t.color] : 'border-border text-slate-500 hover:border-slate-600'
                }`}
              >
                <t.icon size={18} />
                {t.label}
                <span className="text-[10px] font-normal text-slate-500">{t.hint}</span>
              </button>
            )
          })}
        </div>

        <div>
          <label className="label-field">{tipo === 'ajuste' ? 'Nova quantidade' : 'Quantidade'}</label>
          <input
            type="number"
            step="0.01"
            className="input-field"
            placeholder="0"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </div>

        <div>
          <label className="label-field">Motivo</label>
          <input
            className="input-field"
            placeholder="Ex: Compra de fornecedor, perda, contagem física..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        <div>
          <label className="label-field">Data</label>
          <input type="date" className="input-field" value={data} onChange={(e) => setData(e.target.value)} />
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
