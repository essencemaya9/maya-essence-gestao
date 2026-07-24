import { format, startOfMonth, endOfMonth, subMonths, isBefore } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from './supabase'
import { daysSince, todayISO } from './format'

function toISO(date) {
  return format(date, 'yyyy-MM-dd')
}

export function getMonthOptions(count = 12) {
  const now = new Date()
  const options = []
  for (let i = 0; i < count; i++) {
    const d = subMonths(now, i)
    const value = format(d, 'yyyy-MM')
    const label = format(d, 'MMMM yyyy', { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())
    options.push({ value, label })
  }
  return options
}

export function currentMonthValue() {
  return format(new Date(), 'yyyy-MM')
}

export function getMonthRange(monthValue) {
  const [year, month] = monthValue.split('-').map(Number)
  const ref = new Date(year, month - 1, 1)
  return { start: toISO(startOfMonth(ref)), end: toISO(endOfMonth(ref)) }
}

export function previousMonthValue(monthValue) {
  const [year, month] = monthValue.split('-').map(Number)
  const ref = subMonths(new Date(year, month - 1, 1), 1)
  return format(ref, 'yyyy-MM')
}

async function fetchTransacoesRange(start, end) {
  const { data, error } = await supabase
    .from('transacoes')
    .select('id, tipo, valor, categoria_id, cliente_id, data, categorias(nome), clientes(nome, essencia_favorita)')
    .gte('data', start)
    .lte('data', end)
  if (error) throw error
  return data || []
}

export function computeFinancialSummary(transacoes) {
  const entradas = transacoes.filter((t) => t.tipo === 'entrada')
  const saidas = transacoes.filter((t) => t.tipo === 'saida')
  const totalEntradas = entradas.reduce((s, t) => s + Number(t.valor), 0)
  const totalSaidas = saidas.reduce((s, t) => s + Number(t.valor), 0)
  return {
    totalEntradas,
    totalSaidas,
    saldo: totalEntradas - totalSaidas,
    ticketMedio: entradas.length > 0 ? totalEntradas / entradas.length : 0,
    numVendas: entradas.length,
  }
}

export function percentChange(current, previous) {
  if (!previous) return current > 0 ? 100 : 0
  return ((current - previous) / Math.abs(previous)) * 100
}

export function computeClientAnalysis(transacoesMes, clientesAll, range) {
  const entradasMes = transacoesMes.filter((t) => t.tipo === 'entrada' && t.cliente_id)

  const clienteIdsAtivos = new Set(entradasMes.map((t) => t.cliente_id))
  const clientesAtivos = clienteIdsAtivos.size

  const novosClientes = clientesAll.filter((c) => {
    const criado = c.created_at ? c.created_at.slice(0, 10) : null
    return criado && criado >= range.start && criado <= range.end
  }).length

  const referenceDate = isBefore(new Date(), new Date(range.end + 'T23:59:59')) ? todayISO() : range.end
  const clientesEmRisco = clientesAll.filter((c) => {
    const dias = daysSince(c.data_ultima_compra)
    return dias !== null && dias >= 30
  }).length

  const gastoPorCliente = new Map()
  entradasMes.forEach((t) => {
    gastoPorCliente.set(t.cliente_id, (gastoPorCliente.get(t.cliente_id) || 0) + Number(t.valor))
  })

  let clientesRecorrentes = 0
  clienteIdsAtivos.forEach((id) => {
    const cliente = clientesAll.find((c) => c.id === id)
    if (cliente && cliente.data_ultima_compra && cliente.data_ultima_compra < range.start) {
      clientesRecorrentes++
    }
  })
  const taxaRecompra = clientesAtivos > 0 ? (clientesRecorrentes / clientesAtivos) * 100 : 0

  const topClientes = Array.from(gastoPorCliente.entries())
    .map(([clienteId, total]) => {
      const cliente = clientesAll.find((c) => c.id === clienteId)
      return { id: clienteId, nome: cliente?.nome || 'Cliente removido', total }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return {
    clientesAtivos,
    novosClientes,
    clientesEmRisco,
    taxaRecompra,
    topClientes,
    referenceDate,
  }
}

export function computeProductAnalysis(transacoesMes) {
  const entradas = transacoesMes.filter((t) => t.tipo === 'entrada')

  const porEssencia = new Map()
  entradas.forEach((t) => {
    const essencia = t.clientes?.essencia_favorita
    if (!essencia) return
    porEssencia.set(essencia, (porEssencia.get(essencia) || 0) + Number(t.valor))
  })
  const topEssencias = Array.from(porEssencia.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)

  const porCategoria = new Map()
  entradas.forEach((t) => {
    const nome = t.categorias?.nome || 'Sem categoria'
    if (!porCategoria.has(nome)) porCategoria.set(nome, { total: 0, count: 0 })
    const bucket = porCategoria.get(nome)
    bucket.total += Number(t.valor)
    bucket.count += 1
  })

  let categoriaLider = null
  let categoriaMaiorTicket = null
  porCategoria.forEach((bucket, nome) => {
    if (!categoriaLider || bucket.total > categoriaLider.total) {
      categoriaLider = { nome, total: bucket.total }
    }
    const ticketMedio = bucket.total / bucket.count
    if (!categoriaMaiorTicket || ticketMedio > categoriaMaiorTicket.ticketMedio) {
      categoriaMaiorTicket = { nome, ticketMedio }
    }
  })

  return { topEssencias, categoriaLider, categoriaMaiorTicket }
}

export async function computeEstoqueAnalysis(range) {
  const [{ data: produtos, error: produtosError }, { data: movimentacoes, error: movError }] = await Promise.all([
    supabase.from('produtos').select('id, nome, quantidade_atual, quantidade_minima, unidade, preco_custo').eq('ativo', true),
    supabase
      .from('movimentacoes_estoque')
      .select('produto_id, quantidade, tipo, produtos(nome, unidade)')
      .eq('tipo', 'saida')
      .gte('data', range.start)
      .lte('data', range.end),
  ])

  // Tabelas de estoque ainda não configuradas — seção fica de fora do relatório sem quebrar o resto.
  if (produtosError || movError) return null

  const lista = produtos || []
  const totalProdutos = lista.length
  const emFalta = lista.filter((p) => Number(p.quantidade_atual) <= 0)
  const estoqueBaixo = lista.filter((p) => Number(p.quantidade_atual) > 0 && Number(p.quantidade_atual) <= Number(p.quantidade_minima))
  const valorEstoque = lista.reduce((s, p) => s + Number(p.quantidade_atual) * Number(p.preco_custo || 0), 0)

  const vendidoPorProduto = new Map()
  ;(movimentacoes || []).forEach((m) => {
    const atual = vendidoPorProduto.get(m.produto_id) || { nome: m.produtos?.nome || 'Produto removido', unidade: m.produtos?.unidade, quantidade: 0 }
    atual.quantidade += Number(m.quantidade)
    vendidoPorProduto.set(m.produto_id, atual)
  })

  const maisVendidos = Array.from(vendidoPorProduto.entries())
    .map(([produtoId, dados]) => ({ produtoId, ...dados }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5)

  const idsComVenda = new Set(vendidoPorProduto.keys())
  const parados = lista.filter((p) => Number(p.quantidade_atual) > 0 && !idsComVenda.has(p.id)).slice(0, 5)

  return { totalProdutos, emFalta, estoqueBaixo, valorEstoque, maisVendidos, parados }
}

export async function loadMonthlyReport(monthValue) {
  const range = getMonthRange(monthValue)
  const prevMonthValue = previousMonthValue(monthValue)
  const prevRange = getMonthRange(prevMonthValue)

  const [transacoesMes, transacoesMesAnterior, { data: clientesAll, error: clientesError }, estoqueAnalise] = await Promise.all([
    fetchTransacoesRange(range.start, range.end),
    fetchTransacoesRange(prevRange.start, prevRange.end),
    supabase.from('clientes').select('id, nome, created_at, data_ultima_compra'),
    computeEstoqueAnalysis(range),
  ])

  if (clientesError) throw clientesError

  const financeiroMes = computeFinancialSummary(transacoesMes)
  const financeiroMesAnterior = computeFinancialSummary(transacoesMesAnterior)
  const clientesAnalise = computeClientAnalysis(transacoesMes, clientesAll || [], range)
  const produtosAnalise = computeProductAnalysis(transacoesMes)

  return {
    range,
    prevRange,
    financeiroMes,
    financeiroMesAnterior,
    crescimentoEntradas: percentChange(financeiroMes.totalEntradas, financeiroMesAnterior.totalEntradas),
    clientesAnalise,
    produtosAnalise,
    estoqueAnalise,
  }
}

export async function loadLastMonthsSeries(n = 6) {
  const now = new Date()
  const months = []
  for (let i = n - 1; i >= 0; i--) {
    const d = subMonths(now, i)
    months.push({
      key: format(d, 'yyyy-MM'),
      label: format(d, 'MMM', { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()),
      ...getMonthRange(format(d, 'yyyy-MM')),
    })
  }

  const { data, error } = await supabase
    .from('transacoes')
    .select('tipo, valor, data')
    .gte('data', months[0].start)
    .lte('data', months[months.length - 1].end)
  if (error) throw error

  return months.map((m) => {
    const items = (data || []).filter((t) => t.data >= m.start && t.data <= m.end)
    return {
      mes: m.label,
      key: m.key,
      start: m.start,
      end: m.end,
      Entradas: items.filter((t) => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0),
      Saídas: items.filter((t) => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0),
    }
  })
}
