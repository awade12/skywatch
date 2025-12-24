package rangetracker

import (
	"sync"
	"time"
)

type BucketStats struct {
	Bearing      int     `json:"bearing"`
	MaxRangeNM   float64 `json:"max_range_nm"`
	MaxRangeICAO string  `json:"max_range_icao,omitempty"`
	ContactCount int64   `json:"contact_count"`
}

type RangeStats struct {
	Buckets        []BucketStats `json:"buckets"`
	AllTimeMaxNM   float64       `json:"all_time_max_nm"`
	AllTimeMaxICAO string        `json:"all_time_max_icao,omitempty"`
	TotalContacts  int64         `json:"total_contacts"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

type Tracker struct {
	mu             sync.RWMutex
	maxByBearing   [36]float64
	icaoByBearing  [36]string
	countByBearing [36]int64
	allTimeMaxNM   float64
	allTimeMaxICAO string
	repo           Repository
}

type Repository interface {
	SaveRangeStats(bucket int, maxNM float64, icao string, count int64) error
	LoadRangeStats() ([]BucketStats, error)
}

func New(repo Repository) *Tracker {
	t := &Tracker{
		repo: repo,
	}
	if repo != nil {
		t.loadFromDB()
	}
	return t
}

func (t *Tracker) loadFromDB() {
	stats, err := t.repo.LoadRangeStats()
	if err != nil {
		return
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	for _, s := range stats {
		if s.Bearing >= 0 && s.Bearing < 36 {
			t.maxByBearing[s.Bearing] = s.MaxRangeNM
			t.icaoByBearing[s.Bearing] = s.MaxRangeICAO
			t.countByBearing[s.Bearing] = s.ContactCount

			if s.MaxRangeNM > t.allTimeMaxNM {
				t.allTimeMaxNM = s.MaxRangeNM
				t.allTimeMaxICAO = s.MaxRangeICAO
			}
		}
	}
}

func (t *Tracker) Record(bearing, distanceNM float64, icao string) {
	if bearing < 0 || bearing >= 360 || distanceNM <= 0 {
		return
	}

	bucket := int(bearing / 10)
	if bucket >= 36 {
		bucket = 35
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	t.countByBearing[bucket]++

	if distanceNM > t.maxByBearing[bucket] {
		t.maxByBearing[bucket] = distanceNM
		t.icaoByBearing[bucket] = icao

		if t.repo != nil {
			go t.repo.SaveRangeStats(bucket, distanceNM, icao, t.countByBearing[bucket])
		}
	}

	if distanceNM > t.allTimeMaxNM {
		t.allTimeMaxNM = distanceNM
		t.allTimeMaxICAO = icao
	}
}

func (t *Tracker) GetStats() RangeStats {
	t.mu.RLock()
	defer t.mu.RUnlock()

	stats := RangeStats{
		Buckets:        make([]BucketStats, 36),
		AllTimeMaxNM:   t.allTimeMaxNM,
		AllTimeMaxICAO: t.allTimeMaxICAO,
		UpdatedAt:      time.Now(),
	}

	for i := 0; i < 36; i++ {
		stats.Buckets[i] = BucketStats{
			Bearing:      i * 10,
			MaxRangeNM:   t.maxByBearing[i],
			MaxRangeICAO: t.icaoByBearing[i],
			ContactCount: t.countByBearing[i],
		}
		stats.TotalContacts += t.countByBearing[i]
	}

	return stats
}

func (t *Tracker) GetMaxRange() (float64, string) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.allTimeMaxNM, t.allTimeMaxICAO
}

