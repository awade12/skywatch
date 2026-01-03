import type {
  Stats,
  OverallStats,
  ReceiverInfo,
  HealthStatus,
  ReceiverHealth,
  FeedStatus,
  HourlyStat,
  DailyStat,
  AltitudeDistribution,
  TypeStat,
  OperatorStat,
  Aircraft,
  RecentAircraft,
  RangeStats,
  PeakStats,
  FlightRecord,
} from "./components"

export const MOCK_STATS: Stats = {
  uptime: "4h32m15s",
  aircraft_now: 12,
  total_seen: 247,
  max_range_nm: 156.4,
  max_range_icao: "A1B2C3",
}

export const MOCK_OVERALL: OverallStats = {
  total_unique_aircraft: 15482,
  total_positions: 2847561,
  total_faa_records: 8923,
  positions_last_24h: 45872,
  aircraft_last_24h: 312,
}

export const MOCK_RECEIVER: ReceiverInfo = {
  node_name: "Dev Node",
}

export const MOCK_HEALTH_STATUS: HealthStatus = {
  status: "ok",
  uptime: "4h32m15s",
  aircraft_count: 12,
  ready: true,
  components: {
    feed_client: { ready: true },
    tracker: { ready: true },
    http_server: { ready: true },
    health_monitor: { ready: true },
  },
}

export const MOCK_HEALTH: ReceiverHealth = {
  cpu_percent: 23.5,
  memory_percent: 45.2,
  memory_used_mb: 462,
  memory_total_mb: 1024,
  temp_celsius: 52.3,
  uptime: "12d 4h 32m",
  goroutines: 28,
  platform: "linux/arm64",
}

export const MOCK_FEED: FeedStatus = {
  connected: true,
  last_message: new Date().toISOString(),
  messages_total: 1847562,
  messages_per_sec: 42.7,
  reconnects: 0,
  host: "127.0.0.1",
  port: 30003,
  format: "sbs",
  valid_messages: 1845123,
  invalid_messages: 2439,
  position_messages: 892456,
  velocity_messages: 456789,
  message_types: {
    msg1_id: 124567,
    msg2_surface: 2341,
    msg3_airborne: 892456,
    msg4_velocity: 456789,
    msg5_surv_alt: 234567,
    msg6_surv_id: 12345,
    msg7_air2air: 45678,
    msg8_allcall: 78234,
  },
}

export const MOCK_HOURLY: HourlyStat[] = Array.from({ length: 24 }, (_, i) => ({
  hour: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
  count: Math.floor(Math.random() * 50) + 10,
}))

export const MOCK_DAILY: DailyStat[] = Array.from({ length: 7 }, (_, i) => ({
  date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split("T")[0],
  unique_aircraft: Math.floor(Math.random() * 200) + 100,
  total_positions: Math.floor(Math.random() * 50000) + 10000,
}))

export const MOCK_ALTITUDE: AltitudeDistribution = {
  ground: 5,
  low: 89,
  medium: 156,
  high: 234,
  very_high: 45,
}

export const MOCK_TYPES: TypeStat[] = [
  { aircraft_type: "B738", count: 89 },
  { aircraft_type: "A320", count: 76 },
  { aircraft_type: "B77W", count: 45 },
  { aircraft_type: "A321", count: 42 },
  { aircraft_type: "E75L", count: 38 },
  { aircraft_type: "CRJ9", count: 31 },
  { aircraft_type: "B739", count: 28 },
  { aircraft_type: "A319", count: 24 },
  { aircraft_type: "B752", count: 19 },
  { aircraft_type: "C172", count: 15 },
]

export const MOCK_OPERATORS: OperatorStat[] = [
  { operator: "Southwest Airlines", count: 67 },
  { operator: "American Airlines", count: 54 },
  { operator: "United Airlines", count: 48 },
  { operator: "Delta Air Lines", count: 42 },
  { operator: "Spirit Airlines", count: 23 },
  { operator: "Frontier Airlines", count: 18 },
  { operator: "JetBlue Airways", count: 15 },
  { operator: "Alaska Airlines", count: 12 },
  { operator: "Private", count: 45 },
  { operator: "Unknown", count: 28 },
]

const randomCallsign = () => {
  const prefixes = ["AAL", "UAL", "DAL", "SWA", "JBU", "N"]
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  return prefix + Math.floor(Math.random() * 9000 + 1000)
}

const randomSquawk = () => {
  const squawks = ["1200", "4521", "7500", "7600", "7700", "2345", "6712"]
  return squawks[Math.floor(Math.random() * squawks.length)]
}

export const MOCK_AIRCRAFT: Aircraft[] = Array.from({ length: 12 }, (_, i) => ({
  icao: Math.random().toString(16).substring(2, 8).toUpperCase(),
  callsign: randomCallsign(),
  alt_ft: Math.floor(Math.random() * 40000) + 1000,
  speed_kt: Math.floor(Math.random() * 400) + 150,
  heading: Math.floor(Math.random() * 360),
  lat: 33.0 + Math.random() * 2,
  lon: -97.0 + Math.random() * 2,
  distance_nm: Math.floor(Math.random() * 100) + 5,
  bearing: Math.floor(Math.random() * 360),
  bearing_cardinal: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.floor(Math.random() * 8)],
  squawk: i === 0 ? "7700" : randomSquawk(),
  registration: "N" + Math.floor(Math.random() * 90000 + 10000),
  aircraft_type: MOCK_TYPES[Math.floor(Math.random() * MOCK_TYPES.length)].aircraft_type,
  operator: MOCK_OPERATORS[Math.floor(Math.random() * MOCK_OPERATORS.length)].operator,
  last_seen: new Date(Date.now() - Math.random() * 30000).toISOString(),
  on_ground: false,
  vertical_rate: Math.floor(Math.random() * 4000) - 2000,
}))

export const MOCK_RECENT: RecentAircraft[] = Array.from({ length: 50 }, (_, i) => ({
  icao: Math.random().toString(16).substring(2, 8).toUpperCase(),
  callsign: randomCallsign(),
  registration: "N" + Math.floor(Math.random() * 90000 + 10000),
  aircraft_type: MOCK_TYPES[Math.floor(Math.random() * MOCK_TYPES.length)].aircraft_type,
  operator: MOCK_OPERATORS[Math.floor(Math.random() * MOCK_OPERATORS.length)].operator,
  lat: 33.0 + Math.random() * 2,
  lon: -97.0 + Math.random() * 2,
  alt_ft: Math.floor(Math.random() * 40000) + 1000,
  speed_kt: Math.floor(Math.random() * 400) + 150,
  heading: Math.floor(Math.random() * 360),
  squawk: "1200",
  on_ground: false,
  last_seen: new Date(Date.now() - i * 60000 - Math.random() * 30000).toISOString(),
}))

export const MOCK_RANGE_STATS: RangeStats = {
  buckets: Array.from({ length: 36 }, (_, i) => ({
    bearing: i * 10,
    max_range_nm: Math.floor(Math.random() * 150) + 20,
    max_range_icao: Math.random().toString(16).substring(2, 8).toUpperCase(),
    contact_count: Math.floor(Math.random() * 500) + 50,
  })),
  all_time_max_nm: 187.4,
  all_time_max_icao: "A4B5C6",
  total_contacts: 48756,
}

export const MOCK_PEAK_STATS: PeakStats = {
  busiest_hour: new Date(Date.now() - 3600000 * 5).toISOString(),
  busiest_hour_count: 47,
  busiest_day: new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0],
  busiest_day_count: 312,
  avg_aircraft_per_hour: 18.5,
  total_hours_tracked: 892,
}

export const MOCK_FLIGHTS: FlightRecord[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  icao: Math.random().toString(16).substring(2, 8).toUpperCase(),
  callsign: randomCallsign(),
  registration: "N" + Math.floor(Math.random() * 90000 + 10000),
  aircraft_type: MOCK_TYPES[Math.floor(Math.random() * MOCK_TYPES.length)].aircraft_type,
  first_seen: new Date(Date.now() - (i + 1) * 3600000 - Math.random() * 1800000).toISOString(),
  last_seen: new Date(Date.now() - i * 3600000 - Math.random() * 600000).toISOString(),
  first_lat: 33.0 + Math.random() * 2,
  first_lon: -97.0 + Math.random() * 2,
  last_lat: 33.0 + Math.random() * 2,
  last_lon: -97.0 + Math.random() * 2,
  max_alt_ft: Math.floor(Math.random() * 40000) + 5000,
  total_dist_nm: Math.floor(Math.random() * 200) + 20,
  completed: true,
}))

