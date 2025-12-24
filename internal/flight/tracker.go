package flight

import (
	"math"
	"sync"
	"time"

	"adsb-tracker/internal/database"
	"adsb-tracker/pkg/models"
)

type ActiveFlight struct {
	ID          int64
	ICAO        string
	Callsign    string
	Registration string
	AircraftType string
	FirstSeen   time.Time
	LastSeen    time.Time
	FirstLat    *float64
	FirstLon    *float64
	LastLat     *float64
	LastLon     *float64
	MaxAltFt    int
	TotalDistNM float64
	PrevLat     *float64
	PrevLon     *float64
}

type Tracker struct {
	mu      sync.RWMutex
	flights map[string]*ActiveFlight
	repo    *database.Repository
	staleTimeout time.Duration
}

func New(repo *database.Repository, staleTimeout time.Duration) *Tracker {
	return &Tracker{
		flights:      make(map[string]*ActiveFlight),
		repo:         repo,
		staleTimeout: staleTimeout,
	}
}

func (t *Tracker) Update(ac *models.Aircraft) {
	if ac == nil || ac.ICAO == "" {
		return
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	flight, exists := t.flights[ac.ICAO]
	if !exists {
		flight = &ActiveFlight{
			ICAO:      ac.ICAO,
			FirstSeen: ac.LastSeen,
			LastSeen:  ac.LastSeen,
		}
		t.flights[ac.ICAO] = flight

		if t.repo != nil {
			record := &database.FlightRecord{
				ICAO:      ac.ICAO,
				FirstSeen: ac.LastSeen,
				LastSeen:  ac.LastSeen,
			}
			if ac.Lat != nil {
				record.FirstLat = ac.Lat
				record.LastLat = ac.Lat
			}
			if ac.Lon != nil {
				record.FirstLon = ac.Lon
				record.LastLon = ac.Lon
			}
			id, err := t.repo.CreateFlight(record)
			if err == nil {
				flight.ID = id
			}
		}
	}

	flight.LastSeen = ac.LastSeen

	if ac.Callsign != "" {
		flight.Callsign = ac.Callsign
	}
	if ac.Registration != "" {
		flight.Registration = ac.Registration
	}
	if ac.AircraftType != "" {
		flight.AircraftType = ac.AircraftType
	}

	if ac.AltitudeFt != nil && *ac.AltitudeFt > flight.MaxAltFt {
		flight.MaxAltFt = *ac.AltitudeFt
	}

	if ac.Lat != nil && ac.Lon != nil {
		if flight.FirstLat == nil {
			flight.FirstLat = ac.Lat
			flight.FirstLon = ac.Lon
		}

		if flight.PrevLat != nil && flight.PrevLon != nil {
			dist := haversineNM(*flight.PrevLat, *flight.PrevLon, *ac.Lat, *ac.Lon)
			if dist < 50 {
				flight.TotalDistNM += dist
			}
		}

		flight.LastLat = ac.Lat
		flight.LastLon = ac.Lon
		flight.PrevLat = ac.Lat
		flight.PrevLon = ac.Lon
	}
}

func (t *Tracker) CompleteStaleFlight(icao string) {
	t.mu.Lock()
	flight, exists := t.flights[icao]
	if !exists {
		t.mu.Unlock()
		return
	}
	delete(t.flights, icao)
	t.mu.Unlock()

	if t.repo != nil && flight.ID > 0 {
		var maxAlt *int
		if flight.MaxAltFt > 0 {
			maxAlt = &flight.MaxAltFt
		}

		record := &database.FlightRecord{
			ID:          flight.ID,
			Callsign:    flight.Callsign,
			LastSeen:    flight.LastSeen,
			LastLat:     flight.LastLat,
			LastLon:     flight.LastLon,
			MaxAltFt:    maxAlt,
			TotalDistNM: flight.TotalDistNM,
			Completed:   true,
		}
		t.repo.UpdateFlight(record)
	}
}

func (t *Tracker) GetActiveCount() int {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return len(t.flights)
}

func (t *Tracker) GetRecentFlights(limit int) ([]database.FlightRecord, error) {
	if t.repo == nil {
		return []database.FlightRecord{}, nil
	}
	return t.repo.GetRecentFlights(limit)
}

func (t *Tracker) GetFlightByID(id int64) (*database.FlightRecord, error) {
	if t.repo == nil {
		return nil, nil
	}
	return t.repo.GetFlightByID(id)
}

func haversineNM(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadiusNM = 3440.065
	dLat := toRad(lat2 - lat1)
	dLon := toRad(lon2 - lon1)
	lat1Rad := toRad(lat1)
	lat2Rad := toRad(lat2)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadiusNM * c
}

func toRad(deg float64) float64 {
	return deg * math.Pi / 180
}

