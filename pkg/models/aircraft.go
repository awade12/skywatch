package models

import (
	"math"
	"time"
)

type Aircraft struct {
	ICAO            string     `json:"icao"`
	Callsign        string     `json:"callsign,omitempty"`
	Registration    string     `json:"registration,omitempty"`
	AircraftType    string     `json:"aircraft_type,omitempty"`
	Operator        string     `json:"operator,omitempty"`
	Lat             *float64   `json:"lat,omitempty"`
	Lon             *float64   `json:"lon,omitempty"`
	AltitudeFt      *int       `json:"alt_ft,omitempty"`
	AltitudeGNSS    *int       `json:"alt_gnss_ft,omitempty"`
	SpeedKt         *float64   `json:"speed_kt,omitempty"`
	Heading         *float64   `json:"heading,omitempty"`
	VerticalRate    *int       `json:"vertical_rate,omitempty"`
	Squawk          string     `json:"squawk,omitempty"`
	OnGround        *bool      `json:"on_ground,omitempty"`
	RSSI            *float64   `json:"rssi,omitempty"`
	DistanceNM      *float64   `json:"distance_nm,omitempty"`
	Bearing         *float64   `json:"bearing,omitempty"`
	BearingCardinal string     `json:"bearing_cardinal,omitempty"`
	Trail           []Position `json:"trail,omitempty"`
	LastSeen        time.Time  `json:"last_seen"`
}

type ReceiverLocation struct {
	Lat float64
	Lon float64
}

type Position struct {
	Lat        float64   `json:"lat"`
	Lon        float64   `json:"lon"`
	AltitudeFt *int      `json:"alt_ft,omitempty"`
	SpeedKt    *float64  `json:"speed_kt,omitempty"`
	Heading    *float64  `json:"heading,omitempty"`
	Timestamp  time.Time `json:"timestamp"`
}

type FAAInfo struct {
	Registration string `json:"registration,omitempty"`
	AircraftType string `json:"aircraft_type,omitempty"`
	Manufacturer string `json:"manufacturer,omitempty"`
	Model        string `json:"model,omitempty"`
	Operator     string `json:"operator,omitempty"`
	Owner        string `json:"owner,omitempty"`
}

func (a *Aircraft) CalculateDistance(rx *ReceiverLocation) {
	if rx == nil || a.Lat == nil || a.Lon == nil {
		return
	}
	dist := haversineNM(rx.Lat, rx.Lon, *a.Lat, *a.Lon)
	dist = math.Round(dist*10) / 10
	a.DistanceNM = &dist

	bearing := calculateBearing(rx.Lat, rx.Lon, *a.Lat, *a.Lon)
	bearing = math.Round(bearing)
	a.Bearing = &bearing
	a.BearingCardinal = toCardinal(bearing)
}

func calculateBearing(lat1, lon1, lat2, lon2 float64) float64 {
	lat1Rad := toRad(lat1)
	lat2Rad := toRad(lat2)
	dLon := toRad(lon2 - lon1)

	x := math.Sin(dLon) * math.Cos(lat2Rad)
	y := math.Cos(lat1Rad)*math.Sin(lat2Rad) - math.Sin(lat1Rad)*math.Cos(lat2Rad)*math.Cos(dLon)

	bearing := math.Atan2(x, y) * 180 / math.Pi
	return math.Mod(bearing+360, 360)
}

func toCardinal(bearing float64) string {
	dirs := []string{"N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"}
	idx := int(math.Round(bearing/22.5)) % 16
	return dirs[idx]
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

func (a *Aircraft) Merge(update *Aircraft) {
	if update.Callsign != "" {
		a.Callsign = update.Callsign
	}
	if update.Lat != nil {
		a.Lat = update.Lat
	}
	if update.Lon != nil {
		a.Lon = update.Lon
	}
	if update.AltitudeFt != nil {
		a.AltitudeFt = update.AltitudeFt
	}
	if update.AltitudeGNSS != nil {
		a.AltitudeGNSS = update.AltitudeGNSS
	}
	if update.SpeedKt != nil {
		a.SpeedKt = update.SpeedKt
	}
	if update.Heading != nil {
		a.Heading = update.Heading
	}
	if update.VerticalRate != nil {
		a.VerticalRate = update.VerticalRate
	}
	if update.Squawk != "" {
		a.Squawk = update.Squawk
	}
	if update.OnGround != nil {
		a.OnGround = update.OnGround
	}
	if update.RSSI != nil {
		a.RSSI = update.RSSI
	}
	a.LastSeen = update.LastSeen
}

func (a *Aircraft) Copy() Aircraft {
	cpy := Aircraft{
		ICAO:            a.ICAO,
		Callsign:        a.Callsign,
		Registration:    a.Registration,
		AircraftType:    a.AircraftType,
		Operator:        a.Operator,
		Squawk:          a.Squawk,
		BearingCardinal: a.BearingCardinal,
		LastSeen:        a.LastSeen,
	}
	if len(a.Trail) > 0 {
		cpy.Trail = make([]Position, len(a.Trail))
		copy(cpy.Trail, a.Trail)
	}
	if a.Lat != nil {
		v := *a.Lat
		cpy.Lat = &v
	}
	if a.Lon != nil {
		v := *a.Lon
		cpy.Lon = &v
	}
	if a.AltitudeFt != nil {
		v := *a.AltitudeFt
		cpy.AltitudeFt = &v
	}
	if a.AltitudeGNSS != nil {
		v := *a.AltitudeGNSS
		cpy.AltitudeGNSS = &v
	}
	if a.SpeedKt != nil {
		v := *a.SpeedKt
		cpy.SpeedKt = &v
	}
	if a.Heading != nil {
		v := *a.Heading
		cpy.Heading = &v
	}
	if a.VerticalRate != nil {
		v := *a.VerticalRate
		cpy.VerticalRate = &v
	}
	if a.OnGround != nil {
		v := *a.OnGround
		cpy.OnGround = &v
	}
	if a.DistanceNM != nil {
		v := *a.DistanceNM
		cpy.DistanceNM = &v
	}
	if a.Bearing != nil {
		v := *a.Bearing
		cpy.Bearing = &v
	}
	if a.RSSI != nil {
		v := *a.RSSI
		cpy.RSSI = &v
	}
	return cpy
}

