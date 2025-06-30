// backend/src/server.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path'); // Added for static file serving in production build

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;

// Serve static files from the React build directory (e.g., 'public' or 'build')
// Adjust this path based on where your React build output will eventually go.
// For development with `npm start` in frontend, this might not be hit much,
// but it's essential for a combined production build.
app.use(express.static(path.join(__dirname, '../public'))); // Assumes 'public' in backend root

// --- Global map to store active clients by their connection codes ---
const clients = new Map(); // Map: code -> WebSocket instance

// --- WebSocket connection handling ---
wss.on('connection', ws => {
    console.log('Client connected to WebSocket.');

    // Assign a temporary unique ID to this WebSocket for internal tracking before a code is assigned
    ws.id = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`Assigned temp ID: ${ws.id}`);

    ws.on('message', message => {
        try {
            const data = JSON.parse(message);
            console.log(`Received signaling message from ${data.fromCode || ws.id}:`, data.type);

            switch (data.type) {
                case 'register_code': // New type: Client tells server its code
                    if (data.code) {
                        // If this WS was previously registered with a different code, remove it
                        for (let [code, clientWs] of clients.entries()) {
                            if (clientWs === ws) {
                                clients.delete(code);
                                break;
                            }
                        }
                        clients.set(data.code, ws);
                        ws.code = data.code; // Store the code on the WebSocket object itself
                        console.log(`Client ${ws.id} registered with code: ${data.code}`);
                        ws.send(JSON.stringify({ type: 'registration_success', code: data.code }));
                    } else {
                        ws.send(JSON.stringify({ type: 'error', message: 'Registration requires a code.' }));
                    }
                    break;

                case 'session_offer':
                case 'session_answer':
                case 'webrtc_offer':
                case 'webrtc_answer':
                case 'webrtc_ice_candidate':
                case 'encrypted_message': // For fallback if WebRTC isn't ready
                    if (data.toCode) {
                        const targetClient = clients.get(data.toCode);
                        if (targetClient && targetClient.readyState === WebSocket.OPEN) {
                            // Forward the message to the target peer
                            // Remove sensitive routing info before forwarding if necessary
                            const { toCode, ...messageToForward } = data;
                            targetClient.send(JSON.stringify(messageToForward));
                            console.log(`Relayed ${data.type} from ${data.fromCode || ws.code || ws.id} to ${data.toCode}`);
                        } else {
                            console.warn(`Target client ${data.toCode} not found or not open for ${data.type} from ${data.fromCode || ws.code || ws.id}`);
                            ws.send(JSON.stringify({ type: 'error', message: `Peer ${data.toCode} not found or offline.` }));
                        }
                    } else {
                        console.warn(`Message of type ${data.type} received without toCode.`);
                        ws.send(JSON.stringify({ type: 'error', message: 'Missing target peer code (toCode).' }));
                    }
                    break;

                default:
                    console.warn(`Unhandled message type: ${data.type} from ${ws.code || ws.id}`);
                    ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${data.type}` }));
            }
        } catch (e) {
            console.error('Failed to parse message or handle:', e);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format.' }));
        }
    });

    ws.on('close', () => {
        console.log(`Client ${ws.code || ws.id} disconnected.`);
        // Remove the client from the map when they disconnect
        if (ws.code && clients.has(ws.code)) {
            clients.delete(ws.code);
            console.log(`Client ${ws.code} removed from active connections.`);
        }
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`NYX Backend server listening on port ${PORT}`);
    console.log(`Serving static files from: ${path.join(__dirname, '../public')}`);
});