import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import { appTheme } from './theme'
import AppLayout from './layout/AppLayout'
import DashboardPage from './pages/DashboardPage'
import InformationSystemsPage from './pages/InformationSystemsPage'
import ModulesPage from './pages/ModulesPage'
import EnvironmentsPage from './pages/EnvironmentsPage'
import InstancesPage from './pages/InstancesPage'
import DeploymentsPage from './pages/DeploymentsPage'
import ServersPage from './pages/ServersPage'
import ClustersPage from './pages/ClustersPage'
import ZonesPage from './pages/ZonesPage'
import SegmentsPage from './pages/SegmentsPage'
import InterfacesPage from './pages/InterfacesPage'
import RoutersPage from './pages/RoutersPage'
import FirewallsPage from './pages/FirewallsPage'
import ProtocolsPage from './pages/ProtocolsPage'
import ProjectsPage from './pages/ProjectsPage'
import FlowsPage from './pages/FlowsPage'
import DiagramsPage from './pages/DiagramsPage'
import MatrixPage from './pages/MatrixPage'
import AuditPage from './pages/AuditPage'

export default function App() {
  return (
    <ConfigProvider locale={ruRU} theme={appTheme}>
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path='/' element={<DashboardPage />} />
              <Route path='/is' element={<InformationSystemsPage />} />
              <Route path='/modules' element={<ModulesPage />} />
              <Route path='/environments' element={<EnvironmentsPage />} />
              <Route path='/instances' element={<InstancesPage />} />
              <Route path='/deployments' element={<DeploymentsPage />} />
              <Route path='/servers' element={<ServersPage />} />
              <Route path='/clusters' element={<ClustersPage />} />
              <Route path='/zones' element={<ZonesPage />} />
              <Route path='/segments' element={<SegmentsPage />} />
              <Route path='/interfaces' element={<InterfacesPage />} />
              <Route path='/routers' element={<RoutersPage />} />
              <Route path='/firewalls' element={<FirewallsPage />} />
              <Route path='/protocols' element={<ProtocolsPage />} />
              <Route path='/projects' element={<ProjectsPage />} />
              <Route path='/flows' element={<FlowsPage />} />
              <Route path='/diagrams' element={<DiagramsPage />} />
              <Route path='/matrix' element={<MatrixPage />} />
              <Route path='/audit' element={<AuditPage />} />
              <Route path='*' element={<Navigate to='/' replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}
