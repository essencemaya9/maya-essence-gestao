import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Receipt, Download, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDateBR } from '../lib/format'
import { useLocalStorage } from '../lib/useLocalStorage'
import { PERIOD_OPTIONS, getPeriodRange } from '../lib/periods'
import TransactionModal from '../components/TransactionModal'
import ConfirmDialog from '../components/ConfirmDialog'
import SearchableSelect from '../components/SearchableSelect'
import EmptyState from '../components/EmptyState'
import { SkeletonList } from '../components/Skeleton'
import { useToast } from '../context/ToastContext'

const PAGE_SIZE = 20

const defaultFilters = {
  tipo: 'todos',
  categoria_id: null,
  cliente_id: null,
  periodo: 'todos',
  custom: {},
  valorMin: '',
  valorMax: '',
}

export default function Lancamentos() {
  const toast = useToast()
  const [filters, setFilters] = useLocalStorage('lanc_filters', defaultFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [categorias, setCategorias] = useState([])
  const [clientes, setClientes] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    async function loadOptions() {
      const [{ data: cats }, { data: clis }] = await Promise.all([
        supabase.from('categorias').select('id, nome').order('nome'),
        supabase.from('clientes').select('id, nome').order('nome'),
      ])
      setCategorias(cats || [])
      setClientes(clis || [])
    }
    loadOptions()
  }, [])

  const buildQuery = useCallback(
    (from, to) => {
      let query = supabase
        .from('transacoes')
        .select('id, tipo, valor, descricao, data, categoria_id, cliente_id, categorias(nome), clientes(nome)')
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters.tipo !== 'todos') query = query.eq('tipo', filters.tipo)
      if (filters.categoria_id) query = query.eq('categoria_id', filters.categoria_id)
      if (filters.cliente_id) query = query.eq('cliente_id', filters.cliente_id)
      if (filters.valorMin) query = query.gte('valor', Number(filters.valorMin))
      if (filters.valorMax) query = query.lte('valor', Number(filters.valorMax))
      if (filters.periodo !== 'todos') {
        const range = getPeriodRange(filters.periodo, filters.custom)
        query = query.gte('data', range.start).lte('data', range.end)
      }
      return query
    },
    [filters],
  )

  const loadPage = useCallback(
    async (pageIndex, append) => {
      setLoading(true)
      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, error } = await buildQuery(from, to)
      if (error) {
        toast.error('Erro ao carregar lançamentos: ' + error.message)
        setLoading(false)
        return
      }
      setHasMore((data || []).length === PAGE_SIZE)
      setItems((prev) => (append ? [...prev, ...(data || [])] : data || []))
      setLoading(false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buildQuery],
  )

  useEffect(() => {
    setPage(0)
    loadPage(0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  function updateFilter(patch) {
    setFilters((f) => ({ ...f, ...patch }))
  }

  function openNew() {
    setEditingTransaction(null)
    setModalOpen(true)
  }

  function openEdit(t) {
    setEditingTransaction(t)
    setModalOpen(true)
  }

  function refresh() {
    setPage(0)
    loadPage(0, false)
  }

  function loadMore() {
    const next = page + 1
    setPage(next)
    loadPage(next, true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)

    const { data: movimentacoes, error: movError } = await supabase
      .from('movimentacoes_estoque')
      .select('id, produto_id, tipo, quantidade, produtos(quantidade_atual)')
      .eq('transacao_id', deleteTarget.id)

    if (movError) {
      setDeleting(false)
      toast.error('Erro ao verificar movimentações de estoque: ' + movError.message)
      return
    }

    for (const mov of movimentacoes || []) {
      if (mov.tipo === 'saida' || mov.tipo === 'entrada') {
        const atual = Number(mov.produtos?.quantidade_atual ?? 0)
        const delta = mov.tipo === 'saida' ? mov.quantidade : -mov.quantidade
        const { error: stockError } = await supabase
          .from('produtos')
          .update({ quantidade_atual: atual + Number(delta) })
          .eq('id', mov.produto_id)
        if (stockError) {
          setDeleting(false)
          toast.error('Erro ao devolver a quantidade ao estoque: ' + stockError.message)
          return
        }
      }
      const { error: delMovError } = await supabase.from('movimentacoes_estoque').delete().eq('id', mov.id)
      if (delMovError) {
        setDeleting(false)
        toast.error('Erro ao remover movimentação de estoque: ' + delMovError.message)
        return
      }
    }

    const { error } = await supabase.from('transacoes').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      toast.error('Erro ao excluir: ' + error.message)
      return
    }
    toast.success(
      movimentacoes && movimentacoes.length > 0 ? 'Lançamento excluído e estoque devolvido.' : 'Lançamento excluído.',
    )
    setDeleteTarget(null)
    refresh()
  }

  async function exportCSV() {
    const { data, error } = await buildQuery(0, 9999)
    if (error) {
      toast.error('Erro ao exportar CSV: ' + error.message)
      return
    }
    if (!data || data.length === 0) {
      toast.info('Nenhum lançamento para exportar.')
      return
    }
    const header = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Cliente', 'Valor']
    const rows = data.map((t) => [
      formatDateBR(t.data),
      t.tipo === 'entrada' ? 'Entrada' : 'Saída',
      t.descricao || '',
      t.categorias?.nome || '',
      t.clientes?.nome || '',
      String(t.valor).replace('.', ','),
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lancamentos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exportado com sucesso!')
  }

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filters.tipo !== 'todos') n++
    if (filters.categoria_id) n++
    if (filters.cliente_id) n++
    if (filters.periodo !== 'todos') n++
    if (filters.valorMin) n++
    if (filters.valorMax) n++
    return n
  }, [filters])

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Lançamentos</h1>
          <p className="text-sm text-slate-500">Histórico de entradas e saídas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={16} /> CSV
          </button>
          <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Novo Lançamento
          </button>
        </div>
      </div>

      <div className="card p-4">
        <button
          onClick={() => setShowFilters((s) => !s)}
          className="flex items-center justify-between w-full text-sm font-semibold text-slate-200"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal size={16} /> Filtros
            {activeFilterCount > 0 && (
              <span className="bg-primary/20 text-primary-light text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </span>
          <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 animate-fade-in">
            <div>
              <label className="label-field">Tipo</label>
              <div className="flex gap-1.5 bg-slate-800/60 border border-border rounded-xl p-1">
                {[
                  { v: 'todos', l: 'Todos' },
                  { v: 'entrada', l: 'Entrada' },
                  { v: 'saida', l: 'Saída' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => updateFilter({ tipo: opt.v })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      filters.tipo === opt.v ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label-field">Categoria</label>
              <SearchableSelect
                options={categorias.map((c) => ({ value: c.id, label: c.nome }))}
                value={filters.categoria_id}
                onChange={(v) => updateFilter({ categoria_id: v })}
                placeholder="Todas"
              />
            </div>

            <div>
              <label className="label-field">Cliente</label>
              <SearchableSelect
                options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
                value={filters.cliente_id}
                onChange={(v) => updateFilter({ cliente_id: v })}
                placeholder="Todos"
              />
            </div>

            <div>
              <label className="label-field">Período</label>
              <select
                className="input-field"
                value={filters.periodo}
                onChange={(e) => updateFilter({ periodo: e.target.value })}
              >
                <option value="todos">Todos</option>
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {filters.periodo === 'personalizado' && (
              <>
                <div>
                  <label className="label-field">De</label>
                  <input
                    type="date"
                    className="input-field"
                    value={filters.custom.start || ''}
                    onChange={(e) => updateFilter({ custom: { ...filters.custom, start: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="label-field">Até</label>
                  <input
                    type="date"
                    className="input-field"
                    value={filters.custom.end || ''}
                    onChange={(e) => updateFilter({ custom: { ...filters.custom, end: e.target.value } })}
                  />
                </div>
              </>
            )}

            <div>
              <label className="label-field">Valor mínimo</label>
              <input
                type="number"
                className="input-field"
                placeholder="0,00"
                value={filters.valorMin}
                onChange={(e) => updateFilter({ valorMin: e.target.value })}
              />
            </div>
            <div>
              <label className="label-field">Valor máximo</label>
              <input
                type="number"
                className="input-field"
                placeholder="0,00"
                value={filters.valorMax}
                onChange={(e) => updateFilter({ valorMax: e.target.value })}
              />
            </div>

            <div className="flex items-end">
              <button className="btn-secondary w-full text-sm" onClick={() => setFilters(defaultFilters)}>
                Limpar filtros
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {loading && items.length === 0 ? (
          <SkeletonList count={6} />
        ) : items.length === 0 ? (
          <EmptyState icon={Receipt} title="Nenhum lançamento encontrado" message="Ajuste os filtros ou adicione um novo lançamento." />
        ) : (
          <>
            {items.map((t) => (
              <div key={t.id} className="card p-4 flex items-center justify-between gap-3 hover:bg-card-hover transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200 truncate">{t.descricao || t.categorias?.nome || 'Sem descrição'}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {formatDateBR(t.data)}
                    {t.categorias?.nome ? ` · ${t.categorias.nome}` : ''}
                    {t.clientes?.nome ? ` · ${t.clientes.nome}` : ''}
                  </p>
                </div>
                <p className={`text-sm font-semibold shrink-0 ${t.tipo === 'entrada' ? 'text-entrada' : 'text-saida'}`}>
                  {t.tipo === 'entrada' ? '+' : '-'} {formatCurrency(t.valor)}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(t)}
                    className="p-2 rounded-lg text-slate-500 hover:text-primary-light hover:bg-primary/10 transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(t)}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
            {hasMore && (
              <button onClick={loadMore} disabled={loading} className="btn-secondary w-full text-sm mt-2">
                {loading ? 'Carregando...' : 'Carregar mais'}
              </button>
            )}
          </>
        )}
      </div>

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
        editingTransaction={editingTransaction}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        danger
        title="Excluir lançamento"
        message={`Tem certeza que deseja excluir "${deleteTarget?.descricao || deleteTarget?.categorias?.nome || 'este lançamento'}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
      />
    </div>
  )
}
