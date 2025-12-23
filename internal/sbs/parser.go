package sbs

import (
	"strconv"
	"strings"
	"time"

	"adsb-tracker/pkg/models"
)

const (
	idxMessageType = 0
	idxICAO        = 4
	idxCallsign    = 10 
	idxAltitude    = 11
	idxGroundSpeed = 12 
	idxHeading     = 13
	idxLatitude    = 14
	idxLongitude   = 15
	idxVertRate    = 16
	idxSquawk      = 17
	idxOnGround    = 21
	minFields      = 22
)

func ParseMessage(line string) *models.Aircraft {
	fields := strings.Split(line, ",")
	if len(fields) < minFields {
		return nil
	}

	if fields[idxMessageType] != "MSG" {
		return nil
	}

	icao := strings.TrimSpace(fields[idxICAO])
	if icao == "" {
		return nil
	}

	ac := &models.Aircraft{
		ICAO:     strings.ToUpper(icao),
		LastSeen: time.Now().UTC(),
	}

	if cs := strings.TrimSpace(fields[idxCallsign]); cs != "" {
		ac.Callsign = cs
	}

	if alt := parseInt(fields[idxAltitude]); alt != nil {
		ac.AltitudeFt = alt
	}

	if spd := parseFloat(fields[idxGroundSpeed]); spd != nil {
		ac.SpeedKt = spd
	}

	if hdg := parseFloat(fields[idxHeading]); hdg != nil {
		ac.Heading = hdg
	}

	if lat := parseFloat(fields[idxLatitude]); lat != nil {
		ac.Lat = lat
	}

	if lon := parseFloat(fields[idxLongitude]); lon != nil {
		ac.Lon = lon
	}

	if vr := parseInt(fields[idxVertRate]); vr != nil {
		ac.VerticalRate = vr
	}

	if sq := strings.TrimSpace(fields[idxSquawk]); sq != "" {
		ac.Squawk = sq
	}

	if og := parseBool(fields[idxOnGround]); og != nil {
		ac.OnGround = og
	}

	return ac
}

func parseInt(s string) *int {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return nil
	}
	return &v
}

func parseFloat(s string) *float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return nil
	}
	return &v
}

func parseBool(s string) *bool {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	if s == "-1" || s == "1" {
		v := true
		return &v
	}
	if s == "0" {
		v := false
		return &v
	}
	return nil
}

