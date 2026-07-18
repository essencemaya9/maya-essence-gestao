import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isPendenteRecompra } from '../lib/recompra'

const RecompraContext = createContext(null)

export function RecompraProvider({ children }) {
  const [pendentesCount, setPendentesCount] = useState(0)

  const refreshCount = useCallback(async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, data_ultima_compra, data_ultimo_contato')

    if (error) {
      console.error('Erro ao carregar contagem de recompra:', error.message)
      return
    }

    const count = (data || []).filter(isPendenteRecompra).length
    setPendentesCount(count)
  }, [])

  useEffect(() => {
    refreshCount()

    const channel = supabase
      .channel('recompra-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, refreshCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contatos_recompra' }, refreshCount)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refreshCount])

  return (
    <RecompraContext.Provider value={{ pendentesCount, refreshCount }}>{children}</RecompraContext.Provider>
  )
}

export function useRecompraBadge() {
  const ctx = useContext(RecompraContext)
  if (!ctx) throw new Error('useRecompraBadge must be used within RecompraProvider')
  return ctx
}
