package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
)

type DB struct {
	conn *sql.DB
}

type Config struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

func (c Config) ConnectionString() string {
	sslMode := c.SSLMode
	if sslMode == "" {
		sslMode = "disable"
	}
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, sslMode)
}

func Connect(cfg Config) (*DB, error) {
	conn, err := sql.Open("postgres", cfg.ConnectionString())
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(5)
	conn.SetConnMaxLifetime(5 * time.Minute)

	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Printf("[DB] Connected to PostgreSQL at %s:%d", cfg.Host, cfg.Port)
	return &DB{conn: conn}, nil
}

func (db *DB) Close() error {
	return db.conn.Close()
}

func (db *DB) Migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS aircraft (
		icao VARCHAR(6) PRIMARY KEY,
		callsign VARCHAR(10),
		registration VARCHAR(10),
		aircraft_type VARCHAR(10),
		operator VARCHAR(100),
		lat DOUBLE PRECISION,
		lon DOUBLE PRECISION,
		altitude_ft INTEGER,
		speed_kt DOUBLE PRECISION,
		heading DOUBLE PRECISION,
		vertical_rate INTEGER,
		squawk VARCHAR(4),
		on_ground BOOLEAN,
		last_seen TIMESTAMP WITH TIME ZONE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS position_history (
		id SERIAL PRIMARY KEY,
		icao VARCHAR(6) NOT NULL,
		lat DOUBLE PRECISION NOT NULL,
		lon DOUBLE PRECISION NOT NULL,
		altitude_ft INTEGER,
		speed_kt DOUBLE PRECISION,
		heading DOUBLE PRECISION,
		timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_position_history_icao ON position_history(icao);
	CREATE INDEX IF NOT EXISTS idx_position_history_timestamp ON position_history(timestamp);
	CREATE INDEX IF NOT EXISTS idx_position_history_icao_timestamp ON position_history(icao, timestamp DESC);

	CREATE TABLE IF NOT EXISTS faa_registry (
		icao VARCHAR(6) PRIMARY KEY,
		registration VARCHAR(10),
		aircraft_type VARCHAR(10),
		manufacturer VARCHAR(100),
		model VARCHAR(100),
		operator VARCHAR(100),
		owner VARCHAR(100)
	);

	CREATE INDEX IF NOT EXISTS idx_faa_registry_registration ON faa_registry(registration);

	CREATE TABLE IF NOT EXISTS session_stats (
		id INTEGER PRIMARY KEY DEFAULT 1,
		total_seen INTEGER DEFAULT 0,
		max_range_nm DOUBLE PRECISION DEFAULT 0,
		max_range_icao VARCHAR(6),
		session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		last_save TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		CONSTRAINT single_row CHECK (id = 1)
	);

	CREATE TABLE IF NOT EXISTS range_stats (
		bearing_bucket INTEGER PRIMARY KEY,
		max_range_nm DOUBLE PRECISION DEFAULT 0,
		max_range_icao VARCHAR(6),
		contact_count BIGINT DEFAULT 0,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS flights (
		id SERIAL PRIMARY KEY,
		icao VARCHAR(6) NOT NULL,
		callsign VARCHAR(10),
		registration VARCHAR(10),
		aircraft_type VARCHAR(10),
		first_seen TIMESTAMP WITH TIME ZONE NOT NULL,
		last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
		first_lat DOUBLE PRECISION,
		first_lon DOUBLE PRECISION,
		last_lat DOUBLE PRECISION,
		last_lon DOUBLE PRECISION,
		max_alt_ft INTEGER,
		total_dist_nm DOUBLE PRECISION DEFAULT 0,
		completed BOOLEAN DEFAULT FALSE
	);

	CREATE INDEX IF NOT EXISTS idx_flights_icao ON flights(icao);
	CREATE INDEX IF NOT EXISTS idx_flights_last_seen ON flights(last_seen DESC);
	CREATE INDEX IF NOT EXISTS idx_flights_completed ON flights(completed);
	`

	_, err := db.conn.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	log.Printf("[DB] Database schema migrated successfully")
	return nil
}

func (db *DB) Conn() *sql.DB {
	return db.conn
}

