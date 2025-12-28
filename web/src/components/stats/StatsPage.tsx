"use client"

import { useState, useEffect } from "react"
import { Plane, Clock, Radio, Cpu, HardDrive, Activity, Radar, TrendingUp, Database, MapPin, Wifi, WifiOff, Globe, Server, Layers } from "lucide-react"

import {
  type Stats,
  type OverallStats,
  type ReceiverInfo,
  type HealthStatus,
  type ReceiverHealth,
  type FeedStatus,
  type HourlyStat,
  type DailyStat,
  type AltitudeDistribution,
  type TypeStat,
  type OperatorStat,
  type Aircraft,
  type RecentAircraft,
  type RangeStats,
  type PeakStats,
  type FlightRecord,
  COLORS,
  DbStat,
  HealthBar,
  MsgTypeStat,
} from "./components"

import { EmergencyAlert } from "./components/EmergencyAlert"
import { LiveAircraftTable } from "./components/LiveAircraftTable"
import { ActivityCharts } from "./components/ActivityCharts"
import { RecentlySeenGrid } from "./components/RecentlySeenGrid"
import { CompletedFlights } from "./components/CompletedFlights"

export function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [overall, setOverall] = useState<OverallStats | null>(null)
  const [receiver, setReceiver] = useState<ReceiverInfo | null>(null)
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [health, setHealth] = useState<ReceiverHealth | null>(null)
  const [feed, setFeed] = useState<FeedStatus | null>(null)
  const [hourly, setHourly] = useState<HourlyStat[]>([])
  const [daily, setDaily] = useState<DailyStat[]>([])
  const [altitude, setAltitude] = useState<AltitudeDistribution | null>(null)
  const [types, setTypes] = useState<TypeStat[]>([])
  const [operators, setOperators] = useState<OperatorStat[]>([])
  const [aircraft, setAircraft] = useState<Aircraft[]>([])
  const [recent, setRecent] = useState<RecentAircraft[]>([])
  const [rangeStats, setRangeStats] = useState<RangeStats | null>(null)
  const [peakStats, setPeakStats] = useState<PeakStats | null>(null)
  const [flights, setFlights] = useState<FlightRecord[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const endpoints = [
          { url: "/api/v1/stats", setter: setStats },
          { url: "/api/v1/stats/overall", setter: setOverall },
          { url: "/api/v1/receiver", setter: setReceiver },
          { url: "/api/v1/health", setter: setHealthStatus },
          { url: "/api/v1/receiver/health", setter: setHealth },
          { url: "/api/v1/receiver/feed", setter: setFeed },
          { url: "/api/v1/stats/altitude", setter: setAltitude },
          { url: "/api/v1/stats/range", setter: setRangeStats },
          { url: "/api/v1/stats/peak", setter: setPeakStats },
        ]

        const arrayEndpoints = [
          { url: "/api/v1/stats/hourly?hours=24", setter: setHourly },
          { url: "/api/v1/stats/daily?days=7", setter: setDaily },
          { url: "/api/v1/stats/types?limit=10", setter: setTypes },
          { url: "/api/v1/stats/operators?limit=10", setter: setOperators },
          { url: "/api/v1/aircraft", setter: setAircraft },
          { url: "/api/v1/stats/recent?limit=50", setter: setRecent },
          { url: "/api/v1/flights?limit=20", setter: setFlights },
        ]

        await Promise.all([
          ...endpoints.map(async ({ url, setter }) => {
            const res = await fetch(url)
            if (res.ok) setter(await res.json())
          }),
          ...arrayEndpoints.map(async ({ url, setter }) => {
            const res = await fetch(url)
            if (res.ok) {
              const data = await res.json()
              setter(Array.isArray(data) ? data : [])
            }
          }),
        ])
      } catch (e) {
        console.error("Failed to fetch stats:", e)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const altitudeData = altitude ? [
    { name: "Low", value: altitude.low ?? 0, range: "0-10k ft" },
    { name: "Medium", value: altitude.medium ?? 0, range: "10-25k ft" },
    { name: "High", value: altitude.high ?? 0, range: "25k+ ft" },
  ].filter(d => d.value > 0) : []

  const totalAltitude = altitudeData.reduce((sum, d) => sum + d.value, 0)

  const componentEntries = healthStatus?.components
    ? Object.entries(healthStatus.components)
    : []

  const formatComponentName = (name: string) =>
    name
      .split("_")
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.bg }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        <EmergencyAlert aircraft={aircraft} />

        <div className="grid lg:grid-cols-4 gap-4 mb-6">
          <div className="lg:col-span-2 rounded-2xl p-6" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-zinc-500 mb-1">Total Aircraft This Session</div>
                <div className="text-5xl font-bold text-white">{stats?.total_seen?.toLocaleString() ?? "0"}</div>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm text-zinc-400">{stats?.aircraft_now ?? 0} live</span>
                  </div>
                  <div className="text-sm text-zinc-500">Max: {stats?.max_range_nm?.toFixed(1) ?? "0"} nm</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500 mb-1">Uptime</div>
                <div className="text-lg font-mono text-white">{stats?.uptime ?? "-"}</div>
                <div className="text-xs text-zinc-500 mt-2">System</div>
                <div className={`text-sm font-medium ${healthStatus?.ready ? "text-green-500" : "text-yellow-400"}`}>
                  {healthStatus ? (healthStatus.ready ? "READY" : healthStatus.status?.toUpperCase() ?? "INIT") : "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Radio className="h-4 w-4 text-cyan-500" />
              <span className="text-sm text-zinc-400">Node</span>
            </div>
            <div className="text-xl font-semibold text-white">
              {receiver?.node_name ?? "Skywatch Node"}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-zinc-500">Active</span>
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="flex items-center gap-2 mb-3">
              {feed?.connected ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
              <span className="text-sm text-zinc-400">Feed Status</span>
            </div>
            <div className="text-2xl font-bold text-white">{feed?.messages_per_sec?.toFixed(1) ?? "0"}<span className="text-sm text-zinc-500 ml-1">/sec</span></div>
            <div className="text-sm text-zinc-500 mt-1">{feed?.messages_total?.toLocaleString() ?? "0"} total</div>
            <div className="mt-2 text-xs text-zinc-600 font-mono">{feed?.format?.toUpperCase()} @ {feed?.host}:{feed?.port}</div>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Server className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-zinc-400">Component Readiness</span>
            </div>
            {!healthStatus ? (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-zinc-500 animate-pulse" />
                <span className="text-sm text-zinc-500">Loading...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${healthStatus.ready ? "bg-green-500" : "bg-yellow-400 animate-pulse"}`} />
                  <span className="text-sm text-zinc-300">
                    {healthStatus.ready ? "All systems ready" : "Initializing components"}
                  </span>
                </div>
                {componentEntries.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {componentEntries.map(([name, state]) => (
                      <div key={name} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">{formatComponentName(name)}</span>
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${state.ready ? "bg-green-500" : "bg-red-500 animate-pulse"}`} />
                          <span className={`font-mono ${state.ready ? "text-green-400" : "text-red-400"}`}>
                            {state.ready ? "ready" : (state.message || "stopped")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {overall && (
          <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-zinc-300">Database Statistics</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <DbStat label="Unique Aircraft" value={overall.total_unique_aircraft} icon={<Plane className="h-4 w-4" />} />
              <DbStat label="Total Positions" value={overall.total_positions} icon={<MapPin className="h-4 w-4" />} />
              <DbStat label="FAA Records" value={overall.total_faa_records} icon={<Layers className="h-4 w-4" />} />
              <DbStat label="Positions (24h)" value={overall.positions_last_24h} icon={<Clock className="h-4 w-4" />} />
              <DbStat label="Aircraft (24h)" value={overall.aircraft_last_24h} icon={<TrendingUp className="h-4 w-4" />} />
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          {peakStats && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium text-zinc-300">Peak Activity</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Busiest Hour</div>
                  <div className="text-xl font-bold text-white">{peakStats.busiest_hour_count}</div>
                  <div className="text-xs text-zinc-500">{peakStats.busiest_hour ? new Date(peakStats.busiest_hour).toLocaleString() : "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Busiest Day</div>
                  <div className="text-xl font-bold text-white">{peakStats.busiest_day_count}</div>
                  <div className="text-xs text-zinc-500">{peakStats.busiest_day || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Avg Aircraft/Hour</div>
                  <div className="text-lg font-mono text-white">{peakStats.avg_aircraft_per_hour?.toFixed(1) ?? "0"}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Hours Tracked</div>
                  <div className="text-lg font-mono text-white">{peakStats.total_hours_tracked ?? 0}</div>
                </div>
              </div>
            </div>
          )}

          {rangeStats && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
              <div className="flex items-center gap-2 mb-4">
                <Radar className="h-4 w-4 text-cyan-500" />
                <span className="text-sm font-medium text-zinc-300">Range Coverage</span>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <div className="text-xs text-zinc-500 mb-1">All-Time Max Range</div>
                  <div className="text-3xl font-bold text-cyan-400">{rangeStats.all_time_max_nm?.toFixed(1) ?? "0"}<span className="text-sm text-zinc-500 ml-1">nm</span></div>
                  <div className="text-xs text-zinc-500 mt-1">ICAO: {rangeStats.all_time_max_icao || "-"}</div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-zinc-500 mb-1">Total Contacts</div>
                  <div className="text-2xl font-bold text-white">{rangeStats.total_contacts?.toLocaleString() ?? "0"}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-6 gap-1">
                {rangeStats.buckets?.slice(0, 36).map((b, i) => (
                  <div key={i} className="text-center">
                    <div className="h-8 rounded flex items-end justify-center" style={{ backgroundColor: COLORS.bg }}>
                      <div
                        className="w-full rounded"
                        style={{
                          height: `${Math.min((b.max_range_nm / (rangeStats.all_time_max_nm || 1)) * 100, 100)}%`,
                          backgroundColor: b.max_range_nm > 0 ? COLORS.cyan : COLORS.textDim,
                          minHeight: b.max_range_nm > 0 ? "2px" : "0"
                        }}
                      />
                    </div>
                    <div className="text-[8px] text-zinc-600 mt-1">{b.bearing}°</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {feed?.message_types && (
          <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-zinc-300">Message Types</span>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
              <MsgTypeStat label="MSG1" sublabel="ID" value={feed.message_types.msg1_id} />
              <MsgTypeStat label="MSG2" sublabel="Surface" value={feed.message_types.msg2_surface} />
              <MsgTypeStat label="MSG3" sublabel="Airborne" value={feed.message_types.msg3_airborne} color={COLORS.cyan} />
              <MsgTypeStat label="MSG4" sublabel="Velocity" value={feed.message_types.msg4_velocity} color={COLORS.green} />
              <MsgTypeStat label="MSG5" sublabel="Surv Alt" value={feed.message_types.msg5_surv_alt} />
              <MsgTypeStat label="MSG6" sublabel="Surv ID" value={feed.message_types.msg6_surv_id} />
              <MsgTypeStat label="MSG7" sublabel="Air2Air" value={feed.message_types.msg7_air2air} />
              <MsgTypeStat label="MSG8" sublabel="AllCall" value={feed.message_types.msg8_allcall} />
            </div>
            <div className="mt-4 flex gap-6 text-xs">
              <div><span className="text-zinc-500">Valid:</span> <span className="text-green-400 font-mono">{feed.valid_messages?.toLocaleString()}</span></div>
              <div><span className="text-zinc-500">Invalid:</span> <span className="text-red-400 font-mono">{feed.invalid_messages?.toLocaleString()}</span></div>
              <div><span className="text-zinc-500">Position:</span> <span className="text-cyan-400 font-mono">{feed.position_messages?.toLocaleString()}</span></div>
              <div><span className="text-zinc-500">Velocity:</span> <span className="text-green-400 font-mono">{feed.velocity_messages?.toLocaleString()}</span></div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Server className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-zinc-300">System Health</span>
            </div>
            <div className="space-y-3">
              <HealthBar label="CPU" value={health?.cpu_percent ?? 0} />
              <HealthBar label="Memory" value={health?.memory_percent ?? 0} suffix={`${health?.memory_used_mb ?? 0}/${health?.memory_total_mb ?? 0} MB`} />
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Temperature</span>
                <span className={`font-mono text-sm ${(health?.temp_celsius ?? 0) > 70 ? "text-red-400" : (health?.temp_celsius ?? 0) > 60 ? "text-orange-400" : "text-white"}`}>
                  {health?.temp_celsius?.toFixed(1) ?? "-"}°C
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Goroutines</span>
                <span className="font-mono text-sm text-white">{health?.goroutines ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Platform</span>
                <span className="font-mono text-xs text-zinc-400">{health?.platform ?? "-"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-zinc-300">Feed Details</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Connection</span>
                <span className={`text-sm font-medium flex items-center gap-2 ${feed?.connected ? "text-green-400" : "text-red-400"}`}>
                  <span className={`h-2 w-2 rounded-full ${feed?.connected ? "bg-green-500" : "bg-red-500"}`} />
                  {feed?.connected ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Messages/sec</span>
                <span className="font-mono text-sm text-white">{feed?.messages_per_sec?.toFixed(2) ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Total Messages</span>
                <span className="font-mono text-sm text-white">{feed?.messages_total?.toLocaleString() ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Reconnects</span>
                <span className={`font-mono text-sm ${(feed?.reconnects ?? 0) > 0 ? "text-orange-400" : "text-white"}`}>{feed?.reconnects ?? "0"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Format</span>
                <span className="font-mono text-xs text-zinc-400 uppercase">{feed?.format ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Source</span>
                <span className="font-mono text-xs text-zinc-400">{feed?.host ?? "-"}:{feed?.port ?? "-"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Layers className="h-4 w-4 text-cyan-500" />
              <span className="text-sm font-medium text-zinc-300">Altitude Distribution</span>
            </div>
            {altitudeData.length > 0 ? (
              <div className="space-y-3">
                {altitudeData.map((d, i) => (
                  <div key={d.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-zinc-400">{d.name} <span className="text-zinc-600">({d.range})</span></span>
                      <span className="font-mono text-sm text-white">{d.value.toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.bg }}>
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${(d.value / totalAltitude) * 100}%`,
                          backgroundColor: [COLORS.cyan, COLORS.blue, COLORS.purple][i]
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div className="text-xs text-zinc-500 mt-2">Total: {totalAltitude.toLocaleString()} position reports</div>
              </div>
            ) : (
              <div className="text-center text-zinc-600 py-8">No altitude data</div>
            )}
          </div>
        </div>

        <ActivityCharts hourly={hourly} daily={daily} />

        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="text-sm font-medium text-zinc-300 mb-4">Top Aircraft Types</div>
            <div className="space-y-2">
              {types.length > 0 ? types.map((t, i) => (
                <div key={t.aircraft_type} className="flex items-center gap-3">
                  <span className="w-5 text-xs text-zinc-600 font-mono">{i + 1}</span>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm text-white font-mono">{t.aircraft_type}</span>
                    <span className="text-sm text-zinc-400">{t.count}</span>
                  </div>
                  <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.bg }}>
                    <div className="h-full rounded-full" style={{ width: `${(t.count / (types[0]?.count || 1)) * 100}%`, backgroundColor: COLORS.blue }} />
                  </div>
                </div>
              )) : (
                <div className="text-center text-zinc-600 py-4">No data</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="text-sm font-medium text-zinc-300 mb-4">Top Operators</div>
            <div className="space-y-2">
              {operators.length > 0 ? operators.map((o, i) => (
                <div key={o.operator} className="flex items-center gap-3">
                  <span className="w-5 text-xs text-zinc-600 font-mono">{i + 1}</span>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm text-white truncate max-w-[180px]">{o.operator}</span>
                    <span className="text-sm text-zinc-400">{o.count}</span>
                  </div>
                  <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.bg }}>
                    <div className="h-full rounded-full" style={{ width: `${(o.count / (operators[0]?.count || 1)) * 100}%`, backgroundColor: COLORS.green }} />
                  </div>
                </div>
              )) : (
                <div className="text-center text-zinc-600 py-4">No operator data yet</div>
              )}
            </div>
          </div>
        </div>

        <LiveAircraftTable aircraft={aircraft} />

        <CompletedFlights flights={flights} />

        <RecentlySeenGrid recent={recent} />
      </div>
    </div>
  )
}
