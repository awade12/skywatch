package lookup

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"adsb-tracker/internal/database"
	"adsb-tracker/pkg/models"
)

type FAALookup struct {
	repo   *database.Repository
	cache  map[string]*cacheEntry
	mu     sync.RWMutex
	client *http.Client
}

type cacheEntry struct {
	info      *models.FAAInfo
	timestamp time.Time
	notFound  bool
}

func NewFAALookup(repo *database.Repository) *FAALookup {
	return &FAALookup{
		repo:  repo,
		cache: make(map[string]*cacheEntry),
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

func (f *FAALookup) Lookup(icao string) *models.FAAInfo {
	f.mu.RLock()
	entry, ok := f.cache[icao]
	f.mu.RUnlock()

	if ok && time.Since(entry.timestamp) < 24*time.Hour {
		if entry.notFound {
			return nil
		}
		return entry.info
	}

	if f.repo != nil {
		info, err := f.repo.GetFAAInfo(icao)
		if err == nil && info != nil {
			f.mu.Lock()
			f.cache[icao] = &cacheEntry{info: info, timestamp: time.Now()}
			f.mu.Unlock()
			return info
		}
	}

	go f.fetchAndCache(icao)
	return nil
}

func (f *FAALookup) fetchAndCache(icao string) {
	info := f.fetchFromHexDB(icao)
	
	f.mu.Lock()
	if info != nil {
		f.cache[icao] = &cacheEntry{info: info, timestamp: time.Now()}
		if f.repo != nil {
			f.repo.SaveFAAInfo(icao, info)
		}
	} else {
		f.cache[icao] = &cacheEntry{notFound: true, timestamp: time.Now()}
	}
	f.mu.Unlock()
}

func (f *FAALookup) fetchFromHexDB(icao string) *models.FAAInfo {
	url := fmt.Sprintf("https://hexdb.io/api/v1/aircraft/%s", icao)
	
	resp, err := f.client.Get(url)
	if err != nil {
		log.Printf("[FAA] Lookup failed for %s: %v", icao, err)
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil
	}

	var data struct {
		Registration string `json:"Registration"`
		Type         string `json:"Type"`
		ICAOType     string `json:"ICAOTypeCode"`
		Manufacturer string `json:"Manufacturer"`
		RegisteredOwner string `json:"RegisteredOwners"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		log.Printf("[FAA] Decode failed for %s: %v", icao, err)
		return nil
	}

	if data.Registration == "" && data.Type == "" {
		return nil
	}

	return &models.FAAInfo{
		Registration: data.Registration,
		AircraftType: data.ICAOType,
		Manufacturer: data.Manufacturer,
		Model:        data.Type,
		Owner:        data.RegisteredOwner,
	}
}

