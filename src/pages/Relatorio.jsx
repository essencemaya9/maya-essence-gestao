import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FileText,
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  Users,
  UserPlus,
  UserX,
  Repeat,
  Flower2,
  Tag,
  Award,
  Megaphone,
  Target,
  Printer,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react'
import { formatCurrency } from '../lib/format'
import { getMonthOptions, currentMonthValue, loadMonthlyReport } from '../lib/reportMetrics'
import { fetchAccountSummary, fetchCampaignInsights, MetaAdsError } from '../lib/metaAds'
import { useLocalStorage } from '../lib/useLocalStorage'
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton'
import { useToast } from '../context/ToastContext'

const monthOptions = getMonthOptions(12)

export default function Relatorio() {
  const toast = useToast()
  const [monthValue, setMonthValue] = useLocalStorage('relatorio_mes', currentMonthValue())
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState(null)
  const [adsData, setAdsData] = useState({ status: 'loading' })

  const monthLabel = useMemo(
    () => monthOptions.find((o) => o.value === monthValue)?.label || monthValue,
    [monthValue],
  )

  const generate = useCallback(async () => {
    setLoading(true)
    try {
      const data = await loadMonthlyReport(monthValue)
      setReport(data)

      try {
        const [summary, campaigns] = await Promise.all([
          fetchAccountSummary(data.range.start, data.range.end),
          fetchCampaignInsights(data.range.start, data.range.end),
        ])
        const melhorCampanha = [...(campaigns || [])].sort((a, b) => b.spend - a.spend)[0] || null
        setAdsData({ status: 'ok', summary, melhorCampanha })
      } catch (err) {
        setAdsData({
          status: 'error',
          notConfigured: err instanceof MetaAdsError && err.notConfigured,
        })
      }
    } catch (err) {
      toast.error('Erro ao gerar relatório: ' + err.message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthValue])

  useEffect(() => {
    generate()
  }, [generate])

  const recomendacoes = useMemo(() => {
    if (!report) return []
    const list = []
    const { financeiroMes, crescimentoEntradas, clientesAnalise } = report

    if (clientesAnalise.clientesEmRisco > 0) {
      list.push({
        tone: 'atencao',
        text: `Você tem ${clientesAnalise.clientesEmRisco} cliente${clientesAnalise.clientesEmRisco > 1 ? 's' : ''} que não compram há 30+ dias — considere uma promoção de reativação.`,
      })
    }

    if (crescimentoEntradas > 0) {
      list.push({
        tone: 'otimo',
        text: `Suas vendas cresceram ${crescimentoEntradas.toFixed(0)}% comparado ao mês passado. Continue assim!`,
      })
    } else if (crescimentoEntradas < 0) {
      list.push({
        tone: 'alerta',
        text: `Suas vendas caíram ${Math.abs(crescimentoEntradas).toFixed(0)}% comparado ao mês passado — vale investigar o que mudou.`,
      })
    }

    if (financeiroMes.saldo < 0) {
      list.push({ tone: 'alerta', text: 'Seu saldo do mês ficou negativo — reveja despesas ou reforce as vendas.' })
    }

    if (clientesAnalise.clientesAtivos > 0 && clientesAnalise.taxaRecompra < 20) {
      list.push({
        tone: 'atencao',
        text: `Sua taxa de recompra está baixa (${clientesAnalise.taxaRecompra.toFixed(0)}%) — experimente estratégias de fidelização.`,
      })
    }

    if (adsData.status === 'ok' && adsData.summary?.spend > 0) {
      const roi = ((financeiroMes.totalEntradas - adsData.summary.spend) / adsData.summary.spend) * 100
      list.push({
        tone: roi >= 0 ? 'otimo' : 'alerta',
        text:
          roi >= 0
            ? `Seu ROI de anúncios foi de ${roi.toFixed(0)}% neste mês — retorno positivo sobre o investimento.`
            : `Seu investimento em anúncios não performou bem este mês (ROI de ${roi.toFixed(0)}%) — reavalie as campanhas.`,
      })
    }

    if (list.length === 0) {
      list.push({ tone: 'otimo', text: 'Tudo em ordem por aqui! Nenhum alerta para este mês.' })
    }

    return list
  }, [report, adsData])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileText size={20} className="text-primary-light" /> Relatório Mensal
          </h1>
          <p className="text-sm text-slate-500">Resumo completo do desempenho do negócio</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input-field !w-auto" value={monthValue} onChange={(e) => setMonthValue(e.target.value)}>
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button onClick={generate} className="btn-secondary flex items-center gap-2 text-sm" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Gerar Relatório
          </button>
          <button onClick={() => window.print()} className="btn-primary flex items-center gap-2 text-sm" disabled={loading || !report}>
            <Printer size={16} /> Exportar PDF
          </button>
        </div>
      </div>

      {loading || !report ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="print-area space-y-6">
          <div className="hidden print:block">
            <h1 className="text-xl font-bold">Relatório Mensal — Maya Essence</h1>
            <p className="text-sm">{monthLabel}</p>
          </div>

          <Section title="Resumo financeiro" icon={Wallet}>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard icon={TrendingUp} label="Entradas" value={formatCurrency(report.financeiroMes.totalEntradas)} tone="entrada" />
              <StatCard icon={TrendingDown} label="Saídas" value={formatCurrency(report.financeiroMes.totalSaidas)} tone="saida" />
              <StatCard
                icon={Wallet}
                label="Saldo líquido"
                value={formatCurrency(report.financeiroMes.saldo)}
                tone={report.financeiroMes.saldo >= 0 ? 'entrada' : 'saida'}
              />
              <StatCard
                icon={report.crescimentoEntradas >= 0 ? TrendingUp : TrendingDown}
                label="vs. mês anterior"
                value={`${report.crescimentoEntradas >= 0 ? '+' : ''}${report.crescimentoEntradas.toFixed(0)}%`}
                tone={report.crescimentoEntradas >= 0 ? 'entrada' : 'saida'}
              />
              <StatCard icon={Receipt} label="Ticket médio" value={formatCurrency(report.financeiroMes.ticketMedio)} tone="accent" />
            </div>
          </Section>

          <Section title="Análise de clientes" icon={Users}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <StatCard icon={Users} label="Clientes ativos" value={report.clientesAnalise.clientesAtivos} tone="primary" />
              <StatCard icon={UserPlus} label="Novos clientes" value={report.clientesAnalise.novosClientes} tone="entrada" />
              <StatCard icon={UserX} label="Clientes em risco" value={report.clientesAnalise.clientesEmRisco} tone="saida" />
              <StatCard icon={Repeat} label="Taxa de recompra" value={`${report.clientesAnalise.taxaRecompra.toFixed(0)}%`} tone="accent" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Top 5 clientes do mês</p>
            {report.clientesAnalise.topClientes.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma venda com cliente vinculado neste mês.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {report.clientesAnalise.topClientes.map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between py-2.5">
                    <p className="text-sm text-slate-300">
                      <span className="text-slate-500 mr-2">#{i + 1}</span> {c.nome}
                    </p>
                    <p className="text-sm font-semibold text-entrada">{formatCurrency(c.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Análise de produtos" icon={Tag}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Flower2 size={13} /> Top 3 essências mais vendidas
                </p>
                {report.produtosAnalise.topEssencias.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados de essência suficientes neste mês.</p>
                ) : (
                  <div className="space-y-2">
                    {report.produtosAnalise.topEssencias.map((e, i) => (
                      <div key={e.nome} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">
                          #{i + 1} {e.nome}
                        </span>
                        <span className="font-semibold text-slate-200">{formatCurrency(e.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <Award size={13} /> Categoria que mais gerou receita
                  </p>
                  <p className="text-sm text-slate-200">
                    {report.produtosAnalise.categoriaLider
                      ? `${report.produtosAnalise.categoriaLider.nome} — ${formatCurrency(report.produtosAnalise.categoriaLider.total)}`
                      : 'Sem dados neste mês.'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <Target size={13} /> Maior ticket médio por categoria
                  </p>
                  <p className="text-sm text-slate-200">
                    {report.produtosAnalise.categoriaMaiorTicket
                      ? `${report.produtosAnalise.categoriaMaiorTicket.nome} — ${formatCurrency(report.produtosAnalise.categoriaMaiorTicket.ticketMedio)} por venda`
                      : 'Sem dados neste mês.'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Aproximação por ticket médio — o app não rastreia custo por produto para calcular margem real.
                  </p>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Análise de anúncios" icon={Megaphone}>
            {adsData.status === 'loading' ? (
              <SkeletonBlock className="h-20 w-full" />
            ) : adsData.status === 'error' ? (
              <p className="text-sm text-slate-500">
                {adsData.notConfigured
                  ? 'Meta Ads ainda não configurado. Veja a aba Anúncios para instruções.'
                  : 'Não foi possível carregar os dados de anúncios deste mês.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={Wallet} label="Investido no mês" value={formatCurrency(adsData.summary.spend)} tone="accent" />
                <StatCard
                  icon={adsData.summary.spend > 0 && report.financeiroMes.totalEntradas >= adsData.summary.spend ? TrendingUp : TrendingDown}
                  label="ROI"
                  value={
                    adsData.summary.spend > 0
                      ? `${(((report.financeiroMes.totalEntradas - adsData.summary.spend) / adsData.summary.spend) * 100).toFixed(0)}%`
                      : '—'
                  }
                  tone={report.financeiroMes.totalEntradas >= adsData.summary.spend ? 'entrada' : 'saida'}
                />
                <StatCard icon={Award} label="Melhor campanha" value={adsData.melhorCampanha?.campaign_name || '—'} tone="primary" />
                <StatCard
                  icon={Target}
                  label="Custo por cliente adquirido"
                  value={
                    report.clientesAnalise.novosClientes > 0
                      ? formatCurrency(adsData.summary.spend / report.clientesAnalise.novosClientes)
                      : '—'
                  }
                  tone="accent"
                />
              </div>
            )}
          </Section>

          <Section title="Recomendações automáticas" icon={Info}>
            <div className="space-y-2.5">
              {recomendacoes.map((r, i) => {
                const Icon = r.tone === 'otimo' ? CheckCircle2 : r.tone === 'atencao' ? AlertTriangle : AlertTriangle
                const cls =
                  r.tone === 'otimo'
                    ? 'border-entrada/40 bg-entrada/10 text-entrada'
                    : r.tone === 'atencao'
                      ? 'border-accent/40 bg-accent/10 text-accent-light'
                      : 'border-saida/40 bg-saida/10 text-saida'
                return (
                  <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 ${cls}`}>
                    <Icon size={16} className="shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-200">{r.text}</p>
                  </div>
                )
              })}
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <Icon size={16} className="text-primary-light" /> {title}
      </h2>
      {children}
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
