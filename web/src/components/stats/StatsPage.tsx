"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts"
import { Plane, Clock, Radio, Thermometer, Cpu, HardDrive, Activity, Radar, TrendingUp, Users } from "lucide-react"

interface Stats {
  uptime: string
  aircraft_now: number
  total_seen: number
  max_range_nm: number
  max_range_icao?: string
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

const ALTITUDE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4"]

export function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [health, setHealth] = useState<ReceiverHealth | null>(null)
  const [feed, setFeed] = useState<FeedStatus | null>(null)
  const [hourly, setHourly] = useState<HourlyStat[]>([])
  const [altitude, setAltitude] = useState<AltitudeDistribution | null>(null)
  const [types, setTypes] = useState<TypeStat[]>([])
  const [operators, setOperators] = useState<OperatorStat[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, healthRes, feedRes, hourlyRes, altRes, typesRes, opsRes] = await Promise.all([
          fetch("/api/v1/stats"),
          fetch("/api/v1/receiver/health"),
          fetch("/api/v1/receiver/feed"),
          fetch("/api/v1/stats/hourly?hours=24"),
          fetch("/api/v1/stats/altitude"),
          fetch("/api/v1/stats/types?limit=8"),
          fetch("/api/v1/stats/operators?limit=8"),
        ])

        if (statsRes.ok) setStats(await statsRes.json())
        if (healthRes.ok) setHealth(await healthRes.json())
        if (feedRes.ok) setFeed(await feedRes.json())
        if (hourlyRes.ok) setHourly(await hourlyRes.json())
        if (altRes.ok) setAltitude(await altRes.json())
        if (typesRes.ok) setTypes(await typesRes.json())
        if (opsRes.ok) setOperators(await opsRes.json())
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
    count: { label: "Aircraft", color: "var(--chart-1)" },
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIHN0cm9rZT0iIzFmMjkzNyIgc3Ryb2tlLXdpZHRoPSIuNSIvPjwvZz48L3N2Zz4=')] opacity-20" />
      
      <div className="relative z-10 container mx-auto px-6 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Radar className="h-6 w-6 text-cyan-400" />
            </div>
            <h1 className="text-3xl font-semibold text-white tracking-tight">Skywatch Statistics</h1>
          </div>
          <p className="text-slate-400 text-sm">Real-time ADS-B receiver monitoring</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard
            title="Aircraft Now"
            value={stats?.aircraft_now ?? "-"}
            icon={<Plane className="h-4 w-4" />}
            subtitle="Currently tracked"
            accent="cyan"
          />
          <StatCard
            title="Total Seen"
            value={stats?.total_seen ?? "-"}
            icon={<TrendingUp className="h-4 w-4" />}
            subtitle="This session"
            accent="emerald"
          />
          <StatCard
            title="Max Range"
            value={stats?.max_range_nm ? `${stats.max_range_nm.toFixed(1)} nm` : "-"}
            icon={<Radar className="h-4 w-4" />}
            subtitle={stats?.max_range_icao || "No data"}
            accent="violet"
          />
          <StatCard
            title="Uptime"
            value={stats?.uptime ?? "-"}
            icon={<Clock className="h-4 w-4" />}
            subtitle="Session duration"
            accent="amber"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          <Card className="bg-slate-900/50 border-slate-800/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                Feed Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Connection</span>
                  <span className={`text-sm font-medium flex items-center gap-2 ${feed?.connected ? "text-emerald-400" : "text-red-400"}`}>
                    <span className={`h-2 w-2 rounded-full ${feed?.connected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                    {feed?.connected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Messages/sec</span>
                  <span className="text-white font-mono text-sm">{feed?.messages_per_sec?.toFixed(1) ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Total Messages</span>
                  <span className="text-white font-mono text-sm">{feed?.messages_total?.toLocaleString() ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Format</span>
                  <span className="text-white font-mono text-sm uppercase">{feed?.format ?? "-"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-violet-400" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <HealthBar label="CPU" value={health?.cpu_percent ?? 0} icon={<Cpu className="h-3 w-3" />} />
                <HealthBar label="Memory" value={health?.memory_percent ?? 0} icon={<HardDrive className="h-3 w-3" />} />
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm flex items-center gap-2">
                    <Thermometer className="h-3 w-3" />
                    Temperature
                  </span>
                  <span className={`text-sm font-mono ${(health?.temp_celsius ?? 0) > 70 ? "text-red-400" : "text-white"}`}>
                    {health?.temp_celsius?.toFixed(1) ?? "-"}°C
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Platform</span>
                  <span className="text-white font-mono text-sm">{health?.platform ?? "-"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Radio className="h-4 w-4 text-cyan-400" />
                Altitude Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[140px]">
                {altitudeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={altitudeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
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
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">No data</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {altitudeData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-1 text-xs text-slate-400">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ALTITUDE_COLORS[i] }} />
                    {item.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          <Card className="bg-slate-900/50 border-slate-800/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Aircraft per Hour (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                {hourly.length > 0 ? (
                  <ChartContainer config={hourlyChartConfig} className="h-full w-full">
                    <AreaChart data={hourly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="hour"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#64748b", fontSize: 10 }}
                        tickFormatter={(v) => v.split("T")[1]?.slice(0, 5) || v}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#64748b", fontSize: 10 }}
                        width={30}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        fill="url(#colorCount)"
                      />
                    </AreaChart>
                  </ChartContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">No data available</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Plane className="h-4 w-4 text-amber-400" />
                Top Aircraft Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                {types.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={types} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="type"
                        type="category"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        width={60}
                      />
                      <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">No data available</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900/50 border-slate-800/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" />
              Top Operators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {operators.length > 0 ? operators.map((op, i) => (
                <div key={op.operator} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono text-xs">#{i + 1}</span>
                    <span className="text-white text-sm truncate max-w-[120px]">{op.operator}</span>
                  </div>
                  <span className="text-emerald-400 font-mono text-sm">{op.count}</span>
                </div>
              )) : (
                <div className="col-span-full text-center text-slate-500 text-sm py-4">No operator data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, subtitle, accent }: {
  title: string
  value: string | number
  icon: React.ReactNode
  subtitle: string
  accent: "cyan" | "emerald" | "violet" | "amber"
}) {
  const colors = {
    cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/20 text-cyan-400",
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400",
    violet: "from-violet-500/20 to-violet-500/5 border-violet-500/20 text-violet-400",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400",
  }

  return (
    <Card className={`bg-gradient-to-br ${colors[accent]} backdrop-blur border`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400 text-sm">{title}</span>
          <span className={colors[accent].split(" ").pop()}>{icon}</span>
        </div>
        <div className="text-2xl font-semibold text-white font-mono">{value}</div>
        <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
      </CardContent>
    </Card>
  )
}

function HealthBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const getColor = (v: number) => {
    if (v > 80) return "bg-red-500"
    if (v > 60) return "bg-amber-500"
    return "bg-emerald-500"
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-400 text-sm flex items-center gap-2">{icon}{label}</span>
        <span className="text-white font-mono text-sm">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${getColor(value)} rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

