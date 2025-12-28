import { AlertTriangle } from "lucide-react"
import type { Aircraft } from "./types"

interface EmergencyAlertProps {
  aircraft: Aircraft[]
}

export function EmergencyAlert({ aircraft }: EmergencyAlertProps) {
  const emergencySquawks = aircraft.filter(a => 
    a.squawk === "7500" || a.squawk === "7600" || a.squawk === "7700"
  )

  if (emergencySquawks.length === 0) return null

  return (
    <div className="mb-6 p-4 rounded-2xl flex items-center gap-3 animate-pulse" style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)" }}>
      <AlertTriangle className="h-6 w-6 text-red-500" />
      <div>
        <span className="text-red-400 font-semibold">EMERGENCY: </span>
        {emergencySquawks.map(a => (
          <span key={a.icao} className="text-red-300 mr-3">
            {a.callsign || a.icao} Squawk {a.squawk}
            {a.squawk === "7500" && " (HIJACK)"}
            {a.squawk === "7600" && " (RADIO FAILURE)"}
            {a.squawk === "7700" && " (EMERGENCY)"}
          </span>
        ))}
      </div>
    </div>
  )
}

