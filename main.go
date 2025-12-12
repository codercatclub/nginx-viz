package main

import (
	"bufio"
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"net/netip"
	"os"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/oschwald/maxminddb-golang/v2"
)

//go:embed public
var publicDir embed.FS

type errorResponse struct {
	Error string `json:"error"`
}

type nginxVizPage struct {
	CountryIcons map[string]string `json:"country_icons"`
}

type ipRecord struct {
	Country struct {
		ISOCode string            `maxminddb:"iso_code"`
		Names   map[string]string `maxminddb:"names"`
	} `maxminddb:"country"`
}

type LogEntry struct {
	Timestamp   time.Time `json:"timestamp"`
	IP          string    `json:"ip"`
	Method      string    `json:"method"`
	URL         string    `json:"url"`
	StatusCode  int       `json:"status_code"`
	Size        int       `json:"size"`
	UserAgent   string    `json:"user_agent"`
	Referer     string    `json:"referer"`
	Country     string    `json:"country"`
	CountryFull string    `json:"country_full"`
}

type LogUpdate struct {
	Type string   `json:"type"`
	Data LogEntry `json:"data"`
}

type clientAction struct {
	conn   *websocket.Conn
	action string // "register" or "unregister"
}

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow connections from any origin
		},
	}
	clients       = make(map[*websocket.Conn]bool)
	clientActions = make(chan clientAction)
)

func returnError(w http.ResponseWriter, header int, msg string) {
	payload := errorResponse{Error: msg}

	js, err := json.Marshal(payload)
	if err != nil {
		fmt.Printf("error marshaling error msg. %v\n", err)
	}

	w.Header().Set("Content-Type", "application/json;")
	w.WriteHeader(header)
	w.Write(js)
}

func find(slice []string, val string) (int, bool) {
	for i, item := range slice {
		if item == val {
			return i, true
		}
	}
	return -1, false
}

var allowedOrigins = []string{"http://localhost:3000", "https://codercatclub.github.io", "https://codercat.tk", "https://codercat.xyz"}

func corsMiddleware(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		_, found := find(allowedOrigins, r.Header.Get("Origin"))
		if !found {
			// Do not attach CORS header if origin is not allowed
			h.ServeHTTP(w, r)
			return
		}

		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func customFileServer(root http.FileSystem) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, ".js") {
			w.Header().Set("Content-Type", "application/javascript")
		}
		http.FileServer(root).ServeHTTP(w, r)
	})
}

func main() {

	//read all SVG icons and store them in an array.

	svgIconMap := make(map[string]string)

	svgIconPaths, err := publicDir.ReadDir("public/assets/textures/1x1")
	if err != nil {
		log.Fatal(err)
	}

	for _, svgIconFile := range svgIconPaths {
		svgText, err := publicDir.ReadFile("public/assets/textures/1x1/" + svgIconFile.Name())
		if err != nil {
			log.Printf("Error reading SVG file %s: %v", svgIconFile.Name(), err)
			continue
		}
		svgIconMap[svgIconFile.Name()] = string(svgText)
	}

	// Parse command line arguments
	logFilePtr := flag.String("i", "mylog.log", "Path to the nginx log file to watch")
	flag.Parse()
	var logFile = *logFilePtr

	//read file with IP -> Country mapping
	dbFile, err := publicDir.ReadFile("public/assets/libs/dbip-country-lite-2023-06.mmdb")
	if err != nil {
		log.Fatal(err)
	}
	db, err := maxminddb.OpenBytes(dbFile)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	c := make(chan LogEntry)
	go watchLogFile(logFile, c, db)
	go broadcastLogEntries(c)
	go manageClients()

	r := mux.NewRouter()
	r.HandleFunc("/", MakeNginxVizHandler(svgIconMap)).Methods("GET")
	r.HandleFunc("/ws", MakeWebSocketHandler()).Methods("GET")
	r.PathPrefix("/public/").Handler(customFileServer(http.FS(publicDir))).Methods("GET")

	r.Use(corsMiddleware)

	srvAddress := "127.0.0.1:9001"

	srv := &http.Server{
		Handler:      r,
		Addr:         srvAddress,
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	fmt.Printf("Starting server on %s\n", srvAddress)

	log.Fatal(srv.ListenAndServe())

}

func MakeNginxVizHandler(countryIcons map[string]string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		indexHtml, err := publicDir.ReadFile("public/index.html")
		if err != nil {
			log.Printf("Error reading index.html: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		tmpl := template.Must(template.New("index").Parse(string(indexHtml)))

		w.WriteHeader(http.StatusOK)

		tmpl.Execute(w, nginxVizPage{
			CountryIcons: countryIcons,
		})
	}
}

func parseNginxLog(line string) (LogEntry, error) {
	// Nginx common log format: IP - - [timestamp] "METHOD /path HTTP/1.1" status size "referer" "user-agent"
	// Example: 127.0.0.1 - - [17/Nov/2025:10:30:45 +0000] "GET /api/test HTTP/1.1" 200 1234 "http://example.com" "Mozilla/5.0..."

	logRegex := regexp.MustCompile(`^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*) [^"]*" (\d+) (\d+) "([^"]*)" "([^"]*)".*$`)
	matches := logRegex.FindStringSubmatch(line)

	if len(matches) != 9 {
		return LogEntry{}, fmt.Errorf("failed to parse log line: %s", line)
	}

	// Parse timestamp
	timestampStr := matches[2]
	timestamp, err := time.Parse("02/Jan/2006:15:04:05 -0700", timestampStr)
	if err != nil {
		// Fallback to current time if parsing fails
		timestamp = time.Now()
	}

	// Parse status code
	statusCode, err := strconv.Atoi(matches[5])
	if err != nil {
		statusCode = 0
	}

	// Parse size
	size, err := strconv.Atoi(matches[6])
	if err != nil {
		size = 0
	}

	return LogEntry{
		Timestamp:   timestamp,
		IP:          matches[1],
		Method:      matches[3],
		URL:         matches[4],
		StatusCode:  statusCode,
		Size:        size,
		Referer:     matches[7],
		UserAgent:   matches[8],
		Country:     "",
		CountryFull: "",
	}, nil
}

func getInode(logFile string) (uint64, error) {
	freshInfo, err := os.Stat(logFile)
	if err != nil {
		return 0.0, err
	}
	freshStat, ok := freshInfo.Sys().(*syscall.Stat_t)
	if !ok {
		return 0.0, fmt.Errorf("Syscall Error")
	}

	return freshStat.Ino, nil
}

// watchLogFile monitors the log file for new entries
func watchLogFile(logFile string, c chan LogEntry, db *maxminddb.Reader) {
	// Check if file exists, if not wait for it
	for {
		if _, err := os.Stat(logFile); os.IsNotExist(err) {
			log.Printf("Log file %s does not exist, waiting...", logFile)
			time.Sleep(2 * time.Second)
			continue
		}
		break
	}

	log.Printf("Starting to watch log file: %s", logFile)

	file, err := os.Open(logFile)
	if err != nil {
		log.Printf("Error opening log file: %v", err)
		return
	}
	defer file.Close()

	rotated := make(chan bool, 1)
	currentInode, err := getInode(logFile)
	if err != nil {
		log.Printf("Error getting logFile inode %v", err)
		return
	}

	go inodeChecker(logFile, currentInode, rotated)

	// Start from beginning of file
	file.Seek(0, 0)
	reader := bufio.NewReader(file)

	for {
		select {
		case <-rotated:
			// File rotated, restart watchLogFile
			log.Printf("Restarting log file watcher...")
			go watchLogFile(logFile, c, db)
			return
		default:
			line, err := reader.ReadString('\n')

			if err != nil {
				// EOF reached, wait a bit and retry
				time.Sleep(500 * time.Millisecond)
				continue
			}

			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}

			logEntry, err := parseNginxLog(line)
			if err != nil {
				log.Printf("Error parsing log line: %v", err)
				continue
			}

			// Skip requests to flag SVG files to prevent infinite loop
			if strings.Contains(logEntry.URL, "nginxviz") {
				continue
			}

			ip, err := netip.ParseAddr(logEntry.IP)
			if err != nil {
				log.Printf("Error parsing ip: %v", err)
				continue
			}

			var record ipRecord
			err = db.Lookup(ip).Decode(&record)
			if err != nil {
				log.Printf("Error decoding ip: %v", err)
				continue
			}

			logEntry.Country = record.Country.ISOCode
			logEntry.CountryFull = record.Country.Names["en"]

			c <- logEntry
		}
	}
}

func inodeChecker(logFile string, currentInode uint64, rotated chan bool) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		newInode, err := getInode(logFile)
		if err != nil {
			log.Printf("Error getting logFile inode %v", err)
			continue
		}

		if newInode != currentInode {
			log.Printf("Log file rotated (inode changed from %d to %d), restarting...", currentInode, newInode)
			rotated <- true
			return
		}
	}
}

func broadcastLogEntries(c chan LogEntry) {
	for logEntry := range c {
		broadcastLogEntry(logEntry)
	}
}

// broadcastLogEntry sends log updates to all connected WebSocket clients
func broadcastLogEntry(logEntry LogEntry) {
	log.Printf("Broadcasting log entry: %s %s %s %d", logEntry.IP, logEntry.Method, logEntry.URL, logEntry.StatusCode)

	update := LogUpdate{
		Type: "log_entry",
		Data: logEntry,
	}

	message, err := json.Marshal(update)
	if err != nil {
		log.Printf("Error marshaling log update: %v", err)
		return
	}

	// Create a snapshot of clients to avoid holding locks during slow operations
	clientSnapshot := make([]*websocket.Conn, 0, len(clients))
	for client := range clients {
		clientSnapshot = append(clientSnapshot, client)
	}

	for _, client := range clientSnapshot {
		err := client.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			log.Printf("Error writing to WebSocket client: %v", err)
			client.Close()
			clientActions <- clientAction{conn: client, action: "unregister"}
		}
	}
}

func manageClients() {
	for action := range clientActions {
		switch action.action {
		case "register":
			clients[action.conn] = true
			log.Printf("Client registered, total clients: %d", len(clients))
		case "unregister":
			delete(clients, action.conn)
			log.Printf("Client unregistered, total clients: %d", len(clients))
		}
	}
}

// MakeWebSocketHandler creates a WebSocket handler for real-time log updates
func MakeWebSocketHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}
		defer conn.Close()

		// Register client
		clientActions <- clientAction{conn: conn, action: "register"}

		log.Printf("New WebSocket client connected")

		// Set up ping/pong to keep connection alive
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		conn.SetPongHandler(func(string) error {
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			return nil
		})

		// Start ping ticker
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		done := make(chan struct{})

		// Read messages in a goroutine
		go func() {
			defer close(done)
			for {
				_, _, err := conn.ReadMessage()
				if err != nil {
					log.Printf("WebSocket read error: %v", err)
					return
				}
			}
		}()

		// Keep connection alive with pings
		for {
			select {
			case <-ticker.C:
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					log.Printf("WebSocket ping error: %v", err)
					return
				}
			case <-done:
				// Unregister client before returning
				clientActions <- clientAction{conn: conn, action: "unregister"}
				log.Printf("WebSocket client disconnected")
				return
			}
		}
	}
}
