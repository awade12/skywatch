import { Clock, Calendar } from "lucide-react"
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis } from "recharts"
import type { HourlyStat, DailyStat } from "./types"

interface ActivityChartsProps {
  hourly: HourlyStat[]
  daily: DailyStat[]
}

export function ActivityCharts({ hourly, daily }: ActivityChartsProps) {
  return (
    <div className="grid lg:grid-cols-2 gap-4 mb-6">
      <div 
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: "#141418", border: "1px solid #232329" }}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div 
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#1c1c22" }}
            >
              <Clock className="w-4 h-4 text-zinc-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-200">Hourly Activity</div>
              <div className="text-xs text-zinc-500">Last 24 hours</div>
            </div>
          </div>
          
          <div className="h-[160px]">
            {hourly.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="hour" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: "#3f3f46", fontSize: 10 }} 
                    tickFormatter={(v) => v.split("T")[1]?.slice(0, 5) || v} 
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: "#3f3f46", fontSize: 10 }} 
                    width={30} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    fill="url(#hourlyGrad)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-zinc-600">No data</div>
            )}
          </div>
        </div>
      </div>

      <div 
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: "#141418", border: "1px solid #232329" }}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div 
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#1c1c22" }}
            >
              <Calendar className="w-4 h-4 text-zinc-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-200">Daily Activity</div>
              <div className="text-xs text-zinc-500">Last 7 days</div>
            </div>
          </div>
          
          <div className="h-[160px]">
            {daily.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <XAxis 
                    dataKey="date" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: "#3f3f46", fontSize: 10 }} 
                    tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short' })} 
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: "#3f3f46", fontSize: 10 }} 
                    width={40} 
                  />
                  <Bar 
                    dataKey="unique_aircraft" 
                    fill="#52525b" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-zinc-600">No data</div>
            )}
          </div>

          {daily.length > 0 && (
            <div 
              className="mt-4 pt-3 text-xs text-zinc-500"
              style={{ borderTop: "1px solid #232329" }}
            >
              Yesterday: {daily[daily.length - 2]?.unique_aircraft ?? 0} aircraft, {daily[daily.length - 2]?.total_positions?.toLocaleString() ?? 0} positions
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
