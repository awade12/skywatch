package beast

import (
	"time"

	"adsb-tracker/pkg/models"
)

const (
	EscapeByte = 0x1a

	TypeModeAC    = '1'
	TypeModeShort = '2'
	TypeModeLong  = '3'
)

type Message struct {
	Type      byte
	Timestamp uint64
	RSSI      float64
	Data      []byte
}

type Parser struct {
	cpr *CPRDecoder
}

func NewParser() *Parser {
	return &Parser{
		cpr: NewCPRDecoder(),
	}
}

func (p *Parser) SetReceiverLocation(lat, lon float64) {
	p.cpr.SetReference(lat, lon)
}

func ParseFrame(data []byte) (*Message, int) {
	if len(data) < 2 {
		return nil, 0
	}

	if data[0] != EscapeByte {
		return nil, 1
	}

	msgType := data[1]
	var dataLen int
	switch msgType {
	case TypeModeAC:
		dataLen = 2
	case TypeModeShort:
		dataLen = 7
	case TypeModeLong:
		dataLen = 14
	default:
		return nil, 2
	}

	frameLen := 2 + 6 + 1 + dataLen
	if len(data) < frameLen {
		return nil, 0
	}

	unescaped := unescape(data[2:frameLen])
	if len(unescaped) < 7+dataLen {
		return nil, frameLen
	}

	msg := &Message{
		Type:      msgType,
		Timestamp: parseTimestamp(unescaped[0:6]),
		RSSI:      parseRSSI(unescaped[6]),
		Data:      unescaped[7:],
	}

	return msg, frameLen
}

func unescape(data []byte) []byte {
	result := make([]byte, 0, len(data))
	for i := 0; i < len(data); i++ {
		if data[i] == EscapeByte && i+1 < len(data) && data[i+1] == EscapeByte {
			result = append(result, EscapeByte)
			i++
		} else {
			result = append(result, data[i])
		}
	}
	return result
}

func parseTimestamp(data []byte) uint64 {
	if len(data) < 6 {
		return 0
	}
	var ts uint64
	for i := 0; i < 6; i++ {
		ts = (ts << 8) | uint64(data[i])
	}
	return ts
}

func parseRSSI(b byte) float64 {
	return float64(b)/255.0*35.0 - 50.0
}

func (p *Parser) Decode(msg *Message) *models.Aircraft {
	if msg.Type == TypeModeAC || len(msg.Data) < 7 {
		return nil
	}

	df := (msg.Data[0] >> 3) & 0x1f
	if df != 17 && df != 18 {
		return nil
	}

	icao := icaoFromData(msg.Data)
	if icao == "" {
		return nil
	}

	ac := &models.Aircraft{
		ICAO:     icao,
		LastSeen: time.Now().UTC(),
	}

	rssi := msg.RSSI
	ac.RSSI = &rssi

	me := msg.Data[4:11]
	tc := (me[0] >> 3) & 0x1f

	switch {
	case tc >= 1 && tc <= 4:
		parseIdent(me, ac)
	case tc >= 9 && tc <= 18:
		p.parseAirborne(me, ac, icao)
	case tc == 19:
		parseVelocity(me, ac)
	case tc >= 20 && tc <= 22:
		p.parseAirborne(me, ac, icao)
	}

	return ac
}

func icaoFromData(data []byte) string {
	if len(data) < 4 {
		return ""
	}
	return bytesToHex(data[1:4])
}

func bytesToHex(b []byte) string {
	const hex = "0123456789ABCDEF"
	result := make([]byte, len(b)*2)
	for i, v := range b {
		result[i*2] = hex[v>>4]
		result[i*2+1] = hex[v&0x0f]
	}
	return string(result)
}

func parseIdent(me []byte, ac *models.Aircraft) {
	if len(me) < 7 {
		return
	}

	chars := "?ABCDEFGHIJKLMNOPQRSTUVWXYZ????? ???????????????0123456789??????"

	c1 := (uint(me[1]) >> 2) & 0x3f
	c2 := ((uint(me[1]) & 0x03) << 4) | (uint(me[2]) >> 4)
	c3 := ((uint(me[2]) & 0x0f) << 2) | (uint(me[3]) >> 6)
	c4 := uint(me[3]) & 0x3f
	c5 := (uint(me[4]) >> 2) & 0x3f
	c6 := ((uint(me[4]) & 0x03) << 4) | (uint(me[5]) >> 4)
	c7 := ((uint(me[5]) & 0x0f) << 2) | (uint(me[6]) >> 6)
	c8 := uint(me[6]) & 0x3f

	callsign := ""
	for _, c := range []uint{c1, c2, c3, c4, c5, c6, c7, c8} {
		if c < uint(len(chars)) && chars[c] != ' ' && chars[c] != '?' {
			callsign += string(chars[c])
		}
	}

	if callsign != "" {
		ac.Callsign = callsign
	}
}

func (p *Parser) parseAirborne(me []byte, ac *models.Aircraft, icao string) {
	if len(me) < 7 {
		return
	}

	tc := (me[0] >> 3) & 0x1f

	altCode := (uint(me[1])<<4 | uint(me[2])>>4) & 0xfff
	if altCode > 0 {
		var alt int
		if tc < 20 {
			qBit := (altCode >> 4) & 1
			if qBit == 1 {
				n := ((altCode & 0xf) | ((altCode >> 1) & 0x7f0))
				alt = int(n)*25 - 1000
			}
		} else {
			alt = int(altCode) * 25
		}
		if alt > -1000 && alt < 60000 {
			ac.AltitudeFt = &alt
		}
	}

	oddFlag := (me[2] >> 2) & 1
	cprLat := (uint32(me[2]&0x03) << 15) | (uint32(me[3]) << 7) | (uint32(me[4]) >> 1)
	cprLon := (uint32(me[4]&0x01) << 16) | (uint32(me[5]) << 8) | uint32(me[6])

	if lat, lon, ok := p.cpr.AddFrame(icao, cprLat, cprLon, oddFlag == 1); ok {
		ac.Lat = &lat
		ac.Lon = &lon
	}
}

func parseVelocity(me []byte, ac *models.Aircraft) {
	if len(me) < 7 {
		return
	}

	subtype := me[0] & 0x07

	if subtype == 1 || subtype == 2 {
		ewDir := (me[1] >> 2) & 1
		ewVel := int(((uint(me[1])&0x03)<<8)|uint(me[2])) - 1
		nsDir := (me[3] >> 7) & 1
		nsVel := int(((uint(me[3])&0x7f)<<3)|(uint(me[4])>>5)) - 1

		if ewVel >= 0 && nsVel >= 0 {
			ew := float64(ewVel)
			ns := float64(nsVel)
			if ewDir == 1 {
				ew = -ew
			}
			if nsDir == 1 {
				ns = -ns
			}

			speed := sqrt(ew*ew + ns*ns)
			heading := atan2(ew, ns) * 180.0 / 3.14159265359
			if heading < 0 {
				heading += 360
			}

			ac.SpeedKt = &speed
			ac.Heading = &heading
		}

		vertSign := (me[4] >> 3) & 1
		vertRate := int(((uint(me[4])&0x07)<<6)|(uint(me[5])>>2)) - 1
		if vertRate >= 0 {
			vr := vertRate * 64
			if vertSign == 1 {
				vr = -vr
			}
			ac.VerticalRate = &vr
		}
	}
}

func sqrt(x float64) float64 {
	if x <= 0 {
		return 0
	}
	z := x
	for i := 0; i < 10; i++ {
		z = (z + x/z) / 2
	}
	return z
}

func atan2(y, x float64) float64 {
	if x > 0 {
		return atan(y / x)
	}
	if x < 0 {
		if y >= 0 {
			return atan(y/x) + 3.14159265359
		}
		return atan(y/x) - 3.14159265359
	}
	if y > 0 {
		return 3.14159265359 / 2
	}
	if y < 0 {
		return -3.14159265359 / 2
	}
	return 0
}

func atan(x float64) float64 {
	if x < -1 {
		return -3.14159265359/2 - atan(1/x)
	}
	if x > 1 {
		return 3.14159265359/2 - atan(1/x)
	}
	result := x
	term := x
	for i := 1; i < 15; i++ {
		term *= -x * x * float64(2*i-1) / float64(2*i+1)
		result += term
	}
	return result
}
