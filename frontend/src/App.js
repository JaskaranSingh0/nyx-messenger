// frontend/src/App.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
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
    const wsRef = useRef(null);
    const [connectionStatus, setConnectionStatus] = useState('Disconnected');
    const [messageInput, setMessageInput] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [sessionKeyPair, setSessionKeyPair] = useState(null);
    const sessionKeyPairRef = useRef(null); // Ref for latest sessionKeyPair
    const [peerPublicKey, setPeerPublicKey] = useState(null);
    const [sharedSecret, setSharedSecret] = useState(null);
    const sharedSecretRef = useRef(null); // NEW
    const [myConnectionCode, setMyConnectionCode] = useState('');
    const myConnectionCodeRef = useRef(''); // Ref for latest myConnectionCode
    const [peerConnectionCode, setPeerConnectionCode] = useState('');
    const peerConnectionCodeRef = useRef(''); // Ref for latest peerConnectionCode
    const [statusMessage, setStatusMessage] = useState('');
    const [qrValue, setQrValue] = useState('');
    const [inputConnectionCode, setInputConnectionCode] = useState('');
 
    // File sharing state
    const [fileToShare, setFileToShare] = useState(null);
    const [viewDuration, setViewDuration] = useState(5);
    const [currentFileDisplay, setCurrentFileDisplay] = useState(null);
    const fileTimerRef = useRef(null);
    const [transferringFile, setTransferringFile] = useState(false);

    //message queue
    const [queuedEncryptedMessages, setQueuedEncryptedMessages] = useState([]);


    // WebRTC refs
    const peerConnectionRef = useRef(null);
    const dataChannelRef = useRef(null);
    const iceCandidatesQueueRef = useRef([]);

    // Callback to clear file display
    const clearFileDisplay = useCallback(() => {
        if (currentFileDisplay && currentFileDisplay.url) {
            URL.revokeObjectURL(currentFileDisplay.url);
        }
        setCurrentFileDisplay(null);
        if (fileTimerRef.current) clearTimeout(fileTimerRef.current);
        fileTimerRef.current = null;
        setStatusMessage('File display cleared.');
    }, [currentFileDisplay]);

    // Callback to handle incoming encrypted messages
    const handleReceivedMessage = useCallback(async (encryptedData, secret) => {
        if (!secret) {
            console.warn('Received message without a valid shared secret.');
            return;
        }
        try {
            const { content, iv, type, fileMetadata } = encryptedData;
            const ciphertext = new Uint8Array(content).buffer;
            const ivArr = new Uint8Array(iv);
            console.log("Received ciphertext length:", content.length);
            console.log("Received IV length:", iv.length);  

            if (type === 'text') {
                
                console.log("🧾 Encrypted text message received:", encryptedData);
                const decryptedBuffer = await decryptMessage(secret, ciphertext, ivArr); // Decrypted as ArrayBuffer
                const decryptedText = new TextDecoder().decode(decryptedBuffer); // Decode as text
                console.log("✅ Decrypted Text:", decryptedText);


                setChatMessages(prev => [...prev, { sender: 'peer', content: decryptedText, type: 'text' }]);
            } else if (type === 'file') {
                setTransferringFile(true);
                setStatusMessage(`Receiving ephemeral file: ${fileMetadata.name}...`);

                const decryptedFileBuffer = await decryptMessage(secret, ciphertext, ivArr);
                const fileBlob = new Blob([decryptedFileBuffer], { type: fileMetadata.mimeType });
                const fileURL = URL.createObjectURL(fileBlob);

                setCurrentFileDisplay({
                    url: fileURL,
                    name: fileMetadata.name,
                    type: fileMetadata.mimeType,
                    size: fileMetadata.size,
                    duration: fileMetadata.duration
                });

                if (fileTimerRef.current) clearTimeout(fileTimerRef.current);
                fileTimerRef.current = setTimeout(() => {
                    clearFileDisplay();
                    setStatusMessage('Ephemeral file display expired and cleared.');
                }, fileMetadata.duration * 1000);

                setTransferringFile(false);
            }
            zeroFill(ciphertext);
            zeroFill(ivArr.buffer);

        } catch (error) {
            console.error('Error decrypting message:', error);
            setStatusMessage('Failed to decrypt message: ' + error.message);
        }
    }, [clearFileDisplay]); // `sharedSecret` is removed, `clearFileDisplay` is the dependency.


    const decryptAndDisplayMessage = useCallback(async (message, secret) => {
        await handleReceivedMessage(message, secret);
    }, [handleReceivedMessage]);


    // Callback to bind data channel events
    const bindDataChannelEvents = useCallback((dataChannel) => {
        dataChannel.onopen = () => {
            console.log('✅ WebRTC Data Channel OPEN!');
            setConnectionStatus('Secure WebRTC Channel Active');
            setStatusMessage('You are now directly connected peer-to-peer! Messaging is direct.');
        };
        dataChannel.onmessage = (event) => {
             console.log('Received data from peer channel:', event.data);
             try {
                const parsedData = JSON.parse(event.data);
                console.log("📩 Received message:", parsedData); // Added log statement

                const secret = sharedSecretRef.current;
                if (!secret) {
                    console.warn("❌ No shared secret yet, queuing...");
                    setQueuedEncryptedMessages(prev => [...prev, parsedData]);
                    return;
                }

                const { type } = parsedData;
                if (type === 'file') {
                    console.log("📂 Handling file type..."); // Added log statement
                }

                handleReceivedMessage(parsedData, secret);
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
    }, [handleReceivedMessage, sharedSecret]);

    // Callback for handling WebRTC signaling messages
    const handleWebRTCSignaling = useCallback(async (data, myCode, targetPeerCode, currentPeerConnectionRef, currentWs) => {
        if (!currentPeerConnectionRef.current) {
            console.warn('WebRTC peer connection not initialized for signaling. Queueing ICE candidates if received.');
            if (data.candidate) {
                iceCandidatesQueueRef.current.push(data.candidate);
            }
            return;
        }

        try {
            if (data.sdp) { // This is an offer or an answer
                console.log(`Setting remote description for type: ${data.type}`);
                await currentPeerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));

                // Process any queued ICE candidates after remote description is set
                while (iceCandidatesQueueRef.current.length > 0) {
                    const candidate = iceCandidatesQueueRef.current.shift();
                    console.log('Adding queued ICE candidate:', candidate);
                    await currentPeerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                }

                if (data.type === 'webrtc_offer') {
                    // If it was an offer, create and send an answer
                    const answer = await currentPeerConnectionRef.current.createAnswer();
                    await currentPeerConnectionRef.current.setLocalDescription(answer);
                    if (currentWs && currentWs.readyState === WebSocket.OPEN) {
                        currentWs.send(JSON.stringify({
                            type: 'webrtc_answer',
                            sdp: currentPeerConnectionRef.current.localDescription,
                            toCode: targetPeerCode, // Send answer back to the *sender* of the offer
                            fromCode: myCode
                        }));
                    }
                }
            } else if (data.candidate) { // This is an ICE candidate
                if (currentPeerConnectionRef.current.remoteDescription) {
                    console.log('Adding ICE candidate:', data.candidate);
                    await currentPeerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                } else {
                    console.log('Queueing ICE candidate (remote description not set yet):', data.candidate);
                    iceCandidatesQueueRef.current.push(data.candidate);
                }
            }
        } catch (error) {
            console.error('Error handling WebRTC signaling:', error);
            setStatusMessage('WebRTC signaling error: ' + error.message);
        }
    }, []); // Empty dependency array as all needed variables are passed as arguments or are refs

    // Callback for setting up WebRTC connection
    const setupWebRTC = useCallback(async (socket, isReceiver, myCode, targetPeerCode) => {
        console.log("🧠 setupWebRTC called", { isReceiver, myCode, targetPeerCode });
        
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
                { urls: 'stun:stun.l.google.com:19302' },
                {
                urls: 'turn:openrelay.metered.ca:80?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
                }
            ]
        });
        peerConnectionRef.current = peerConnection;
        
        peerConnection.onconnectionstatechange = () => {
            console.log("🔄 PeerConnection state:", peerConnection.connectionState);
        };

        // --- ICE Candidate handling ---
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate:', event.candidate);
                console.log(`[onicecandidate] toCode: ${targetPeerCode}, fromCode: ${myCode}`);
                socket.send(JSON.stringify({
                    type: 'webrtc_ice_candidate',
                    candidate: event.candidate,
                    toCode: targetPeerCode, // Use passed targetPeerCode
                    fromCode: myCode // Use passed myCode
                }));
            }
        };

        // --- Data Channel handling ---
        if (!isReceiver) {
            // Initiator creates the data channel
            const dataChannel = peerConnection.createDataChannel('chat', { ordered: true });
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
        if (!isReceiver) {
        // Initiator creates and sends the offer
        if (peerConnection.signalingState !== "stable") {
            console.warn("⚠️ Cannot create offer now — signaling state:", peerConnection.signalingState);
            return;
        }
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        console.log('Sending WebRTC offer:', offer);
        socket.send(JSON.stringify({
            type: 'webrtc_offer',
            sdp: offer,
            toCode: targetPeerCode,
            fromCode: myCode
        }));
    }   
    }, [bindDataChannelEvents]); // bindDataChannelEvents is a dependency here

    // Handle page unload for debugging
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            console.log("🔥 Page is reloading or closing!");
            e.preventDefault();
            e.returnValue = '';
        };
        
        window.addEventListener("beforeunload", handleBeforeUnload);
        
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

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
            myConnectionCodeRef.current = code; // Update ref for current code
            // We now have access to kp.publicKey because the await above has completed.
            const publicKeyJwk = await exportPublicKey(kp.publicKey); // Use kp directly
            console.log("Exported JWK:", publicKeyJwk); // <-- Add this
            setQrValue(JSON.stringify({ code: code, publicKey: publicKeyJwk })); // Update QR value here
            console.log("QR Payload:", { code: code, publicKey: publicKeyJwk });

            // Register our code with the server
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'register_code', code: code }));
            }
            setStatusMessage(`Your ephemeral code is: ${code}. Share it with your peer.`);

            // Set a timer for the code to expire (on client-side)
            setTimeout(() => {
                setMyConnectionCode(currentCode => {
                    if (currentCode === code) { // Only expire if it's still the active code
                        setQrValue('');
                        setStatusMessage('Connection code expired. Generate a new one to invite a peer.');
                        return '';
                    }
                    return currentCode; // Keep current code if it's different
                });
            }, 60 * 1000); // 60 seconds validity
        };

        socket.onmessage = async event => {
            const data = JSON.parse(event.data);
            console.log('Received signaling message:', data);

            // Use refs for current myConnectionCode and peerConnectionCode to ensure latest values
            const currentMyCode = myConnectionCodeRef.current;
            const currentPeerCode = peerConnectionCodeRef.current;

            switch (data.type) {
                case 'registration_success':
                    setStatusMessage(`Your ephemeral code is: ${data.code}. Share it with your peer.`);
                    break;

               case 'session_offer':
                // This is the first step for User B (the receiver)
                if (!sessionKeyPairRef.current) {
                    console.error('Session key pair not available in ref for session_offer.');
                    setStatusMessage('Error: Session key not ready for offer. Please refresh.');
                    return;
                }
                console.log("Received session_offer publicKeyJwk:", data.publicKeyJwk);
                try {
                    const peerPk = await importPublicKey(data.publicKeyJwk);
                    setPeerPublicKey(peerPk);

                    // Derive the shared secret using our private key and their public key
                    const ss = await deriveSharedSecret(sessionKeyPairRef.current.privateKey, peerPk);
                    setSharedSecret(ss);
                    sharedSecretRef.current = ss; // Keep ref in sync

                    // If any messages were queued while waiting for the secret, decrypt them now
                    if (queuedEncryptedMessages.length > 0) {
                        console.log("🔓 Decrypting queued messages...");
                        queuedEncryptedMessages.forEach(msg => decryptAndDisplayMessage(msg, ss));
                        setQueuedEncryptedMessages([]);
                    }

                    // Store the peer's code so we can send messages back
                    setPeerConnectionCode(data.fromCode);
                    peerConnectionCodeRef.current = data.fromCode;
                    console.log(`[onmessage-session_offer] Setting peerConnectionCode to: ${data.fromCode}`);

                    // Send our public key back to the initiator in a 'session_answer'
                    const ourPublicKeyJwk = await exportPublicKey(sessionKeyPairRef.current.publicKey);
                    socket.send(JSON.stringify({
                        type: 'session_answer',
                        toCode: data.fromCode,
                        fromCode: currentMyCode,
                        publicKeyJwk: ourPublicKeyJwk
                    }));
                    console.log(`[onmessage-session_offer] Sent session_answer with toCode: ${data.fromCode}, fromCode: ${currentMyCode}`);

                    // Update status: We are now secure, waiting for the initiator to start the WebRTC handshake
                    setStatusMessage('Shared secret derived. Secure session active! Waiting for peer to start direct connection...');
                    setConnectionStatus('Secure Session Active');
                    
                    // THE FIX: We DO NOT call setupWebRTC here. The receiver waits for the 'webrtc_offer'.

                } catch (error) {
                    console.error('Error handling session offer:', error);
                    setStatusMessage('Failed to establish session: ' + error.message);
                }
                break;

                case 'session_answer':
                    // This is the response for User A after sending an offer
                    // Ensure sessionKeyPair is available before proceeding
                    if (!sessionKeyPairRef.current) {
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
                        sharedSecretRef.current = ss; // ✅ Keep ref in sync
                        if (queuedEncryptedMessages.length > 0) {
                            console.log("🔓 Decrypting queued messages...");
                            queuedEncryptedMessages.forEach(msg => decryptAndDisplayMessage(msg, ss));
                            setQueuedEncryptedMessages([]);
                        }

                        setStatusMessage('Shared secret derived. Secure session established! Setting up WebRTC...');
                        setConnectionStatus('Secure Session Active');
                        // Pass explicit current codes to setupWebRTC
                        setTimeout(() => {
                            setupWebRTC(socket, false, currentMyCode, currentPeerCode);
                        }, 100); // or even 250ms
                    } catch (error) {
                        console.error('Error handling session answer:', error);
                        setStatusMessage('Failed to establish session: ' + error.message);
                    }
                    break;

                case 'webrtc_offer':
                    // Mark self as receiver and call setup before applying SDP
                    await setupWebRTC(socket, true, currentMyCode, data.fromCode);
                    // FIX: Add 'await' to ensure the answer is created and sent before moving on.
                    await handleWebRTCSignaling(data, currentMyCode, data.fromCode, peerConnectionRef, socket);
                    break;

                case 'webrtc_answer':
                case 'webrtc_ice_candidate':
                    // Pass explicit current codes and refs to handleWebRTCSignaling
                    handleWebRTCSignaling(data, currentMyCode, currentPeerCode, peerConnectionRef, socket);
                    break;

                case 'encrypted_message':
                    const secret = sharedSecretRef.current;
                    if (!secret) {
                        console.warn("🔐 Received message before shared secret was established. Queuing.");
                        setQueuedEncryptedMessages(prev => [...prev, data.message]);
                        return;
                    }
                    decryptAndDisplayMessage(data.message, secret);
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
            setStatusMessage('Connection lost. Please refresh to start a new secure session.');
        };

        socket.onerror = error => {
            console.error('WebSocket error:', error);
            setConnectionStatus('Error');
            setStatusMessage(`WebSocket Error: ${error.message}`);
        };

        setWs(socket);

        return () => {
            if (socket.readyState === WebSocket.OPEN) {
                console.log("Component unmounting — not closing WebSocket (let server timeout).");
            }
        };
    }, [handleReceivedMessage, setupWebRTC, handleWebRTCSignaling, decryptAndDisplayMessage, sharedSecret]); // Dependencies are now just the memoized callbacks


    useEffect(() => {
        if (
            sharedSecret &&
            peerConnectionCodeRef.current &&
            ws?.readyState === WebSocket.OPEN &&
            !peerConnectionRef.current // prevent unnecessary re-calls
        ) {
            console.log("🔁 Retrying WebRTC setup after reload...");
            setupWebRTC(ws, false, myConnectionCodeRef.current, peerConnectionCodeRef.current);
        }
    }, [sharedSecret]);


    // --- Connection Code / QR Code Generation & Handling ---

    const generateMyCodeAndSend = async () => {
        if (!sessionKeyPair) {
            setStatusMessage('Generating keys... please wait.');
            return;
        }
        const code = generateRandomCode(8); // 8-char alphanumeric
        setMyConnectionCode(code);
        myConnectionCodeRef.current = code; // Update ref

        const publicKeyJwk = await exportPublicKey(sessionKeyPair.publicKey);
        console.log("Exported JWK:", publicKeyJwk); // <-- Add this
        const qrData = JSON.stringify({ code: code, publicKey: publicKeyJwk });
        setQrValue(qrData);

        setStatusMessage(`Share this code or QR: ${code}. Valid for 60 seconds. Awaiting peer connection...`);
        // Register our code with the server
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'register_code', code: code }));
        }

        // Set a timer for the code to expire (on client-side, server will also handle it if not used)
        setTimeout(() => {
            setMyConnectionCode(currentCode => {
                if (currentCode === code) { // Only expire if it's still the active code
                    setQrValue('');
                    setStatusMessage('Connection code expired. Generate a new one to invite a peer.');
                    return '';
                }
                return currentCode;
            });
        }, 60 * 1000); // 60 seconds validity
    };

    const connectToPeer = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    try {
        console.log("🔹 connectToPeer triggered");

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

        setPeerConnectionCode(inputConnectionCode);
        peerConnectionCodeRef.current = inputConnectionCode;
        console.log(`[connectToPeer] Setting peerConnectionCode to: ${inputConnectionCode}`);
        console.log(`[connectToPeer] myConnectionCode is: ${myConnectionCode}`);

        const ourPublicKeyJwk = await exportPublicKey(sessionKeyPair.publicKey);
        console.log("Exported JWK (sender):", ourPublicKeyJwk);

        ws.send(JSON.stringify({
            type: 'session_offer',
            toCode: inputConnectionCode,
            fromCode: myConnectionCodeRef.current,
            publicKeyJwk: ourPublicKeyJwk
        }));
        console.log(`[connectToPeer] Sent session_offer`);

        setStatusMessage(`Sending connection offer to peer with code: ${inputConnectionCode}`);
    } catch (err) {
        console.error("❌ connectToPeer error:", err);
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

            console.log("📤 Sending encrypted text:", messageData);

            if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
                dataChannelRef.current.send(JSON.stringify(messageData));
                setChatMessages(prev => [...prev, { sender: 'me', content: messageInput, type: 'text' }]);
            } else if (ws && ws.readyState === WebSocket.OPEN) {
                // Fallback to signaling server if WebRTC not open (E2EE still protects content)
                ws.send(JSON.stringify({
                    type: 'encrypted_message',
                    toCode: peerConnectionCodeRef.current, // Use the code of the peer we successfully connected to
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

    // --- File Sending Functions ---

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFileToShare(file);
        }
    };

    const sendFile = async () => {
    if (!fileToShare || !sharedSecret) {
        console.warn("❌ No file selected or shared secret not available.");
        setStatusMessage('No file selected or secure session not established.');
        return;
    }

    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
        console.warn("❌ Data channel not open during send. Current state:", dataChannelRef.current?.readyState);
        setStatusMessage('WebRTC data channel not open. Please wait for peer connection.');
        return;
    }

    setStatusMessage('Encrypting and sending file...');
    setTransferringFile(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
        const fileBuffer = event.target.result;
        console.log("📥 File loaded into buffer:", fileBuffer);

        try {
            const { ciphertext, iv } = await encryptMessage(sharedSecret, fileBuffer);
            console.log("🔐 File encrypted:", {
                ciphertextLength: ciphertext.byteLength,
                iv: Array.from(iv)
            });

            const fileMessageData = {
                type: 'file',
                content: Array.from(new Uint8Array(ciphertext)),
                iv: Array.from(iv),
                fileMetadata: {
                    name: fileToShare.name,
                    mimeType: fileToShare.type,
                    size: fileToShare.size,
                    duration: viewDuration
                }
            };

            const payload = JSON.stringify(fileMessageData);
            console.log("📤 Sending file over WebRTC (JSON size):", payload.length);

            // Send via data channel
            dataChannelRef.current.send(payload);
            console.log("✅ File sent over WebRTC data channel!");

            setStatusMessage('File sent successfully!');
            setFileToShare(null); // Clear selection
            zeroFill(fileBuffer);
            zeroFill(new Uint8Array(ciphertext).buffer);
            zeroFill(iv);
        } catch (error) {
            console.error('❌ Error encrypting or sending file:', error);
            setStatusMessage('Failed to send file: ' + error.message);
        } finally {
            setTransferringFile(false);
        }
    };

    reader.onerror = (err) => {
        console.error("❌ FileReader error:", err);
        setStatusMessage('Failed to read file.');
        setTransferringFile(false);
    };

    console.log("📂 Reading file as ArrayBuffer...");
    reader.readAsArrayBuffer(fileToShare);
};


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
                            <button type="button" onClick={connectToPeer}>Connect to Peer</button>
                        </div>
                    </div>
                )}

                {sharedSecret && (
                    <div className="chat-section">
                        <h2>Secure Chat</h2>
                        <div className="message-list" style={{ overflowY: 'auto', maxHeight: '300px', border: '1px solid #61dafb', padding: '10px', borderRadius: '5px', marginBottom: '10px' }}>
                            {chatMessages.map((msg, index) => {
                                console.log("💬 Rendering message:", msg);
                                return (
                                    <p key={index} className={msg.sender === 'me' ? 'my-message' : 'peer-message'}>
                                        <strong>{msg.sender === 'me' ? 'You:' : 'Peer:'}</strong> {msg.content}
                                    </p>
                                );
                            })}
                        </div>
                        <div className="message-input">
                            <input
                                type="text"
                                value={messageInput}
                                onChange={e => setMessageInput(e.target.value)}
                                onKeyPress={e => { if (e.key === 'Enter') sendTextMessage(); }}
                                placeholder="Type your ephemeral message..."
                            />
                            <button
                                onClick={sendTextMessage}
                                disabled={
                                    !sharedSecret ||
                                    // Disable only if BOTH the WebRTC channel AND the WebSocket are not open.
                                    (dataChannelRef.current?.readyState !== 'open' && ws?.readyState !== WebSocket.OPEN)
                                }
                            >
                                Send Message
                            </button>

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
                            <button
                            onClick={() => {
                                console.log("📤 [SendFileButton] Clicked");
                                console.log("📦 File to send:", fileToShare?.name, fileToShare?.size);
                                console.log("📡 DataChannel state:", dataChannelRef.current?.readyState);
                                sendFile();
                            }}
                            disabled={
                                !fileToShare ||
                                !dataChannelRef.current ||
                                dataChannelRef.current.readyState !== 'open' ||
                                transferringFile
                            }
                            >

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