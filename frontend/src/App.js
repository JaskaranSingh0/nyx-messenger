// frontend/src/App.js
import React, { useEffect, useState, useRef } from 'react';
//import WebSocket from 'ws'; // Node.js 'ws' library isn't directly usable in browser. Use native WebSocket.
import {
    generateSessionKeyPair,
    deriveSharedSecret,
    encryptMessage,
    decryptMessage,
    exportPublicKey,
    importPublicKey,
    generateRandomCode,
    zeroFill
} from './cryptoUtils'; // Import our crypto utilities
import { QRCodeSVG } from 'qrcode.react'; // We'll use SVG for simplicity, it's generally good for web
import './App.css';

// Using native WebSocket API in the browser. No need to import 'ws' library.

function App() {
    const [ws, setWs] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('Disconnected');
    const [messageInput, setMessageInput] = useState('');
    const [chatMessages, setChatMessages] = useState([]); // Array of {sender: 'me'/'peer', content: '...', type: 'text'/'file'}
    const [sessionKeyPair, setSessionKeyPair] = useState(null); // Our ephemeral ECDH key pair
    const [peerPublicKey, setPeerPublicKey] = useState(null); // Peer's ephemeral ECDH public key
    const [sharedSecret, setSharedSecret] = useState(null); // Derived AES-GCM key for messaging
    const [connectionCode, setConnectionCode] = useState(''); // Our one-time connection code
    const [inputConnectionCode, setInputConnectionCode] = useState(''); // Input for peer's code
    const [statusMessage, setStatusMessage] = useState(''); // General status messages
    const [qrValue, setQrValue] = useState(''); // Value to encode in QR code

    // File sharing state
    const [fileToShare, setFileToShare] = useState(null);
    const [viewDuration, setViewDuration] = useState(5); // Default 5 seconds
    const [receivingFile, setReceivingFile] = useState(false);
    const [currentFileDisplay, setCurrentFileDisplay] = useState(null); // To display the received ephemeral file
    const fileTimerRef = useRef(null); // Ref to hold the file display timer

    // --- WebSocket and Connection Management ---
    useEffect(() => {
        const socket = new WebSocket('ws://localhost:8080'); // Connect to your backend

        socket.onopen = async () => {
            console.log('Connected to WebSocket signaling server.');
            setConnectionStatus('Connected to Signaling Server');
            setStatusMessage('Generate a code or enter peer\'s code to start a secure session.');

            // Generate our session key pair immediately on connection
            const kp = await generateSessionKeyPair();
            setSessionKeyPair(kp);
            console.log('Session Key Pair Generated.');
        };

        socket.onmessage = async event => {
            const data = JSON.parse(event.data);
            console.log('Received signaling message:', data);

            switch (data.type) {
                case 'session_offer':
                    // This is the first step for User B
                    if (sessionKeyPair) {
                        try {
                            const peerPk = await importPublicKey(data.publicKeyJwk);
                            setPeerPublicKey(peerPk);

                            const ss = await deriveSharedSecret(sessionKeyPair.privateKey, peerPk);
                            setSharedSecret(ss);

                            // Send our public key back as an 'answer'
                            const ourPublicKeyJwk = await exportPublicKey(sessionKeyPair.publicKey);
                            socket.send(JSON.stringify({
                                type: 'session_answer',
                                toCode: data.fromCode, // Send back to the sender of the offer
                                publicKeyJwk: ourPublicKeyJwk
                            }));

                            setStatusMessage('Shared secret derived. Secure session established! You can now chat.');
                            setConnectionStatus('Secure Session Active');
                            // Now initiate WebRTC connection (simplified for this example)
                            await setupWebRTC(socket, true); // true for receiver/answerer
                        } catch (error) {
                            console.error('Error handling session offer:', error);
                            setStatusMessage('Failed to establish session: ' + error.message);
                        }
                    } else {
                        setStatusMessage('Error: Session key not ready when offer received.');
                    }
                    break;

                case 'session_answer':
                    // This is the response for User A after sending an offer
                    if (sessionKeyPair) {
                        try {
                            const peerPk = await importPublicKey(data.publicKeyJwk);
                            setPeerPublicKey(peerPk);

                            const ss = await deriveSharedSecret(sessionKeyPair.privateKey, peerPk);
                            setSharedSecret(ss);
                            setStatusMessage('Shared secret derived. Secure session established! You can now chat.');
                            setConnectionStatus('Secure Session Active');
                            // Now initiate WebRTC connection (simplified for this example)
                            await setupWebRTC(socket, false); // false for initiator/offerer
                        } catch (error) {
                            console.error('Error handling session answer:', error);
                            setStatusMessage('Failed to establish session: ' + error.message);
                        }
                    } else {
                        setStatusMessage('Error: Session key not ready when answer received.');
                    }
                    break;

                case 'webrtc_offer':
                case 'webrtc_answer':
                case 'webrtc_ice_candidate':
                    // WebRTC signaling messages
                    handleWebRTCSignaling(data);
                    break;

                default:
                    console.warn('Unknown message type:', data.type);
            }
        };

        socket.onclose = () => {
            console.log('Disconnected from WebSocket signaling server.');
            setConnectionStatus('Disconnected');
            setStatusMessage('Disconnected from signaling server. Please refresh.');
            // Clear all session-related state on disconnect
            setSessionKeyPair(null);
            setPeerPublicKey(null);
            setSharedSecret(null);
            setConnectionCode('');
            setInputConnectionCode('');
            setQrValue('');
            setChatMessages([]);
            setCurrentFileDisplay(null);
            if (fileTimerRef.current) clearTimeout(fileTimerRef.current);
        };

        socket.onerror = error => {
            console.error('WebSocket error:', error);
            setConnectionStatus('Error');
            setStatusMessage(`WebSocket Error: ${error.message}`);
        };

        setWs(socket);

        return () => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
        };
    }, []); // Only run once on mount

    // --- Connection Code / QR Code Generation & Handling ---

    const generateCode = async () => {
        if (!sessionKeyPair) {
            setStatusMessage('Generating keys... please wait.');
            return;
        }
        const code = generateRandomCode(8); // 8-char alphanumeric
        setConnectionCode(code);

        const publicKeyJwk = await exportPublicKey(sessionKeyPair.publicKey);
        // Stringify the full connection data, including our public key
        const qrData = JSON.stringify({ code: code, publicKey: publicKeyJwk });
        setQrValue(qrData);

        setStatusMessage(`Share this code or QR: ${code}. Valid for 60 seconds.`);

        // Set a timer for the code to expire
        setTimeout(() => {
            if (connectionCode === code) { // Only expire if it's still the active code
                setConnectionCode('');
                setQrValue('');
                setStatusMessage('Connection code expired. Generate a new one.');
            }
        }, 60 * 1000); // 60 seconds validity
    };

    const enterPeerCode = async () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            setStatusMessage('Not connected to signaling server.');
            return;
        }
        if (!inputConnectionCode) {
            setStatusMessage('Please enter a peer code.');
            return;
        }
        if (!sessionKeyPair) {
            setStatusMessage('Generating keys... please wait.');
            return;
        }

        try {
            const ourPublicKeyJwk = await exportPublicKey(sessionKeyPair.publicKey);
            ws.send(JSON.stringify({
                type: 'session_offer',
                toCode: inputConnectionCode,
                fromCode: connectionCode || generateRandomCode(8), // If we didn't generate one, create a temporary one for this offer
                publicKeyJwk: ourPublicKeyJwk
            }));
            setStatusMessage(`Attempting to connect using code: ${inputConnectionCode}`);
        } catch (error) {
            console.error('Error sending session offer:', error);
            setStatusMessage('Failed to send connection offer: ' + error.message);
        }
    };


    // --- Messaging Functions ---

    const sendTextMessage = async () => {
        if (!sharedSecret) {
            setStatusMessage('Secure session not established. Cannot send messages.');
            return;
        }
        if (!messageInput.trim()) return;

        try {
            const { ciphertext, iv } = await encryptMessage(sharedSecret, messageInput);
            const messageData = {
                type: 'text',
                content: Array.from(new Uint8Array(ciphertext)), // Convert ArrayBuffer to array for JSON
                iv: Array.from(iv)
            };

            // Send via WebRTC Data Channel if established, otherwise via WebSocket
            if (peerConnectionRef.current && dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
                dataChannelRef.current.send(JSON.stringify(messageData));
            } else if (ws && ws.readyState === WebSocket.OPEN) {
                // Fallback for initial signaling/connection issues or if WebRTC fails
                // NOTE: This sends via your signaling server, which is OK as it's E2EE
                ws.send(JSON.stringify({
                    type: 'encrypted_message',
                    toCode: inputConnectionCode || connectionCode, // Target peer
                    message: messageData
                }));
            } else {
                setStatusMessage('No active connection to send message.');
                return;
            }

            setChatMessages(prev => [...prev, { sender: 'me', content: messageInput, type: 'text' }]);
            setMessageInput('');
        } catch (error) {
            console.error('Error encrypting or sending message:', error);
            setStatusMessage('Failed to send message: ' + error.message);
        }
    };

    const handleReceivedMessage = async (encryptedData) => {
        if (!sharedSecret) {
            console.warn('Received message before shared secret was established.');
            return;
        }
        try {
            const { content, iv, type, fileMetadata } = encryptedData;
            const ciphertext = new Uint8Array(content).buffer;
            const ivArr = new Uint8Array(iv);

            if (type === 'text') {
                const decryptedText = await decryptMessage(sharedSecret, ciphertext, ivArr);
                setChatMessages(prev => [...prev, { sender: 'peer', content: decryptedText, type: 'text' }]);
            } else if (type === 'file') {
                // This is where the received file's decrypted content will temporarily live
                console.log('Received encrypted file segment/metadata.');
                setStatusMessage(`Receiving file: ${fileMetadata.name}...`);
                setReceivingFile(true); // Indicate file is being received

                // Assuming content is the full file data for simplicity.
                // In a real app, this would be chunked and reassembled.
                const decryptedFileBlob = new Blob([await decryptMessage(sharedSecret, ciphertext, ivArr)]);
                const fileURL = URL.createObjectURL(decryptedFileBlob);

                setCurrentFileDisplay({
                    url: fileURL,
                    name: fileMetadata.name,
                    type: fileMetadata.mimeType,
                    size: fileMetadata.size,
                    duration: fileMetadata.duration // The viewing duration in seconds
                });

                // Set timer to clear the file display
                if (fileTimerRef.current) clearTimeout(fileTimerRef.current);
                fileTimerRef.current = setTimeout(() => {
                    clearFileDisplay();
                    setStatusMessage('File display expired and cleared.');
                }, fileMetadata.duration * 1000);

            }
            // Aggressively zero-fill buffers after use (best effort)
            zeroFill(ciphertext);
            zeroFill(ivArr.buffer);
            if (typeof content === 'string' && content.byteLength) {
                 // For actual ArrayBuffer, not string representation
                zeroFill(new TextEncoder().encode(content).buffer);
            }


        } catch (error) {
            console.error('Error decrypting message:', error);
            setStatusMessage('Failed to decrypt message: ' + error.message);
        }
    };

    const clearFileDisplay = () => {
        if (currentFileDisplay && currentFileDisplay.url) {
            URL.revokeObjectURL(currentFileDisplay.url); // Release the object URL
        }
        setCurrentFileDisplay(null);
        setReceivingFile(false);
        if (fileTimerRef.current) clearTimeout(fileTimerRef.current);
        fileTimerRef.current = null;
    };


    // --- File Sending Functions ---

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFileToShare(file);
        }
    };

    const sendFile = async () => {
        if (!fileToShare || !sharedSecret) {
            setStatusMessage('No file selected or secure session not established.');
            return;
        }

        if (!(peerConnectionRef.current && dataChannelRef.current && dataChannelRef.current.readyState === 'open')) {
            setStatusMessage('WebRTC data channel not open for file transfer.');
            return;
        }

        setStatusMessage('Encrypting and sending file...');

        const reader = new FileReader();
        reader.onload = async (event) => {
            const fileBuffer = event.target.result; // ArrayBuffer of the file
            try {
                const { ciphertext, iv } = await encryptMessage(sharedSecret, fileBuffer); // Encrypt the ArrayBuffer directly
                const fileMessageData = {
                    type: 'file',
                    content: Array.from(new Uint8Array(ciphertext)),
                    iv: Array.from(iv),
                    fileMetadata: {
                        name: fileToShare.name,
                        mimeType: fileToShare.type,
                        size: fileToShare.size,
                        duration: viewDuration // The selected view duration
                    }
                };

                // Send via WebRTC Data Channel
                dataChannelRef.current.send(JSON.stringify(fileMessageData));

                setStatusMessage('File sent successfully!');
                setFileToShare(null); // Clear the file input
                zeroFill(fileBuffer); // Zero-fill original file buffer
                zeroFill(ciphertext); // Zero-fill ciphertext buffer
                zeroFill(iv); // Zero-fill IV buffer
            } catch (error) {
                console.error('Error encrypting or sending file:', error);
                setStatusMessage('Failed to send file: ' + error.message);
            }
        };
        reader.readAsArrayBuffer(fileToShare); // Read file as ArrayBuffer
    };


    // --- WebRTC Setup (Simplified for initial steps) ---
    const peerConnectionRef = useRef(null);
    const dataChannelRef = useRef(null);

    const setupWebRTC = async (socket, isReceiver) => {
        const peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }, // Public STUN server
            ]
        });
        peerConnectionRef.current = peerConnection;

        // --- ICE Candidate handling ---
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate:', event.candidate);
                socket.send(JSON.stringify({
                    type: 'webrtc_ice_candidate',
                    candidate: event.candidate,
                    toCode: inputConnectionCode || connectionCode // Target peer
                }));
            }
        };

        // --- Data Channel handling ---
        if (!isReceiver) {
            // Initiator creates the data channel
            const dataChannel = peerConnection.createDataChannel('chat');
            dataChannelRef.current = dataChannel;
            console.log('Data channel created (initiator):', dataChannel);
            bindDataChannelEvents(dataChannel);
        } else {
            // Receiver listens for data channel
            peerConnection.ondatachannel = (event) => {
                const dataChannel = event.channel;
                dataChannelRef.current = dataChannel;
                console.log('Data channel received (receiver):', dataChannel);
                bindDataChannelEvents(dataChannel);
            };
        }


        // --- SDP Exchange ---
        if (!isReceiver) { // Initiator creates offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            console.log('Sending WebRTC offer:', offer);
            socket.send(JSON.stringify({
                type: 'webrtc_offer',
                sdp: peerConnection.localDescription,
                toCode: inputConnectionCode || connectionCode // Target peer
            }));
        }
        // Receiver will handle offer on `onmessage` via `handleWebRTCSignaling`

    };

    const bindDataChannelEvents = (dataChannel) => {
        dataChannel.onopen = () => {
            console.log('WebRTC Data Channel OPEN!');
            setConnectionStatus('Secure WebRTC Channel Active');
            setStatusMessage('You are now directly connected peer-to-peer!');
        };
        dataChannel.onmessage = (event) => {
            console.log('Received data from peer channel:', event.data);
            try {
                const parsedData = JSON.parse(event.data);
                handleReceivedMessage(parsedData);
            } catch (e) {
                console.error('Failed to parse incoming data channel message:', e);
            }
        };
        dataChannel.onclose = () => {
            console.log('WebRTC Data Channel CLOSED!');
            setConnectionStatus('Secure Session Active (WebRTC Closed)');
            setStatusMessage('WebRTC channel closed. Messages may revert to server relay.');
        };
        dataChannel.onerror = (error) => {
            console.error('WebRTC Data Channel ERROR:', error);
            setStatusMessage('WebRTC channel error: ' + error.message);
        };
    };


    const handleWebRTCSignaling = async (data) => {
        if (!peerConnectionRef.current) {
            // If peer connection not yet set up (e.g. if offer arrived before local setup)
            // This case ideally shouldn't happen with the current flow (setupWebRTC runs after session_offer/answer)
            // But might need more robust handling in a real-world scenario.
            console.warn('Peer connection not initialized for WebRTC signaling.');
            // Force setup if needed
            await setupWebRTC(ws, data.type === 'webrtc_offer');
            // Then re-call this function with the same data to process it
            handleWebRTCSignaling(data);
            return;
        }

        try {
            if (data.type === 'webrtc_offer') {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
                const answer = await peerConnectionRef.current.createAnswer();
                await peerConnectionRef.current.setLocalDescription(answer);
                ws.send(JSON.stringify({
                    type: 'webrtc_answer',
                    sdp: peerConnectionRef.current.localDescription,
                    toCode: inputConnectionCode || connectionCode // Target peer
                }));
            } else if (data.type === 'webrtc_answer') {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
            } else if (data.type === 'webrtc_ice_candidate') {
                if (data.candidate) {
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            }
        } catch (error) {
            console.error('Error handling WebRTC signaling:', error);
            setStatusMessage('WebRTC signaling error: ' + error.message);
        }
    };


    // --- Render ---

    return (
        <div className="App">
            <header className="App-header">
                <h1>NYX Messenger</h1>
                <p>Status: {connectionStatus}</p>
                <p>{statusMessage}</p>

                {!sharedSecret && ( // Show connection UI if not connected
                    <div className="connection-section">
                        <h2>Start Secure Session</h2>
                        <button onClick={generateCode}>Generate One-Time Code</button>
                        {connectionCode && (
                            <div style={{ marginTop: '20px' }}>
                                <p>Your Code: <code>{connectionCode}</code></p>
                                {qrValue && <QRCodeSVG value={qrValue} size={128} level="H" />}
                                <p>Share this code with your peer.</p>
                            </div>
                        )}
                        <div style={{ marginTop: '20px' }}>
                            <input
                                type="text"
                                value={inputConnectionCode}
                                onChange={e => setInputConnectionCode(e.target.value)}
                                placeholder="Enter peer's code"
                            />
                            <button onClick={enterPeerCode}>Connect to Peer</button>
                        </div>
                    </div>
                )}

                {sharedSecret && ( // Show chat UI if connected
                    <div className="chat-section">
                        <h2>Secure Chat</h2>
                        <div className="message-list" style={{ overflowY: 'auto', maxHeight: '300px', border: '1px solid #61dafb', padding: '10px', borderRadius: '5px', marginBottom: '10px' }}>
                            {chatMessages.map((msg, index) => (
                                <p key={index} className={msg.sender === 'me' ? 'my-message' : 'peer-message'}>
                                    <strong>{msg.sender === 'me' ? 'You:' : 'Peer:'}</strong> {msg.content}
                                </p>
                            ))}
                        </div>
                        <div className="message-input">
                            <input
                                type="text"
                                value={messageInput}
                                onChange={e => setMessageInput(e.target.value)}
                                onKeyPress={e => { if (e.key === 'Enter') sendTextMessage(); }}
                                placeholder="Type your ephemeral message..."
                            />
                            <button onClick={sendTextMessage}>Send Message</button>
                        </div>

                        <div className="file-sharing" style={{ marginTop: '20px', borderTop: '1px solid #61dafb', paddingTop: '20px' }}>
                            <h3>Ephemeral File Share</h3>
                            <input type="file" onChange={handleFileChange} />
                            <select value={viewDuration} onChange={(e) => setViewDuration(parseInt(e.target.value))}>
                                <option value={5}>5 seconds</option>
                                <option value={10}>10 seconds</option>
                                <option value={30}>30 seconds</option>
                                <option value={60}>1 minute</option>
                                <option value={300}>5 minutes</option>
                            </select>
                            <button onClick={sendFile} disabled={!fileToShare || receivingFile}>Send File (View Once)</button>
                            {fileToShare && <p>Selected: {fileToShare.name} ({fileToShare.size} bytes)</p>}

                            {currentFileDisplay && (
                                <div className="file-display" style={{ marginTop: '20px', border: '2px solid red', padding: '10px' }}>
                                    <p>Ephemeral File (Viewing for {currentFileDisplay.duration}s)</p>
                                    {currentFileDisplay.type.startsWith('image/') && (
                                        <img src={currentFileDisplay.url} alt={currentFileDisplay.name} style={{ maxWidth: '100%', maxHeight: '400px' }} />
                                    )}
                                    {currentFileDisplay.type.startsWith('video/') && (
                                        <video src={currentFileDisplay.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '400px' }} onEnded={clearFileDisplay}></video>
                                    )}
                                    {/* Add other file types as needed, or a generic download link if not displayable */}
                                    <button onClick={clearFileDisplay}>Clear Now</button>
                                </div>
                            )}
                            {receivingFile && !currentFileDisplay && <p>Receiving file...</p>}
                        </div>
                    </div>
                )}
            </header>
        </div>
    );
}

export default App;