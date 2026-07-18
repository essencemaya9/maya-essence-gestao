import { useEffect, useState } from 'react'
import { Phone, Mail, Flower2, StickyNote, ShoppingBag, MessageCircle, Pencil } from 'lucide-react'
import Drawer from './Drawer'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDateBR, daysSince } from '../lib/format'
import { SkeletonRow } from './Skeleton'

export default function ClientDrawer({ open, onClose, cliente, onEdit }) {
  const [compras, setCompras] = useState([])
  const [contatos, setContatos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open || !cliente) return
    let active = true
    async function load() {
      setLoading(true)
      const [{ data: comprasData }, { data: contatosData }] = await Promise.all([
        supabase
          .from('transacoes')
          .select('id, valor, descricao, data')
          .eq('cliente_id', cliente.id)
          .eq('tipo', 'entrada')
          .order('data', { ascending: false }),
        supabase
          .from('contatos_recompra')
          .select('id, data_contato')
          .eq('cliente_id', cliente.id)
          .order('data_contato', { ascending: false }),
      ])
      if (!active) return
      setCompras(comprasData || [])
      setContatos(contatosData || [])
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [open, cliente])

  if (!cliente) return null

  const dias = daysSince(cliente.data_ultima_compra)

  return (
    <Drawer open={open} onClose={onClose} title="Detalhes do cliente">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-100">{cliente.nome}</h3>
            {dias !== null && <p className="text-xs text-slate-500 mt-0.5">Última compra há {dias} dias</p>}
          </div>
          <button
            onClick={() => onEdit(cliente)}
            className="p-2 rounded-lg text-slate-400 hover:text-primary-light hover:bg-primary/10 transition-colors"
          >
            <Pencil size={16} />
          </button>
        </div>

        <div className="card p-4 space-y-3">
          {cliente.telefone && (
            <div className="flex items-center gap-2.5 text-sm text-slate-300">
              <Phone size={15} className="text-slate-500 shrink-0" /> {cliente.telefone}
            </div>
          )}
          {cliente.email && (
            <div className="flex items-center gap-2.5 text-sm text-slate-300">
              <Mail size={15} className="text-slate-500 shrink-0" /> {cliente.email}
            </div>
          )}
          {cliente.essencia_favorita && (
            <div className="flex items-center gap-2.5 text-sm text-slate-300">
              <Flower2 size={15} className="text-slate-500 shrink-0" /> {cliente.essencia_favorita}
            </div>
          )}
          {cliente.observacoes && (
            <div className="flex items-start gap-2.5 text-sm text-slate-300">
              <StickyNote size={15} className="text-slate-500 shrink-0 mt-0.5" /> {cliente.observacoes}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <ShoppingBag size={16} /> Histórico de compras
          </h4>
          {loading ? (
            <div className="space-y-2">
              <SkeletonRow />
            </div>
          ) : compras.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma compra registrada.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {compras.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm text-slate-300">{c.descricao || 'Compra'}</p>
                    <p className="text-xs text-slate-500">{formatDateBR(c.data)}</p>
                  </div>
                  <p className="text-sm font-semibold text-entrada">{formatCurrency(c.valor)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <MessageCircle size={16} /> Histórico de contatos
          </h4>
          {loading ? (
            <div className="space-y-2">
              <SkeletonRow />
            </div>
          ) : contatos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum contato registrado.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {contatos.map((c) => (
                <div key={c.id} className="py-2.5">
                  <p className="text-sm text-slate-300">Contato via WhatsApp</p>
                  <p className="text-xs text-slate-500">{formatDateBR(c.data_contato)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  )
}
