const http = require("http");
const WebSocket = require("ws");

const server = http.createServer();

const wssSource = new WebSocket.Server({ noServer: true });
const wssSink = new WebSocket.Server({ noServer: true });

// Track sink clients
const sinks = new Set();

wssSink.on("connection", (ws) => {
    sinks.add(ws);

    ws.on("close", () => {
        sinks.delete(ws);
    });
});

wssSource.on("connection", (ws) => {
    ws.on("message", (message) => {
        // Forward message to all sinks
        for (const sink of sinks) {
            if (sink.readyState === WebSocket.OPEN) {
                sink.send(message);
            }
        }
    });
});

// Route connections by URL
server.on("upgrade", (request, socket, head) => {
    const { url } = request;

    if (url === "/source") {
        wssSource.handleUpgrade(request, socket, head, (ws) => {
            wssSource.emit("connection", ws, request);
        });
    } else if (url === "/sink") {
        wssSink.handleUpgrade(request, socket, head, (ws) => {
            wssSink.emit("connection", ws, request);
        });
    } else {
        socket.destroy();
    }
});

server.listen(8585, () => {
    console.log("WebSocket relay server running on port 8585");
    console.log("Source URL: ws://localhost:8585/source");
    console.log("Sink URL:   ws://localhost:8585/sink");
});
