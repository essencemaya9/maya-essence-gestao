// Supabase Edge Function — proxy seguro para o Meta Graph API (Marketing API)
//
// O token de acesso do Meta NUNCA fica no cliente. Ele é lido aqui, no servidor,
// a partir dos secrets do projeto Supabase:
//   supabase secrets set META_ACCESS_TOKEN=xxxx META_AD_ACCOUNT_ID=xxxx
//
// Deploy:
//   supabase functions deploy meta-ads-insights
//
// Chamada pelo cliente via supabase.functions.invoke('meta-ads-insights', { body }).

const GRAPH_VERSION = 'v19.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

async function callGraph(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH_BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString())
  const body = await res.json()

  if (!res.ok || body.error) {
    const message = body?.error?.message || `Erro ao consultar o Meta Graph API (status ${res.status})`
    const isAuthError = body?.error?.code === 190 || body?.error?.type === 'OAuthException'
    throw { status: isAuthError ? 401 : 502, message, isAuthError }
  }

  return body
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const accessToken = Deno.env.get('META_ACCESS_TOKEN')
  const adAccountId = Deno.env.get('META_AD_ACCOUNT_ID')

  if (!accessToken || !adAccountId) {
    return jsonResponse(
      { error: 'Meta Ads não configurado. Defina META_ACCESS_TOKEN e META_AD_ACCOUNT_ID nos secrets do projeto Supabase.' },
      501,
    )
  }

  const accountPath = `/act_${adAccountId}`

  try {
    const payload = await req.json().catch(() => ({}))
    const { action, since, until, time_increment } = payload as {
      action?: string
      since?: string
      until?: string
      time_increment?: string | number
    }

    if (!since || !until) {
      return jsonResponse({ error: 'Parâmetros "since" e "until" são obrigatórios.' }, 400)
    }

    // ---- campanhas: insights por campanha + status ----
    if (action === 'campaigns') {
      const insights = await callGraph(`${accountPath}/insights`, {
        fields: 'campaign_id,campaign_name,spend,reach,clicks,ctr,cpc,actions',
        level: 'campaign',
        time_range: JSON.stringify({ since, until }),
        access_token: accessToken,
        limit: '200',
      })

      const campaigns = await callGraph(`${accountPath}/campaigns`, {
        fields: 'id,name,status',
        limit: '200',
        access_token: accessToken,
      })

      const statusById = new Map((campaigns.data || []).map((c: any) => [c.id, c.status]))

      const data = (insights.data || []).map((row: any) => ({
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        status: statusById.get(row.campaign_id) || 'UNKNOWN',
        spend: Number(row.spend || 0),
        reach: Number(row.reach || 0),
        clicks: Number(row.clicks || 0),
        ctr: Number(row.ctr || 0),
        cpc: Number(row.cpc || 0),
        results: Array.isArray(row.actions)
          ? row.actions.reduce((sum: number, a: any) => sum + Number(a.value || 0), 0)
          : 0,
      }))

      return jsonResponse({ data })
    }

    // ---- resumo da conta no período (cards) ----
    if (action === 'summary') {
      const insights = await callGraph(`${accountPath}/insights`, {
        fields: 'spend,reach,clicks,cpc',
        level: 'account',
        time_range: JSON.stringify({ since, until }),
        access_token: accessToken,
      })

      const row = insights.data?.[0] || {}
      return jsonResponse({
        data: {
          spend: Number(row.spend || 0),
          reach: Number(row.reach || 0),
          clicks: Number(row.clicks || 0),
          cpc: Number(row.cpc || 0),
        },
      })
    }

    // ---- série temporal (semanal/diária) para gráficos de evolução ----
    if (action === 'timeseries') {
      const insights = await callGraph(`${accountPath}/insights`, {
        fields: 'spend',
        level: 'account',
        time_range: JSON.stringify({ since, until }),
        time_increment: String(time_increment || 7),
        access_token: accessToken,
      })

      const data = (insights.data || []).map((row: any) => ({
        start: row.date_start,
        end: row.date_stop,
        spend: Number(row.spend || 0),
      }))

      return jsonResponse({ data })
    }

    return jsonResponse({ error: 'Ação desconhecida. Use "campaigns", "summary" ou "timeseries".' }, 400)
  } catch (err: any) {
    if (err?.status) {
      return jsonResponse({ error: err.message, isAuthError: !!err.isAuthError }, err.status)
    }
    return jsonResponse({ error: err?.message || 'Erro inesperado ao consultar o Meta Ads.' }, 500)
  }
})
