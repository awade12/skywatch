"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line } from "recharts"
import { Plane, Clock, Radio, Thermometer, Cpu, HardDrive, Activity, Radar, TrendingUp, Users, Database, MapPin, Navigation, Gauge, AlertTriangle, Calendar, History } from "lucide-react"

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

const ALTITUDE_COLORS = ["#412221", "#5a3a2a", "#7a5a3a", "#E99C33", "#d4a84a"]
const ACCENT = "#E99C33"
const CARD_BG = "#161815"
const CARD_BORDER = "#1C2723"

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
    { name: "Ground", value: altitude.ground, label: "0-1k ft" },
    { name: "Low", value: altitude.low, label: "1-10k ft" },
    { name: "Medium", value: altitude.medium, label: "10-25k ft" },
    { name: "High", value: altitude.high, label: "25-40k ft" },
    { name: "Very High", value: altitude.very_high, label: "40k+ ft" },
  ] : []

  const hourlyChartConfig = {
    count: { label: "Aircraft", color: ACCENT },
  }

  const dailyChartConfig = {
    count: { label: "Positions", color: "#1C2723" },
    unique_aircraft: { label: "Aircraft", color: ACCENT },
  }

  const emergencySquawks = aircraft.filter(a => 
    a.squawk === "7500" || a.squawk === "7600" || a.squawk === "7700"
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#131313" }}>
      <div className="container mx-auto px-6 py-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg" style={{ backgroundColor: "#1C2723", border: "1px solid #2a3a32" }}>
                <Radar className="h-6 w-6" style={{ color: ACCENT }} />
              </div>
              <h1 className="text-3xl font-semibold text-white tracking-tight">Skywatch</h1>
            </div>
            <p className="text-neutral-500 text-sm">Real-time ADS-B receiver monitoring</p>
          </div>
          <a href="/" className="text-neutral-500 hover:text-white text-sm transition-colors">← Back</a>
        </header>

        {emergencySquawks.length > 0 && (
          <div className="mb-6 p-4 rounded-lg animate-pulse" style={{ backgroundColor: "#412221", border: "1px solid #5a2a2a" }}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-400" />
              <div>
                <div className="text-red-400 font-semibold">Emergency Squawk Detected</div>
                <div className="text-red-300/80 text-sm">
                  {emergencySquawks.map(a => (
                    <span key={a.icao} className="mr-4">
                      {a.callsign || a.icao} - {a.squawk}
                      {a.squawk === "7500" && " (Hijack)"}
                      {a.squawk === "7600" && " (Radio Failure)"}
                      {a.squawk === "7700" && " (Emergency)"}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard title="Aircraft Now" value={stats?.aircraft_now ?? "-"} subtitle="Currently tracked" />
          <StatCard title="Total Seen" value={stats?.total_seen ?? "-"} subtitle="This session" />
          <StatCard title="Max Range" value={stats?.max_range_nm ? `${stats.max_range_nm.toFixed(1)} nm` : "-"} subtitle={stats?.max_range_icao || "—"} />
          <StatCard title="Uptime" value={stats?.uptime ?? "-"} subtitle="Session duration" />
        </div>

        {overall && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-6">
            <MiniStatCard label="Total Aircraft" value={overall.total_unique_aircraft?.toLocaleString() ?? "-"} />
            <MiniStatCard label="Total Positions" value={overall.total_positions?.toLocaleString() ?? "-"} />
            <MiniStatCard label="FAA Records" value={overall.total_faa_records?.toLocaleString() ?? "-"} />
            <MiniStatCard label="Positions (24h)" value={overall.positions_last_24h?.toLocaleString() ?? "-"} />
            <MiniStatCard label="Aircraft (24h)" value={overall.aircraft_last_24h?.toLocaleString() ?? "-"} />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4" style={{ color: ACCENT }} />
              <span className="text-sm font-medium text-neutral-300">Feed Status</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 text-sm">Connection</span>
                <span className={`text-sm font-medium flex items-center gap-2 ${feed?.connected ? "text-green-500" : "text-red-500"}`}>
                  <span className={`h-2 w-2 rounded-full ${feed?.connected ? "bg-green-500" : "bg-red-500"}`} />
                  {feed?.connected ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 text-sm">Messages/sec</span>
                <span className="text-white font-mono text-sm">{feed?.messages_per_sec?.toFixed(1) ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 text-sm">Total Messages</span>
                <span className="text-white font-mono text-sm">{feed?.messages_total?.toLocaleString() ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 text-sm">Reconnects</span>
                <span className="text-white font-mono text-sm">{feed?.reconnects ?? "0"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 text-sm">Source</span>
                <span className="text-neutral-400 font-mono text-xs">{feed?.host ?? "-"}:{feed?.port ?? "-"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="h-4 w-4" style={{ color: ACCENT }} />
              <span className="text-sm font-medium text-neutral-300">System Health</span>
            </div>
            <div className="space-y-3">
              <HealthBar label="CPU" value={health?.cpu_percent ?? 0} />
              <HealthBar label="Memory" value={health?.memory_percent ?? 0} />
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 text-sm">Temperature</span>
                <span className={`text-sm font-mono ${(health?.temp_celsius ?? 0) > 70 ? "text-red-400" : "text-white"}`}>
                  {health?.temp_celsius?.toFixed(1) ?? "-"}°C
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 text-sm">Memory</span>
                <span className="text-neutral-400 font-mono text-xs">{health?.memory_used_mb ?? "-"} / {health?.memory_total_mb ?? "-"} MB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 text-sm">Platform</span>
                <span className="text-neutral-400 font-mono text-xs">{health?.platform ?? "-"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Radio className="h-4 w-4" style={{ color: ACCENT }} />
              <span className="text-sm font-medium text-neutral-300">Altitude Distribution</span>
            </div>
            <div className="h-[130px]">
              {altitudeData.length > 0 && altitudeData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={altitudeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {altitudeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={ALTITUDE_COLORS[index]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-neutral-600 text-sm">No data</div>
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
              {altitudeData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-1 text-xs text-neutral-500">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: ALTITUDE_COLORS[i] }} />
                  {item.label}: {item.value}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <div className="text-sm font-medium text-neutral-300 mb-4">Aircraft per Hour (24h)</div>
            <div className="h-[180px]">
              {hourly.length > 0 ? (
                <ChartContainer config={hourlyChartConfig} className="h-full w-full">
                  <AreaChart data={hourly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="hour"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#525252", fontSize: 10 }}
                      tickFormatter={(v) => v.split("T")[1]?.slice(0, 5) || v}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#525252", fontSize: 10 }}
                      width={30}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={ACCENT}
                      strokeWidth={2}
                      fill="url(#colorCount)"
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-neutral-600 text-sm">No data available</div>
              )}
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <div className="text-sm font-medium text-neutral-300 mb-4">Daily Activity (7 days)</div>
            <div className="h-[180px]">
              {daily.length > 0 ? (
                <ChartContainer config={dailyChartConfig} className="h-full w-full">
                  <LineChart data={daily} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#525252", fontSize: 10 }}
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short' })}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#525252", fontSize: 10 }}
                      width={40}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="unique_aircraft" stroke={ACCENT} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="count" stroke="#3a4a42" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-neutral-600 text-sm">No data available</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <div className="text-sm font-medium text-neutral-300 mb-4">Top Aircraft Types</div>
            <div className="h-[220px]">
              {types.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={types} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="type"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#737373", fontSize: 11 }}
                      width={70}
                    />
                    <Bar dataKey="count" fill={ACCENT} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-neutral-600 text-sm">No data available</div>
              )}
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <div className="text-sm font-medium text-neutral-300 mb-4">Top Operators</div>
            <div className="h-[220px]">
              {operators.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={operators} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="operator"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#737373", fontSize: 11 }}
                      width={100}
                    />
                    <Bar dataKey="count" fill="#3a4a42" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-neutral-600 text-sm">No data available</div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <div className="text-sm font-medium text-neutral-300 mb-4">Currently Tracked ({aircraft.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: CARD_BORDER }}>
                  <th className="text-left py-2 px-2 text-neutral-500 font-medium text-xs">Callsign</th>
                  <th className="text-left py-2 px-2 text-neutral-500 font-medium text-xs">ICAO</th>
                  <th className="text-left py-2 px-2 text-neutral-500 font-medium text-xs">Reg</th>
                  <th className="text-left py-2 px-2 text-neutral-500 font-medium text-xs">Type</th>
                  <th className="text-right py-2 px-2 text-neutral-500 font-medium text-xs">Alt</th>
                  <th className="text-right py-2 px-2 text-neutral-500 font-medium text-xs">Spd</th>
                  <th className="text-right py-2 px-2 text-neutral-500 font-medium text-xs">Hdg</th>
                  <th className="text-right py-2 px-2 text-neutral-500 font-medium text-xs">Dist</th>
                  <th className="text-left py-2 px-2 text-neutral-500 font-medium text-xs">Sqk</th>
                </tr>
              </thead>
              <tbody>
                {aircraft.length > 0 ? aircraft.slice(0, 15).map((a) => (
                  <tr key={a.icao} className="border-b hover:bg-white/[0.02]" style={{ borderColor: "#1a1a1a" }}>
                    <td className="py-2 px-2 text-white font-mono text-xs">{a.callsign || "-"}</td>
                    <td className="py-2 px-2 text-neutral-500 font-mono text-xs">{a.icao}</td>
                    <td className="py-2 px-2 text-neutral-400 text-xs">{a.registration || "-"}</td>
                    <td className="py-2 px-2 text-neutral-400 text-xs">{a.aircraft_type || "-"}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs">
                      {a.on_ground ? <span style={{ color: ACCENT }}>GND</span> : <span className="text-white">{a.altitude?.toLocaleString() ?? "-"}</span>}
                    </td>
                    <td className="py-2 px-2 text-right text-white font-mono text-xs">{a.speed ?? "-"}</td>
                    <td className="py-2 px-2 text-right text-neutral-400 font-mono text-xs">{a.heading ? `${a.heading}°` : "-"}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs" style={{ color: ACCENT }}>{a.distance_nm?.toFixed(1) ?? "-"}</td>
                    <td className="py-2 px-2">
                      <span className={`font-mono text-xs ${
                        a.squawk === "7500" || a.squawk === "7600" || a.squawk === "7700" 
                          ? "text-red-500 font-bold" 
                          : "text-neutral-500"
                      }`}>
                        {a.squawk || "-"}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-neutral-600 text-sm">No aircraft currently tracked</td>
                  </tr>
                )}
              </tbody>
            </table>
            {aircraft.length > 15 && (
              <div className="text-center text-neutral-600 text-xs mt-3">
                Showing 15 of {aircraft.length} aircraft
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <div className="text-sm font-medium text-neutral-300 mb-4">Recently Seen</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {recent.length > 0 ? recent.map((a) => (
              <div key={a.icao} className="p-3 rounded-lg" style={{ backgroundColor: "#131313", border: `1px solid ${CARD_BORDER}` }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-mono text-sm">{a.callsign || a.icao}</span>
                  <span className="text-neutral-600 text-xs">{a.registration || ""}</span>
                </div>
                <div className="text-neutral-500 text-xs truncate">{a.operator || a.aircraft_type || "-"}</div>
                <div className="text-neutral-600 text-xs mt-1">
                  {new Date(a.last_seen).toLocaleTimeString()}
                </div>
              </div>
            )) : (
              <div className="col-span-full text-center text-neutral-600 text-sm py-4">No recent aircraft</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, subtitle }: { title: string; value: string | number; subtitle: string }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <div className="text-neutral-500 text-xs mb-1">{title}</div>
      <div className="text-2xl font-semibold text-white font-mono" style={{ color: ACCENT }}>{value}</div>
      <div className="text-neutral-600 text-xs mt-1">{subtitle}</div>
    </div>
  )
}

function MiniStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: "#131313", border: `1px solid ${CARD_BORDER}` }}>
      <div className="text-neutral-600 text-xs mb-1">{label}</div>
      <div className="text-white font-mono text-sm">{value}</div>
    </div>
  )
}

function HealthBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-neutral-500 text-sm">{label}</span>
        <span className="text-white font-mono text-xs">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "#1a1a1a" }}>
        <div 
          className="h-full rounded-full transition-all duration-500" 
          style={{ 
            width: `${Math.min(value, 100)}%`,
            backgroundColor: value > 80 ? "#412221" : value > 60 ? ACCENT : "#1C2723"
          }} 
        />
      </div>
    </div>
  )
}
