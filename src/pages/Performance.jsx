import { useEffect, useMemo, useState } from 'react'
import { format, startOfMonth, startOfYear, subMonths } from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend,
  RadialBarChart,
  RadialBar,
} from 'recharts'
import { Radar, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchSpendTimeseries, fetchAccountSummary, MetaAdsError } from '../lib/metaAds'
import { formatCurrency } from '../lib/format'
import { loadLastMonthsSeries, percentChange } from '../lib/reportMetrics'
import { useLocalStorage } from '../lib/useLocalStorage'
import { SkeletonBlock } from '../components/Skeleton'

function ClickableDot({ cx, cy, stroke, payload, onSelect }) {
  if (cx == null || cy == null) return null
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={stroke}
      stroke="#0f172a"
      strokeWidth={1}
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect(payload)}
    />
  )
}

const RESULT_FILTERS = [
  { value: 'mes', label: 'Este mês' },
  { value: '3meses', label: 'Últimos 3 meses' },
  { value: '6meses', label: 'Últimos 6 meses' },
  { value: 'ano', label: 'Este ano' },
]

function toISO(date) {
  return format(date, 'yyyy-MM-dd')
}

function getResultRange(filter) {
  const now = new Date()
  switch (filter) {
    case 'mes':
      return { start: toISO(startOfMonth(now)), end: toISO(now) }
    case '3meses':
      return { start: toISO(startOfMonth(subMonths(now, 2))), end: toISO(now) }
    case '6meses':
      return { start: toISO(startOfMonth(subMonths(now, 5))), end: toISO(now) }
    case 'ano':
      return { start: toISO(startOfYear(now)), end: toISO(now) }
    default:
      return { start: toISO(startOfMonth(now)), end: toISO(now) }
  }
}

export default function Performance() {
  const [filter, setFilter] = useLocalStorage('performance_filter', 'mes')
  const [loadingResult, setLoadingResult] = useState(true)
  const [resultData, setResultData] = useState({ entradas: 0, saidas: 0 })

  const [loadingWeekly, setLoadingWeekly] = useState(true)
  const [weeklyData, setWeeklyData] = useState([])
  const [adsConfigured, setAdsConfigured] = useState(true)

  const [loadingMonthly, setLoadingMonthly] = useState(true)
  const [monthlySeries, setMonthlySeries] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(null)

  const range = useMemo(() => getResultRange(filter), [filter])

  useEffect(() => {
    let active = true
    async function load() {
      setLoadingResult(true)
      const { data } = await supabase.from('transacoes').select('tipo, valor').gte('data', range.start).lte('data', range.end)
      if (!active) return
      const entradas = (data || []).filter((t) => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0)
      const saidas = (data || []).filter((t) => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)
      setResultData({ entradas, saidas })
      setLoadingResult(false)
    }
    load()
    return () => {
      active = false
    }
  }, [range.start, range.end])

  useEffect(() => {
    let active = true
    async function load() {
      setLoadingWeekly(true)
      try {
        const weeks = await fetchSpendTimeseries(range.start, range.end, 7)
        const { data: vendas } = await supabase
          .from('transacoes')
          .select('valor, data')
          .eq('tipo', 'entrada')
          .gte('data', range.start)
          .lte('data', range.end)
        if (!active) return

        const combined = (weeks || []).map((w, i) => {
          const vendasSemana = (vendas || [])
            .filter((v) => v.data >= w.start && v.data <= w.end)
            .reduce((s, v) => s + Number(v.valor), 0)
          return { semana: `S${i + 1}`, Investido: w.spend, Vendas: vendasSemana }
        })
        setWeeklyData(combined)
        setAdsConfigured(true)
      } catch (err) {
        if (!active) return
        setAdsConfigured(!(err instanceof MetaAdsError && err.notConfigured))
        setWeeklyData([])
      } finally {
        if (active) setLoadingWeekly(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [range.start, range.end])

  useEffect(() => {
    let active = true
    async function load() {
      setLoadingMonthly(true)
      const base = await loadLastMonthsSeries(6)
      let withAds = base
      try {
        const adsPerMonth = await Promise.all(
          base.map((m) => fetchAccountSummary(m.start, m.end).catch(() => ({ spend: 0 }))),
        )
        withAds = base.map((m, i) => ({ ...m, Anúncios: adsPerMonth[i]?.spend || 0 }))
      } catch {
        withAds = base.map((m) => ({ ...m, Anúncios: 0 }))
      }
      if (!active) return
      setMonthlySeries(withAds)
      setLoadingMonthly(false)
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const lucro = resultData.entradas - resultData.saidas
  const positivo = lucro >= 0

  const barData = [
    { name: 'Entradas', valor: resultData.entradas },
    { name: 'Saídas', valor: resultData.saidas },
  ]

  const totalInvestidoSemanal = weeklyData.reduce((s, w) => s + w.Investido, 0)
  const totalVendasSemanal = weeklyData.reduce((s, w) => s + w.Vendas, 0)
  const roiSemanal = totalInvestidoSemanal > 0 ? ((totalVendasSemanal - totalInvestidoSemanal) / totalInvestidoSemanal) * 100 : 0

  const alertas = useMemo(() => {
    if (monthlySeries.length < 2) return []
    const atual = monthlySeries[monthlySeries.length - 1]
    const anterior = monthlySeries[monthlySeries.length - 2]
    const list = []

    const gastoChange = percentChange(atual.Saídas, anterior.Saídas)
    if (gastoChange >= 30) {
      list.push({ level: 'alerta', text: `Seus gastos aumentaram ${gastoChange.toFixed(0)}% este mês.` })
    }

    if (atual.Anúncios > 0 && atual.Anúncios > atual.Entradas) {
      list.push({ level: 'atencao', text: 'Você está investindo mais em anúncios do que vendendo.' })
    }

    const vendaChange = percentChange(atual.Entradas, anterior.Entradas)
    if (vendaChange >= 10) {
      list.push({ level: 'otimo', text: `Suas vendas cresceram ${vendaChange.toFixed(0)}% comparado ao mês passado.` })
    }

    if (atual.Anúncios > 0) {
      const roiMes = (atual.Entradas - atual.Anúncios) / atual.Anúncios
      if (roiMes >= 2) {
        list.push({ level: 'otimo', text: `ROI dos anúncios está em ${roiMes.toFixed(1)}x — continue investindo.` })
      }
    }

    return list
  }, [monthlySeries])

  const saude = useMemo(() => {
    if (monthlySeries.length < 2) return 50
    const atual = monthlySeries[monthlySeries.length - 1]
    const anterior = monthlySeries[monthlySeries.length - 2]
    const saldoAtual = atual.Entradas - atual.Saídas

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

    const saldoScore = saldoAtual >= 0 ? 25 : 0
    const crescimento = percentChange(atual.Entradas, anterior.Entradas)
    const crescimentoScore = clamp(12.5 + crescimento / 4, 0, 25)
    const roi = atual.Anúncios > 0 ? ((atual.Entradas - atual.Anúncios) / atual.Anúncios) * 100 : null
    const roiScore = roi === null ? 12.5 : clamp(12.5 + roi / 8, 0, 25)
    const recompraScoreBase = 12.5 // sem taxa de recompra mensal isolada aqui; usa baseline neutro

    return Math.round(saldoScore + crescimentoScore + roiScore + recompraScoreBase)
  }, [monthlySeries])

  const saudeColor = saude <= 33 ? '#ef4444' : saude <= 66 ? '#f59e0b' : '#22c55e'
  const saudeLabel = saude <= 33 ? 'Negócio em risco' : saude <= 66 ? 'Atenção necessária' : 'Negócio saudável'

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Radar size={20} className="text-primary-light" /> Performance
        </h1>
        <p className="text-sm text-slate-500">Painel visual de saúde do negócio</p>
      </div>

      <div className="card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-slate-200">Resultado do período</h2>
          <div className="flex flex-wrap gap-1.5 bg-slate-800/60 border border-border/60 rounded-xl p-1.5">
            {RESULT_FILTERS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  filter === opt.value ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loadingResult ? (
          <SkeletonBlock className="h-64 w-full" />
        ) : (
          <>
            <p className={`text-center text-2xl sm:text-3xl font-extrabold mb-4 ${positivo ? 'text-entrada' : 'text-saida'}`}>
              {positivo ? 'LUCRO' : 'PREJUÍZO'} DE {formatCurrency(Math.abs(lucro))}
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={13} width={70} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 13 }}
                  formatter={(value) => formatCurrency(value)}
                />
                <ReferenceLine x={resultData.saidas} stroke="#f59e0b" strokeDasharray="6 4" label={{ value: 'Ponto de equilíbrio', fill: '#f59e0b', fontSize: 11, position: 'top' }} />
                <Bar dataKey="valor" radius={[0, 8, 8, 0]} animationDuration={700}>
                  {barData.map((entry, index) => (
                    <Cell key={entry.name} fill={index === 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      <div className="card p-4 sm:p-6 relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-200">Investimento vs Retorno (Meta Ads) — semanal</h2>
          {!loadingWeekly && adsConfigured && totalInvestidoSemanal > 0 && (
            <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${roiSemanal >= 0 ? 'bg-entrada/15 text-entrada' : 'bg-saida/15 text-saida'}`}>
              Retorno: {roiSemanal.toFixed(0)}%
            </span>
          )}
        </div>
        {loadingWeekly ? (
          <SkeletonBlock className="h-64 w-full" />
        ) : !adsConfigured ? (
          <p className="text-sm text-slate-500 py-8 text-center">Meta Ads ainda não configurado. Veja a aba Anúncios.</p>
        ) : weeklyData.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">Sem dados suficientes no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="colorInvestido" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="semana" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 13 }}
                formatter={(value) => formatCurrency(value)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Investido" stroke="#ef4444" fill="url(#colorInvestido)" strokeWidth={2} animationDuration={800} />
              <Area type="monotone" dataKey="Vendas" stroke="#22c55e" fill="url(#colorVendas)" strokeWidth={2} animationDuration={800} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Evolução mensal — últimos 6 meses</h2>
        {loadingMonthly ? (
          <SkeletonBlock className="h-64 w-full" />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="mes" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 13 }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="Entradas"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={({ cx, cy, stroke, payload }) => (
                    <ClickableDot key={`entradas-${payload.key}`} cx={cx} cy={cy} stroke={stroke} payload={payload} onSelect={setSelectedMonth} />
                  )}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="Saídas"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={({ cx, cy, stroke, payload }) => (
                    <ClickableDot key={`saidas-${payload.key}`} cx={cx} cy={cy} stroke={stroke} payload={payload} onSelect={setSelectedMonth} />
                  )}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="Anúncios"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={({ cx, cy, stroke, payload }) => (
                    <ClickableDot key={`anuncios-${payload.key}`} cx={cx} cy={cy} stroke={stroke} payload={payload} onSelect={setSelectedMonth} />
                  )}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
            {selectedMonth && (
              <div className="mt-3 flex flex-wrap gap-4 rounded-xl border border-border/60 bg-slate-800/60 px-4 py-3 text-sm animate-fade-in">
                <span className="font-semibold text-slate-200">{selectedMonth.mes}</span>
                <span className="text-entrada">Entradas: {formatCurrency(selectedMonth.Entradas)}</span>
                <span className="text-saida">Saídas: {formatCurrency(selectedMonth.Saídas)}</span>
                <span className="text-accent-light">Anúncios: {formatCurrency(selectedMonth.Anúncios)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {alertas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {alertas.map((a, i) => {
            const Icon = a.level === 'otimo' ? CheckCircle2 : a.level === 'atencao' ? AlertCircle : AlertTriangle
            const cls =
              a.level === 'otimo'
                ? 'border-entrada/40 bg-entrada/10 text-entrada'
                : a.level === 'atencao'
                  ? 'border-accent/40 bg-accent/10 text-accent-light'
                  : 'border-saida/40 bg-saida/10 text-saida'
            const prefix = a.level === 'otimo' ? 'ÓTIMO' : a.level === 'atencao' ? 'ATENÇÃO' : 'ALERTA'
            return (
              <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 ${cls}`}>
                <Icon size={16} className="shrink-0 mt-0.5" />
                <p className="text-sm text-slate-200">
                  <span className="font-bold">{prefix}:</span> {a.text}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <div className="card p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-200 mb-2">Saúde do negócio</h2>
        {loadingMonthly ? (
          <SkeletonBlock className="h-56 w-full" />
        ) : (
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart
                cx="50%"
                cy="100%"
                innerRadius="90%"
                outerRadius="140%"
                barSize={22}
                startAngle={180}
                endAngle={0}
                data={[{ value: saude, fill: saudeColor }]}
              >
                <RadialBar dataKey="value" cornerRadius={12} background={{ fill: '#334155' }} animationDuration={900} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="-mt-16 text-center">
              <p className="text-4xl font-extrabold" style={{ color: saudeColor }}>
                {saude}
              </p>
              <p className="text-sm font-semibold text-slate-300 mt-1">{saudeLabel}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
