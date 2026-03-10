import { useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useEnergyStore } from '../store/useEnergyStore'

/**
 * Hook für Navigation-basiertes Erstellen von Entitäten.
 *
 * Quellseite: navigateToCreate() speichert Draft und navigiert zur Zielseite.
 * Zielseite: isCreationTarget=true → Add-Form automatisch öffnen.
 *            saveAndReturn() speichert neue ID und navigiert zurück.
 * Quellseite: pendingReturn enthält Draft + neue ID → Form wiederherstellen.
 */
export function useCreateNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const pendingCreation = useEnergyStore((s) => s.pendingCreation)
  const setPendingCreation = useEnergyStore((s) => s.setPendingCreation)
  const completePendingCreation = useEnergyStore((s) => s.completePendingCreation)
  const clearPendingCreation = useEnergyStore((s) => s.clearPendingCreation)

  // Zur Zielseite navigieren um neue Entität zu erstellen
  const navigateToCreate = useCallback((opts: {
    targetPath: string
    assignField: string
    assignMode: 'single' | 'append'
    draft: any
    extraState?: Record<string, any>
  }) => {
    setPendingCreation({
      returnPath: location.pathname,
      draft: opts.draft,
      extraState: opts.extraState,
      assignField: opts.assignField,
      assignMode: opts.assignMode,
    })
    navigate(opts.targetPath)
  }, [navigate, location.pathname, setPendingCreation])

  // Sind wir Zielseite einer Erstellungs-Navigation?
  const isCreationTarget = !!pendingCreation
    && !pendingCreation.createdEntityId
    && pendingCreation.returnPath !== location.pathname

  // Entity erstellt → zurück zur Quellseite
  const saveAndReturn = useCallback((entityId: string) => {
    completePendingCreation(entityId)
    const returnPath = useEnergyStore.getState().pendingCreation?.returnPath
    if (returnPath) navigate(returnPath)
  }, [completePendingCreation, navigate])

  // Abbrechen → zurück ohne Erstellung
  const cancelAndReturn = useCallback(() => {
    const returnPath = pendingCreation?.returnPath
    clearPendingCreation()
    if (returnPath) navigate(returnPath)
  }, [clearPendingCreation, navigate, pendingCreation?.returnPath])

  // Rückkehr von Zielseite? (Quellseite erkennt das)
  const pendingReturn = pendingCreation?.createdEntityId
    && pendingCreation.returnPath === location.pathname
    ? pendingCreation
    : null

  // --- Flow-Edit: Aus Energiefluss-Diagramm zum Bearbeiten navigiert ---
  const flowState = location.state as { editId?: string; createNew?: boolean; initialValues?: Record<string, any>; returnTo?: string } | null
  const flowEditId = flowState?.editId || null
  const isFlowEdit = !!flowEditId && !!flowState?.returnTo

  // --- Flow-Create: Aus Energiefluss-Diagramm zum Erstellen navigiert ---
  const flowCreateNew = !!flowState?.createNew && !!flowState?.returnTo
  const flowInitialValues = flowState?.initialValues || null

  // Nach Speichern/Abbrechen zurück zum Energiefluss
  const returnFromFlow = useCallback(() => {
    if (flowState?.returnTo) {
      navigate(flowState.returnTo)
    }
  }, [navigate, flowState?.returnTo])

  return {
    navigateToCreate,
    isCreationTarget,
    saveAndReturn,
    cancelAndReturn,
    pendingReturn,
    clearPendingCreation,
    flowEditId,
    isFlowEdit,
    flowCreateNew,
    flowInitialValues,
    returnFromFlow,
  }
}
