import { daysSince } from './format'

export function isPendenteRecompra(cliente) {
  const dUltimaCompra = daysSince(cliente.data_ultima_compra)
  if (dUltimaCompra === null || dUltimaCompra < 30) return false
  const dUltimoContato = daysSince(cliente.data_ultimo_contato)
  if (dUltimoContato !== null && dUltimoContato < 30) return false
  return true
}

export function faixaRecompra(dias) {
  if (dias >= 30 && dias <= 45) return '30-45'
  if (dias > 45 && dias <= 60) return '45-60'
  if (dias > 60 && dias <= 90) return '60-90'
  return '90+'
}
