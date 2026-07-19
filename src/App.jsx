import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Lancamentos from './pages/Lancamentos'
import Clientes from './pages/Clientes'
import Recompra from './pages/Recompra'
import Anuncios from './pages/Anuncios'
import Relatorio from './pages/Relatorio'
import Performance from './pages/Performance'
import { ToastProvider } from './context/ToastContext'
import { RecompraProvider } from './context/RecompraContext'

export default function App() {
  return (
    <ToastProvider>
      <RecompraProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="lancamentos" element={<Lancamentos />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="recompra" element={<Recompra />} />
            <Route path="anuncios" element={<Anuncios />} />
            <Route path="relatorio" element={<Relatorio />} />
            <Route path="performance" element={<Performance />} />
          </Route>
        </Routes>
      </RecompraProvider>
    </ToastProvider>
  )
}
