import CopilotChat from '../components/copilot/CopilotChat'
import { useWebSocket } from '../hooks/useWebSocket'

export default function AICopilotPage() {
  // Feed live ESP32 telemetry into the copilot as a starting context.
  // Operators can still override values in the left panel manually.
  const { telemetry } = useWebSocket()

  return (
    <div style={{ height: 'calc(100vh - 88px)' }}>
      <CopilotChat liveTelemetry={telemetry} />
    </div>
  )
}
