package beast

import (
	"math"
	"sync"
	"time"
)

const (
	cprMaxDelta = 10 * time.Second
	nzLat       = 15.0
)

type CPRFrame struct {
	Lat       uint32
	Lon       uint32
	Odd       bool
	Timestamp time.Time
}

type CPRDecoder struct {
	mu       sync.RWMutex
	frames   map[string][2]*CPRFrame
	lastPos  map[string]*Position
	refLat   float64
	refLon   float64
	hasRef   bool
}

type Position struct {
	Lat float64
	Lon float64
}

func NewCPRDecoder() *CPRDecoder {
	return &CPRDecoder{
		frames:  make(map[string][2]*CPRFrame),
		lastPos: make(map[string]*Position),
	}
}

func (d *CPRDecoder) SetReference(lat, lon float64) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.refLat = lat
	d.refLon = lon
	d.hasRef = true
}

func (d *CPRDecoder) AddFrame(icao string, lat, lon uint32, odd bool) (float64, float64, bool) {
	d.mu.Lock()
	defer d.mu.Unlock()

	now := time.Now()
	frame := &CPRFrame{
		Lat:       lat,
		Lon:       lon,
		Odd:       odd,
		Timestamp: now,
	}

	frames := d.frames[icao]
	idx := 0
	if odd {
		idx = 1
	}
	frames[idx] = frame
	d.frames[icao] = frames

	var refLat, refLon float64
	var hasRef bool

	if pos, ok := d.lastPos[icao]; ok {
		refLat = pos.Lat
		refLon = pos.Lon
		hasRef = true
	} else if d.hasRef {
		refLat = d.refLat
		refLon = d.refLon
		hasRef = true
	}

	if hasRef {
		decodedLat, decodedLon, ok := decodeLocalCPR(lat, lon, odd, refLat, refLon)
		if ok {
			d.lastPos[icao] = &Position{Lat: decodedLat, Lon: decodedLon}
			return decodedLat, decodedLon, true
		}
	}

	even := frames[0]
	oddFrame := frames[1]

	if even == nil || oddFrame == nil {
		return 0, 0, false
	}

	if now.Sub(even.Timestamp) > cprMaxDelta || now.Sub(oddFrame.Timestamp) > cprMaxDelta {
		return 0, 0, false
	}

	decodedLat, decodedLon, ok := decodeCPR(even.Lat, even.Lon, oddFrame.Lat, oddFrame.Lon, odd)
	if !ok {
		return 0, 0, false
	}

	if d.hasRef {
		dist := quickDist(d.refLat, d.refLon, decodedLat, decodedLon)
		if dist > 300 {
			return 0, 0, false
		}
	}

	d.lastPos[icao] = &Position{Lat: decodedLat, Lon: decodedLon}
	return decodedLat, decodedLon, true
}

func decodeLocalCPR(cprLat, cprLon uint32, odd bool, refLat, refLon float64) (float64, float64, bool) {
	const cprScale = 131072.0

	latCpr := float64(cprLat) / cprScale
	lonCpr := float64(cprLon) / cprScale

	var dLat float64
	if odd {
		dLat = 360.0 / 59.0
	} else {
		dLat = 360.0 / 60.0
	}

	j := math.Floor(refLat/dLat) + math.Floor(0.5+mod(refLat, dLat)/dLat-latCpr)
	lat := dLat * (j + latCpr)

	if lat < -90 || lat > 90 {
		return 0, 0, false
	}

	var nlVal int
	if odd {
		nlVal = nl(lat) - 1
	} else {
		nlVal = nl(lat)
	}

	if nlVal < 1 {
		nlVal = 1
	}

	dLon := 360.0 / float64(nlVal)
	m := math.Floor(refLon/dLon) + math.Floor(0.5+mod(refLon, dLon)/dLon-lonCpr)
	lon := dLon * (m + lonCpr)

	if lon > 180 {
		lon -= 360
	}
	if lon < -180 {
		lon += 360
	}

	dist := quickDist(refLat, refLon, lat, lon)
	if dist > 180 {
		return 0, 0, false
	}

	return lat, lon, true
}

func decodeCPR(evenLat, evenLon, oddLat, oddLon uint32, useOdd bool) (float64, float64, bool) {
	const cprScale = 131072.0

	latEven := float64(evenLat) / cprScale
	latOdd := float64(oddLat) / cprScale
	lonEven := float64(evenLon) / cprScale
	lonOdd := float64(oddLon) / cprScale

	j := math.Floor(59*latEven - 60*latOdd + 0.5)

	latE := (360.0/60.0)*(mod(j, 60) + latEven)
	latO := (360.0/59.0)*(mod(j, 59) + latOdd)

	if latE >= 270 {
		latE -= 360
	}
	if latO >= 270 {
		latO -= 360
	}

	nlE := nl(latE)
	nlO := nl(latO)

	if nlE != nlO {
		return 0, 0, false
	}

	var lat, lon float64

	if useOdd {
		lat = latO
		if nlO > 0 {
			m := math.Floor(lonEven*(float64(nlO)-1) - lonOdd*float64(nlO) + 0.5)
			lon = (360.0 / float64(nlO)) * (mod(m, float64(nlO)) + lonOdd)
		} else {
			lon = lonOdd * 360.0
		}
	} else {
		lat = latE
		if nlE > 0 {
			m := math.Floor(lonEven*(float64(nlE)-1) - lonOdd*float64(nlE) + 0.5)
			lon = (360.0 / float64(nlE)) * (mod(m, float64(nlE)) + lonEven)
		} else {
			lon = lonEven * 360.0
		}
	}

	if lon >= 180 {
		lon -= 360
	}

	if lat < -90 || lat > 90 || lon < -180 || lon > 180 {
		return 0, 0, false
	}

	return lat, lon, true
}

func quickDist(lat1, lon1, lat2, lon2 float64) float64 {
	dLat := (lat2 - lat1) * 60
	avgLat := (lat1 + lat2) / 2
	dLon := (lon2 - lon1) * 60 * math.Cos(avgLat*math.Pi/180)
	return math.Sqrt(dLat*dLat + dLon*dLon)
}

func nl(lat float64) int {
	if lat == 0 {
		return 59
	}
	if math.Abs(lat) == 87 {
		return 2
	}
	if math.Abs(lat) > 87 {
		return 1
	}

	a := 1 - math.Cos(math.Pi/(2*nzLat))
	b := math.Pow(math.Cos(lat*math.Pi/180), 2)
	x := 1 - a/b

	if x < -1 {
		x = -1
	}
	if x > 1 {
		x = 1
	}

	return int(math.Floor(2 * math.Pi / math.Acos(x)))
}

func mod(a, b float64) float64 {
	result := math.Mod(a, b)
	if result < 0 {
		result += b
	}
	return result
}

func (d *CPRDecoder) Cleanup() {
	d.mu.Lock()
	defer d.mu.Unlock()

	now := time.Now()
	for icao, frames := range d.frames {
		stale := true
		for _, f := range frames {
			if f != nil && now.Sub(f.Timestamp) < 60*time.Second {
				stale = false
				break
			}
		}
		if stale {
			delete(d.frames, icao)
			delete(d.lastPos, icao)
		}
	}
}
