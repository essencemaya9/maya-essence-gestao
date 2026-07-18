export function formatCurrency(value) {
  const n = Number(value) || 0
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function parseCurrencyInput(text) {
  const digits = String(text).replace(/\D/g, '')
  return Number(digits) / 100
}

export function maskCurrencyDisplay(numericValue) {
  const n = Number(numericValue) || 0
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function maskPhone(value) {
  const digits = String(value).replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function phoneToWhatsAppLink(phone, message) {
  const digits = String(phone || '').replace(/\D/g, '')
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  const text = encodeURIComponent(message || '')
  return `https://wa.me/${withCountry}?text=${text}`
}

export function daysSince(dateStr) {
  if (!dateStr) return null
  const then = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.floor((now - then) / (1000 * 60 * 60 * 24))
  return diff
}

export function formatDateBR(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('pt-BR')
}

export function todayISO() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 10)
}
