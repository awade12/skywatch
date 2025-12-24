package database

import (
	"database/sql"
	"time"

	"adsb-tracker/pkg/models"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *DB) *Repository {
	return &Repository{db: db.Conn()}
}

func (r *Repository) SaveAircraft(ac *models.Aircraft) error {
	query := `
		INSERT INTO aircraft (icao, callsign, lat, lon, altitude_ft, speed_kt, heading, vertical_rate, squawk, on_ground, last_seen)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (icao) DO UPDATE SET
			callsign = COALESCE(NULLIF($2, ''), aircraft.callsign),
			lat = COALESCE($3, aircraft.lat),
			lon = COALESCE($4, aircraft.lon),
			altitude_ft = COALESCE($5, aircraft.altitude_ft),
			speed_kt = COALESCE($6, aircraft.speed_kt),
			heading = COALESCE($7, aircraft.heading),
			vertical_rate = COALESCE($8, aircraft.vertical_rate),
			squawk = COALESCE(NULLIF($9, ''), aircraft.squawk),
			on_ground = COALESCE($10, aircraft.on_ground),
			last_seen = $11
	`

	var lat, lon, speedKt, heading *float64
	var altFt, vertRate *int
	var onGround *bool

	if ac.Lat != nil {
		lat = ac.Lat
	}
	if ac.Lon != nil {
		lon = ac.Lon
	}
	if ac.AltitudeFt != nil {
		altFt = ac.AltitudeFt
	}
	if ac.SpeedKt != nil {
		speedKt = ac.SpeedKt
	}
	if ac.Heading != nil {
		heading = ac.Heading
	}
	if ac.VerticalRate != nil {
		vertRate = ac.VerticalRate
	}
	if ac.OnGround != nil {
		onGround = ac.OnGround
	}

	_, err := r.db.Exec(query, ac.ICAO, ac.Callsign, lat, lon, altFt, speedKt, heading, vertRate, ac.Squawk, onGround, ac.LastSeen)
	return err
}

func (r *Repository) SavePosition(ac *models.Aircraft) error {
	if ac.Lat == nil || ac.Lon == nil {
		return nil
	}

	query := `
		INSERT INTO position_history (icao, lat, lon, altitude_ft, speed_kt, heading, timestamp)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	_, err := r.db.Exec(query, ac.ICAO, *ac.Lat, *ac.Lon, ac.AltitudeFt, ac.SpeedKt, ac.Heading, ac.LastSeen)
	return err
}

func (r *Repository) GetPositionHistory(icao string, limit int) ([]models.Position, error) {
	query := `
		SELECT lat, lon, altitude_ft, speed_kt, heading, timestamp
		FROM position_history
		WHERE icao = $1
		ORDER BY timestamp DESC
		LIMIT $2
	`

	rows, err := r.db.Query(query, icao, limit)
	if err != nil {
		return []models.Position{}, err
	}
	defer rows.Close()

	positions := []models.Position{}
	for rows.Next() {
		var p models.Position
		var altFt sql.NullInt64
		var speedKt, heading sql.NullFloat64

		if err := rows.Scan(&p.Lat, &p.Lon, &altFt, &speedKt, &heading, &p.Timestamp); err != nil {
			return []models.Position{}, err
		}

		if altFt.Valid {
			v := int(altFt.Int64)
			p.AltitudeFt = &v
		}
		if speedKt.Valid {
			p.SpeedKt = &speedKt.Float64
		}
		if heading.Valid {
			p.Heading = &heading.Float64
		}

		positions = append(positions, p)
	}

	return positions, rows.Err()
}

func (r *Repository) GetPositionHistoryTimeRange(icao string, from, to *time.Time, limit int) ([]models.Position, error) {
	var query string
	var args []interface{}

	if from != nil && to != nil {
		query = `
			SELECT lat, lon, altitude_ft, speed_kt, heading, timestamp
			FROM position_history
			WHERE icao = $1 AND timestamp >= $2 AND timestamp <= $3
			ORDER BY timestamp DESC
			LIMIT $4
		`
		args = []interface{}{icao, *from, *to, limit}
	} else if from != nil {
		query = `
			SELECT lat, lon, altitude_ft, speed_kt, heading, timestamp
			FROM position_history
			WHERE icao = $1 AND timestamp >= $2
			ORDER BY timestamp DESC
			LIMIT $3
		`
		args = []interface{}{icao, *from, limit}
	} else if to != nil {
		query = `
			SELECT lat, lon, altitude_ft, speed_kt, heading, timestamp
			FROM position_history
			WHERE icao = $1 AND timestamp <= $2
			ORDER BY timestamp DESC
			LIMIT $3
		`
		args = []interface{}{icao, *to, limit}
	} else {
		return r.GetPositionHistory(icao, limit)
	}

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return []models.Position{}, err
	}
	defer rows.Close()

	positions := []models.Position{}
	for rows.Next() {
		var p models.Position
		var altFt sql.NullInt64
		var speedKt, heading sql.NullFloat64

		if err := rows.Scan(&p.Lat, &p.Lon, &altFt, &speedKt, &heading, &p.Timestamp); err != nil {
			return []models.Position{}, err
		}

		if altFt.Valid {
			v := int(altFt.Int64)
			p.AltitudeFt = &v
		}
		if speedKt.Valid {
			p.SpeedKt = &speedKt.Float64
		}
		if heading.Valid {
			p.Heading = &heading.Float64
		}

		positions = append(positions, p)
	}

	return positions, rows.Err()
}

func (r *Repository) CleanupOldPositions(maxAge time.Duration) (int64, error) {
	query := `DELETE FROM position_history WHERE timestamp < $1`
	result, err := r.db.Exec(query, time.Now().Add(-maxAge))
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func (r *Repository) GetFAAInfo(icao string) (*models.FAAInfo, error) {
	query := `
		SELECT registration, aircraft_type, manufacturer, model, operator, owner
		FROM faa_registry
		WHERE icao = $1
	`

	var info models.FAAInfo
	var reg, acType, mfr, model, operator, owner sql.NullString

	err := r.db.QueryRow(query, icao).Scan(&reg, &acType, &mfr, &model, &operator, &owner)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	info.Registration = reg.String
	info.AircraftType = acType.String
	info.Manufacturer = mfr.String
	info.Model = model.String
	info.Operator = operator.String
	info.Owner = owner.String

	return &info, nil
}

func (r *Repository) SaveFAAInfo(icao string, info *models.FAAInfo) error {
	query := `
		INSERT INTO faa_registry (icao, registration, aircraft_type, manufacturer, model, operator, owner)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (icao) DO UPDATE SET
			registration = $2,
			aircraft_type = $3,
			manufacturer = $4,
			model = $5,
			operator = $6,
			owner = $7
	`

	_, err := r.db.Exec(query, icao, info.Registration, info.AircraftType, info.Manufacturer, info.Model, info.Operator, info.Owner)
	return err
}

type HourlyStats struct {
	Hour  time.Time `json:"hour"`
	Count int       `json:"count"`
}

type DailyStats struct {
	Date           time.Time `json:"date"`
	UniqueAircraft int       `json:"unique_aircraft"`
	TotalPositions int       `json:"total_positions"`
}

type AircraftTypeStats struct {
	AircraftType string `json:"aircraft_type"`
	Count        int    `json:"count"`
}

type OperatorStats struct {
	Operator string `json:"operator"`
	Count    int    `json:"count"`
}

type OverallStats struct {
	TotalUniqueAircraft int `json:"total_unique_aircraft"`
	TotalPositions      int `json:"total_positions"`
	TotalFAARecords     int `json:"total_faa_records"`
	PositionsLast24h    int `json:"positions_last_24h"`
	AircraftLast24h     int `json:"aircraft_last_24h"`
}

func (r *Repository) GetHourlyStats(hours int) ([]HourlyStats, error) {
	query := `
		SELECT date_trunc('hour', timestamp) as hour, COUNT(DISTINCT icao) as count
		FROM position_history
		WHERE timestamp > NOW() - INTERVAL '1 hour' * $1
		GROUP BY hour
		ORDER BY hour ASC
	`

	rows, err := r.db.Query(query, hours)
	if err != nil {
		return []HourlyStats{}, err
	}
	defer rows.Close()

	stats := []HourlyStats{}
	for rows.Next() {
		var s HourlyStats
		if err := rows.Scan(&s.Hour, &s.Count); err != nil {
			return []HourlyStats{}, err
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}

func (r *Repository) GetDailyStats(days int) ([]DailyStats, error) {
	query := `
		SELECT 
			date_trunc('day', timestamp) as date,
			COUNT(DISTINCT icao) as unique_aircraft,
			COUNT(*) as total_positions
		FROM position_history
		WHERE timestamp > NOW() - INTERVAL '1 day' * $1
		GROUP BY date
		ORDER BY date ASC
	`

	rows, err := r.db.Query(query, days)
	if err != nil {
		return []DailyStats{}, err
	}
	defer rows.Close()

	stats := []DailyStats{}
	for rows.Next() {
		var s DailyStats
		if err := rows.Scan(&s.Date, &s.UniqueAircraft, &s.TotalPositions); err != nil {
			return []DailyStats{}, err
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}

func (r *Repository) GetTopAircraftTypes(limit int) ([]AircraftTypeStats, error) {
	query := `
		SELECT f.aircraft_type, COUNT(DISTINCT p.icao) as count
		FROM position_history p
		JOIN faa_registry f ON p.icao = f.icao
		WHERE f.aircraft_type IS NOT NULL AND f.aircraft_type != ''
		AND p.timestamp > NOW() - INTERVAL '24 hours'
		GROUP BY f.aircraft_type
		ORDER BY count DESC
		LIMIT $1
	`

	rows, err := r.db.Query(query, limit)
	if err != nil {
		return []AircraftTypeStats{}, err
	}
	defer rows.Close()

	stats := []AircraftTypeStats{}
	for rows.Next() {
		var s AircraftTypeStats
		if err := rows.Scan(&s.AircraftType, &s.Count); err != nil {
			return []AircraftTypeStats{}, err
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}

func (r *Repository) GetTopOperators(limit int) ([]OperatorStats, error) {
	query := `
		SELECT f.owner, COUNT(DISTINCT p.icao) as count
		FROM position_history p
		JOIN faa_registry f ON p.icao = f.icao
		WHERE f.owner IS NOT NULL AND f.owner != ''
		AND p.timestamp > NOW() - INTERVAL '24 hours'
		GROUP BY f.owner
		ORDER BY count DESC
		LIMIT $1
	`

	rows, err := r.db.Query(query, limit)
	if err != nil {
		return []OperatorStats{}, err
	}
	defer rows.Close()

	stats := []OperatorStats{}
	for rows.Next() {
		var s OperatorStats
		if err := rows.Scan(&s.Operator, &s.Count); err != nil {
			return []OperatorStats{}, err
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}

func (r *Repository) GetOverallStats() (*OverallStats, error) {
	stats := &OverallStats{}

	err := r.db.QueryRow(`SELECT COUNT(DISTINCT icao) FROM position_history`).Scan(&stats.TotalUniqueAircraft)
	if err != nil {
		return nil, err
	}

	err = r.db.QueryRow(`SELECT COUNT(*) FROM position_history`).Scan(&stats.TotalPositions)
	if err != nil {
		return nil, err
	}

	err = r.db.QueryRow(`SELECT COUNT(*) FROM faa_registry`).Scan(&stats.TotalFAARecords)
	if err != nil {
		return nil, err
	}

	err = r.db.QueryRow(`SELECT COUNT(*) FROM position_history WHERE timestamp > NOW() - INTERVAL '24 hours'`).Scan(&stats.PositionsLast24h)
	if err != nil {
		return nil, err
	}

	err = r.db.QueryRow(`SELECT COUNT(DISTINCT icao) FROM position_history WHERE timestamp > NOW() - INTERVAL '24 hours'`).Scan(&stats.AircraftLast24h)
	if err != nil {
		return nil, err
	}

	return stats, nil
}

func (r *Repository) GetRecentAircraft(limit int) ([]models.Aircraft, error) {
	query := `
		SELECT a.icao, a.callsign, a.lat, a.lon, a.altitude_ft, a.speed_kt, a.heading, 
		       a.squawk, a.on_ground, a.last_seen,
		       f.registration, f.aircraft_type, f.operator
		FROM aircraft a
		LEFT JOIN faa_registry f ON a.icao = f.icao
		ORDER BY a.last_seen DESC
		LIMIT $1
	`

	rows, err := r.db.Query(query, limit)
	if err != nil {
		return []models.Aircraft{}, err
	}
	defer rows.Close()

	aircraft := []models.Aircraft{}
	for rows.Next() {
		var ac models.Aircraft
		var callsign, squawk, reg, acType, operator sql.NullString
		var lat, lon, speedKt, heading sql.NullFloat64
		var altFt sql.NullInt64
		var onGround sql.NullBool

		err := rows.Scan(&ac.ICAO, &callsign, &lat, &lon, &altFt, &speedKt, &heading,
			&squawk, &onGround, &ac.LastSeen, &reg, &acType, &operator)
		if err != nil {
			return []models.Aircraft{}, err
		}

		ac.Callsign = callsign.String
		ac.Squawk = squawk.String
		ac.Registration = reg.String
		ac.AircraftType = acType.String
		ac.Operator = operator.String

		if lat.Valid {
			ac.Lat = &lat.Float64
		}
		if lon.Valid {
			ac.Lon = &lon.Float64
		}
		if altFt.Valid {
			v := int(altFt.Int64)
			ac.AltitudeFt = &v
		}
		if speedKt.Valid {
			ac.SpeedKt = &speedKt.Float64
		}
		if heading.Valid {
			ac.Heading = &heading.Float64
		}
		if onGround.Valid {
			ac.OnGround = &onGround.Bool
		}

		aircraft = append(aircraft, ac)
	}
	return aircraft, rows.Err()
}

func (r *Repository) GetAltitudeDistribution() (map[string]int, error) {
	query := `
		SELECT 
			CASE 
				WHEN altitude_ft < 1000 THEN 'ground'
				WHEN altitude_ft < 10000 THEN 'low'
				WHEN altitude_ft < 25000 THEN 'medium'
				WHEN altitude_ft < 35000 THEN 'high'
				ELSE 'very_high'
			END as band,
			COUNT(*) as count
		FROM position_history
		WHERE timestamp > NOW() - INTERVAL '1 hour'
		AND altitude_ft IS NOT NULL
		GROUP BY band
	`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	dist := make(map[string]int)
	for rows.Next() {
		var band string
		var count int
		if err := rows.Scan(&band, &count); err != nil {
			return nil, err
		}
		dist[band] = count
	}
	return dist, rows.Err()
}

type SessionStats struct {
	TotalSeen    int       `json:"total_seen"`
	MaxRangeNM   float64   `json:"max_range_nm"`
	MaxRangeICAO string    `json:"max_range_icao"`
	SessionStart time.Time `json:"session_start"`
	LastSave     time.Time `json:"last_save"`
}

func (r *Repository) SaveSessionStats(stats *SessionStats) error {
	query := `
		INSERT INTO session_stats (id, total_seen, max_range_nm, max_range_icao, session_start, last_save)
		VALUES (1, $1, $2, $3, $4, $5)
		ON CONFLICT (id) DO UPDATE SET
			total_seen = $1,
			max_range_nm = $2,
			max_range_icao = $3,
			last_save = $5
	`
	_, err := r.db.Exec(query, stats.TotalSeen, stats.MaxRangeNM, stats.MaxRangeICAO, stats.SessionStart, time.Now())
	return err
}

func (r *Repository) LoadSessionStats() (*SessionStats, error) {
	query := `SELECT total_seen, max_range_nm, max_range_icao, session_start, last_save FROM session_stats WHERE id = 1`

	var stats SessionStats
	var maxRangeICAO sql.NullString

	err := r.db.QueryRow(query).Scan(&stats.TotalSeen, &stats.MaxRangeNM, &maxRangeICAO, &stats.SessionStart, &stats.LastSave)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	stats.MaxRangeICAO = maxRangeICAO.String
	return &stats, nil
}

type RangeBucketStats struct {
	Bearing      int     `json:"bearing"`
	MaxRangeNM   float64 `json:"max_range_nm"`
	MaxRangeICAO string  `json:"max_range_icao"`
	ContactCount int64   `json:"contact_count"`
}

func (r *Repository) SaveRangeStats(bucket int, maxNM float64, icao string, count int64) error {
	query := `
		INSERT INTO range_stats (bearing_bucket, max_range_nm, max_range_icao, contact_count, updated_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (bearing_bucket) DO UPDATE SET
			max_range_nm = GREATEST(range_stats.max_range_nm, $2),
			max_range_icao = CASE WHEN $2 > range_stats.max_range_nm THEN $3 ELSE range_stats.max_range_icao END,
			contact_count = $4,
			updated_at = NOW()
	`
	_, err := r.db.Exec(query, bucket, maxNM, icao, count)
	return err
}

func (r *Repository) LoadRangeStats() ([]RangeBucketStats, error) {
	query := `SELECT bearing_bucket, max_range_nm, COALESCE(max_range_icao, ''), contact_count FROM range_stats ORDER BY bearing_bucket`

	rows, err := r.db.Query(query)
	if err != nil {
		return []RangeBucketStats{}, err
	}
	defer rows.Close()

	stats := []RangeBucketStats{}
	for rows.Next() {
		var s RangeBucketStats
		if err := rows.Scan(&s.Bearing, &s.MaxRangeNM, &s.MaxRangeICAO, &s.ContactCount); err != nil {
			return []RangeBucketStats{}, err
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}

type FlightRecord struct {
	ID           int64     `json:"id"`
	ICAO         string    `json:"icao"`
	Callsign     string    `json:"callsign,omitempty"`
	Registration string    `json:"registration,omitempty"`
	AircraftType string    `json:"aircraft_type,omitempty"`
	FirstSeen    time.Time `json:"first_seen"`
	LastSeen     time.Time `json:"last_seen"`
	FirstLat     *float64  `json:"first_lat,omitempty"`
	FirstLon     *float64  `json:"first_lon,omitempty"`
	LastLat      *float64  `json:"last_lat,omitempty"`
	LastLon      *float64  `json:"last_lon,omitempty"`
	MaxAltFt     *int      `json:"max_alt_ft,omitempty"`
	TotalDistNM  float64   `json:"total_dist_nm"`
	Completed    bool      `json:"completed"`
}

func (r *Repository) CreateFlight(flight *FlightRecord) (int64, error) {
	query := `
		INSERT INTO flights (icao, callsign, registration, aircraft_type, first_seen, last_seen, first_lat, first_lon, last_lat, last_lon, max_alt_ft, total_dist_nm, completed)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id
	`
	var id int64
	err := r.db.QueryRow(query,
		flight.ICAO, flight.Callsign, flight.Registration, flight.AircraftType,
		flight.FirstSeen, flight.LastSeen,
		flight.FirstLat, flight.FirstLon, flight.LastLat, flight.LastLon,
		flight.MaxAltFt, flight.TotalDistNM, flight.Completed,
	).Scan(&id)
	return id, err
}

func (r *Repository) UpdateFlight(flight *FlightRecord) error {
	query := `
		UPDATE flights SET
			callsign = COALESCE(NULLIF($2, ''), callsign),
			last_seen = $3,
			last_lat = COALESCE($4, last_lat),
			last_lon = COALESCE($5, last_lon),
			max_alt_ft = GREATEST(COALESCE(max_alt_ft, 0), COALESCE($6, 0)),
			total_dist_nm = $7,
			completed = $8
		WHERE id = $1
	`
	_, err := r.db.Exec(query,
		flight.ID, flight.Callsign, flight.LastSeen,
		flight.LastLat, flight.LastLon,
		flight.MaxAltFt, flight.TotalDistNM, flight.Completed,
	)
	return err
}

func (r *Repository) GetRecentFlights(limit int) ([]FlightRecord, error) {
	query := `
		SELECT id, icao, COALESCE(callsign, ''), COALESCE(registration, ''), COALESCE(aircraft_type, ''),
		       first_seen, last_seen, first_lat, first_lon, last_lat, last_lon,
		       max_alt_ft, total_dist_nm, completed
		FROM flights
		WHERE completed = true
		ORDER BY last_seen DESC
		LIMIT $1
	`

	rows, err := r.db.Query(query, limit)
	if err != nil {
		return []FlightRecord{}, err
	}
	defer rows.Close()

	flights := []FlightRecord{}
	for rows.Next() {
		var f FlightRecord
		var firstLat, firstLon, lastLat, lastLon sql.NullFloat64
		var maxAlt sql.NullInt64

		err := rows.Scan(&f.ID, &f.ICAO, &f.Callsign, &f.Registration, &f.AircraftType,
			&f.FirstSeen, &f.LastSeen, &firstLat, &firstLon, &lastLat, &lastLon,
			&maxAlt, &f.TotalDistNM, &f.Completed)
		if err != nil {
			return []FlightRecord{}, err
		}

		if firstLat.Valid {
			f.FirstLat = &firstLat.Float64
		}
		if firstLon.Valid {
			f.FirstLon = &firstLon.Float64
		}
		if lastLat.Valid {
			f.LastLat = &lastLat.Float64
		}
		if lastLon.Valid {
			f.LastLon = &lastLon.Float64
		}
		if maxAlt.Valid {
			v := int(maxAlt.Int64)
			f.MaxAltFt = &v
		}

		flights = append(flights, f)
	}
	return flights, rows.Err()
}

func (r *Repository) GetFlightByID(id int64) (*FlightRecord, error) {
	query := `
		SELECT id, icao, COALESCE(callsign, ''), COALESCE(registration, ''), COALESCE(aircraft_type, ''),
		       first_seen, last_seen, first_lat, first_lon, last_lat, last_lon,
		       max_alt_ft, total_dist_nm, completed
		FROM flights
		WHERE id = $1
	`

	var f FlightRecord
	var firstLat, firstLon, lastLat, lastLon sql.NullFloat64
	var maxAlt sql.NullInt64

	err := r.db.QueryRow(query, id).Scan(&f.ID, &f.ICAO, &f.Callsign, &f.Registration, &f.AircraftType,
		&f.FirstSeen, &f.LastSeen, &firstLat, &firstLon, &lastLat, &lastLon,
		&maxAlt, &f.TotalDistNM, &f.Completed)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if firstLat.Valid {
		f.FirstLat = &firstLat.Float64
	}
	if firstLon.Valid {
		f.FirstLon = &firstLon.Float64
	}
	if lastLat.Valid {
		f.LastLat = &lastLat.Float64
	}
	if lastLon.Valid {
		f.LastLon = &lastLon.Float64
	}
	if maxAlt.Valid {
		v := int(maxAlt.Int64)
		f.MaxAltFt = &v
	}

	return &f, nil
}

type PeakStats struct {
	BusiestHour        time.Time `json:"busiest_hour"`
	BusiestHourCount   int       `json:"busiest_hour_count"`
	BusiestDay         string    `json:"busiest_day"`
	BusiestDayCount    int       `json:"busiest_day_count"`
	AvgAircraftPerHour float64   `json:"avg_aircraft_per_hour"`
	TotalHoursTracked  int       `json:"total_hours_tracked"`
}

func (r *Repository) GetPeakStats() (*PeakStats, error) {
	stats := &PeakStats{}

	hourQuery := `
		SELECT date_trunc('hour', timestamp) as hour, COUNT(DISTINCT icao) as count
		FROM position_history
		WHERE timestamp > NOW() - INTERVAL '7 days'
		GROUP BY hour
		ORDER BY count DESC
		LIMIT 1
	`
	var busiestHour sql.NullTime
	var busiestHourCount sql.NullInt64
	err := r.db.QueryRow(hourQuery).Scan(&busiestHour, &busiestHourCount)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	if busiestHour.Valid {
		stats.BusiestHour = busiestHour.Time
		stats.BusiestHourCount = int(busiestHourCount.Int64)
	}

	dayQuery := `
		SELECT date_trunc('day', timestamp)::date as day, COUNT(DISTINCT icao) as count
		FROM position_history
		WHERE timestamp > NOW() - INTERVAL '30 days'
		GROUP BY day
		ORDER BY count DESC
		LIMIT 1
	`
	var busiestDay sql.NullTime
	var busiestDayCount sql.NullInt64
	err = r.db.QueryRow(dayQuery).Scan(&busiestDay, &busiestDayCount)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	if busiestDay.Valid {
		stats.BusiestDay = busiestDay.Time.Format("2006-01-02")
		stats.BusiestDayCount = int(busiestDayCount.Int64)
	}

	avgQuery := `
		SELECT 
			COUNT(DISTINCT date_trunc('hour', timestamp)) as hours,
			COUNT(DISTINCT icao) as total_aircraft
		FROM position_history
		WHERE timestamp > NOW() - INTERVAL '7 days'
	`
	var hours, totalAircraft sql.NullInt64
	err = r.db.QueryRow(avgQuery).Scan(&hours, &totalAircraft)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	if hours.Valid && hours.Int64 > 0 {
		stats.TotalHoursTracked = int(hours.Int64)
		stats.AvgAircraftPerHour = float64(totalAircraft.Int64) / float64(hours.Int64)
	}

	return stats, nil
}

