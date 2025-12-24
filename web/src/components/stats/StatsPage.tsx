"use client"

import { useState, useEffect } from "react"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line } from "recharts"
import { Plane, Clock, Radio, Thermometer, Cpu, HardDrive, Activity, Radar, TrendingUp, TrendingDown, Users, Database, MapPin, AlertTriangle, Calendar, History, Search, ChevronUp, ChevronDown } from "lucide-react"

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
  count: number
  unique_aircraft: number
}

interface AltitudeDistribution {
  ground: number
  low: number
  medium: number
  high: number
  very_high: number
}

interface TypeStat {
  type: string
  count: number
}

interface OperatorStat {
  operator: string
  count: number
}

interface Aircraft {
  icao: string
  callsign?: string
  altitude?: number
  speed?: number
  heading?: number
  lat?: number
  lon?: number
  distance_nm?: number
  bearing?: number
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

const ALTITUDE_COLORS = [COLORS.blue, COLORS.cyan, COLORS.green, COLORS.orange, COLORS.purple]

export function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [overall, setOverall] = useState<OverallStats | null>(null)
  const [health, setHealth] = useState<ReceiverHealth | null>(null)
  const [feed, setFeed] = useState<FeedStatus | null>(null)
  const [hourly, setHourly] = useState<HourlyStat[]>([])
  const [daily, setDaily] = useState<DailyStat[]>([])
  const [altitude, setAltitude] = useState<AltitudeDistribution | null>(null)
  const [types, setTypes] = useState<TypeStat[]>([])
  const [operators, setOperators] = useState<OperatorStat[]>([])
  const [aircraft, setAircraft] = useState<Aircraft[]>([])
  const [recent, setRecent] = useState<RecentAircraft[]>([])
  const [timeRange, setTimeRange] = useState<"1H" | "6H" | "24H" | "7D">("24H")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, overallRes, healthRes, feedRes, hourlyRes, dailyRes, altRes, typesRes, opsRes, aircraftRes, recentRes] = await Promise.all([
          fetch("/api/v1/stats"),
          fetch("/api/v1/stats/overall"),
          fetch("/api/v1/receiver/health"),
          fetch("/api/v1/receiver/feed"),
          fetch("/api/v1/stats/hourly?hours=24"),
          fetch("/api/v1/stats/daily?days=7"),
          fetch("/api/v1/stats/altitude"),
          fetch("/api/v1/stats/types?limit=10"),
          fetch("/api/v1/stats/operators?limit=10"),
          fetch("/api/v1/aircraft"),
          fetch("/api/v1/stats/recent?limit=20"),
        ])

        if (statsRes.ok) setStats(await statsRes.json())
        if (overallRes.ok) setOverall(await overallRes.json())
        if (healthRes.ok) setHealth(await healthRes.json())
        if (feedRes.ok) setFeed(await feedRes.json())
        if (hourlyRes.ok) {
          const data = await hourlyRes.json()
          setHourly(Array.isArray(data) ? data : [])
        }
        if (dailyRes.ok) {
          const data = await dailyRes.json()
          setDaily(Array.isArray(data) ? data : [])
        }
        if (altRes.ok) setAltitude(await altRes.json())
        if (typesRes.ok) {
          const data = await typesRes.json()
          setTypes(Array.isArray(data) ? data : [])
        }
        if (opsRes.ok) {
          const data = await opsRes.json()
          setOperators(Array.isArray(data) ? data : [])
        }
        if (aircraftRes.ok) {
          const data = await aircraftRes.json()
          setAircraft(Array.isArray(data) ? data : [])
        }
        if (recentRes.ok) {
          const data = await recentRes.json()
          setRecent(Array.isArray(data) ? data : [])
        }
      } catch (e) {
        console.error("Failed to fetch stats:", e)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const altitudeData = altitude ? [
    { name: "GND", value: altitude.ground, full: "Ground (0-1k)" },
    { name: "LOW", value: altitude.low, full: "Low (1-10k)" },
    { name: "MED", value: altitude.medium, full: "Medium (10-25k)" },
    { name: "HIGH", value: altitude.high, full: "High (25-40k)" },
    { name: "FL400+", value: altitude.very_high, full: "Very High (40k+)" },
  ] : []

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
          <div className="mb-6 p-4 rounded-2xl flex items-center gap-3" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <span className="text-red-400 font-medium">Emergency Squawk: </span>
              {emergencySquawks.map(a => (
                <span key={a.icao} className="text-red-300 mr-3">
                  {a.callsign || a.icao} ({a.squawk})
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex-shrink-0">
              <div className="text-sm text-zinc-500 mb-1">Total Aircraft Tracked</div>
              <div className="text-4xl font-bold text-white">{stats?.total_seen?.toLocaleString() ?? "0"}</div>
              <div className="text-sm text-zinc-500 mt-1">≈ {stats?.aircraft_now ?? 0} currently visible</div>
            </div>
            
            <div className="flex-1 h-20">
              {altitudeData.length > 0 && totalAltitude > 0 && (
                <div className="h-full flex flex-col justify-center">
                  <div className="flex h-8 rounded-lg overflow-hidden gap-0.5">
                    {altitudeData.map((d, i) => (
                      <div 
                        key={d.name}
                        className="h-full flex items-end"
                        style={{ 
                          width: `${(d.value / totalAltitude) * 100}%`,
                          minWidth: d.value > 0 ? "20px" : "0"
                        }}
                      >
                        <div 
                          className="w-full rounded-sm"
                          style={{ 
                            backgroundColor: ALTITUDE_COLORS[i],
                            height: `${Math.max(20, (d.value / Math.max(...altitudeData.map(x => x.value))) * 100)}%`
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex mt-3 gap-4">
                    {altitudeData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: ALTITUDE_COLORS[i] }} />
                        <span className="text-xs text-zinc-500">{d.name}</span>
                        <span className="text-xs text-zinc-400">{((d.value / totalAltitude) * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 rounded-2xl p-6" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-semibold text-white">Activity</div>
                <div className="text-sm text-zinc-500">Aircraft detections over time</div>
              </div>
              <div className="flex rounded-lg overflow-hidden" style={{ backgroundColor: COLORS.bg }}>
                {(["1H", "6H", "24H", "7D"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className="px-3 py-1.5 text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: timeRange === range ? COLORS.cardBorder : "transparent",
                      color: timeRange === range ? COLORS.text : COLORS.textMuted,
                    }}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.blue }} />
                <span className="text-xs text-zinc-500">Detections</span>
              </div>
            </div>
            <div className="h-[200px]">
              {hourly.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="hour"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: COLORS.textDim, fontSize: 10 }}
                      tickFormatter={(v) => v.split("T")[1]?.slice(0, 5) || v}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: COLORS.textDim, fontSize: 10 }}
                      width={30}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={COLORS.blue}
                      strokeWidth={2}
                      fill="url(#colorBlue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-600 text-sm">No data</div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
              <div className="text-sm text-zinc-500 mb-1">Max Range This Session</div>
              <div className="text-3xl font-bold text-white">{stats?.max_range_nm?.toFixed(1) ?? "0"}<span className="text-lg text-zinc-500 ml-1">nm</span></div>
              <div className="flex items-center gap-2 mt-2">
                <Badge value={12} positive />
                <span className="text-xs text-zinc-500">from last session</span>
              </div>
            </div>
            <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
              <div className="text-sm text-zinc-500 mb-1">Message Rate</div>
              <div className="text-3xl font-bold text-white">{feed?.messages_per_sec?.toFixed(1) ?? "0"}<span className="text-lg text-zinc-500 ml-1">/sec</span></div>
              <div className="flex items-center gap-2 mt-2">
                <span className={`h-2 w-2 rounded-full ${feed?.connected ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-xs text-zinc-500">{feed?.connected ? "Connected" : "Disconnected"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold text-white">Live Aircraft</div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search by callsign, registration, or type"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-lg text-sm text-white placeholder-zinc-500 w-80"
                  style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.cardBorder}` }}
                />
              </div>
              <div className="flex rounded-lg overflow-hidden" style={{ backgroundColor: COLORS.bg }}>
                {["1D", "7D", "All", "1M"].map((range) => (
                  <button
                    key={range}
                    className="px-3 py-1.5 text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: range === "All" ? COLORS.cardBorder : "transparent",
                      color: range === "All" ? COLORS.text : COLORS.textMuted,
                    }}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.cardBorder}` }}>
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-500">Aircraft</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-500">Altitude</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-500">Speed</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-500">Distance</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-500">Trend</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-500">Squawk</th>
                </tr>
              </thead>
              <tbody>
                {filteredAircraft.length > 0 ? filteredAircraft.slice(0, 10).map((a) => (
                  <tr key={a.icao} style={{ borderBottom: `1px solid ${COLORS.bg}` }} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
                          <Plane className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{a.callsign || a.icao}</div>
                          <div className="text-xs text-zinc-500">{a.aircraft_type || a.registration || "Unknown"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-sm text-white font-mono">
                        {a.on_ground ? "GND" : a.altitude?.toLocaleString() ?? "-"}
                      </div>
                      <div className="text-xs text-zinc-500">ft</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-sm text-white font-mono">{a.speed ?? "-"}</div>
                      <div className="text-xs text-zinc-500">kts</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-sm font-mono" style={{ color: COLORS.blue }}>{a.distance_nm?.toFixed(1) ?? "-"}</div>
                      <div className="text-xs text-zinc-500">nm</div>
                    </td>
                    <td className="py-3 px-3">
                      <Sparkline positive={(a.vertical_rate ?? 0) >= 0} />
                    </td>
                    <td className="py-3 px-3">
                      {a.squawk ? (
                        <span className={`px-2 py-1 rounded text-xs font-mono ${
                          ["7500", "7600", "7700"].includes(a.squawk) 
                            ? "bg-red-500/20 text-red-400" 
                            : "bg-zinc-800 text-zinc-400"
                        }`}>
                          {a.squawk}
                        </span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-600">No aircraft found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredAircraft.length > 10 && (
            <div className="text-center text-zinc-500 text-sm mt-4">
              Showing 10 of {filteredAircraft.length} aircraft
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <div className="rounded-2xl p-6" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="text-lg font-semibold text-white mb-4">Top Aircraft Types</div>
            <div className="space-y-3">
              {types.length > 0 ? types.slice(0, 8).map((t, i) => (
                <div key={t.type} className="flex items-center gap-3">
                  <div className="w-6 text-xs text-zinc-500 font-mono">#{i + 1}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white">{t.type}</span>
                      <span className="text-sm font-mono text-zinc-400">{t.count}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.bg }}>
                      <div 
                        className="h-full rounded-full"
                        style={{ 
                          width: `${(t.count / (types[0]?.count || 1)) * 100}%`,
                          backgroundColor: COLORS.blue
                        }}
                      />
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center text-zinc-600 py-8">No data</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl p-6" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="text-lg font-semibold text-white mb-4">Top Operators</div>
            <div className="space-y-3">
              {operators.length > 0 ? operators.slice(0, 8).map((o, i) => (
                <div key={o.operator} className="flex items-center gap-3">
                  <div className="w-6 text-xs text-zinc-500 font-mono">#{i + 1}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white truncate max-w-[200px]">{o.operator}</span>
                      <span className="text-sm font-mono text-zinc-400">{o.count}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.bg }}>
                      <div 
                        className="h-full rounded-full"
                        style={{ 
                          width: `${(o.count / (operators[0]?.count || 1)) * 100}%`,
                          backgroundColor: COLORS.green
                        }}
                      />
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center text-zinc-600 py-8">No data</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-4 mb-6">
          <SystemCard 
            label="CPU Usage" 
            value={`${health?.cpu_percent?.toFixed(1) ?? 0}%`} 
            percent={health?.cpu_percent ?? 0}
          />
          <SystemCard 
            label="Memory" 
            value={`${health?.memory_percent?.toFixed(1) ?? 0}%`}
            subtext={`${health?.memory_used_mb ?? 0}/${health?.memory_total_mb ?? 0} MB`}
            percent={health?.memory_percent ?? 0}
          />
          <SystemCard 
            label="Temperature" 
            value={`${health?.temp_celsius?.toFixed(1) ?? 0}°C`}
            percent={((health?.temp_celsius ?? 0) / 100) * 100}
            warning={(health?.temp_celsius ?? 0) > 70}
          />
          <SystemCard 
            label="Messages" 
            value={feed?.messages_total?.toLocaleString() ?? "0"}
            subtext={`${feed?.reconnects ?? 0} reconnects`}
          />
        </div>

        <div className="text-center text-zinc-600 text-xs py-4">
          Platform: {health?.platform ?? "-"} • Uptime: {stats?.uptime ?? "-"} • {feed?.format?.toUpperCase() ?? "SBS"} feed from {feed?.host ?? "localhost"}:{feed?.port ?? 30003}
        </div>
      </div>
    </div>
  )
}

function Badge({ value, positive }: { value: number; positive: boolean }) {
  return (
    <span 
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ 
        backgroundColor: positive ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
        color: positive ? COLORS.green : COLORS.red
      }}
    >
      {positive ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {value}%
    </span>
  )
}

function Sparkline({ positive }: { positive: boolean }) {
  const data = Array.from({ length: 20 }, (_, i) => ({
    v: Math.random() * 100 + (positive ? i * 2 : -i * 2)
  }))
  
  return (
    <div className="w-20 h-6">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line 
            type="monotone" 
            dataKey="v" 
            stroke={positive ? COLORS.green : COLORS.red} 
            strokeWidth={1.5} 
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function SystemCard({ label, value, subtext, percent, warning }: { 
  label: string
  value: string
  subtext?: string
  percent?: number
  warning?: boolean
}) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
      <div className="text-xs text-zinc-500 mb-2">{label}</div>
      <div className="text-xl font-bold text-white mb-1">{value}</div>
      {subtext && <div className="text-xs text-zinc-500">{subtext}</div>}
      {percent !== undefined && (
        <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.bg }}>
          <div 
            className="h-full rounded-full transition-all"
            style={{ 
              width: `${Math.min(percent, 100)}%`,
              backgroundColor: warning ? COLORS.red : percent > 80 ? COLORS.orange : COLORS.green
            }}
          />
        </div>
      )}
    </div>
  )
}
