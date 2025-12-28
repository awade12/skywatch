export interface Stats {
  uptime: string
  aircraft_now: number
  total_seen: number
  max_range_nm: number
  max_range_icao?: string
}

export interface OverallStats {
  total_unique_aircraft: number
  total_positions: number
  total_faa_records: number
  positions_last_24h: number
  aircraft_last_24h: number
}

export interface ReceiverInfo {
  node_name: string
}

export interface ComponentState {
  ready: boolean
  message?: string
}

export interface HealthStatus {
  status: string
  uptime: string
  aircraft_count: number
  ready: boolean
  components?: Record<string, ComponentState>
}

export interface ReceiverHealth {
  cpu_percent: number
  memory_percent: number
  memory_used_mb: number
  memory_total_mb: number
  temp_celsius: number
  uptime: string
  goroutines: number
  platform: string
}

export interface MessageTypeStats {
  msg1_id: number
  msg2_surface: number
  msg3_airborne: number
  msg4_velocity: number
  msg5_surv_alt: number
  msg6_surv_id: number
  msg7_air2air: number
  msg8_allcall: number
}

export interface FeedStatus {
  connected: boolean
  last_message: string
  messages_total: number
  messages_per_sec: number
  reconnects: number
  host: string
  port: number
  format: string
  valid_messages: number
  invalid_messages: number
  position_messages: number
  velocity_messages: number
  message_types: MessageTypeStats
}

export interface RangeBucket {
  bearing: number
  max_range_nm: number
  max_range_icao: string
  contact_count: number
}

export interface RangeStats {
  buckets: RangeBucket[]
  all_time_max_nm: number
  all_time_max_icao: string
  total_contacts: number
}

export interface PeakStats {
  busiest_hour: string
  busiest_hour_count: number
  busiest_day: string
  busiest_day_count: number
  avg_aircraft_per_hour: number
  total_hours_tracked: number
}

export interface FlightRecord {
  id: number
  icao: string
  callsign?: string
  registration?: string
  aircraft_type?: string
  first_seen: string
  last_seen: string
  first_lat?: number
  first_lon?: number
  last_lat?: number
  last_lon?: number
  max_alt_ft?: number
  total_dist_nm: number
  completed: boolean
}

export interface HourlyStat {
  hour: string
  count: number
}

export interface DailyStat {
  date: string
  unique_aircraft: number
  total_positions: number
}

export interface AltitudeDistribution {
  ground?: number
  low?: number
  medium?: number
  high?: number
  very_high?: number
}

export interface TypeStat {
  aircraft_type: string
  count: number
}

export interface OperatorStat {
  operator: string
  count: number
}

export interface Aircraft {
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

export interface RecentAircraft {
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

export const COLORS = {
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

