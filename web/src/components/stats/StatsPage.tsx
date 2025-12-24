"use client"

import { useState, useEffect } from "react"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, AreaChart, Area, LineChart, Line } from "recharts"
import { Plane, Clock, Radio, Thermometer, Cpu, HardDrive, Activity, Radar, TrendingUp, Database, MapPin, AlertTriangle, Search, ChevronUp, ChevronDown, Wifi, WifiOff, Globe, Server, Layers, Navigation } from "lucide-react"

interface Stats {
  uptime: string
  aircraft_now: number
  total_seen: number
  max_range_nm: number
  max_range_icao?: string
}

interface OverallStats {
  total_unique_aircraft: number
  total_positions: number
  total_faa_records: number
  positions_last_24h: number
  aircraft_last_24h: number
}

interface ReceiverInfo {
  lat: number
  lon: number
}

interface HealthStatus {
  status: string
  uptime: string
  aircraft_count: number
}

interface ReceiverHealth {
  cpu_percent: number
  memory_percent: number
  memory_used_mb: number
  memory_total_mb: number
  temp_celsius: number
  uptime: string
  goroutines: number
  platform: string
}

interface FeedStatus {
  connected: boolean
  last_message: string
  messages_total: number
  messages_per_sec: number
  reconnects: number
  host: string
  port: number
  format: string
}

interface HourlyStat {
  hour: string
  count: number
}

interface DailyStat {
  date: string
  unique_aircraft: number
  total_positions: number
}

interface AltitudeDistribution {
  ground?: number
  low?: number
  medium?: number
  high?: number
  very_high?: number
}

interface TypeStat {
  aircraft_type: string
  count: number
}

interface OperatorStat {
  operator: string
  count: number
}

interface Aircraft {
  icao: string
  callsign?: string
  alt_ft?: number
  speed_kt?: number
  heading?: number
  lat?: number
  lon?: number
  distance_nm?: number
  bearing?: number
  bearing_cardinal?: string
  squawk?: string
  registration?: string
  aircraft_type?: string
  operator?: string
  last_seen: string
  on_ground?: boolean
  vertical_rate?: number
}

interface RecentAircraft {
  icao: string
  callsign?: string
  registration?: string
  aircraft_type?: string
  operator?: string
  lat?: number
  lon?: number
  alt_ft?: number
  speed_kt?: number
  heading?: number
  squawk?: string
  on_ground?: boolean
  last_seen: string
}

const COLORS = {
  bg: "#0a0a0f",
  card: "#12121a",
  cardBorder: "#1e1e2e",
  blue: "#3b82f6",
  green: "#10b981",
  red: "#ef4444",
  orange: "#f59e0b",
  cyan: "#06b6d4",
  purple: "#8b5cf6",
  text: "#ffffff",
  textMuted: "#71717a",
  textDim: "#3f3f46",
}

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
  const [searchQuery, setSearchQuery] = useState("")

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
        ]

        const arrayEndpoints = [
          { url: "/api/v1/stats/hourly?hours=24", setter: setHourly },
          { url: "/api/v1/stats/daily?days=7", setter: setDaily },
          { url: "/api/v1/stats/types?limit=10", setter: setTypes },
          { url: "/api/v1/stats/operators?limit=10", setter: setOperators },
          { url: "/api/v1/aircraft", setter: setAircraft },
          { url: "/api/v1/stats/recent?limit=50", setter: setRecent },
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

  const emergencySquawks = aircraft.filter(a => 
    a.squawk === "7500" || a.squawk === "7600" || a.squawk === "7700"
  )

  const filteredAircraft = aircraft.filter(a => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      a.icao?.toLowerCase().includes(q) ||
      a.callsign?.toLowerCase().includes(q) ||
      a.registration?.toLowerCase().includes(q) ||
      a.aircraft_type?.toLowerCase().includes(q) ||
      a.operator?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.bg }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {emergencySquawks.length > 0 && (
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
        )}

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
                <div className="text-xs text-zinc-500 mt-2">Status</div>
                <div className={`text-sm font-medium ${healthStatus?.status === "ok" ? "text-green-500" : "text-red-500"}`}>
                  {healthStatus?.status?.toUpperCase() ?? "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-cyan-500" />
              <span className="text-sm text-zinc-400">Receiver Location</span>
            </div>
            <div className="font-mono text-white text-lg">
              {receiver?.lat?.toFixed(4) ?? "-"}°
            </div>
            <div className="font-mono text-white text-lg">
              {receiver?.lon?.toFixed(4) ?? "-"}°
            </div>
            <div className="mt-3 text-xs text-zinc-500">
              Max range: {stats?.max_range_icao ?? "-"}
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

        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="text-sm font-medium text-zinc-300 mb-4">Hourly Activity (24h)</div>
            <div className="h-[180px]">
              {hourly.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fill: COLORS.textDim, fontSize: 10 }} tickFormatter={(v) => v.split("T")[1]?.slice(0, 5) || v} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: COLORS.textDim, fontSize: 10 }} width={30} />
                    <Area type="monotone" dataKey="count" stroke={COLORS.blue} strokeWidth={2} fill="url(#hourlyGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-600">No data</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="text-sm font-medium text-zinc-300 mb-4">Daily Activity (7 days)</div>
            <div className="h-[180px]">
              {daily.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: COLORS.textDim, fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short' })} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: COLORS.textDim, fontSize: 10 }} width={40} />
                    <Bar dataKey="unique_aircraft" fill={COLORS.cyan} radius={[4, 4, 0, 0]} name="Aircraft" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-600">No data</div>
              )}
            </div>
            {daily.length > 0 && (
              <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                <span>Yesterday: {daily[0]?.unique_aircraft ?? 0} aircraft, {daily[0]?.total_positions?.toLocaleString() ?? 0} positions</span>
              </div>
            )}
          </div>
        </div>

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

        <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-zinc-300">Live Aircraft ({aircraft.length})</div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search callsign, reg, type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg text-sm text-white placeholder-zinc-500 w-64"
                style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.cardBorder}` }}
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.cardBorder}` }}>
                  <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Callsign</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">ICAO</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Reg</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Type</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">Alt (ft)</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">Spd (kt)</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">Hdg</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">V/S</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">Dist</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Brg</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Sqk</th>
                </tr>
              </thead>
              <tbody>
                {filteredAircraft.length > 0 ? filteredAircraft.slice(0, 15).map((a) => (
                  <tr key={a.icao} style={{ borderBottom: `1px solid ${COLORS.bg}` }} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-2 font-mono text-white">{a.callsign || "-"}</td>
                    <td className="py-2 px-2 font-mono text-xs text-zinc-500">{a.icao}</td>
                    <td className="py-2 px-2 text-zinc-400">{a.registration || "-"}</td>
                    <td className="py-2 px-2 font-mono text-zinc-400">{a.aircraft_type || "-"}</td>
                    <td className="py-2 px-2 text-right font-mono">
                      {a.on_ground ? <span className="text-orange-400">GND</span> : <span className="text-white">{a.alt_ft?.toLocaleString() ?? "-"}</span>}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-white">{a.speed_kt ?? "-"}</td>
                    <td className="py-2 px-2 text-right font-mono text-zinc-400">{a.heading ? `${a.heading}°` : "-"}</td>
                    <td className="py-2 px-2 text-right font-mono">
                      {a.vertical_rate ? (
                        <span className={a.vertical_rate > 0 ? "text-green-400" : "text-red-400"}>
                          {a.vertical_rate > 0 ? "+" : ""}{a.vertical_rate}
                        </span>
                      ) : <span className="text-zinc-600">-</span>}
                    </td>
                    <td className="py-2 px-2 text-right font-mono" style={{ color: COLORS.cyan }}>{a.distance_nm?.toFixed(1) ?? "-"}</td>
                    <td className="py-2 px-2 text-zinc-400">{a.bearing_cardinal ?? "-"}</td>
                    <td className="py-2 px-2">
                      {a.squawk ? (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                          ["7500", "7600", "7700"].includes(a.squawk) ? "bg-red-500/20 text-red-400" : "text-zinc-400"
                        }`}>{a.squawk}</span>
                      ) : <span className="text-zinc-600">-</span>}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={11} className="py-8 text-center text-zinc-600">No aircraft</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
          <div className="text-sm font-medium text-zinc-300 mb-4">Recently Seen ({recent.length})</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recent.slice(0, 12).map((a) => (
              <div key={a.icao + a.last_seen} className="p-3 rounded-xl" style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.cardBorder}` }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-white text-sm">{a.callsign || a.icao}</span>
                  <span className="text-xs text-zinc-600">{a.aircraft_type}</span>
                </div>
                <div className="text-xs text-zinc-500 truncate">{a.registration} • {a.operator || "-"}</div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-zinc-600">{a.alt_ft?.toLocaleString() ?? "-"} ft</span>
                  <span className="text-zinc-600">{a.speed_kt ?? "-"} kt</span>
                  <span className="text-zinc-500">{new Date(a.last_seen).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DbStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-zinc-500 mb-1">{icon}<span className="text-xs">{label}</span></div>
      <div className="text-xl font-bold text-white font-mono">{value?.toLocaleString() ?? "-"}</div>
    </div>
  )
}

function HealthBar({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  const color = value > 80 ? COLORS.red : value > 60 ? COLORS.orange : COLORS.green
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-zinc-500">{label}</span>
        <span className="font-mono text-sm text-white">{value.toFixed(1)}%{suffix && <span className="text-zinc-500 text-xs ml-1">({suffix})</span>}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.bg }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
