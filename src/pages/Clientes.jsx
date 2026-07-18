import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Users, Phone, Flower2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { daysSince } from '../lib/format'
import { useLocalStorage } from '../lib/useLocalStorage'
import ClientModal from '../components/ClientModal'
import ClientDrawer from '../components/ClientDrawer'
import EmptyState from '../components/EmptyState'
import { SkeletonList } from '../components/Skeleton'
import { useToast } from '../context/ToastContext'

const defaultFilters = { busca: '', essencia: 'todas', faixa: 'todas' }

export default function Clientes() {
  const toast = useToast()
  const [filters, setFilters] = useLocalStorage('clientes_filters', defaultFilters)
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [drawerCliente, setDrawerCliente] = useState(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('clientes').select('*').order('nome')
    if (error) {
      toast.error('Erro ao carregar clientes: ' + error.message)
    } else {
      setClientes(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const essencias = useMemo(() => {
    const set = new Set(clientes.map((c) => c.essencia_favorita).filter(Boolean))
    return Array.from(set).sort()
  }, [clientes])

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      if (filters.busca && !c.nome.toLowerCase().includes(filters.busca.toLowerCase())) return false
      if (filters.essencia !== 'todas' && c.essencia_favorita !== filters.essencia) return false
      if (filters.faixa !== 'todas') {
        const dias = daysSince(c.data_ultima_compra)
        if (dias === null) return false
        if (filters.faixa === 'menos30' && dias >= 30) return false
        if (filters.faixa === '30a60' && (dias < 30 || dias > 60)) return false
        if (filters.faixa === 'mais60' && dias <= 60) return false
      }
      return true
    })
  }, [clientes, filters])

  function updateFilter(patch) {
    setFilters((f) => ({ ...f, ...patch }))
  }

  function openNew() {
    setEditingClient(null)
    setModalOpen(true)
  }

  function openEdit(cliente) {
    setEditingClient(cliente)
    setModalOpen(true)
    setDrawerCliente(null)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Clientes</h1>
          <p className="text-sm text-slate-500">{clientes.length} clientes cadastrados</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto">
          <Plus size={16} /> Novo Cliente
        </button>
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
            <label className="label-field">Essência favorita</label>
            <select
              className="input-field"
              value={filters.essencia}
              onChange={(e) => updateFilter({ essencia: e.target.value })}
            >
              <option value="todas">Todas</option>
              {essencias.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Dias desde última compra</label>
            <select className="input-field" value={filters.faixa} onChange={(e) => updateFilter({ faixa: e.target.value })}>
              <option value="todas">Todos</option>
              <option value="menos30">Menos de 30 dias</option>
              <option value="30a60">30 a 60 dias</option>
              <option value="mais60">Mais de 60 dias</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonList count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum cliente encontrado" message="Ajuste os filtros ou cadastre um novo cliente." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const dias = daysSince(c.data_ultima_compra)
            const badge =
              dias === null
                ? { label: 'Sem compras', cls: 'bg-slate-700 text-slate-300' }
                : dias < 30
                  ? { label: `${dias}d`, cls: 'bg-entrada/15 text-entrada' }
                  : dias <= 60
                    ? { label: `${dias}d`, cls: 'bg-accent/15 text-accent-light' }
                    : { label: `${dias}d`, cls: 'bg-saida/15 text-saida' }

            return (
              <button
                key={c.id}
                onClick={() => setDrawerCliente(c)}
                className="card p-4 text-left hover:bg-card-hover transition-colors space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-100 truncate">{c.nome}</p>
                  <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 shrink-0 ${badge.cls}`}>{badge.label}</span>
                </div>
                {c.telefone && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Phone size={13} /> {c.telefone}
                  </p>
                )}
                {c.essencia_favorita && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Flower2 size={13} /> {c.essencia_favorita}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  {dias === null ? 'Nenhuma compra registrada' : `Última compra: ${dias} dias atrás`}
                </p>
              </button>
            )
          })}
        </div>
      )}

      <ClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        editingClient={editingClient}
      />

      <ClientDrawer
        open={!!drawerCliente}
        onClose={() => setDrawerCliente(null)}
        cliente={drawerCliente}
        onEdit={openEdit}
      />
    </div>
  )
}
