import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

export default function SearchableSelect({ options, value, onChange, placeholder = 'Selecionar...', clearable = true }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const selected = options.find((o) => o.value === value)
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input-field flex items-center justify-between text-left"
      >
        <span className={selected ? 'text-slate-100' : 'text-slate-500'}>{selected ? selected.label : placeholder}</span>
        <span className="flex items-center gap-1 shrink-0">
          {clearable && selected && (
            <X
              size={14}
              className="text-slate-500 hover:text-slate-200"
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
            />
          )}
          <ChevronDown size={16} className="text-slate-500" />
        </span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1.5 w-full bg-slate-800 border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
            <Search size={14} className="text-slate-500 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="bg-transparent text-sm outline-none flex-1 text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-500">Nenhum resultado</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-700/60 transition-colors ${
                    o.value === value ? 'text-primary-light bg-primary/10' : 'text-slate-200'
                  }`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
