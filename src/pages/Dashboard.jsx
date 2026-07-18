import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { Wallet, TrendingUp, TrendingDown, Receipt, ArrowRight, Inbox } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDateBR } from '../lib/format'
import { getPeriodRange, getLastNMonths } from '../lib/periods'
import { useLocalStorage } from '../lib/useLocalStorage'
import PeriodFilter from '../components/PeriodFilter'
import { SkeletonBlock, SkeletonCard, SkeletonRow } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { useToast } from '../context/ToastContext'

export default function Dashboard() {
  const toast = useToast()
  const [period, setPeriod] = useLocalStorage('dash_period', 'mes')
  const [custom, setCustom] = useLocalStorage('dash_custom_period', {})
  const [loading, setLoading] = useState(true)
  const [transacoes, setTransacoes] = useState([])
  const [chartLoading, setChartLoading] = useState(true)
  const [chartData, setChartData] = useState([])
  const [recentes, setRecentes] = useState([])

  const range = useMemo(() => getPeriodRange(period, custom), [period, custom])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('transacoes')
        .select('id, tipo, valor, data')
        .gte('data', range.start)
        .lte('data', range.end)

      if (!active) return
      if (error) {
        toast.error('Erro ao carregar dados do dashboard: ' + error.message)
        setTransacoes([])
      } else {
        setTransacoes(data || [])
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end])

  useEffect(() => {
    let active = true
    async function loadRecentes() {
      const { data, error } = await supabase
        .from('transacoes')
        .select('id, tipo, valor, descricao, data, categorias(nome), clientes(nome)')
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5)
      if (!active) return
      if (!error) setRecentes(data || [])
    }
    loadRecentes()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    async function loadChart() {
      setChartLoading(true)
      const months = getLastNMonths(6)
      const { data, error } = await supabase
        .from('transacoes')
        .select('tipo, valor, data')
        .gte('data', months[0].start)
        .lte('data', months[months.length - 1].end)

      if (!active) return
      if (error) {
        setChartData([])
        setChartLoading(false)
        return
      }

      const grouped = months.map((m) => {
        const items = (data || []).filter((t) => t.data >= m.start && t.data <= m.end)
        return {
          mes: m.label,
          Entradas: items.filter((t) => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0),
          Saídas: items.filter((t) => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0),
        }
      })
      setChartData(grouped)
      setChartLoading(false)
    }
    loadChart()
    return () => {
      active = false
    }
  }, [])

  const stats = useMemo(() => {
    const entradas = transacoes.filter((t) => t.tipo === 'entrada')
    const saidas = transacoes.filter((t) => t.tipo === 'saida')
    const totalEntradas = entradas.reduce((s, t) => s + Number(t.valor), 0)
    const totalSaidas = saidas.reduce((s, t) => s + Number(t.valor), 0)
    const saldo = totalEntradas - totalSaidas
    const ticketMedio = entradas.length > 0 ? totalEntradas / entradas.length : 0
    return { totalEntradas, totalSaidas, saldo, ticketMedio }
  }, [transacoes])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500">Visão geral do seu negócio</p>
        </div>
        <PeriodFilter period={period} onChange={setPeriod} custom={custom} onCustomChange={setCustom} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              icon={Wallet}
              label="Saldo do período"
              value={formatCurrency(stats.saldo)}
              tone={stats.saldo >= 0 ? 'primary' : 'saida'}
            />
            <StatCard icon={TrendingUp} label="Entradas" value={formatCurrency(stats.totalEntradas)} tone="entrada" />
            <StatCard icon={TrendingDown} label="Saídas" value={formatCurrency(stats.totalSaidas)} tone="saida" />
            <StatCard icon={Receipt} label="Ticket médio" value={formatCurrency(stats.ticketMedio)} tone="accent" />
          </>
        )}
      </div>

      <div className="card p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Entradas vs Saídas — últimos 6 meses</h2>
        {chartLoading ? (
          <SkeletonBlock className="h-72 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="mes" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 13 }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(value) => formatCurrency(value)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Entradas" fill="#22c55e" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Saídas" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-200">Últimas transações</h2>
          <Link to="/lancamentos" className="text-xs font-semibold text-primary-light hover:text-primary flex items-center gap-1">
            Ver tudo <ArrowRight size={14} />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : recentes.length === 0 ? (
          <EmptyState icon={Inbox} title="Nenhuma transação ainda" message="Adicione seu primeiro lançamento na aba Lançamentos." />
        ) : (
          <div className="divide-y divide-border/50">
            {recentes.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{t.descricao || t.categorias?.nome || 'Sem descrição'}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateBR(t.data)}
                    {t.categorias?.nome ? ` · ${t.categorias.nome}` : ''}
                    {t.clientes?.nome ? ` · ${t.clientes.nome}` : ''}
                  </p>
                </div>
                <p className={`text-sm font-semibold shrink-0 ${t.tipo === 'entrada' ? 'text-entrada' : 'text-saida'}`}>
                  {t.tipo === 'entrada' ? '+' : '-'} {formatCurrency(t.valor)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
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
