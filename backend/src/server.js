// backend/src/server.js
require('dotenv').config(); // Load environment variables from .env

const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080; // Default to 8080 if not specified
const path = require('path');

// Serve static files from the React build directory (to be created later)
app.use(express.static(path.join(__dirname, '../public'))); // This assumes 'public' is where React build output goes

// WebSocket connection handling
wss.on('connection', ws => {
    console.log('Client connected to WebSocket.');

    ws.on('message', message => {
        console.log(`Received: ${message}`);
        // In later steps, this will be where encrypted signaling messages are processed.
        // For now, let's just echo for testing.
        ws.send(`Echo: ${message}`);
    });

    ws.on('close', () => {
        console.log('Client disconnected from WebSocket.');
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`NYX Backend server listening on port ${PORT}`);
    console.log(`Serving static files from: ${__dirname}/../public`);
});