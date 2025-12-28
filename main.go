package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"adsb-tracker/internal/api"
	"adsb-tracker/internal/config"
	"adsb-tracker/internal/database"
	"adsb-tracker/internal/feed"
	"adsb-tracker/internal/flight"
	"adsb-tracker/internal/health"
	"adsb-tracker/internal/lookup"
	rangetracker "adsb-tracker/internal/range"
	"adsb-tracker/internal/tracker"
	"adsb-tracker/internal/webhook"
)

func main() {
	configFile := flag.String("config", "config.json", "Path to config file")
	sbsHost := flag.String("sbs-host", "", "SBS feed host")
	sbsPort := flag.Int("sbs-port", 0, "SBS feed port")
	feedFormat := flag.String("feed-format", "", "Feed format: sbs or beast")
	httpAddr := flag.String("http-addr", "", "HTTP listen address")
	staleTimeout := flag.Duration("stale-timeout", 0, "Aircraft stale timeout")
	startDump1090 := flag.Bool("start-dump1090", false, "Automatically start dump1090 with network enabled")
	deviceIndex := flag.Int("device-index", -1, "RTL-SDR device index for dump1090")
	rxLat := flag.Float64("rx-lat", 0, "Receiver latitude for distance calculation")
	rxLon := flag.Float64("rx-lon", 0, "Receiver longitude for distance calculation")
	noDatabase := flag.Bool("no-db", false, "Run without database connection")
	flag.Parse()

	logHandler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	logger := slog.New(logHandler)
	slog.SetDefault(logger)
	stdLogger := slog.NewLogLogger(logHandler, slog.LevelInfo)
	log.SetOutput(stdLogger.Writer())
	log.SetFlags(0)

	cfg, err := config.Load(*configFile)
	if err != nil {
		log.Fatalf("[MAIN] Failed to load config: %v", err)
	}

	if *sbsHost != "" {
		cfg.SBSHost = *sbsHost
	}
	if *sbsPort != 0 {
		cfg.SBSPort = *sbsPort
	}
	if *httpAddr != "" {
		cfg.HTTPAddr = *httpAddr
	}
	if *staleTimeout != 0 {
		cfg.StaleTimeout = *staleTimeout
	}
	if *deviceIndex >= 0 {
		cfg.DeviceIndex = *deviceIndex
	}
	if *rxLat != 0 {
		cfg.RxLat = *rxLat
	}
	if *rxLon != 0 {
		cfg.RxLon = *rxLon
	}
	if *feedFormat != "" {
		cfg.FeedFormat = *feedFormat
	}

	if cfg.FeedFormat == "beast" && *sbsPort == 0 && cfg.SBSPort == 30003 {
		cfg.SBSPort = 30005
	}

	logger.Info("starting Skywatch")

	var dump1090Cmd *exec.Cmd
	if *startDump1090 {
		dump1090Cmd = startDump1090Process(cfg.DeviceIndex, cfg.SBSPort, cfg.FeedFormat)
		if dump1090Cmd != nil {
			time.Sleep(2 * time.Second)
		}
	}

	var db *database.DB
	var repo *database.Repository
	var faaLookup *lookup.FAALookup

	if !*noDatabase && cfg.Database.Host != "" {
		dbCfg := database.Config{
			Host:     cfg.Database.Host,
			Port:     cfg.Database.Port,
			User:     cfg.Database.User,
			Password: cfg.Database.Password,
			DBName:   cfg.Database.DBName,
			SSLMode:  cfg.Database.SSLMode,
		}

		db, err = database.Connect(dbCfg)
		if err != nil {
			log.Printf("[MAIN] Database connection failed: %v (running without persistence)", err)
			faaLookup = lookup.NewFAALookup(nil)
		} else {
			if err := db.Migrate(); err != nil {
				log.Printf("[MAIN] Database migration failed: %v", err)
			}
			repo = database.NewRepository(db)
			faaLookup = lookup.NewFAALookup(repo)
		}
	} else {
		log.Printf("[MAIN] Running without database")
		faaLookup = lookup.NewFAALookup(nil)
	}

	logger.Info("configuration loaded",
		"feed_host", cfg.SBSHost,
		"feed_port", cfg.SBSPort,
		"feed_format", cfg.FeedFormat,
		"http_addr", cfg.HTTPAddr,
	)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	groupCtx, groupCancel := context.WithCancel(ctx)
	defer groupCancel()

	var wg sync.WaitGroup
	var groupErr error
	var groupErrMu sync.Mutex

	setGroupErr := func(err error) {
		groupErrMu.Lock()
		if groupErr == nil {
			groupErr = err
		}
		groupErrMu.Unlock()
	}

	var webhookDispatcher *webhook.Dispatcher
	if cfg.Webhooks.DiscordURL != "" {
		webhookDispatcher = webhook.NewDispatcher(cfg.Webhooks)
		logger.Info("webhooks enabled", "provider", "discord")
	}

	healthMonitor := health.NewMonitor(cfg.Webhooks.HealthThresholds, webhookDispatcher)

	var rangeRepo rangetracker.Repository
	if repo != nil {
		rangeRepo = &rangeRepoAdapter{repo: repo}
	}
	rangeTrk := rangetracker.New(rangeRepo)

	flightTrk := flight.New(repo, cfg.StaleTimeout)

	trk := tracker.New(tracker.Options{
		StaleAfter:           cfg.StaleTimeout,
		RxLat:                cfg.RxLat,
		RxLon:                cfg.RxLon,
		TrailLength:          cfg.TrailLength,
		Repo:                 repo,
		FAALookup:            faaLookup,
		Webhooks:             webhookDispatcher,
		RangeTracker:         rangeTrk,
		FlightTracker:        flightTrk,
		PersistenceWorkers:   4,
		PersistenceQueueSize: 512,
	})

	feedClient := feed.NewClient(cfg.SBSHost, cfg.SBSPort, cfg.FeedFormat, cfg.RxLat, cfg.RxLon, trk)

	server := api.NewServer(trk, repo)
	server.SetHealthMonitor(healthMonitor)
	server.SetFeedClient(feedClient)
	server.SetWebhooks(webhookDispatcher)
	server.SetNodeName(cfg.NodeName)
	server.SetRangeTracker(rangeTrk)
	server.SetFlightTracker(flightTrk)
	readiness := health.NewReadiness()
	server.SetReadiness(readiness)
	server.StartHub()

	httpServer := &http.Server{
		Addr:    cfg.HTTPAddr,
		Handler: server.Handler(),
	}

	runComponent := func(name string, fn func(context.Context) error) {
		readiness.MarkNotReady(name, "starting")
		wg.Add(1)
		go func() {
			defer wg.Done()
			readiness.MarkReady(name)
			logger.Info("component running", "component", name)
			defer readiness.MarkNotReady(name, "stopped")
			if err := fn(groupCtx); err != nil {
				if errors.Is(err, context.Canceled) {
					return
				}
				logger.Error("component exited", "component", name, "error", err)
				setGroupErr(err)
				groupCancel()
				return
			}
			logger.Info("component exited", "component", name)
		}()
	}

	if webhookDispatcher != nil {
		runComponent("webhooks", func(ctx context.Context) error {
			webhookDispatcher.Run(ctx)
			return ctx.Err()
		})
	}

	runComponent("health_monitor", func(ctx context.Context) error {
		healthMonitor.Run(ctx)
		return ctx.Err()
	})

	runComponent("feed_client", func(ctx context.Context) error {
		feedClient.Run(ctx)
		return ctx.Err()
	})

	runComponent("tracker", func(ctx context.Context) error {
		return trk.Run(ctx)
	})

	runComponent("http_server", func(ctx context.Context) error {
		errCh := make(chan error, 1)
		go func() {
			errCh <- httpServer.ListenAndServe()
		}()

		select {
		case <-ctx.Done():
			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer shutdownCancel()
			if err := httpServer.Shutdown(shutdownCtx); err != nil && err != http.ErrServerClosed {
				return err
			}
			if err := <-errCh; err != nil && err != http.ErrServerClosed {
				return err
			}
			return nil
		case err := <-errCh:
			if err == http.ErrServerClosed {
				return nil
			}
			return err
		}
	})

	wg.Wait()
	if err := groupErr; err != nil && !errors.Is(err, context.Canceled) {
		logger.Error("service error", "error", err)
	}

	if db != nil {
		db.Close()
	}

	if dump1090Cmd != nil && dump1090Cmd.Process != nil {
		logger.Info("stopping dump1090")
		dump1090Cmd.Process.Signal(syscall.SIGTERM)
		dump1090Cmd.Wait()
	}

	logger.Info("shutdown complete")
}

func startDump1090Process(deviceIndex, port int, feedFormat string) *exec.Cmd {
	args := []string{
		"--device-index", fmt.Sprintf("%d", deviceIndex),
		"--net",
		"--quiet",
	}

	if feedFormat == "beast" {
		args = append(args, "--net-bo-port", fmt.Sprintf("%d", port))
	} else {
		args = append(args, "--net-sbs-port", fmt.Sprintf("%d", port))
	}

	cmd := exec.Command("dump1090", args...)
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Start(); err != nil {
		log.Printf("[MAIN] Failed to start dump1090: %v", err)
		log.Printf("[MAIN] Make sure dump1090 is installed and in PATH")
		return nil
	}

	log.Printf("[MAIN] Started dump1090 (PID %d) with --net on port %d (%s)", cmd.Process.Pid, port, feedFormat)
	return cmd
}

type rangeRepoAdapter struct {
	repo *database.Repository
}

func (a *rangeRepoAdapter) SaveRangeStats(bucket int, maxNM float64, icao string, count int64) error {
	return a.repo.SaveRangeStats(bucket, maxNM, icao, count)
}

func (a *rangeRepoAdapter) LoadRangeStats() ([]rangetracker.BucketStats, error) {
	dbStats, err := a.repo.LoadRangeStats()
	if err != nil {
		return nil, err
	}

	stats := make([]rangetracker.BucketStats, len(dbStats))
	for i, s := range dbStats {
		stats[i] = rangetracker.BucketStats{
			Bearing:      s.Bearing,
			MaxRangeNM:   s.MaxRangeNM,
			MaxRangeICAO: s.MaxRangeICAO,
			ContactCount: s.ContactCount,
		}
	}
	return stats, nil
}
