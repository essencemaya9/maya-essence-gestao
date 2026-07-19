import { supabase } from './supabase'

class MetaAdsError extends Error {
  constructor(message, { notConfigured = false, isAuthError = false } = {}) {
    super(message)
    this.notConfigured = notConfigured
    this.isAuthError = isAuthError
  }
}

async function invoke(action, params) {
  const { data, error } = await supabase.functions.invoke('meta-ads-insights', {
    body: { action, ...params },
  })

  if (error) {
    const context = error.context
    let body = null
    if (context && typeof context.json === 'function') {
      try {
        body = await context.json()
      } catch {
        // resposta sem corpo JSON
      }
    }

    const status = context?.status
    const message = body?.error || error.message || 'Erro ao consultar o Meta Ads.'

    throw new MetaAdsError(message, {
      notConfigured: status === 501,
      isAuthError: status === 401 || !!body?.isAuthError,
    })
  }

  if (data?.error) {
    throw new MetaAdsError(data.error, { isAuthError: !!data.isAuthError })
  }

  return data?.data
}

export function fetchCampaignInsights(since, until) {
  return invoke('campaigns', { since, until })
}

export function fetchAccountSummary(since, until) {
  return invoke('summary', { since, until })
}

export function fetchSpendTimeseries(since, until, timeIncrement = 7) {
  return invoke('timeseries', { since, until, time_increment: timeIncrement })
}

export { MetaAdsError }
