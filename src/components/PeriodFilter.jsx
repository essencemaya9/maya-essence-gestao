import { PERIOD_OPTIONS } from '../lib/periods'

export default function PeriodFilter({ period, onChange, custom, onCustomChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5 bg-slate-800/60 border border-border/60 rounded-xl p-1.5">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              period === opt.value ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {period === 'personalizado' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="input-field !py-1.5 !text-xs w-[140px]"
            value={custom.start || ''}
            onChange={(e) => onCustomChange({ ...custom, start: e.target.value })}
          />
          <span className="text-slate-500 text-xs">até</span>
          <input
            type="date"
            className="input-field !py-1.5 !text-xs w-[140px]"
            value={custom.end || ''}
            onChange={(e) => onCustomChange({ ...custom, end: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}
