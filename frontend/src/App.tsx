import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { useEnergyStore } from './store/useEnergyStore'
import DashboardPage from './pages/DashboardPage'
import GeneratorsPage from './pages/GeneratorsPage'
import MetersPage from './pages/MetersPage'
import ConsumersPage from './pages/ConsumersPage'
import StoragePage from './pages/StoragePage'
import RoomsPage from './pages/RoomsPage'
import CircuitsPage from './pages/CircuitsPage'
import EnergyFlowPage from './pages/EnergyFlowPage'
import HydraulicSchemaPageWrapper from './pages/HydraulicSchemaPageWrapper'
import ElectricalSchemaPageWrapper from './pages/ElectricalSchemaPageWrapper'
import TrendsPage from './pages/TrendsPage'
import SankeyPage from './pages/SankeyPage'
import OptimizerPage from './pages/OptimizerPage'
import SettingsPage from './pages/SettingsPage'
import SourcesPage from './pages/SourcesPage'
import SensorsPage from './pages/SensorsPage'
import SystemPage from './pages/SystemPage'

export default function App() {
  const syncFromApi = useEnergyStore((s) => s.syncFromApi)

  useEffect(() => {
    syncFromApi()
  }, [syncFromApi])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/generators" element={<GeneratorsPage />} />
        <Route path="/meters" element={<MetersPage />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="/sensors" element={<SensorsPage />} />
        <Route path="/consumers" element={<ConsumersPage />} />
        <Route path="/storage" element={<StoragePage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/circuits" element={<CircuitsPage />} />
        <Route path="/energy-flow" element={<EnergyFlowPage />} />
        <Route path="/hydraulic-schema" element={<HydraulicSchemaPageWrapper />} />
        <Route path="/electrical-schema" element={<ElectricalSchemaPageWrapper />} />
        <Route path="/trends" element={<TrendsPage />} />
        <Route path="/sankey" element={<SankeyPage />} />
        <Route path="/optimizer" element={<OptimizerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/system" element={<SystemPage />} />
      </Route>
    </Routes>
  )
}
