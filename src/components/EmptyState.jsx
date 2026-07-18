export default function EmptyState({ icon: Icon, title, message }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-4 animate-fade-in">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-border/60 flex items-center justify-center mb-4">
          <Icon size={28} className="text-slate-500" />
        </div>
      )}
      <p className="text-slate-200 font-semibold">{title}</p>
      {message && <p className="text-slate-500 text-sm mt-1 max-w-xs">{message}</p>}
    </div>
  )
}
