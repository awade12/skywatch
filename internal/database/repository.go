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

