import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Receipt, Users, RefreshCw, Sparkles, Megaphone, FileText, Radar, Boxes } from 'lucide-react'
import { useRecompraBadge } from '../context/RecompraContext'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/lancamentos', label: 'Lançamentos', icon: Receipt },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/recompra', label: 'Recompra', icon: RefreshCw, badge: true },
  { to: '/estoque', label: 'Estoque', icon: Boxes },
  { to: '/anuncios', label: 'Anúncios', icon: Megaphone },
  { to: '/relatorio', label: 'Relatório', icon: FileText },
  { to: '/performance', label: 'Performance', icon: Radar },
]

export default function Layout() {
  const { pendentesCount } = useRecompraBadge()

  return (
    <div className="min-h-screen bg-bg text-slate-100 flex">
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border/60 bg-card/40 min-h-screen sticky top-0">
        <div className="flex items-center gap-2.5 px-5 py-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-100 leading-tight">Maya Essence</p>
            <p className="text-xs text-slate-500">Gestão</p>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/15 text-primary-light'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`
              }
            >
              <span className="flex items-center gap-3">
                <item.icon size={18} />
                {item.label}
              </span>
              {item.badge && pendentesCount > 0 && (
                <span className="bg-red-500 text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                  {pendentesCount > 99 ? '99+' : pendentesCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 text-xs text-slate-600">© {new Date().getFullYear()} Maya Essence</div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-2.5 px-4 py-4 border-b border-border/60 bg-card/40 sticky top-0 z-30 backdrop-blur">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          <p className="font-bold text-slate-100">Maya Essence</p>
        </header>

        <main className="flex-1 pb-24 md:pb-8 px-4 sm:px-6 py-5 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-border/60 flex items-stretch overflow-x-auto pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2.5 px-3 min-w-[68px] shrink-0 relative text-[11px] font-medium transition-colors ${
                isActive ? 'text-primary-light' : 'text-slate-500'
              }`
            }
          >
            <span className="relative">
              <item.icon size={20} />
              {item.badge && pendentesCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                  {pendentesCount > 99 ? '99+' : pendentesCount}
                </span>
              )}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
