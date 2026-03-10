import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import GeneratorsPage from './pages/GeneratorsPage'
import MetersPage from './pages/MetersPage'
import ConsumersPage from './pages/ConsumersPage'
import StoragePage from './pages/StoragePage'
import RoomsPage from './pages/RoomsPage'
import CircuitsPage from './pages/CircuitsPage'
import EnergyFlowPage from './pages/EnergyFlowPage'
import SankeyPage from './pages/SankeyPage'
import SettingsPage from './pages/SettingsPage'
import SystemPage from './pages/SystemPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/generators" element={<GeneratorsPage />} />
        <Route path="/meters" element={<MetersPage />} />
        <Route path="/consumers" element={<ConsumersPage />} />
        <Route path="/storage" element={<StoragePage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/circuits" element={<CircuitsPage />} />
        <Route path="/energy-flow" element={<EnergyFlowPage />} />
        <Route path="/sankey" element={<SankeyPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/system" element={<SystemPage />} />
      </Route>
    </Routes>
  )
}
