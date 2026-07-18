import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const PERIOD_OPTIONS = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mês' },
  { value: 'mes_passado', label: 'Mês passado' },
  { value: 'personalizado', label: 'Personalizado' },
]

function toISO(date) {
  return format(date, 'yyyy-MM-dd')
}

export function getPeriodRange(period, custom = {}) {
  const now = new Date()

  switch (period) {
    case 'hoje':
      return { start: toISO(startOfDay(now)), end: toISO(endOfDay(now)) }
    case 'semana':
      return {
        start: toISO(startOfWeek(now, { weekStartsOn: 0 })),
        end: toISO(endOfWeek(now, { weekStartsOn: 0 })),
      }
    case 'mes':
      return { start: toISO(startOfMonth(now)), end: toISO(endOfMonth(now)) }
    case 'mes_passado': {
      const last = subMonths(now, 1)
      return { start: toISO(startOfMonth(last)), end: toISO(endOfMonth(last)) }
    }
    case 'personalizado':
      return { start: custom.start || toISO(startOfMonth(now)), end: custom.end || toISO(endOfDay(now)) }
    default:
      return { start: toISO(startOfMonth(now)), end: toISO(endOfMonth(now)) }
  }
}

export function getLastNMonths(n = 6) {
  const now = new Date()
  const months = []
  for (let i = n - 1; i >= 0; i--) {
    const d = subMonths(now, i)
    months.push({
      key: format(d, 'yyyy-MM'),
      label: format(d, 'MMM', { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()),
      start: toISO(startOfMonth(d)),
      end: toISO(endOfMonth(d)),
    })
  }
  return months
}
