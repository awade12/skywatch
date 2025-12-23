const aircraft = new Map();
const markers = new Map();
const trails = new Map();
let selectedIcao = null;
let map;
let ws;
let reconnectTimeout;

const aircraftSvg = `<svg viewBox="0 0 24 24" width="28" height="28">
    <path fill="#00d4ff" d="M12 2L4 12l1.5 1.5L11 9v12h2V9l5.5 4.5L20 12z"/>
</svg>`;

function init() {
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([33.29, -96.98], 10);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    loadAircraft();
    connectWebSocket();
    setInterval(updateStats, 5000);
    setInterval(cleanupStale, 10000);
}

async function loadAircraft() {
    try {
        const resp = await fetch('/api/aircraft');
        const data = await resp.json();
        data.forEach(ac => updateAircraft(ac));
        renderList();
    } catch (err) {
        console.error('Failed to load aircraft:', err);
    }
}

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
        document.getElementById('ws-status').classList.remove('disconnected');
        document.getElementById('ws-status-text').textContent = 'Connected';
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
    };

    ws.onclose = () => {
        document.getElementById('ws-status').classList.add('disconnected');
        document.getElementById('ws-status-text').textContent = 'Disconnected';
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.event === 'add' || msg.event === 'update') {
            updateAircraft(msg.aircraft);
            renderList();
        } else if (msg.event === 'remove') {
            removeAircraft(msg.aircraft.icao);
            renderList();
        }
    };
}

function updateAircraft(ac) {
    const existing = aircraft.get(ac.icao);
    if (existing) {
        Object.assign(existing, ac);
        existing.lastUpdate = Date.now();
    } else {
        ac.lastUpdate = Date.now();
        aircraft.set(ac.icao, ac);
    }
    updateMarker(ac);
    updateTrail(ac);
}

function removeAircraft(icao) {
    aircraft.delete(icao);
    
    const marker = markers.get(icao);
    if (marker) {
        map.removeLayer(marker);
        markers.delete(icao);
    }

    const trail = trails.get(icao);
    if (trail) {
        map.removeLayer(trail);
        trails.delete(icao);
    }

    if (selectedIcao === icao) {
        selectedIcao = null;
    }
}

function updateMarker(ac) {
    if (ac.lat == null || ac.lon == null) return;

    let marker = markers.get(ac.icao);
    const rotation = ac.heading || 0;

    if (!marker) {
        const icon = L.divIcon({
            className: 'aircraft-icon',
            html: `<div style="transform: rotate(${rotation}deg)">${aircraftSvg}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });

        marker = L.marker([ac.lat, ac.lon], { icon }).addTo(map);
        marker.on('click', () => selectAircraft(ac.icao));
        markers.set(ac.icao, marker);
    } else {
        marker.setLatLng([ac.lat, ac.lon]);
        marker.setIcon(L.divIcon({
            className: 'aircraft-icon',
            html: `<div style="transform: rotate(${rotation}deg)">${aircraftSvg}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        }));
    }
}

function updateTrail(ac) {
    if (!ac.trail || ac.trail.length < 2) return;

    const points = ac.trail.map(p => [p.lat, p.lon]);
    
    let trail = trails.get(ac.icao);
    if (trail) {
        trail.setLatLngs(points);
    } else {
        trail = L.polyline(points, {
            color: '#00d4ff',
            weight: 2,
            opacity: 0.5
        }).addTo(map);
        trails.set(ac.icao, trail);
    }
}

function selectAircraft(icao) {
    selectedIcao = icao;
    const ac = aircraft.get(icao);
    if (ac && ac.lat != null && ac.lon != null) {
        map.panTo([ac.lat, ac.lon]);
    }
    renderList();
}

function renderList() {
    const list = document.getElementById('aircraft-list');
    const sorted = Array.from(aircraft.values())
        .filter(ac => ac.lat != null && ac.lon != null)
        .sort((a, b) => (a.distance_nm || 999) - (b.distance_nm || 999));

    document.getElementById('aircraft-count').textContent = sorted.length;

    list.innerHTML = sorted.map(ac => `
        <div class="aircraft-card ${ac.icao === selectedIcao ? 'selected' : ''}" 
             onclick="selectAircraft('${ac.icao}')">
            <div class="aircraft-header">
                <div>
                    <div class="callsign">${ac.callsign || ac.icao}</div>
                    <div class="icao">${ac.icao}</div>
                </div>
                <div class="distance">
                    ${ac.distance_nm != null ? ac.distance_nm + ' NM ' + (ac.bearing_cardinal || '') : '--'}
                </div>
            </div>
            <div class="aircraft-details">
                <div class="detail">
                    <div class="detail-value">${ac.alt_ft != null ? ac.alt_ft.toLocaleString() : '--'}</div>
                    <div class="detail-label">ALT FT</div>
                </div>
                <div class="detail">
                    <div class="detail-value">${ac.speed_kt != null ? Math.round(ac.speed_kt) : '--'}</div>
                    <div class="detail-label">KTS</div>
                </div>
                <div class="detail">
                    <div class="detail-value">${ac.heading != null ? Math.round(ac.heading) + '°' : '--'}</div>
                    <div class="detail-label">HDG</div>
                </div>
            </div>
            ${ac.registration || ac.aircraft_type ? `
                <div class="registration">
                    ${ac.registration || ''} ${ac.aircraft_type ? '• ' + ac.aircraft_type : ''} ${ac.operator ? '• ' + ac.operator : ''}
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function updateStats() {
    try {
        const resp = await fetch('/api/stats');
        const stats = await resp.json();
        document.getElementById('max-range').textContent = stats.max_range_nm || '--';
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

function cleanupStale() {
    const now = Date.now();
    const staleThreshold = 120000;

    aircraft.forEach((ac, icao) => {
        if (now - ac.lastUpdate > staleThreshold) {
            removeAircraft(icao);
        }
    });
    renderList();
}

document.addEventListener('DOMContentLoaded', init);

