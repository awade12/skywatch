"use client"

import { useState, useEffect } from "react"

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
} from "./components"

import { EmergencyAlert } from "./components/EmergencyAlert"
import { LiveAircraftTable } from "./components/LiveAircraftTable"
import { ActivityCharts } from "./components/ActivityCharts"
import { RecentlySeenGrid } from "./components/RecentlySeenGrid"
import { CompletedFlights } from "./components/CompletedFlights"
import { SessionStats } from "./components/SessionStats"
import { NodeCard } from "./components/NodeCard"
import { FeedStatusCard } from "./components/FeedStatusCard"
import { ComponentReadiness } from "./components/ComponentReadiness"
import { DatabaseStats } from "./components/DatabaseStats"
import { PeakActivityCard } from "./components/PeakActivityCard"
import { RangeCoverageCard } from "./components/RangeCoverageCard"
import { MessageTypesCard } from "./components/MessageTypesCard"
import { SystemHealthCard } from "./components/SystemHealthCard"
import { FeedDetailsCard } from "./components/FeedDetailsCard"
import { AltitudeDistribution as AltitudeDistributionCard } from "./components/AltitudeDistribution"
import { TopTypesCard, TopOperatorsCard } from "./components/TopListCard"
import * as mock from "./mockData"

const USE_MOCK_DATA = import.meta.env.DEV

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
    if (USE_MOCK_DATA) {
      setStats(mock.MOCK_STATS)
      setOverall(mock.MOCK_OVERALL)
      setReceiver(mock.MOCK_RECEIVER)
      setHealthStatus(mock.MOCK_HEALTH_STATUS)
      setHealth(mock.MOCK_HEALTH)
      setFeed(mock.MOCK_FEED)
      setHourly(mock.MOCK_HOURLY)
      setDaily(mock.MOCK_DAILY)
      setAltitude(mock.MOCK_ALTITUDE)
      setTypes(mock.MOCK_TYPES)
      setOperators(mock.MOCK_OPERATORS)
      setAircraft(mock.MOCK_AIRCRAFT)
      setRecent(mock.MOCK_RECENT)
      setRangeStats(mock.MOCK_RANGE_STATS)
      setPeakStats(mock.MOCK_PEAK_STATS)
      setFlights(mock.MOCK_FLIGHTS)
      return
    }

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

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.bg }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        <EmergencyAlert aircraft={aircraft} />

        <div className="grid lg:grid-cols-4 gap-4 mb-6">
          <SessionStats stats={stats} healthStatus={healthStatus} />
          <NodeCard receiver={receiver} />
          <FeedStatusCard feed={feed} />
        </div>

        <DatabaseStats overall={overall} />

        <div className="mb-6">
          <ComponentReadiness healthStatus={healthStatus} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <PeakActivityCard peakStats={peakStats} />
          <RangeCoverageCard rangeStats={rangeStats} />
        </div>

        <MessageTypesCard feed={feed} />

        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          <SystemHealthCard health={health} />
          <FeedDetailsCard feed={feed} />
          <AltitudeDistributionCard altitude={altitude} />
        </div>

        <ActivityCharts hourly={hourly} daily={daily} />

        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <TopTypesCard types={types} />
          <TopOperatorsCard operators={operators} />
        </div>

        <LiveAircraftTable aircraft={aircraft} />

        <CompletedFlights flights={flights} />

        <RecentlySeenGrid recent={recent} />
      </div>
    </div>
  )
}
