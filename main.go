package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"syscall"
	"time"

	"adsb-tracker/internal/api"
	"adsb-tracker/internal/config"
	"adsb-tracker/internal/database"
	"adsb-tracker/internal/feed"
	"adsb-tracker/internal/health"
	"adsb-tracker/internal/lookup"
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

	log.SetFlags(log.LstdFlags | log.Lmicroseconds)

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

	log.Printf("[MAIN] Starting Skywatch")

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

	log.Printf("[MAIN] Feed: %s:%d (%s format)", cfg.SBSHost, cfg.SBSPort, cfg.FeedFormat)
	log.Printf("[MAIN] HTTP server: %s", cfg.HTTPAddr)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var webhookDispatcher *webhook.Dispatcher
	if cfg.Webhooks.DiscordURL != "" {
		webhookDispatcher = webhook.NewDispatcher(cfg.Webhooks)
		go webhookDispatcher.Run(ctx)
		log.Printf("[MAIN] Webhooks enabled (Discord)")
	}

	healthMonitor := health.NewMonitor(cfg.Webhooks.HealthThresholds, webhookDispatcher)
	go healthMonitor.Run(ctx)

	trk := tracker.New(tracker.Options{
		StaleAfter:  cfg.StaleTimeout,
		RxLat:       cfg.RxLat,
		RxLon:       cfg.RxLon,
		TrailLength: cfg.TrailLength,
		Repo:        repo,
		FAALookup:   faaLookup,
		Webhooks:    webhookDispatcher,
	})
	go trk.StartCleanup(ctx)

	feedClient := feed.NewClient(cfg.SBSHost, cfg.SBSPort, cfg.FeedFormat, cfg.RxLat, cfg.RxLon, trk)
	go feedClient.Run(ctx)

	server := api.NewServer(trk, repo)
	server.SetHealthMonitor(healthMonitor)
	server.SetFeedClient(feedClient)
	server.SetWebhooks(webhookDispatcher)
	server.StartHub()

	httpServer := &http.Server{
		Addr:    cfg.HTTPAddr,
		Handler: server.Handler(),
	}

	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[MAIN] HTTP server error: %v", err)
		}
	}()

	log.Printf("[MAIN] Server running")

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Printf("[MAIN] Shutting down...")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("[MAIN] HTTP shutdown error: %v", err)
	}

	if db != nil {
		db.Close()
	}

	if dump1090Cmd != nil && dump1090Cmd.Process != nil {
		log.Printf("[MAIN] Stopping dump1090...")
		dump1090Cmd.Process.Signal(syscall.SIGTERM)
		dump1090Cmd.Wait()
	}

	log.Printf("[MAIN] Shutdown complete")
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
