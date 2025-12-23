package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"adsb-tracker/internal/database"
	"adsb-tracker/internal/tracker"
)

type Server struct {
	tracker   *tracker.Tracker
	repo      *database.Repository
	startTime time.Time
	wsHub     *Hub
}

func NewServer(t *tracker.Tracker, repo *database.Repository) *Server {
	s := &Server{
		tracker:   t,
		repo:      repo,
		startTime: time.Now(),
		wsHub:     NewHub(t),
	}
	return s
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/v1/aircraft", s.handleAircraft)
	mux.HandleFunc("/api/v1/aircraft/search", s.handleAircraftSearch)
	mux.HandleFunc("/api/v1/aircraft/", s.handleAircraftRoutes)
	mux.HandleFunc("/api/v1/health", s.handleHealth)
	mux.HandleFunc("/api/v1/stats", s.handleStats)
	mux.HandleFunc("/api/v1/stats/hourly", s.handleStatsHourly)
	mux.HandleFunc("/api/v1/stats/daily", s.handleStatsDaily)
	mux.HandleFunc("/api/v1/stats/types", s.handleStatsTypes)
	mux.HandleFunc("/api/v1/stats/operators", s.handleStatsOperators)
	mux.HandleFunc("/api/v1/stats/overall", s.handleStatsOverall)
	mux.HandleFunc("/api/v1/stats/altitude", s.handleStatsAltitude)
	mux.HandleFunc("/api/v1/stats/recent", s.handleStatsRecent)
	mux.HandleFunc("/api/v1/receiver", s.handleReceiver)

	mux.HandleFunc("/ws", s.wsHub.HandleWebSocket)
	mux.Handle("/", http.FileServer(http.Dir("web")))
	return mux
}

func (s *Server) StartHub() {
	go s.wsHub.Run()
}

func (s *Server) handleAircraft(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	aircraft := s.tracker.GetAll()
	writeJSON(w, http.StatusOK, aircraft)
}

func (s *Server) handleAircraftRoutes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/v1/aircraft/")
	parts := strings.Split(path, "/")

	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, "ICAO address required", http.StatusBadRequest)
		return
	}

	icao := strings.ToUpper(strings.TrimSpace(parts[0]))

	if len(parts) == 1 {
		s.handleAircraftByICAO(w, r, icao)
		return
	}

	switch parts[1] {
	case "trail":
		s.handleTrail(w, r, icao)
	case "faa":
		s.handleFAA(w, r, icao)
	case "history":
		s.handleHistory(w, r, icao)
	default:
		http.Error(w, "Not found", http.StatusNotFound)
	}
}

func (s *Server) handleAircraftByICAO(w http.ResponseWriter, r *http.Request, icao string) {
	ac, found := s.tracker.Get(icao)
	if !found {
		http.Error(w, "Aircraft not found", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, ac)
}

func (s *Server) handleTrail(w http.ResponseWriter, r *http.Request, icao string) {
	trail, err := s.tracker.GetTrail(icao)
	if err != nil {
		http.Error(w, "Failed to get trail", http.StatusInternalServerError)
		return
	}

	if trail == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}

	writeJSON(w, http.StatusOK, trail)
}

func (s *Server) handleFAA(w http.ResponseWriter, r *http.Request, icao string) {
	if s.repo == nil {
		http.Error(w, "FAA lookup not available", http.StatusServiceUnavailable)
		return
	}

	info, err := s.repo.GetFAAInfo(icao)
	if err != nil {
		http.Error(w, "Failed to get FAA info", http.StatusInternalServerError)
		return
	}

	if info == nil {
		http.Error(w, "FAA info not found", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, info)
}

func (s *Server) handleHistory(w http.ResponseWriter, r *http.Request, icao string) {
	if s.repo == nil {
		http.Error(w, "History not available", http.StatusServiceUnavailable)
		return
	}

	query := r.URL.Query()
	limit := 100
	if l := query.Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 1000 {
			limit = parsed
		}
	}

	var from, to *time.Time
	if f := query.Get("from"); f != "" {
		if parsed, err := time.Parse(time.RFC3339, f); err == nil {
			from = &parsed
		}
	}
	if t := query.Get("to"); t != "" {
		if parsed, err := time.Parse(time.RFC3339, t); err == nil {
			to = &parsed
		}
	}

	positions, err := s.repo.GetPositionHistoryTimeRange(icao, from, to, limit)
	if err != nil {
		http.Error(w, "Failed to get history", http.StatusInternalServerError)
		return
	}

	if positions == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}

	writeJSON(w, http.StatusOK, positions)
}

func (s *Server) handleAircraftSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := r.URL.Query()
	filters := tracker.SearchFilters{
		Callsign:     query.Get("callsign"),
		AircraftType: query.Get("type"),
		Registration: query.Get("registration"),
	}

	if bounds := query.Get("bounds"); bounds != "" {
		parts := strings.Split(bounds, ",")
		if len(parts) == 4 {
			var err error
			filters.MinLat, err = strconv.ParseFloat(parts[0], 64)
			if err == nil {
				filters.MinLon, err = strconv.ParseFloat(parts[1], 64)
			}
			if err == nil {
				filters.MaxLat, err = strconv.ParseFloat(parts[2], 64)
			}
			if err == nil {
				filters.MaxLon, err = strconv.ParseFloat(parts[3], 64)
			}
			if err == nil {
				filters.HasBounds = true
			}
		}
	}

	aircraft := s.tracker.Search(filters)
	writeJSON(w, http.StatusOK, aircraft)
}

type receiverResponse struct {
	Lat float64 `json:"lat,omitempty"`
	Lon float64 `json:"lon,omitempty"`
}

func (s *Server) handleReceiver(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	info := s.tracker.GetReceiverInfo()
	if info == nil {
		writeJSON(w, http.StatusOK, receiverResponse{})
		return
	}

	writeJSON(w, http.StatusOK, receiverResponse{
		Lat: info.Lat,
		Lon: info.Lon,
	})
}

type healthResponse struct {
	Status        string `json:"status"`
	Uptime        string `json:"uptime"`
	AircraftCount int    `json:"aircraft_count"`
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	resp := healthResponse{
		Status:        "ok",
		Uptime:        time.Since(s.startTime).Round(time.Second).String(),
		AircraftCount: s.tracker.Count(),
	}
	writeJSON(w, http.StatusOK, resp)
}

type statsResponse struct {
	Uptime       string  `json:"uptime"`
	AircraftNow  int     `json:"aircraft_now"`
	TotalSeen    int     `json:"total_seen"`
	MaxRangeNM   float64 `json:"max_range_nm"`
	MaxRangeICAO string  `json:"max_range_icao,omitempty"`
}

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stats := s.tracker.GetStats()
	resp := statsResponse{
		Uptime:       time.Since(s.startTime).Round(time.Second).String(),
		AircraftNow:  stats.AircraftCount,
		TotalSeen:    stats.TotalSeen,
		MaxRangeNM:   stats.MaxRangeNM,
		MaxRangeICAO: stats.MaxRangeICAO,
	}
	writeJSON(w, http.StatusOK, resp)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (s *Server) handleStatsHourly(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.repo == nil {
		http.Error(w, "Database not available", http.StatusServiceUnavailable)
		return
	}

	hours := 24
	if h := r.URL.Query().Get("hours"); h != "" {
		if parsed, err := strconv.Atoi(h); err == nil && parsed > 0 && parsed <= 168 {
			hours = parsed
		}
	}

	stats, err := s.repo.GetHourlyStats(hours)
	if err != nil {
		http.Error(w, "Failed to get hourly stats", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleStatsDaily(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.repo == nil {
		http.Error(w, "Database not available", http.StatusServiceUnavailable)
		return
	}

	days := 7
	if d := r.URL.Query().Get("days"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil && parsed > 0 && parsed <= 90 {
			days = parsed
		}
	}

	stats, err := s.repo.GetDailyStats(days)
	if err != nil {
		http.Error(w, "Failed to get daily stats", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleStatsTypes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.repo == nil {
		http.Error(w, "Database not available", http.StatusServiceUnavailable)
		return
	}

	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 50 {
			limit = parsed
		}
	}

	stats, err := s.repo.GetTopAircraftTypes(limit)
	if err != nil {
		http.Error(w, "Failed to get aircraft type stats", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleStatsOperators(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.repo == nil {
		http.Error(w, "Database not available", http.StatusServiceUnavailable)
		return
	}

	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 50 {
			limit = parsed
		}
	}

	stats, err := s.repo.GetTopOperators(limit)
	if err != nil {
		http.Error(w, "Failed to get operator stats", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleStatsOverall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.repo == nil {
		http.Error(w, "Database not available", http.StatusServiceUnavailable)
		return
	}

	stats, err := s.repo.GetOverallStats()
	if err != nil {
		http.Error(w, "Failed to get overall stats", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleStatsAltitude(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.repo == nil {
		http.Error(w, "Database not available", http.StatusServiceUnavailable)
		return
	}

	stats, err := s.repo.GetAltitudeDistribution()
	if err != nil {
		http.Error(w, "Failed to get altitude stats", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleStatsRecent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.repo == nil {
		http.Error(w, "Database not available", http.StatusServiceUnavailable)
		return
	}

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	aircraft, err := s.repo.GetRecentAircraft(limit)
	if err != nil {
		http.Error(w, "Failed to get recent aircraft", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, aircraft)
}
