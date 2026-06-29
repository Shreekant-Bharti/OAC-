import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { Toaster } from 'react-hot-toast'

export default function Layout() {
  return (
    <div className="flex h-screen bg-noc-bg overflow-hidden grid-bg">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
        {/* Status bar */}
        <footer className="h-7 flex items-center px-5 gap-6 border-t border-noc-border glass flex-shrink-0">
          <LogItem color="bg-noc-green" text="Telemetry pipeline active" />
          <LogItem color="bg-noc-cyan"  text="ML Engine B ready" />
          <LogItem color="bg-noc-blue"  text="RAG pipeline initialised" />
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-noc-green font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-noc-green" />
            All Systems Operational
          </div>
        </footer>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#111827', color: '#dce8ff', border: '1px solid #1a2744', fontSize: '13px' },
          success: { iconTheme: { primary: '#00e676', secondary: '#111827' } },
          error:   { iconTheme: { primary: '#ff3b3b', secondary: '#111827' } },
        }}
      />
    </div>
  )
}

function LogItem({ color, text }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${color} animate-pulse`} />
      <span className="text-[10px] text-noc-textDim font-mono">{text}</span>
    </div>
  )
}
