import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  const showToast = useCallback(
    (message, type = 'success') => {
      const id = ++idCounter
      setToasts((prev) => [...prev, { id, message, type }])
      timers.current[id] = setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  const toast = {
    success: (msg) => showToast(msg, 'success'),
    error: (msg) => showToast(msg, 'error'),
    info: (msg) => showToast(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-slide-up flex items-start gap-2.5 rounded-xl px-4 py-3 shadow-xl border backdrop-blur-sm ${
              t.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-600/50 text-emerald-100'
                : t.type === 'error'
                  ? 'bg-red-950/90 border-red-600/50 text-red-100'
                  : 'bg-slate-800/90 border-slate-600/50 text-slate-100'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 size={20} className="shrink-0 mt-0.5 text-emerald-400" />}
            {t.type === 'error' && <XCircle size={20} className="shrink-0 mt-0.5 text-red-400" />}
            {t.type === 'info' && <Info size={20} className="shrink-0 mt-0.5 text-primary-light" />}
            <p className="text-sm flex-1 leading-snug">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
