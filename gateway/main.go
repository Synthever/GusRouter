package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	backendURLStr := os.Getenv("GO_BACKEND_URL")
	if backendURLStr == "" {
		backendURLStr = "http://127.0.0.1:20128"
	}
	serverURLStr := os.Getenv("SERVER_URL")
	if serverURLStr == "" {
		serverURLStr = "http://127.0.0.1:3000"
	}
	distPath := os.Getenv("FRONTEND_DIST")
	if distPath == "" {
		distPath = "/root/workspace/GoRouter/frontend/dist"
	}

	backendURL, err := url.Parse(backendURLStr)
	if err != nil {
		log.Fatalf("invalid backend url: %v", err)
	}
	serverURL, err := url.Parse(serverURLStr)
	if err != nil {
		log.Fatalf("invalid server url: %v", err)
	}

	proxyBackend := httputil.NewSingleHostReverseProxy(backendURL)
	proxyServer := httputil.NewSingleHostReverseProxy(serverURL)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Route specific high-throughput / LLM API calls to 9router-go backend
		if strings.HasPrefix(path, "/v1/chat/completions") ||
			strings.HasPrefix(path, "/chat/completions") ||
			strings.HasPrefix(path, "/v1/messages") ||
			strings.HasPrefix(path, "/messages") ||
			strings.HasPrefix(path, "/v1/embeddings") ||
			strings.HasPrefix(path, "/embeddings") ||
			strings.HasPrefix(path, "/v1/responses") ||
			strings.HasPrefix(path, "/responses") ||
			strings.HasPrefix(path, "/api/usage/stream") ||
			strings.HasPrefix(path, "/usage/stream") ||
			strings.HasPrefix(path, "/api/chat") {
			r.Host = backendURL.Host
			proxyBackend.ServeHTTP(w, r)
			return
		}

		// Route SRouter management APIs & Auth to SRouter server
		if path == "/v1" ||
			strings.HasPrefix(path, "/v1/") ||
			strings.HasPrefix(path, "/health") ||
			strings.HasPrefix(path, "/auth/") {
			r.Host = serverURL.Host
			proxyServer.ServeHTTP(w, r)
			return
		}

		// Otherwise serve frontend static SPA
		fpath := filepath.Join(distPath, filepath.Clean(path))
		if info, err := os.Stat(fpath); err == nil && !info.IsDir() {
			http.ServeFile(w, r, fpath)
			return
		}

		// SPA fallback
		http.ServeFile(w, r, filepath.Join(distPath, "index.html"))
	})

	log.Printf("GoRouter Gateway listening on :%s (Backend -> %s, Server -> %s, Frontend -> %s)", port, backendURLStr, serverURLStr, distPath)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("failed to start gateway: %v", err)
	}
}
