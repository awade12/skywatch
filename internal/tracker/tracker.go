package tracker

import (
	"context"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"adsb-tracker/pkg/models"
)

const (
	defaultPersistenceWorkers  = 4
	defaultPersistenceQueueLen = 512
	defaultFAAQueueLen         = 256
)

type persistenceKind int

const (
	persistAircraft persistenceKind = iota
	persistPosition
)

type persistenceTask struct {
	kind     persistenceKind
	aircraft models.Aircraft
}

type webhookRequest struct {
	aircraft models.Aircraft
	isNew    bool
}

type EventType int

const (
	EventAdd EventType = iota
	EventUpdate
	EventRemove
)

type AircraftEvent struct {
	Type     EventType
	Aircraft models.Aircraft
}

type Repository interface {
	SaveAircraft(ac *models.Aircraft) error
	SavePosition(ac *models.Aircraft) error
	GetPositionHistory(icao string, limit int) ([]models.Position, error)
}

type FAALookup interface {
	Lookup(icao string) *models.FAAInfo
}

type Tracker struct {
	mu         sync.RWMutex
	aircraft   map[string]*models.Aircraft
	staleAfter time.Duration
	rxLocation *models.ReceiverLocation

	maxRangeNM   float64
	maxRangeICAO string
	totalSeen    int
	trailLength  int

	repo          Repository
	faaLookup     FAALookup
	webhooks      WebhookDispatcher
	rangeTracker  RangeTracker
	flightTracker FlightTracker

	persistCh      chan persistenceTask
	persistWorkers int

	faaLookupCh  chan string
	faaPending   map[string]struct{}
	faaPendingMu sync.Mutex

	shutdown atomic.Bool

	eventsMu    sync.RWMutex
	subscribers []chan AircraftEvent
}

type Stats struct {
	AircraftCount int     `json:"aircraft_count"`
	TotalSeen     int     `json:"total_seen"`
	MaxRangeNM    float64 `json:"max_range_nm"`
	MaxRangeICAO  string  `json:"max_range_icao,omitempty"`
}

type SearchFilters struct {
	Callsign     string
	AircraftType string
	Registration string
	MinLat       float64
	MinLon       float64
	MaxLat       float64
	MaxLon       float64
	HasBounds    bool
}

type WebhookDispatcher interface {
	SendEmergency(ac *models.Aircraft)
	SendWatchlistMatch(ac *models.Aircraft, pattern string)
	SendNewAircraft(ac *models.Aircraft)
	CheckWatchlist(ac *models.Aircraft) (bool, string)
	IsEmergencySquawk(squawk string) bool
}

type RangeTracker interface {
	Record(bearing, distanceNM float64, icao string)
}

type FlightTracker interface {
	Update(ac *models.Aircraft)
	CompleteStaleFlight(icao string)
}

type Options struct {
	StaleAfter           time.Duration
	RxLat                float64
	RxLon                float64
	TrailLength          int
	Repo                 Repository
	FAALookup            FAALookup
	Webhooks             WebhookDispatcher
	RangeTracker         RangeTracker
	FlightTracker        FlightTracker
	PersistenceWorkers   int
	PersistenceQueueSize int
}

func New(opts Options) *Tracker {
	if opts.PersistenceWorkers <= 0 {
		opts.PersistenceWorkers = defaultPersistenceWorkers
	}
	if opts.PersistenceQueueSize <= 0 {
		opts.PersistenceQueueSize = defaultPersistenceQueueLen
	}

	t := &Tracker{
		aircraft:       make(map[string]*models.Aircraft),
		staleAfter:     opts.StaleAfter,
		trailLength:    opts.TrailLength,
		repo:           opts.Repo,
		faaLookup:      opts.FAALookup,
		webhooks:       opts.Webhooks,
		rangeTracker:   opts.RangeTracker,
		flightTracker:  opts.FlightTracker,
		persistWorkers: opts.PersistenceWorkers,
		faaPending:     make(map[string]struct{}),
	}
	if t.repo != nil {
		t.persistCh = make(chan persistenceTask, opts.PersistenceQueueSize)
	}
	if t.faaLookup != nil {
		t.faaLookupCh = make(chan string, defaultFAAQueueLen)
	}
	if t.trailLength == 0 {
		t.trailLength = 50
	}
	if opts.RxLat != 0 || opts.RxLon != 0 {
		t.rxLocation = &models.ReceiverLocation{Lat: opts.RxLat, Lon: opts.RxLon}
		log.Printf("[TRACKER] Receiver location: %.4f, %.4f", opts.RxLat, opts.RxLon)
	}
	return t
}

func (t *Tracker) Subscribe() chan AircraftEvent {
	ch := make(chan AircraftEvent, 100)
	t.eventsMu.Lock()
	t.subscribers = append(t.subscribers, ch)
	t.eventsMu.Unlock()
	return ch
}

func (t *Tracker) Unsubscribe(ch chan AircraftEvent) {
	t.eventsMu.Lock()
	defer t.eventsMu.Unlock()
	for i, sub := range t.subscribers {
		if sub == ch {
			t.subscribers = append(t.subscribers[:i], t.subscribers[i+1:]...)
			close(ch)
			return
		}
	}
}

func (t *Tracker) broadcast(event AircraftEvent) {
	t.eventsMu.RLock()
	defer t.eventsMu.RUnlock()
	for _, ch := range t.subscribers {
		select {
		case ch <- event:
		default:
		}
	}
}

func (t *Tracker) Update(update *models.Aircraft) {
	if update == nil || update.ICAO == "" {
		return
	}

	var (
		saveAircraft   []models.Aircraft
		savePositions  []models.Aircraft
		rangeUpdates   []models.Aircraft
		flightUpdates  []models.Aircraft
		webhookUpdates []webhookRequest
		faaRequests    []string
		events         []AircraftEvent
		newICAO        string
	)

	t.mu.Lock()

	existing, ok := t.aircraft[update.ICAO]
	if !ok {
		ac := update.Copy()
		ac.CalculateDistance(t.rxLocation)
		t.aircraft[update.ICAO] = &ac
		t.totalSeen++
		t.updateMaxRange(&ac)

		snapshot := ac.Copy()
		rangeUpdates = append(rangeUpdates, snapshot)
		flightUpdates = append(flightUpdates, snapshot)
		saveAircraft = append(saveAircraft, snapshot)
		events = append(events, AircraftEvent{Type: EventAdd, Aircraft: snapshot})
		webhookUpdates = append(webhookUpdates, webhookRequest{aircraft: snapshot, isNew: true})
		if t.needsFAAEnrichment(&ac) {
			faaRequests = append(faaRequests, ac.ICAO)
		}
		newICAO = ac.ICAO
	} else {
		oldSquawk := existing.Squawk
		oldLat := existing.Lat
		oldLon := existing.Lon
		oldAlt := existing.AltitudeFt
		oldSpd := existing.SpeedKt
		oldHdg := existing.Heading
		oldTime := existing.LastSeen

		if !t.isPositionValid(existing, update, oldTime) {
			update.Lat = nil
			update.Lon = nil
		}

		existing.Merge(update)
		existing.CalculateDistance(t.rxLocation)
		t.updateMaxRange(existing)

		var snapshot models.Aircraft
		var haveSnapshot bool
		getSnapshot := func() models.Aircraft {
			if !haveSnapshot {
				snapshot = existing.Copy()
				haveSnapshot = true
			}
			return snapshot
		}

		rangeUpdates = append(rangeUpdates, getSnapshot())
		flightUpdates = append(flightUpdates, getSnapshot())

		posChanged := hasStateChanged(oldLat, existing.Lat) || hasStateChanged(oldLon, existing.Lon)

		if posChanged && existing.Lat != nil && existing.Lon != nil {
			t.addToTrail(existing)
			savePositions = append(savePositions, getSnapshot())
		}

		if posChanged ||
			hasIntChanged(oldAlt, existing.AltitudeFt) ||
			hasStateChanged(oldSpd, existing.SpeedKt) ||
			hasStateChanged(oldHdg, existing.Heading) {
			saveAircraft = append(saveAircraft, getSnapshot())
			events = append(events, AircraftEvent{Type: EventUpdate, Aircraft: getSnapshot()})
		}

		if existing.Squawk != oldSquawk {
			webhookUpdates = append(webhookUpdates, webhookRequest{aircraft: getSnapshot(), isNew: false})
		}

		if t.needsFAAEnrichment(existing) {
			faaRequests = append(faaRequests, existing.ICAO)
		}
	}

	t.mu.Unlock()

	for _, evt := range events {
		eventCopy := evt
		t.broadcast(eventCopy)
	}

	for _, ac := range saveAircraft {
		t.queueSaveAircraft(ac)
	}

	for _, ac := range savePositions {
		t.queueSavePosition(ac)
	}

	for _, ac := range rangeUpdates {
		acCopy := ac
		t.recordRange(&acCopy)
	}

	for _, ac := range flightUpdates {
		t.dispatchFlightUpdate(ac)
	}

	for _, req := range webhookUpdates {
		acCopy := req.aircraft
		t.checkWebhookEvents(&acCopy, req.isNew)
	}

	for _, icao := range faaRequests {
		t.scheduleFAAEnrichment(icao)
	}

	if newICAO != "" {
		log.Printf("[TRACKER] Aircraft added: %s", newICAO)
	}
}

func (t *Tracker) checkWebhookEvents(ac *models.Aircraft, isNew bool) {
	if t.webhooks == nil {
		return
	}

	acCopy := ac.Copy()

	if isNew {
		go t.webhooks.SendNewAircraft(&acCopy)
	}

	if ac.Squawk != "" && t.webhooks.IsEmergencySquawk(ac.Squawk) {
		log.Printf("[TRACKER] Emergency squawk detected: %s squawking %s", ac.ICAO, ac.Squawk)
		go t.webhooks.SendEmergency(&acCopy)
	}

	if matched, pattern := t.webhooks.CheckWatchlist(&acCopy); matched {
		log.Printf("[TRACKER] Watchlist match: %s matched pattern %s", ac.ICAO, pattern)
		go t.webhooks.SendWatchlistMatch(&acCopy, pattern)
	}
}

func (t *Tracker) needsFAAEnrichment(ac *models.Aircraft) bool {
	if t.faaLookup == nil {
		return false
	}
	return ac.Registration == "" || ac.AircraftType == "" || ac.Operator == ""
}

func (t *Tracker) addToTrail(ac *models.Aircraft) {
	if ac.Lat == nil || ac.Lon == nil {
		return
	}
	pos := models.Position{
		Lat:       *ac.Lat,
		Lon:       *ac.Lon,
		Timestamp: ac.LastSeen,
	}
	if ac.AltitudeFt != nil {
		v := *ac.AltitudeFt
		pos.AltitudeFt = &v
	}
	if ac.SpeedKt != nil {
		pos.SpeedKt = ac.SpeedKt
	}
	if ac.Heading != nil {
		pos.Heading = ac.Heading
	}

	ac.Trail = append(ac.Trail, pos)
	if len(ac.Trail) > t.trailLength {
		ac.Trail = ac.Trail[len(ac.Trail)-t.trailLength:]
	}
}

func (t *Tracker) scheduleFAAEnrichment(icao string) {
	if t.faaLookupCh == nil || t.shutdown.Load() {
		return
	}

	t.faaPendingMu.Lock()
	if _, exists := t.faaPending[icao]; exists {
		t.faaPendingMu.Unlock()
		return
	}
	t.faaPending[icao] = struct{}{}
	t.faaPendingMu.Unlock()

	select {
	case t.faaLookupCh <- icao:
	default:
		t.faaPendingMu.Lock()
		delete(t.faaPending, icao)
		t.faaPendingMu.Unlock()
		log.Printf("[TRACKER] FAA lookup queue full, dropping request for %s", icao)
	}
}

func (t *Tracker) applyFAAInfo(icao string, info *models.FAAInfo) {
	if info == nil {
		return
	}

	t.mu.Lock()
	ac, ok := t.aircraft[icao]
	if !ok {
		t.mu.Unlock()
		return
	}

	updated := false
	if info.Registration != "" && ac.Registration != info.Registration {
		ac.Registration = info.Registration
		updated = true
	}
	if info.AircraftType != "" && ac.AircraftType != info.AircraftType {
		ac.AircraftType = info.AircraftType
		updated = true
	}
	if info.Owner != "" && ac.Operator != info.Owner {
		ac.Operator = info.Owner
		updated = true
	}

	var snapshot models.Aircraft
	if updated {
		snapshot = ac.Copy()
	}
	t.mu.Unlock()

	if updated {
		t.queueSaveAircraft(snapshot)
		t.dispatchFlightUpdate(snapshot)
		t.broadcast(AircraftEvent{Type: EventUpdate, Aircraft: snapshot})
	}
}

func (t *Tracker) queueSaveAircraft(ac models.Aircraft) {
	if t.persistCh == nil || t.shutdown.Load() {
		return
	}
	task := persistenceTask{kind: persistAircraft, aircraft: ac}
	select {
	case t.persistCh <- task:
	default:
		log.Printf("[TRACKER] Persistence queue full, dropping aircraft save for %s", ac.ICAO)
	}
}

func (t *Tracker) queueSavePosition(ac models.Aircraft) {
	if t.persistCh == nil || t.shutdown.Load() {
		return
	}
	task := persistenceTask{kind: persistPosition, aircraft: ac}
	select {
	case t.persistCh <- task:
	default:
		log.Printf("[TRACKER] Persistence queue full, dropping position save for %s", ac.ICAO)
	}
}

func (t *Tracker) handlePersistenceTask(task persistenceTask) {
	if t.repo == nil {
		return
	}

	ac := task.aircraft
	switch task.kind {
	case persistAircraft:
		if err := t.repo.SaveAircraft(&ac); err != nil {
			log.Printf("[TRACKER] Failed to save aircraft %s: %v", ac.ICAO, err)
		}
	case persistPosition:
		if err := t.repo.SavePosition(&ac); err != nil {
			log.Printf("[TRACKER] Failed to save position for %s: %v", ac.ICAO, err)
		}
	}
}

func (t *Tracker) runPersistenceWorker(ctx context.Context, wg *sync.WaitGroup) {
	defer wg.Done()
	for {
		select {
		case <-ctx.Done():
			return
		case task, ok := <-t.persistCh:
			if !ok {
				return
			}
			t.handlePersistenceTask(task)
		}
	}
}

func (t *Tracker) runFAAWorker(ctx context.Context, wg *sync.WaitGroup) {
	defer wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		case icao, ok := <-t.faaLookupCh:
			if !ok {
				return
			}
			info := t.faaLookup.Lookup(icao)
			t.faaPendingMu.Lock()
			delete(t.faaPending, icao)
			t.faaPendingMu.Unlock()
			if info != nil {
				t.applyFAAInfo(icao, info)
			}
		}
	}
}

func hasStateChanged(old, new *float64) bool {
	if old == nil && new == nil {
		return false
	}
	if old == nil || new == nil {
		return true
	}
	return *old != *new
}

func hasIntChanged(old, new *int) bool {
	if old == nil && new == nil {
		return false
	}
	if old == nil || new == nil {
		return true
	}
	return *old != *new
}

func (t *Tracker) isPositionValid(existing *models.Aircraft, update *models.Aircraft, oldTime time.Time) bool {
	if update.Lat == nil || update.Lon == nil {
		return true
	}
	if existing.Lat == nil || existing.Lon == nil {
		return true
	}

	elapsed := update.LastSeen.Sub(oldTime).Seconds()
	if elapsed <= 0 {
		elapsed = 1
	}

	dist := quickDistanceNM(*existing.Lat, *existing.Lon, *update.Lat, *update.Lon)

	maxSpeedKts := 800.0
	maxDistNM := (maxSpeedKts / 3600.0) * elapsed * 1.5

	if maxDistNM < 5 {
		maxDistNM = 5
	}

	if dist > maxDistNM {
		log.Printf("[TRACKER] Position jump rejected for %s: %.1f NM in %.1fs (max %.1f NM)",
			update.ICAO, dist, elapsed, maxDistNM)
		return false
	}

	return true
}

func quickDistanceNM(lat1, lon1, lat2, lon2 float64) float64 {
	dLat := (lat2 - lat1) * 60
	dLon := (lon2 - lon1) * 60 * cosApprox(lat1)
	return sqrtApprox(dLat*dLat + dLon*dLon)
}

func cosApprox(deg float64) float64 {
	rad := deg * 0.0174533
	return 1 - rad*rad/2
}

func sqrtApprox(x float64) float64 {
	if x <= 0 {
		return 0
	}
	z := x
	for i := 0; i < 5; i++ {
		z = (z + x/z) / 2
	}
	return z
}

func (t *Tracker) updateMaxRange(ac *models.Aircraft) {
	if ac.DistanceNM != nil && *ac.DistanceNM > t.maxRangeNM {
		t.maxRangeNM = *ac.DistanceNM
		t.maxRangeICAO = ac.ICAO
		log.Printf("[TRACKER] New max range: %.1f NM (%s)", t.maxRangeNM, ac.ICAO)
	}
}

func (t *Tracker) recordRange(ac *models.Aircraft) {
	if t.rangeTracker == nil {
		return
	}
	if ac.Bearing != nil && ac.DistanceNM != nil {
		t.rangeTracker.Record(*ac.Bearing, *ac.DistanceNM, ac.ICAO)
	}
}

func (t *Tracker) dispatchFlightUpdate(ac models.Aircraft) {
	if t.flightTracker == nil {
		return
	}
	acCopy := ac
	t.flightTracker.Update(&acCopy)
}

func (t *Tracker) GetStats() Stats {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return Stats{
		AircraftCount: len(t.aircraft),
		TotalSeen:     t.totalSeen,
		MaxRangeNM:    t.maxRangeNM,
		MaxRangeICAO:  t.maxRangeICAO,
	}
}

func (t *Tracker) Get(icao string) (models.Aircraft, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	ac, ok := t.aircraft[icao]
	if !ok {
		return models.Aircraft{}, false
	}
	return ac.Copy(), true
}

func (t *Tracker) GetTrail(icao string) ([]models.Position, error) {
	t.mu.RLock()
	ac, ok := t.aircraft[icao]
	if ok && len(ac.Trail) > 0 {
		trail := make([]models.Position, len(ac.Trail))
		copy(trail, ac.Trail)
		t.mu.RUnlock()
		return trail, nil
	}
	t.mu.RUnlock()

	if t.repo != nil {
		return t.repo.GetPositionHistory(icao, t.trailLength)
	}
	return []models.Position{}, nil
}

func (t *Tracker) GetAll() []models.Aircraft {
	t.mu.RLock()
	defer t.mu.RUnlock()
	result := make([]models.Aircraft, 0, len(t.aircraft))
	for _, ac := range t.aircraft {
		result = append(result, ac.Copy())
	}
	return result
}

func (t *Tracker) GetReceiverInfo() *models.ReceiverLocation {
	return t.rxLocation
}

func (t *Tracker) Search(filters SearchFilters) []models.Aircraft {
	t.mu.RLock()
	defer t.mu.RUnlock()

	result := make([]models.Aircraft, 0)
	for _, ac := range t.aircraft {
		if !matchesFilters(ac, filters) {
			continue
		}
		result = append(result, ac.Copy())
	}
	return result
}

func matchesFilters(ac *models.Aircraft, f SearchFilters) bool {
	if f.Callsign != "" {
		if ac.Callsign == "" || !containsIgnoreCase(ac.Callsign, f.Callsign) {
			return false
		}
	}
	if f.AircraftType != "" {
		if ac.AircraftType == "" || !containsIgnoreCase(ac.AircraftType, f.AircraftType) {
			return false
		}
	}
	if f.Registration != "" {
		if ac.Registration == "" || !containsIgnoreCase(ac.Registration, f.Registration) {
			return false
		}
	}
	if f.HasBounds {
		if ac.Lat == nil || ac.Lon == nil {
			return false
		}
		if *ac.Lat < f.MinLat || *ac.Lat > f.MaxLat {
			return false
		}
		if *ac.Lon < f.MinLon || *ac.Lon > f.MaxLon {
			return false
		}
	}
	return true
}

func containsIgnoreCase(s, substr string) bool {
	sLower := make([]byte, len(s))
	subLower := make([]byte, len(substr))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 32
		}
		sLower[i] = c
	}
	for i := 0; i < len(substr); i++ {
		c := substr[i]
		if c >= 'A' && c <= 'Z' {
			c += 32
		}
		subLower[i] = c
	}
	return len(s) >= len(substr) && bytesContains(sLower, subLower)
}

func bytesContains(s, sub []byte) bool {
	if len(sub) == 0 {
		return true
	}
	if len(s) < len(sub) {
		return false
	}
	for i := 0; i <= len(s)-len(sub); i++ {
		match := true
		for j := 0; j < len(sub); j++ {
			if s[i+j] != sub[j] {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}

func (t *Tracker) Count() int {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return len(t.aircraft)
}

func (t *Tracker) Run(ctx context.Context) error {
	var wg sync.WaitGroup

	if t.persistCh != nil {
		for i := 0; i < t.persistWorkers; i++ {
			wg.Add(1)
			go t.runPersistenceWorker(ctx, &wg)
		}
	}

	if t.faaLookupCh != nil {
		wg.Add(1)
		go t.runFAAWorker(ctx, &wg)
	}

	cleanupTicker := time.NewTicker(10 * time.Second)
	defer cleanupTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			t.shutdown.Store(true)
			wg.Wait()
			return ctx.Err()
		case <-cleanupTicker.C:
			t.cleanupStale()
		}
	}
}

func (t *Tracker) cleanupStale() {
	now := time.Now().UTC()
	var toRemove []string

	t.mu.RLock()
	for icao, ac := range t.aircraft {
		if now.Sub(ac.LastSeen) > t.staleAfter {
			toRemove = append(toRemove, icao)
		}
	}
	t.mu.RUnlock()

	if len(toRemove) == 0 {
		return
	}

	t.mu.Lock()
	for _, icao := range toRemove {
		if ac, ok := t.aircraft[icao]; ok {
			if now.Sub(ac.LastSeen) > t.staleAfter {
				log.Printf("[TRACKER] Aircraft removed (stale): %s", icao)
				acCopy := ac.Copy()
				delete(t.aircraft, icao)
				t.broadcast(AircraftEvent{Type: EventRemove, Aircraft: acCopy})

				if t.flightTracker != nil {
					go t.flightTracker.CompleteStaleFlight(icao)
				}
			}
		}
	}
	t.mu.Unlock()
}
