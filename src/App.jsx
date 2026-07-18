import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Lancamentos from './pages/Lancamentos'
import Clientes from './pages/Clientes'
import Recompra from './pages/Recompra'
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
          </Route>
        </Routes>
      </RecompraProvider>
    </ToastProvider>
  )
}
