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
		return nil, err
	}
	defer rows.Close()

	var positions []models.Position
	for rows.Next() {
		var p models.Position
		var altFt sql.NullInt64
		var speedKt, heading sql.NullFloat64

		if err := rows.Scan(&p.Lat, &p.Lon, &altFt, &speedKt, &heading, &p.Timestamp); err != nil {
			return nil, err
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
		return nil, err
	}
	defer rows.Close()

	var positions []models.Position
	for rows.Next() {
		var p models.Position
		var altFt sql.NullInt64
		var speedKt, heading sql.NullFloat64

		if err := rows.Scan(&p.Lat, &p.Lon, &altFt, &speedKt, &heading, &p.Timestamp); err != nil {
			return nil, err
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
		return nil, err
	}
	defer rows.Close()

	var stats []HourlyStats
	for rows.Next() {
		var s HourlyStats
		if err := rows.Scan(&s.Hour, &s.Count); err != nil {
			return nil, err
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
		return nil, err
	}
	defer rows.Close()

	var stats []DailyStats
	for rows.Next() {
		var s DailyStats
		if err := rows.Scan(&s.Date, &s.UniqueAircraft, &s.TotalPositions); err != nil {
			return nil, err
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
		return nil, err
	}
	defer rows.Close()

	var stats []AircraftTypeStats
	for rows.Next() {
		var s AircraftTypeStats
		if err := rows.Scan(&s.AircraftType, &s.Count); err != nil {
			return nil, err
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}

func (r *Repository) GetTopOperators(limit int) ([]OperatorStats, error) {
	query := `
		SELECT f.operator, COUNT(DISTINCT p.icao) as count
		FROM position_history p
		JOIN faa_registry f ON p.icao = f.icao
		WHERE f.operator IS NOT NULL AND f.operator != ''
		AND p.timestamp > NOW() - INTERVAL '24 hours'
		GROUP BY f.operator
		ORDER BY count DESC
		LIMIT $1
	`

	rows, err := r.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []OperatorStats
	for rows.Next() {
		var s OperatorStats
		if err := rows.Scan(&s.Operator, &s.Count); err != nil {
			return nil, err
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
		return nil, err
	}
	defer rows.Close()

	var aircraft []models.Aircraft
	for rows.Next() {
		var ac models.Aircraft
		var callsign, squawk, reg, acType, operator sql.NullString
		var lat, lon, speedKt, heading sql.NullFloat64
		var altFt sql.NullInt64
		var onGround sql.NullBool

		err := rows.Scan(&ac.ICAO, &callsign, &lat, &lon, &altFt, &speedKt, &heading,
			&squawk, &onGround, &ac.LastSeen, &reg, &acType, &operator)
		if err != nil {
			return nil, err
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

