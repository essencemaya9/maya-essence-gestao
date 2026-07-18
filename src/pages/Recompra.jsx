import { useEffect, useMemo, useState } from 'react'
import { Search, RefreshCw, Phone, Flower2, MessageCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { daysSince, formatDateBR, phoneToWhatsAppLink } from '../lib/format'
import { useLocalStorage } from '../lib/useLocalStorage'
import { isPendenteRecompra, faixaRecompra } from '../lib/recompra'
import { useRecompraBadge } from '../context/RecompraContext'
import EmptyState from '../components/EmptyState'
import { SkeletonList } from '../components/Skeleton'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../context/ToastContext'
import { todayISO } from '../lib/format'

const defaultFilters = { busca: '', ordenacao: 'mais_antigo', faixa: 'todas' }

export default function Recompra() {
  const toast = useToast()
  const { refreshCount } = useRecompraBadge()
  const [filters, setFilters] = useLocalStorage('recompra_filters', defaultFilters)
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [confirming, setConfirming] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('clientes').select('*')
    if (error) {
      toast.error('Erro ao carregar clientes para recompra: ' + error.message)
      setClientes([])
    } else {
      setClientes((data || []).filter(isPendenteRecompra))
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateFilter(patch) {
    setFilters((f) => ({ ...f, ...patch }))
  }

  const filtered = useMemo(() => {
    let list = clientes.filter((c) => (filters.busca ? c.nome.toLowerCase().includes(filters.busca.toLowerCase()) : true))

    if (filters.faixa !== 'todas') {
      list = list.filter((c) => faixaRecompra(daysSince(c.data_ultima_compra)) === filters.faixa)
    }

    list = [...list].sort((a, b) => {
      if (filters.ordenacao === 'alfabetica') return a.nome.localeCompare(b.nome, 'pt-BR')
      const da = daysSince(a.data_ultima_compra)
      const db = daysSince(b.data_ultima_compra)
      return filters.ordenacao === 'mais_antigo' ? db - da : da - db
    })

    return list
  }, [clientes, filters])

  async function handleConfirmContato() {
    if (!confirmTarget) return
    setConfirming(true)
    const hoje = todayISO()

    const { error: insertError } = await supabase
      .from('contatos_recompra')
      .insert({ cliente_id: confirmTarget.id, data_contato: hoje })

    if (insertError) {
      toast.error('Erro ao registrar contato: ' + insertError.message)
      setConfirming(false)
      return
    }

    const { error: updateError } = await supabase
      .from('clientes')
      .update({ data_ultimo_contato: hoje })
      .eq('id', confirmTarget.id)

    setConfirming(false)

    if (updateError) {
      toast.error('Erro ao atualizar cliente: ' + updateError.message)
      return
    }

    toast.success(`Contato com ${confirmTarget.nome} registrado com sucesso!`)
    setClientes((prev) => prev.filter((c) => c.id !== confirmTarget.id))
    setConfirmTarget(null)
    refreshCount()
  }

  function whatsappLink(cliente) {
    const msg = `Oi ${cliente.nome}! Tudo bem? Aqui é a Maya Essence 🌸 Já faz um tempinho desde sua última compra. Temos novidades incríveis em essências! Posso te mostrar?`
    return phoneToWhatsAppLink(cliente.telefone, msg)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <RefreshCw size={20} className="text-primary-light" /> Recompra
        </h1>
        <p className="text-sm text-slate-500">{clientes.length} clientes prontos para contato</p>
      </div>

      <div className="card p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input-field pl-10"
            placeholder="Buscar por nome..."
            value={filters.busca}
            onChange={(e) => updateFilter({ busca: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label-field">Ordenação</label>
            <select className="input-field" value={filters.ordenacao} onChange={(e) => updateFilter({ ordenacao: e.target.value })}>
              <option value="mais_antigo">Mais antigo primeiro</option>
              <option value="mais_recente">Mais recente primeiro</option>
              <option value="alfabetica">Ordem alfabética</option>
            </select>
          </div>
          <div>
            <label className="label-field">Faixa</label>
            <select className="input-field" value={filters.faixa} onChange={(e) => updateFilter({ faixa: e.target.value })}>
              <option value="todas">Todas</option>
              <option value="30-45">30 - 45 dias</option>
              <option value="45-60">45 - 60 dias</option>
              <option value="60-90">60 - 90 dias</option>
              <option value="90+">Mais de 90 dias</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonList count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Tudo em dia!"
          message="Nenhum cliente pendente de recompra no momento."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((c) => {
            const dias = daysSince(c.data_ultima_compra)
            return (
              <div key={c.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-100">{c.nome}</p>
                  <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-saida/15 text-saida shrink-0">
                    {dias}d
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Comprou há {dias} dias · {formatDateBR(c.data_ultima_compra)}
                </p>
                {c.essencia_favorita && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Flower2 size={13} /> {c.essencia_favorita}
                  </p>
                )}
                {c.telefone && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Phone size={13} /> {c.telefone}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <a
                    href={whatsappLink(c)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl px-3 py-2.5 transition-colors"
                  >
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                  <button
                    onClick={() => setConfirmTarget(c)}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-xl px-3 py-2.5 transition-colors"
                  >
                    <CheckCircle2 size={16} /> Contatei
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirmContato}
        loading={confirming}
        title="Confirmar contato"
        message={`Confirmar que você enviou mensagem para ${confirmTarget?.nome}?`}
        confirmLabel="Confirmar"
      />
    </div>
  )
}
