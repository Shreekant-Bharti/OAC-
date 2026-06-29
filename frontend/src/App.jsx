import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'

const Dashboard      = lazy(() => import('./pages/Dashboard'))
const TopologyPage   = lazy(() => import('./pages/TopologyPage'))
const AICopilotPage  = lazy(() => import('./pages/AICopilotPage'))
const SystemHealthPage = lazy(() => import('./pages/SystemHealthPage'))
const DocsPage       = lazy(() => import('./pages/DocsPage'))
const SettingsPage   = lazy(() => import('./pages/SettingsPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-64">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin" />
        <p className="text-xs text-noc-textDim">Loading module…</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={
            <Suspense fallback={<PageLoader />}><Dashboard /></Suspense>
          } />
          <Route path="topology" element={
            <Suspense fallback={<PageLoader />}><TopologyPage /></Suspense>
          } />
          <Route path="copilot" element={
            <Suspense fallback={<PageLoader />}><AICopilotPage /></Suspense>
          } />
          <Route path="health" element={
            <Suspense fallback={<PageLoader />}><SystemHealthPage /></Suspense>
          } />
          <Route path="docs" element={
            <Suspense fallback={<PageLoader />}><DocsPage /></Suspense>
          } />
          <Route path="settings" element={
            <Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
