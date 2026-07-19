import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Megaphone, Wallet, Eye, MousePointerClick, Target, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchCampaignInsights, fetchAccountSummary, MetaAdsError } from '../lib/metaAds'
import { formatCurrency } from '../lib/format'
import { getPeriodRange } from '../lib/periods'
import { useLocalStorage } from '../lib/useLocalStorage'
import PeriodFilter from '../components/PeriodFilter'
import { SkeletonBlock, SkeletonCard, SkeletonRow } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

export default function Anuncios() {
  const [period, setPeriod] = useLocalStorage('anuncios_period', 'mes')
  const [custom, setCustom] = useLocalStorage('anuncios_custom_period', {})
  const [loading, setLoading] = useState(true)
  const [errorInfo, setErrorInfo] = useState(null)
  const [summary, setSummary] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [totalEntradas, setTotalEntradas] = useState(0)

  const range = useMemo(() => getPeriodRange(period, custom), [period, custom])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setErrorInfo(null)
      try {
        const [summaryData, campaignsData, { data: transacoes, error: txError }] = await Promise.all([
          fetchAccountSummary(range.start, range.end),
          fetchCampaignInsights(range.start, range.end),
          supabase.from('transacoes').select('valor').eq('tipo', 'entrada').gte('data', range.start).lte('data', range.end),
        ])
        if (!active) return
        if (txError) throw txError

        setSummary(summaryData)
        setCampaigns(campaignsData || [])
        setTotalEntradas((transacoes || []).reduce((s, t) => s + Number(t.valor), 0))
      } catch (err) {
        if (!active) return
        if (err instanceof MetaAdsError) {
          setErrorInfo({ message: err.message, notConfigured: err.notConfigured, isAuthError: err.isAuthError })
        } else {
          setErrorInfo({ message: err.message || 'Erro ao carregar dados de anúncios.' })
        }
        setSummary(null)
        setCampaigns([])
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [range.start, range.end])

  const roi = useMemo(() => {
    const investido = summary?.spend || 0
    const lucro = totalEntradas - investido
    const roiPercent = investido > 0 ? (lucro / investido) * 100 : 0
    return { investido, lucro, roiPercent, positivo: lucro >= 0 }
  }, [summary, totalEntradas])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Megaphone size={20} className="text-primary-light" /> Anúncios
          </h1>
          <p className="text-sm text-slate-500">Desempenho das campanhas no Meta Ads</p>
        </div>
        <PeriodFilter period={period} onChange={setPeriod} custom={custom} onCustomChange={setCustom} />
      </div>

      {errorInfo ? (
        <div className="card p-6 border-accent/40">
          <EmptyState
            icon={AlertTriangle}
            title={errorInfo.notConfigured ? 'Meta Ads ainda não configurado' : 'Não foi possível carregar os anúncios'}
            message={
              errorInfo.notConfigured
                ? 'Configure META_ACCESS_TOKEN e META_AD_ACCOUNT_ID nos secrets da Edge Function do Supabase para ativar esta aba.'
                : errorInfo.isAuthError
                  ? 'O token de acesso do Meta expirou ou é inválido. Gere um novo token e atualize o secret META_ACCESS_TOKEN no Supabase.'
                  : errorInfo.message
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <StatCard icon={Wallet} label="Investido no período" value={formatCurrency(summary?.spend)} tone="accent" />
                <StatCard icon={Eye} label="Alcance total" value={(summary?.reach || 0).toLocaleString('pt-BR')} tone="primary" />
                <StatCard icon={MousePointerClick} label="Cliques totais" value={(summary?.clicks || 0).toLocaleString('pt-BR')} tone="primary" />
                <StatCard icon={Target} label="CPC médio" value={formatCurrency(summary?.cpc)} tone="accent" />
              </>
            )}
          </div>

          {!loading && (
            <div
              className={`card p-6 border-2 ${roi.positivo ? 'border-entrada bg-entrada/10' : 'border-saida bg-saida/10'}`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide ${roi.positivo ? 'text-entrada' : 'text-saida'}`}>
                {roi.positivo ? 'Lucro sobre investimento em anúncios' : 'Prejuízo sobre investimento em anúncios'}
              </p>
              <p className={`text-3xl font-extrabold mt-1 ${roi.positivo ? 'text-entrada' : 'text-saida'}`}>
                {roi.positivo ? 'LUCRO' : 'PREJUÍZO'} DE {formatCurrency(Math.abs(roi.lucro))}
              </p>
              <p className="text-sm text-slate-400 mt-2">
                Entradas no período: {formatCurrency(totalEntradas)} · Investido: {formatCurrency(roi.investido)} · ROI:{' '}
                <span className={roi.positivo ? 'text-entrada font-semibold' : 'text-saida font-semibold'}>
                  {roi.roiPercent.toFixed(0)}%
                </span>
              </p>
            </div>
          )}

          <div className="card p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-slate-200 mb-4">Investimento por campanha</h2>
            {loading ? (
              <SkeletonBlock className="h-64 w-full" />
            ) : campaigns.length === 0 ? (
              <EmptyState icon={Megaphone} title="Nenhuma campanha no período" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={campaigns} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="campaign_name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 13 }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Bar dataKey="spend" name="Investido" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-slate-200 mb-4">Campanhas</h2>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <EmptyState icon={Megaphone} title="Nenhuma campanha no período" />
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                      <th className="px-4 sm:px-2 py-2 font-semibold">Campanha</th>
                      <th className="px-2 py-2 font-semibold">Status</th>
                      <th className="px-2 py-2 font-semibold text-right">Investido</th>
                      <th className="px-2 py-2 font-semibold text-right">Alcance</th>
                      <th className="px-2 py-2 font-semibold text-right">Cliques</th>
                      <th className="px-2 py-2 font-semibold text-right">CTR</th>
                      <th className="px-2 py-2 font-semibold text-right">CPC</th>
                      <th className="px-4 sm:px-2 py-2 font-semibold text-right">Resultados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {campaigns.map((c) => (
                      <tr key={c.campaign_id} className="text-slate-300">
                        <td className="px-4 sm:px-2 py-3 font-medium text-slate-200">{c.campaign_name}</td>
                        <td className="px-2 py-3">
                          <span
                            className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${
                              c.status === 'ACTIVE' ? 'bg-entrada/15 text-entrada' : 'bg-slate-700 text-slate-400'
                            }`}
                          >
                            {c.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-right">{formatCurrency(c.spend)}</td>
                        <td className="px-2 py-3 text-right">{c.reach.toLocaleString('pt-BR')}</td>
                        <td className="px-2 py-3 text-right">{c.clicks.toLocaleString('pt-BR')}</td>
                        <td className="px-2 py-3 text-right">{c.ctr.toFixed(2)}%</td>
                        <td className="px-2 py-3 text-right">{formatCurrency(c.cpc)}</td>
                        <td className="px-4 sm:px-2 py-3 text-right">{c.results}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, tone }) {
  const toneClasses = {
    primary: 'text-primary-light bg-primary/10',
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
