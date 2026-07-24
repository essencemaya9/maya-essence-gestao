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
  Lightbulb,
  Boxes,
  PackageX,
  PackageMinus,
  ShoppingBag,
  MoonStar,
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

  const resumoConversa = useMemo(() => {
    if (!report) return ''
    const { financeiroMes, crescimentoEntradas, clientesAnalise } = report
    const saldoTexto =
      financeiroMes.saldo >= 0
        ? `sobrou ${formatCurrency(financeiroMes.saldo)} no caixa`
        : `faltou ${formatCurrency(Math.abs(financeiroMes.saldo))} — as saídas passaram as entradas`
    const crescimentoTexto =
      crescimentoEntradas > 0
        ? `Suas vendas foram ${crescimentoEntradas.toFixed(0)}% maiores que no mês passado.`
        : crescimentoEntradas < 0
          ? `Suas vendas foram ${Math.abs(crescimentoEntradas).toFixed(0)}% menores que no mês passado.`
          : 'Suas vendas ficaram bem parecidas com as do mês passado.'
    const clientesTexto =
      clientesAnalise.clientesAtivos > 0
        ? `${clientesAnalise.clientesAtivos} cliente${clientesAnalise.clientesAtivos > 1 ? 's compraram' : ' comprou'} de você`
        : 'ninguém comprou de você'

    return `Em ${monthLabel.toLowerCase()}, entraram ${formatCurrency(financeiroMes.totalEntradas)} e saíram ${formatCurrency(financeiroMes.totalSaidas)}. No fim das contas, ${saldoTexto}. ${crescimentoTexto} Nesse período, ${clientesTexto}.`
  }, [report, monthLabel])

  const recomendacoes = useMemo(() => {
    if (!report) return []
    const list = []
    const { financeiroMes, crescimentoEntradas, clientesAnalise, estoqueAnalise } = report

    if (financeiroMes.saldo < 0) {
      list.push({
        tone: 'alerta',
        text: 'Esse mês fechou no vermelho. Dá uma olhada no que mais pesou nas saídas e veja se dá pra cortar ou negociar algo antes do próximo mês.',
      })
    }

    if (clientesAnalise.clientesEmRisco > 0) {
      list.push({
        tone: 'atencao',
        text: `Você tem ${clientesAnalise.clientesEmRisco} cliente${clientesAnalise.clientesEmRisco > 1 ? 's' : ''} sumido${clientesAnalise.clientesEmRisco > 1 ? 's' : ''} há mais de 30 dias. Que tal mandar uma mensagem carinhosa lembrando dele? Dá pra fazer isso direto na aba Recompra.`,
      })
    }

    if (crescimentoEntradas > 0) {
      list.push({
        tone: 'otimo',
        text: `Suas vendas cresceram ${crescimentoEntradas.toFixed(0)}% em relação ao mês passado. Continue fazendo o que está funcionando!`,
      })
    } else if (crescimentoEntradas < -10) {
      list.push({
        tone: 'alerta',
        text: `Suas vendas caíram ${Math.abs(crescimentoEntradas).toFixed(0)}% em relação ao mês passado. Vale pensar em uma promoção ou em reforçar a divulgação.`,
      })
    }

    if (clientesAnalise.clientesAtivos > 0 && clientesAnalise.taxaRecompra < 20) {
      list.push({
        tone: 'atencao',
        text: `Poucos clientes voltaram a comprar esse mês (${clientesAnalise.taxaRecompra.toFixed(0)}%). Pensar em um cartão fidelidade ou um mimo na segunda compra pode ajudar a trazer eles de volta.`,
      })
    }

    if (estoqueAnalise) {
      if (estoqueAnalise.emFalta.length > 0) {
        const nomes = estoqueAnalise.emFalta.slice(0, 3).map((p) => p.nome).join(', ')
        list.push({
          tone: 'alerta',
          text: `${estoqueAnalise.emFalta.length} produto${estoqueAnalise.emFalta.length > 1 ? 's estão' : ' está'} zerado${estoqueAnalise.emFalta.length > 1 ? 's' : ''} no estoque (${nomes}${estoqueAnalise.emFalta.length > 3 ? '...' : ''}). Isso pode significar vendas perdidas — vale repor assim que possível.`,
        })
      }
      if (estoqueAnalise.estoqueBaixo.length > 0) {
        const nomes = estoqueAnalise.estoqueBaixo.slice(0, 3).map((p) => p.nome).join(', ')
        list.push({
          tone: 'atencao',
          text: `${estoqueAnalise.estoqueBaixo.length} produto${estoqueAnalise.estoqueBaixo.length > 1 ? 's estão' : ' está'} acabando (${nomes}${estoqueAnalise.estoqueBaixo.length > 3 ? '...' : ''}). Fica de olho antes que zere de vez.`,
        })
      }
      if (estoqueAnalise.parados.length > 0) {
        const nomes = estoqueAnalise.parados.slice(0, 3).map((p) => p.nome).join(', ')
        list.push({
          tone: 'atencao',
          text: `${nomes} não saiu do estoque esse mês. Pode ser hora de dar um destaque pra ele nos anúncios ou pensar numa promoção pra girar esse produto.`,
        })
      }
      if (estoqueAnalise.maisVendidos.length > 0) {
        list.push({
          tone: 'otimo',
          text: `${estoqueAnalise.maisVendidos[0].nome} foi o produto que mais saiu esse mês. Vale caprichar na divulgação dele, já que está fazendo sucesso.`,
        })
      }
    }

    if (adsData.status === 'ok' && adsData.summary?.spend > 0) {
      const roi = ((financeiroMes.totalEntradas - adsData.summary.spend) / adsData.summary.spend) * 100
      list.push({
        tone: roi >= 0 ? 'otimo' : 'alerta',
        text:
          roi >= 0
            ? `Cada real investido em anúncios voltou como ${(roi / 100 + 1).toFixed(1)}x em vendas esse mês. Está valendo a pena continuar investindo.`
            : `O dinheiro gasto em anúncios não voltou em vendas esse mês. Vale revisar as campanhas ou pausar as que não estão performando.`,
      })
    }

    if (list.length === 0) {
      list.push({ tone: 'otimo', text: 'Tudo em ordem por aqui! Nenhum ponto de atenção para este mês.' })
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
          <p className="text-sm text-slate-500">Tudo sobre o seu negócio, explicado em bom português</p>
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

          <div className="card p-5 sm:p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">{resumoConversa}</p>
          </div>

          <Section title="Como foi o dinheiro esse mês" icon={Wallet}>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard icon={TrendingUp} label="Quanto entrou" value={formatCurrency(report.financeiroMes.totalEntradas)} tone="entrada" />
              <StatCard icon={TrendingDown} label="Quanto saiu" value={formatCurrency(report.financeiroMes.totalSaidas)} tone="saida" />
              <StatCard
                icon={Wallet}
                label={report.financeiroMes.saldo >= 0 ? 'O que sobrou' : 'O que faltou'}
                value={formatCurrency(Math.abs(report.financeiroMes.saldo))}
                tone={report.financeiroMes.saldo >= 0 ? 'entrada' : 'saida'}
              />
              <StatCard
                icon={report.crescimentoEntradas >= 0 ? TrendingUp : TrendingDown}
                label="Comparado ao mês passado"
                value={`${report.crescimentoEntradas >= 0 ? '+' : ''}${report.crescimentoEntradas.toFixed(0)}%`}
                tone={report.crescimentoEntradas >= 0 ? 'entrada' : 'saida'}
              />
              <StatCard
                icon={Receipt}
                label="Cada venda deu, em média"
                value={formatCurrency(report.financeiroMes.ticketMedio)}
                tone="accent"
              />
            </div>
          </Section>

          <Section title="Seus clientes" icon={Users}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <StatCard icon={Users} label="Compraram esse mês" value={report.clientesAnalise.clientesAtivos} tone="primary" />
              <StatCard icon={UserPlus} label="Clientes novos" value={report.clientesAnalise.novosClientes} tone="entrada" />
              <StatCard icon={UserX} label="Sumidos há 30+ dias" value={report.clientesAnalise.clientesEmRisco} tone="saida" />
              <StatCard
                icon={Repeat}
                label="Voltaram a comprar"
                value={`${report.clientesAnalise.taxaRecompra.toFixed(0)}%`}
                tone="accent"
              />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Quem mais comprou esse mês</p>
            {report.clientesAnalise.topClientes.length === 0 ? (
              <p className="text-sm text-slate-500">Ninguém com nome vinculado comprou este mês.</p>
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

          <Section title="O que mais vendeu" icon={Tag}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Flower2 size={13} /> Essências campeãs de venda
                </p>
                {report.produtosAnalise.topEssencias.length === 0 ? (
                  <p className="text-sm text-slate-500">Ainda não dá pra saber — cadastre a essência favorita dos clientes.</p>
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
                    <Award size={13} /> Categoria que mais trouxe dinheiro
                  </p>
                  <p className="text-sm text-slate-200">
                    {report.produtosAnalise.categoriaLider
                      ? `${report.produtosAnalise.categoriaLider.nome} — ${formatCurrency(report.produtosAnalise.categoriaLider.total)}`
                      : 'Sem dados neste mês.'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <Target size={13} /> Categoria com a venda média mais alta
                  </p>
                  <p className="text-sm text-slate-200">
                    {report.produtosAnalise.categoriaMaiorTicket
                      ? `${report.produtosAnalise.categoriaMaiorTicket.nome} — ${formatCurrency(report.produtosAnalise.categoriaMaiorTicket.ticketMedio)} por venda`
                      : 'Sem dados neste mês.'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    É uma estimativa pelo valor médio de venda — o app não guarda o custo de cada produto pra calcular o lucro exato dessa categoria.
                  </p>
                </div>
              </div>
            </div>
          </Section>

          {report.estoqueAnalise && (
            <Section title="Seu estoque" icon={Boxes}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <StatCard icon={Boxes} label="Produtos cadastrados" value={report.estoqueAnalise.totalProdutos} tone="primary" />
                <StatCard icon={PackageX} label="Zerados" value={report.estoqueAnalise.emFalta.length} tone="saida" />
                <StatCard icon={PackageMinus} label="Acabando" value={report.estoqueAnalise.estoqueBaixo.length} tone="accent" />
                <StatCard
                  icon={Wallet}
                  label="Parado no estoque"
                  value={formatCurrency(report.estoqueAnalise.valorEstoque)}
                  tone="entrada"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <ShoppingBag size={13} /> Os que mais saíram esse mês
                  </p>
                  {report.estoqueAnalise.maisVendidos.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhuma saída de estoque registrada esse mês.</p>
                  ) : (
                    <div className="space-y-2">
                      {report.estoqueAnalise.maisVendidos.map((p, i) => (
                        <div key={p.produtoId} className="flex items-center justify-between text-sm">
                          <span className="text-slate-300">
                            #{i + 1} {p.nome}
                          </span>
                          <span className="font-semibold text-slate-200">
                            {p.quantidade} {p.unidade}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <MoonStar size={13} /> Parados, sem sair nenhuma vez
                  </p>
                  {report.estoqueAnalise.parados.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum produto parado — tudo girando bem!</p>
                  ) : (
                    <div className="space-y-2">
                      {report.estoqueAnalise.parados.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="text-slate-300">{p.nome}</span>
                          <span className="text-slate-500">
                            {p.quantidade_atual} {p.unidade}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )}

          <Section title="Seus anúncios no Meta" icon={Megaphone}>
            {adsData.status === 'loading' ? (
              <SkeletonBlock className="h-20 w-full" />
            ) : adsData.status === 'error' ? (
              <p className="text-sm text-slate-500">
                {adsData.notConfigured
                  ? 'Você ainda não conectou o Meta Ads. Veja a aba Anúncios para saber como configurar.'
                  : 'Não deu pra buscar os dados de anúncios desse mês agora.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={Wallet} label="Quanto você investiu" value={formatCurrency(adsData.summary.spend)} tone="accent" />
                <StatCard
                  icon={adsData.summary.spend > 0 && report.financeiroMes.totalEntradas >= adsData.summary.spend ? TrendingUp : TrendingDown}
                  label="Retorno sobre o investimento"
                  value={
                    adsData.summary.spend > 0
                      ? `${(((report.financeiroMes.totalEntradas - adsData.summary.spend) / adsData.summary.spend) * 100).toFixed(0)}%`
                      : '—'
                  }
                  tone={report.financeiroMes.totalEntradas >= adsData.summary.spend ? 'entrada' : 'saida'}
                />
                <StatCard icon={Award} label="Campanha que mais gastou" value={adsData.melhorCampanha?.campaign_name || '—'} tone="primary" />
                <StatCard
                  icon={Target}
                  label="Custo por cliente novo"
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

          <Section title="Ideias para melhorar" icon={Lightbulb}>
            <div className="space-y-2.5">
              {recomendacoes.map((r, i) => {
                const Icon = r.tone === 'otimo' ? CheckCircle2 : AlertTriangle
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
