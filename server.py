import argparse
import os
import socket
from flask import Flask, send_from_directory, jsonify

# Serve all static assets (HTML, CSS, JS, frames, audio) from the project directory
app = Flask(__name__, static_folder=".", static_url_path="")

@app.after_request
def add_no_cache_headers(response):
    """Prevent browsers from caching HTML pages during development."""
    if response.mimetype == "text/html":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

@app.route("/")
def index():
    """Serve index.html at root."""
    if os.path.exists("index.html"):
        return send_from_directory(".", "index.html")
    return "<h1>Flask Wi-Fi Server is running!</h1>"

@app.route("/api/status")
def status():
    """Test API endpoint returning JSON."""
    return jsonify({
        "status": "online",
        "message": "Connected to Flask server over Wi-Fi",
        "ip": get_local_ip()
    })

def get_local_ip():
    """Detect the local Wi-Fi / LAN IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("0.0.0.0", port)) == 0

def select_port(requested_port):
    if not is_port_in_use(requested_port):
        return requested_port
    print(f"⚠️  Port {requested_port} is already in use.")
    for fallback in [8080, 5001, 3000, 8081]:
        if not is_port_in_use(fallback):
            print(f"🔄 Switching to available port {fallback}.")
            return fallback
    return requested_port

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Host Flask server on local Wi-Fi")
    parser.add_argument("--port", "-p", type=int, default=int(os.environ.get("PORT", 8080)), help="Port to run on (default: 8080)")
    args = parser.parse_args()

    port = select_port(args.port)
    local_ip = get_local_ip()

    print("\n" + "=" * 60)
    print(" 🚀 Flask Wi-Fi Host Server Started")
    print(f" • Local (this Mac):   http://localhost:{port}")
    print(f" • Wi-Fi (Phone/LAN):  http://{local_ip}:{port}")
    print("=" * 60 + "\n")

    # host='0.0.0.0' binds to all interfaces, allowing access across the Wi-Fi network
    app.run(host="0.0.0.0", port=port, debug=False)
