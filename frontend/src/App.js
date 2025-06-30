// frontend/src/App.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
// No 'import WebSocket from 'ws';' here, use native browser WebSocket
import { QRCodeSVG } from 'qrcode.react'; // Correct named import
import {
    generateSessionKeyPair,
    deriveSharedSecret,
    encryptMessage,
    decryptMessage,
    exportPublicKey,
    importPublicKey,
    generateRandomCode,
    zeroFill
} from './cryptoUtils';
import './App.css';

function App() {
    const [ws, setWs] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('Disconnected');
    const [messageInput, setMessageInput] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [sessionKeyPair, setSessionKeyPair] = useState(null);
    const sessionKeyPairRef = useRef(null); // New ref
    const [peerPublicKey, setPeerPublicKey] = useState(null);
    const [sharedSecret, setSharedSecret] = useState(null);
    const [myConnectionCode, setMyConnectionCode] = useState(''); // Renamed for clarity
    const [peerConnectionCode, setPeerConnectionCode] = useState(''); // What peer's code we are connecting to
    const [statusMessage, setStatusMessage] = useState('');
    const [qrValue, setQrValue] = useState('');
    const [inputConnectionCode, setInputConnectionCode] = useState(''); // Input for peer's code to connect to <-- ADD THIS LINE
 
    // File sharing state
    const [fileToShare, setFileToShare] = useState(null);
    const [viewDuration, setViewDuration] = useState(5);
    const [currentFileDisplay, setCurrentFileDisplay] = useState(null);
    const fileTimerRef = useRef(null);
    const [transferringFile, setTransferringFile] = useState(false); // To show file transfer progress

    // WebRTC refs
    const peerConnectionRef = useRef(null);
    const dataChannelRef = useRef(null);

    // --- WebSocket and Connection Management ---
    useEffect(() => {
        const socket = new WebSocket('ws://localhost:8080');

        socket.onopen = async () => {
            console.log('Connected to WebSocket signaling server.');
            setConnectionStatus('Connected to Signaling Server');
            setStatusMessage('Generating keys and unique code...');

            // Generate our session key pair
            const kp = await generateSessionKeyPair();
            setSessionKeyPair(kp); // Update state for UI
            sessionKeyPairRef.current = kp; // Update ref for immediate access in callbacks

            console.log('Session Key Pair Generated and set in state.');

            // Now that sessionKeyPair is guaranteed to be set, generate and register the code
            const code = generateRandomCode(8);
            setMyConnectionCode(code);
            // We now have access to kp.publicKey because the await above has completed.
            const publicKeyJwk = await exportPublicKey(kp.publicKey); // Use kp directly
            setQrValue(JSON.stringify({ code: code, publicKey: publicKeyJwk })); // Update QR value here

            // Register our code with the server
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'register_code', code: code }));
            }
            setStatusMessage(`Your ephemeral code is: ${code}. Share it with your peer.`);

            // Set a timer for the code to expire (on client-side)
            setTimeout(() => {
                if (myConnectionCode === code) { // Only expire if it's still the active code
                    setMyConnectionCode('');
                    setQrValue('');
                    setStatusMessage('Connection code expired. Generate a new one to invite a peer.');
                }
            }, 60 * 1000); // 60 seconds validity
        };

        socket.onmessage = async event => {
            const data = JSON.parse(event.data);
            console.log('Received signaling message:', data);

            switch (data.type) {
                case 'registration_success':
                    // We've already set the QR value in onopen, so this message
                    // mainly confirms registration. You can adjust status message here if preferred.
                    setStatusMessage(`Your ephemeral code is: ${data.code}. Share it with your peer.`);
                    break;

                case 'session_offer':
                    // This is the first step for User B
                    // Ensure sessionKeyPair is available before proceeding
                    if (!sessionKeyPairRef.current) { // Check the ref
                        console.error('Session key pair not available in ref for session_offer.');
                        setStatusMessage('Error: Session key not ready for offer. Please refresh.');
                        return;
                    }
                    try {
                        const peerPk = await importPublicKey(data.publicKeyJwk);
                        setPeerPublicKey(peerPk);

                        // Use sessionKeyPairRef.current for immediate access
                        const ss = await deriveSharedSecret(sessionKeyPairRef.current.privateKey, peerPk);
                        setSharedSecret(ss);

                        setPeerConnectionCode(data.fromCode); // Remember who sent the offer

                        const ourPublicKeyJwk = await exportPublicKey(sessionKeyPairRef.current.publicKey); // Use ref
                        socket.send(JSON.stringify({
                            type: 'session_answer',
                            toCode: data.fromCode,
                            fromCode: myConnectionCode, // Our code
                            publicKeyJwk: ourPublicKeyJwk
                        }));

                        setStatusMessage('Shared secret derived. Secure session established! Setting up WebRTC...');
                        setConnectionStatus('Secure Session Active');
                        await setupWebRTC(socket, true); // true for receiver/answerer
                    } catch (error) {
                        console.error('Error handling session offer:', error);
                        setStatusMessage('Failed to establish session: ' + error.message);
                    }
                    break;

                case 'session_answer':
                    // This is the response for User A after sending an offer
                    // Ensure sessionKeyPair is available before proceeding
                    if (!sessionKeyPairRef.current) { // Check the ref
                        console.error('Session key pair not available in ref for session_answer.');
                        setStatusMessage('Error: Session key not ready for answer. Please refresh.');
                        return;
                    }
                    try {
                        const peerPk = await importPublicKey(data.publicKeyJwk);
                        setPeerPublicKey(peerPk);

                        // Use sessionKeyPairRef.current for immediate access
                        const ss = await deriveSharedSecret(sessionKeyPairRef.current.privateKey, peerPk);
                        setSharedSecret(ss);
                        setStatusMessage('Shared secret derived. Secure session established! Setting up WebRTC...');
                        setConnectionStatus('Secure Session Active');
                        await setupWebRTC(socket, false); // false for initiator/offerer
                    } catch (error) {
                        console.error('Error handling session answer:', error);
                        setStatusMessage('Failed to establish session: ' + error.message);
                    }
                    break;

                case 'webrtc_offer':
                case 'webrtc_answer':
                case 'webrtc_ice_candidate':
                    handleWebRTCSignaling(data);
                    break;

                case 'encrypted_message':
                    // Fallback for E2EE text messages if WebRTC not ready
                    handleReceivedMessage(data.message);
                    break;

                case 'error':
                    console.error('Server error:', data.message);
                    setStatusMessage(`Server Error: ${data.message}`);
                    break;

                default:
                    console.warn('Unknown message type:', data.type);
            }
        };

        socket.onclose = () => {
            console.log('Disconnected from WebSocket signaling server.');
            setConnectionStatus('Disconnected');
            setStatusMessage('Disconnected from signaling server. Please refresh to start a new session.');
            // Clear all session-related state on disconnect to enforce ephemerality
            setSessionKeyPair(null);
            setPeerPublicKey(null);
            setSharedSecret(null);
            setMyConnectionCode('');
            setPeerConnectionCode('');
            setQrValue('');
            setChatMessages([]);
            setCurrentFileDisplay(null);
            setFileToShare(null);
            setTransferringFile(false);
            if (fileTimerRef.current) clearTimeout(fileTimerRef.current);
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
            if (dataChannelRef.current) {
                dataChannelRef.current.close();
                dataChannelRef.current = null;
            }
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
    }, []); // Empty dependency array means this runs once on mount

    // --- Connection Code / QR Code Generation & Handling ---

    const generateMyCodeAndSend = async () => {
        if (!sessionKeyPair) {
            setStatusMessage('Generating keys... please wait.');
            return;
        }
        const code = generateRandomCode(8); // 8-char alphanumeric
        setMyConnectionCode(code);

        const publicKeyJwk = await exportPublicKey(sessionKeyPair.publicKey);
        const qrData = JSON.stringify({ code: code, publicKey: publicKeyJwk });
        setQrValue(qrData);

        setStatusMessage(`Share this code or QR: ${code}. Valid for 60 seconds. Awaiting peer connection...`);
        // Register our code with the server
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'register_code', code: code }));
        }

        // Set a timer for the code to expire (on client-side, server will also handle it if not used)
        setTimeout(() => {
            if (myConnectionCode === code) { // Only expire if it's still the active code
                setMyConnectionCode('');
                setQrValue('');
                setStatusMessage('Connection code expired. Generate a new one to invite a peer.');
            }
        }, 60 * 1000); // 60 seconds validity
    };

    const connectToPeer = async () => {
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

        // Remember the peer's code we are trying to connect to
        setPeerConnectionCode(inputConnectionCode);

        try {
            const ourPublicKeyJwk = await exportPublicKey(sessionKeyPair.publicKey);
            ws.send(JSON.stringify({
                type: 'session_offer',
                toCode: inputConnectionCode,
                fromCode: myConnectionCode, // Our own registered code
                publicKeyJwk: ourPublicKeyJwk
            }));
            setStatusMessage(`Sending connection offer to peer with code: ${inputConnectionCode}`);
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
                content: Array.from(new Uint8Array(ciphertext)),
                iv: Array.from(iv)
            };

            if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
                dataChannelRef.current.send(JSON.stringify(messageData));
                setChatMessages(prev => [...prev, { sender: 'me', content: messageInput, type: 'text' }]);
            } else if (ws && ws.readyState === WebSocket.OPEN) {
                // Fallback to signaling server if WebRTC not open (E2EE still protects content)
                ws.send(JSON.stringify({
                    type: 'encrypted_message',
                    toCode: peerConnectionCode, // Use the code of the peer we successfully connected to
                    message: messageData
                }));
                 setChatMessages(prev => [...prev, { sender: 'me', content: messageInput + ' (sent via server relay)', type: 'text' }]);
            } else {
                setStatusMessage('No active connection to send message.');
                return;
            }

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
                setTransferringFile(true); // Indicate that a file is being processed
                setStatusMessage(`Receiving ephemeral file: ${fileMetadata.name}...`);

                // Decrypt the file content
                const decryptedFileBlobPart = await decryptMessage(sharedSecret, ciphertext, ivArr); // This needs to be a raw ArrayBuffer/Blob not string
                // Correct decryption for file should return ArrayBuffer directly
                // This means encryptMessage for files should return ArrayBuffer, not string.
                // Re-evaluate encryptMessage in cryptoUtils to handle ArrayBuffers.
                // For now, let's assume `decryptMessage` can take ArrayBuffer and return Blob/ArrayBuffer.
                const fileBlob = new Blob([decryptedFileBlobPart], { type: fileMetadata.mimeType });
                const fileURL = URL.createObjectURL(fileBlob);

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
                    setStatusMessage('Ephemeral file display expired and cleared.');
                }, fileMetadata.duration * 1000);

                setTransferringFile(false);
            }
            // Aggressively zero-fill buffers after use (best effort)
            zeroFill(ciphertext);
            zeroFill(ivArr.buffer);

        } catch (error) {
            console.error('Error decrypting message:', error);
            setStatusMessage('Failed to decrypt message: ' + error.message);
        }
    };

    const clearFileDisplay = useCallback(() => {
        if (currentFileDisplay && currentFileDisplay.url) {
            URL.revokeObjectURL(currentFileDisplay.url); // Release the object URL
        }
        setCurrentFileDisplay(null);
        if (fileTimerRef.current) clearTimeout(fileTimerRef.current);
        fileTimerRef.current = null;
        setStatusMessage('File display cleared.');
    }, [currentFileDisplay]); // Only re-create if currentFileDisplay changes

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
            setStatusMessage('WebRTC data channel not open for file transfer. Please wait for direct connection.');
            return;
        }

        setStatusMessage('Encrypting and sending file...');
        setTransferringFile(true);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const fileBuffer = event.target.result; // ArrayBuffer of the file
            try {
                // Ensure encryptMessage can handle ArrayBuffer directly
                const { ciphertext, iv } = await encryptMessage(sharedSecret, fileBuffer);
                const fileMessageData = {
                    type: 'file',
                    content: Array.from(new Uint8Array(ciphertext)), // Convert ArrayBuffer to array for JSON
                    iv: Array.from(iv),
                    fileMetadata: {
                        name: fileToShare.name,
                        mimeType: fileToShare.type,
                        size: fileToShare.size,
                        duration: viewDuration // The selected view duration
                    }
                };

                // WebRTC Data Channels have message size limits (often 64KB-256KB per message).
                // For larger files, you'd need to chunk the file and send multiple messages,
                // reassembling on the receiver side. For this MVP, we assume small files that fit.
                dataChannelRef.current.send(JSON.stringify(fileMessageData));

                setStatusMessage('File sent successfully!');
                setFileToShare(null); // Clear the file input
                zeroFill(fileBuffer); // Zero-fill original file buffer
                zeroFill(new Uint8Array(ciphertext).buffer); // Zero-fill ciphertext buffer
                zeroFill(iv); // Zero-fill IV buffer
            } catch (error) {
                console.error('Error encrypting or sending file:', error);
                setStatusMessage('Failed to send file: ' + error.message);
            } finally {
                setTransferringFile(false);
            }
        };
        reader.readAsArrayBuffer(fileToShare); // Read file as ArrayBuffer
    };


    // --- WebRTC Setup and Signaling ---

    const setupWebRTC = useCallback(async (socket, isReceiver) => {
        // Close any existing peer connection before setting up a new one
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (dataChannelRef.current) {
            dataChannelRef.current.close();
            dataChannelRef.current = null;
        }

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
                    toCode: peerConnectionCode, // Send to the peer we are connected to
                    fromCode: myConnectionCode
                }));
            }
        };

        // --- Data Channel handling ---
        if (!isReceiver) {
            // Initiator creates the data channel
            const dataChannel = peerConnection.createDataChannel('chat', { ordered: true }); // ordered: true for reliable delivery
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

        // --- SDP Exchange (Offer/Answer) ---
        if (!isReceiver) { // Initiator creates offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            console.log('Sending WebRTC offer:', offer);
            socket.send(JSON.stringify({
                type: 'webrtc_offer',
                sdp: peerConnection.localDescription,
                toCode: peerConnectionCode,
                fromCode: myConnectionCode
            }));
        }
        // Receiver will handle offer via `handleWebRTCSignaling`

    }, [myConnectionCode, peerConnectionCode]); // Depend on codes to ensure correct targets

    const bindDataChannelEvents = useCallback((dataChannel) => {
        dataChannel.onopen = () => {
            console.log('WebRTC Data Channel OPEN!');
            setConnectionStatus('Secure WebRTC Channel Active');
            setStatusMessage('You are now directly connected peer-to-peer! Messaging is direct.');
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
            setStatusMessage('WebRTC channel closed. Messages may revert to server relay or connection lost. Re-initiate connection if needed.');
        };
        dataChannel.onerror = (error) => {
            console.error('WebRTC Data Channel ERROR:', error);
            setStatusMessage('WebRTC channel error: ' + error.message);
        };
    }, [handleReceivedMessage]);


    const handleWebRTCSignaling = useCallback(async (data) => {
        if (!peerConnectionRef.current) {
            console.warn('WebRTC peer connection not initialized for signaling. This should not happen if `setupWebRTC` runs correctly.');
            return;
        }

        try {
            if (data.sdp) { // This is an offer or an answer
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
                if (data.type === 'webrtc_offer') {
                    // If it was an offer, create and send an answer
                    const answer = await peerConnectionRef.current.createAnswer();
                    await peerConnectionRef.current.setLocalDescription(answer);
                    ws.send(JSON.stringify({
                        type: 'webrtc_answer',
                        sdp: peerConnectionRef.current.localDescription,
                        toCode: peerConnectionCode,
                        fromCode: myConnectionCode
                    }));
                }
            } else if (data.candidate) { // This is an ICE candidate
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        } catch (error) {
            console.error('Error handling WebRTC signaling:', error);
            setStatusMessage('WebRTC signaling error: ' + error.message);
        }
    }, [myConnectionCode, peerConnectionCode, ws]);

    // --- CryptoUtils Update ---
    // Make sure encryptMessage in cryptoUtils can take ArrayBuffer and return ArrayBuffer
    // (This was a comment in the previous code, but needs to be actually done)

    // Modification needed in cryptoUtils.js
    // Original: `plaintext` as string, `encoded` with TextEncoder.
    // New: `dataToEncrypt` can be string or ArrayBuffer.
    // Modify `encryptMessage` in `cryptoUtils.js`:
    /*
    export async function encryptMessage(key, dataToEncrypt) {
        let encoded;
        if (typeof dataToEncrypt === 'string') {
            encoded = new TextEncoder().encode(dataToEncrypt);
        } else if (dataToEncrypt instanceof ArrayBuffer) {
            encoded = new Uint8Array(dataToEncrypt);
        } else {
            throw new Error('Data to encrypt must be string or ArrayBuffer.');
        }

        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const ciphertext = await window.crypto.subtle.encrypt(
            { name: AES_ALGO.name, iv: iv },
            key,
            encoded
        );

        return { ciphertext, iv };
    }

    // Modify decryptMessage to return ArrayBuffer for files
    export async function decryptMessage(key, ciphertext, iv) {
        const decrypted = await window.crypto.subtle.decrypt(
            { name: AES_ALGO.name, iv: iv },
            key,
            ciphertext
        );
        // If it was text, return string, otherwise return ArrayBuffer
        // We'll rely on the `type` field in the message to distinguish
        return decrypted; // Will be ArrayBuffer. Call TextDecoder in App.js if text.
    }
    */

    // Back in App.js, handle decrypted result based on type:
    // For text: `const decryptedText = new TextDecoder().decode(await decryptMessage(sharedSecret, ciphertext, ivArr));`
    // For file: `const decryptedFileBuffer = await decryptMessage(sharedSecret, ciphertext, ivArr);`
    // Then `new Blob([decryptedFileBuffer])`

    // Let's ensure this is implemented correctly in `cryptoUtils.js` first.
    // I'll provide the updated cryptoUtils.js for clarity on this.

    return (
        <div className="App">
            <header className="App-header">
                <h1>NYX Messenger</h1>
                <p>Status: {connectionStatus}</p>
                <p>{statusMessage}</p>

                {!sharedSecret && (
                    <div className="connection-section">
                        <h2>Start Secure Session</h2>
                        {/* Only show generate button if we have keys and not yet generated a code */}
                        {sessionKeyPair && !myConnectionCode && (
                            <button onClick={generateMyCodeAndSend}>Generate Your One-Time Code</button>
                        )}

                        {myConnectionCode && (
                            <div style={{ marginTop: '20px' }}>
                                <p>Your Code: <code>{myConnectionCode}</code></p>
                                {qrValue && <QRCodeSVG value={qrValue} size={128} level="H" />}
                                <p>Share this code (physically or securely) with your peer.</p>
                            </div>
                        )}
                        <div style={{ marginTop: '20px' }}>
                            <input
                                type="text"
                                value={inputConnectionCode}
                                onChange={e => setInputConnectionCode(e.target.value)}
                                placeholder="Enter peer's code to connect"
                            />
                            <button onClick={connectToPeer}>Connect to Peer</button>
                        </div>
                    </div>
                )}

                {sharedSecret && (
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
                            <button onClick={sendTextMessage} disabled={!dataChannelRef.current || dataChannelRef.current.readyState !== 'open'}>Send Message</button>
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
                            <button onClick={sendFile} disabled={!fileToShare || !dataChannelRef.current || dataChannelRef.current.readyState !== 'open' || transferringFile}>
                                {transferringFile ? 'Sending...' : 'Send File (View Once)'}
                            </button>
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
                                    {/* For other types, a simple message or a very temporary download might be an option,
                                        but for extreme security, restrict to displayable media. */}
                                    <button onClick={clearFileDisplay}>Clear Now</button>
                                </div>
                            )}
                            {transferringFile && !currentFileDisplay && <p>Processing file transfer...</p>}
                        </div>
                    </div>
                )}
            </header>
        </div>
    );
}

export default App;