// backend/src/server.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;

// Serve static files (adjust path for production)
app.use(express.static(path.join(__dirname, '../public')));

// --- Global map to store active clients by their connection codes ---
const clients = new Map(); // Map: code -> WebSocket instance

// --- WebSocket connection handling ---
wss.on('connection', ws => {
    console.log('Client connected to WebSocket.');
    console.log('🧠 New client connected to WebSocket.');

    // Assign a temporary ID for this client
    ws.id = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`Assigned temp ID: ${ws.id}`);

    ws.on('message', message => {
        try {
            const data = JSON.parse(message);
            console.log(`Received signaling message from ${data.fromCode || ws.id}:`, data.type);

            switch (data.type) {
                case 'register_code':
                    if (data.code) {
                        // Remove old code if same socket is re-registering
                        for (let [code, clientWs] of clients.entries()) {
                            if (clientWs === ws) {
                                clients.delete(code);
                                break;
                            }
                        }
                        clients.set(data.code, ws);
                        ws.code = data.code;
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
                case 'encrypted_message':
                    if (data.toCode) {
                        const targetClient = clients.get(data.toCode);
                        if (targetClient && targetClient.readyState === WebSocket.OPEN) {
                            const messageToForward = { ...data };
                            delete messageToForward.toCode; // only strip routing info
                            targetClient.send(JSON.stringify(messageToForward));
                            console.log(`Relayed ${data.type} from ${data.fromCode || ws.code || ws.id} to ${data.toCode}`);
                        } else {
                            console.warn(`Target client ${data.toCode} not found or not open for ${data.type}`);
                            ws.send(JSON.stringify({ type: 'error', message: `Peer ${data.toCode} not found or offline.` }));
                        }
                    } else {
                        console.warn(`Message of type ${data.type} received without toCode.`);
                        ws.send(JSON.stringify({ type: 'error', message: 'Missing target peer code (toCode).' }));
                    }
                    break;

                //Ping/Pong Intervals
                case 'ping':
                    // Don't log pings, they are just noise
                    ws.send(JSON.stringify({ type: 'pong' }));
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
        // Don't remove it instantly. Let it timeout naturally.
        // Optionally: Set a short-lived cleanup timeout
        if (ws.code && clients.has(ws.code)) {
            console.log(`Client ${ws.code} marked as disconnected — keeping for 10s just in case`);
            setTimeout(() => {
                if (clients.get(ws.code) === ws) {
                    clients.delete(ws.code);
                    console.log(`Client ${ws.code} fully removed after timeout.`);
                }
            }, 10_000); // 10 seconds grace period
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
