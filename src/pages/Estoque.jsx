import { useEffect, useMemo, useState } from 'react'
import {
  Package,
  PackageX,
  AlertTriangle,
  Wallet,
  Plus,
  Pencil,
  Trash2,
  ArrowLeftRight,
  Search,
  History,
  Boxes,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDateBR } from '../lib/format'
import { getPeriodRange, PERIOD_OPTIONS } from '../lib/periods'
import { useLocalStorage } from '../lib/useLocalStorage'
import ProdutoModal, { CATEGORIAS } from '../components/ProdutoModal'
import MovimentarEstoqueModal from '../components/MovimentarEstoqueModal'
import ConfirmDialog from '../components/ConfirmDialog'
import SearchableSelect from '../components/SearchableSelect'
import EmptyState from '../components/EmptyState'
import { SkeletonCard, SkeletonList } from '../components/Skeleton'
import { useToast } from '../context/ToastContext'

const defaultFilters = { busca: '', categoria: 'todas', status: 'todos' }
const defaultHistFilters = { produto_id: null, tipo: 'todos', periodo: 'todos', custom: {} }

function statusOf(produto) {
  if (Number(produto.quantidade_atual) <= 0) return 'falta'
  if (Number(produto.quantidade_atual) <= Number(produto.quantidade_minima)) return 'baixo'
  return 'normal'
}

export default function Estoque() {
  const toast = useToast()
  const [view, setView] = useLocalStorage('estoque_view', 'produtos')
  const [filters, setFilters] = useLocalStorage('estoque_filters', defaultFilters)
  const [histFilters, setHistFilters] = useLocalStorage('estoque_hist_filters', defaultHistFilters)

  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduto, setEditingProduto] = useState(null)
  const [movimentarProduto, setMovimentarProduto] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [movimentacoes, setMovimentacoes] = useState([])
  const [loadingHist, setLoadingHist] = useState(true)

  async function loadProdutos() {
    setLoading(true)
    const { data, error } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome')
    if (error) {
      toast.error('Erro ao carregar produtos: ' + error.message)
    } else {
      setProdutos(data || [])
    }
    setLoading(false)
  }

  async function loadMovimentacoes() {
    setLoadingHist(true)
    let query = supabase
      .from('movimentacoes_estoque')
      .select('id, tipo, quantidade, motivo, data, produto_id, produtos(nome, unidade)')
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)

    if (histFilters.produto_id) query = query.eq('produto_id', histFilters.produto_id)
    if (histFilters.tipo !== 'todos') query = query.eq('tipo', histFilters.tipo)
    if (histFilters.periodo !== 'todos') {
      const range = getPeriodRange(histFilters.periodo, histFilters.custom)
      query = query.gte('data', range.start).lte('data', range.end)
    }

    const { data, error } = await query
    if (error) {
      toast.error('Erro ao carregar movimentações: ' + error.message)
    } else {
      setMovimentacoes(data || [])
    }
    setLoadingHist(false)
  }

  useEffect(() => {
    loadProdutos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (view === 'movimentacoes') loadMovimentacoes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, histFilters])

  function refreshAll() {
    loadProdutos()
    if (view === 'movimentacoes') loadMovimentacoes()
  }

  const stats = useMemo(() => {
    const total = produtos.length
    const emFalta = produtos.filter((p) => statusOf(p) === 'falta').length
    const estoqueBaixo = produtos.filter((p) => statusOf(p) === 'baixo').length
    const valorTotal = produtos.reduce((s, p) => s + Number(p.quantidade_atual) * Number(p.preco_custo || 0), 0)
    return { total, emFalta, estoqueBaixo, valorTotal }
  }, [produtos])

  const filtered = useMemo(() => {
    return produtos.filter((p) => {
      if (filters.busca && !p.nome.toLowerCase().includes(filters.busca.toLowerCase())) return false
      if (filters.categoria !== 'todas' && p.categoria !== filters.categoria) return false
      if (filters.status !== 'todos' && statusOf(p) !== filters.status) return false
      return true
    })
  }, [produtos, filters])

  function updateFilter(patch) {
    setFilters((f) => ({ ...f, ...patch }))
  }

  function updateHistFilter(patch) {
    setHistFilters((f) => ({ ...f, ...patch }))
  }

  function openNew() {
    setEditingProduto(null)
    setModalOpen(true)
  }

  function openEdit(p) {
    setEditingProduto(p)
    setModalOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('produtos').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      if (error.code === '23503') {
        toast.error('Não é possível excluir: este produto tem movimentações de estoque registradas. Marque-o como inativo em vez de excluir.')
      } else {
        toast.error('Erro ao excluir: ' + error.message)
      }
      return
    }
    toast.success('Produto excluído.')
    setDeleteTarget(null)
    refreshAll()
  }

  const STATUS_BADGE = {
    falta: { label: 'EM FALTA', cls: 'bg-saida/15 text-saida' },
    baixo: { label: 'ESTOQUE BAIXO', cls: 'bg-accent/15 text-accent-light' },
    normal: { label: 'NORMAL', cls: 'bg-entrada/15 text-entrada' },
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Boxes size={20} className="text-primary-light" /> Estoque
          </h1>
          <p className="text-sm text-slate-500">Controle de produtos e movimentações</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto">
          <Plus size={16} /> Novo Produto
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard icon={Package} label="Produtos cadastrados" value={stats.total} tone="primary" />
            <StatCard icon={PackageX} label="Em falta" value={stats.emFalta} tone="saida" />
            <StatCard icon={AlertTriangle} label="Estoque baixo" value={stats.estoqueBaixo} tone="accent" />
            <StatCard icon={Wallet} label="Valor total em estoque" value={formatCurrency(stats.valorTotal)} tone="entrada" />
          </>
        )}
      </div>

      <div className="flex gap-1.5 bg-slate-800/60 border border-border/60 rounded-xl p-1.5 w-fit">
        <button
          onClick={() => setView('produtos')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            view === 'produtos' ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <Package size={14} /> Produtos
        </button>
        <button
          onClick={() => setView('movimentacoes')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            view === 'movimentacoes' ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <History size={14} /> Histórico
        </button>
      </div>

      {view === 'produtos' ? (
        <>
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
                <label className="label-field">Categoria</label>
                <select className="input-field" value={filters.categoria} onChange={(e) => updateFilter({ categoria: e.target.value })}>
                  <option value="todas">Todas</option>
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Status</label>
                <select className="input-field" value={filters.status} onChange={(e) => updateFilter({ status: e.target.value })}>
                  <option value="todos">Todos</option>
                  <option value="falta">Em falta</option>
                  <option value="baixo">Estoque baixo</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <SkeletonList count={6} />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Package} title="Nenhum produto encontrado" message="Ajuste os filtros ou cadastre um novo produto." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((p) => {
                const status = statusOf(p)
                const badge = STATUS_BADGE[status]
                const margem = p.preco_venda > 0 ? ((p.preco_venda - p.preco_custo) / p.preco_venda) * 100 : 0
                return (
                  <div key={p.id} className="card p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-100 truncate">{p.nome}</p>
                        <p className="text-xs text-slate-500">{p.categoria || 'Sem categoria'}</p>
                      </div>
                      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">
                      {p.quantidade_atual} <span className="text-slate-500">{p.unidade}</span>
                    </p>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Custo: {formatCurrency(p.preco_custo)}</span>
                      <span>Venda: {formatCurrency(p.preco_venda)}</span>
                    </div>
                    <p className={`text-xs font-semibold ${margem >= 0 ? 'text-entrada' : 'text-saida'}`}>
                      Margem: {margem.toFixed(1)}%
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={() => setMovimentarProduto(p)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-primary/15 hover:bg-primary/25 text-primary-light text-xs font-semibold rounded-lg px-2 py-2 transition-colors"
                      >
                        <ArrowLeftRight size={13} /> Movimentar
                      </button>
                      <button
                        onClick={() => openEdit(p)}
                        className="p-2 rounded-lg text-slate-500 hover:text-primary-light hover:bg-primary/10 transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label-field">Produto</label>
              <SearchableSelect
                options={produtos.map((p) => ({ value: p.id, label: p.nome }))}
                value={histFilters.produto_id}
                onChange={(v) => updateHistFilter({ produto_id: v })}
                placeholder="Todos"
              />
            </div>
            <div>
              <label className="label-field">Tipo</label>
              <select className="input-field" value={histFilters.tipo} onChange={(e) => updateHistFilter({ tipo: e.target.value })}>
                <option value="todos">Todos</option>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </div>
            <div>
              <label className="label-field">Período</label>
              <select className="input-field" value={histFilters.periodo} onChange={(e) => updateHistFilter({ periodo: e.target.value })}>
                <option value="todos">Todos</option>
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card p-4 sm:p-6">
            {loadingHist ? (
              <SkeletonList count={6} />
            ) : movimentacoes.length === 0 ? (
              <EmptyState icon={History} title="Nenhuma movimentação encontrada" />
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                      <th className="px-4 sm:px-2 py-2 font-semibold">Data</th>
                      <th className="px-2 py-2 font-semibold">Produto</th>
                      <th className="px-2 py-2 font-semibold">Tipo</th>
                      <th className="px-2 py-2 font-semibold text-right">Quantidade</th>
                      <th className="px-4 sm:px-2 py-2 font-semibold">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {movimentacoes.map((m) => (
                      <tr key={m.id} className="text-slate-300">
                        <td className="px-4 sm:px-2 py-3">{formatDateBR(m.data)}</td>
                        <td className="px-2 py-3 font-medium text-slate-200">{m.produtos?.nome || 'Produto removido'}</td>
                        <td className="px-2 py-3">
                          <span
                            className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${
                              m.tipo === 'entrada'
                                ? 'bg-entrada/15 text-entrada'
                                : m.tipo === 'saida'
                                  ? 'bg-saida/15 text-saida'
                                  : 'bg-accent/15 text-accent-light'
                            }`}
                          >
                            {m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'saida' ? 'Saída' : 'Ajuste'}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-right">
                          {m.quantidade} {m.produtos?.unidade}
                        </td>
                        <td className="px-4 sm:px-2 py-3 text-slate-400">{m.motivo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <ProdutoModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={refreshAll} editingProduto={editingProduto} />

      <MovimentarEstoqueModal
        open={!!movimentarProduto}
        onClose={() => setMovimentarProduto(null)}
        onSaved={refreshAll}
        produto={movimentarProduto}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        danger
        title="Excluir produto"
        message={`Tem certeza que deseja excluir "${deleteTarget?.nome}"? O histórico de movimentações vinculado a ele será perdido.`}
        confirmLabel="Excluir"
      />
    </div>
  )
}

function StatCard({ icon: Icon, label, value, tone }) {
  const toneClasses = {
    primary: 'text-primary-light bg-primary/10',
    entrada: 'text-entrada bg-entrada/10',
    saida: 'text-saida bg-saida/10',
    accent: 'text-accent-light bg-accent/10',
  }
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${toneClasses[tone]}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-lg font-bold text-slate-100 truncate">{value}</p>
      </div>
    </div>
  )
}
