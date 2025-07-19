// frontend/src/App.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiWifi, FiWifiOff, FiShield } from 'react-icons/fi';
import {
    generateSessionKeyPair,
    deriveSharedSecret,
    encryptMessage,
    decryptMessage,
    exportPublicKey,
    importPublicKey,
    generateRandomCode,
    generateShortAuthString,
    zeroFill
} from './cryptoUtils';
import ConnectionManager from './components/ConnectionManager';
import VerificationPrompt from './components/VerificationPrompt';
import ChatInterface from './components/ChatInterface';
import './App.css';

function App() {
    // ===================================================================
    // 1. All useState and useRef hooks FIRST
    // ===================================================================
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
    const [inputConnectionCode, setInputConnectionCode] = useState('');
    
    // File sharing state
    const [fileToShare, setFileToShare] = useState(null);
    const [viewDuration, setViewDuration] = useState(5);
    const [currentFileDisplay, setCurrentFileDisplay] = useState(null);
    const fileTimerRef = useRef(null);
    const [transferringFile, setTransferringFile] = useState(false);

    // This prevents us from sending too many messages
    const typingTimeoutRef = useRef(null);
    const messageListRef = useRef(null);
    const pongTimeoutRef = useRef(null);

    // Add this with your other useState declarations (around line 47)
    const [unreadMessages, setUnreadMessages] = useState(0);

    // new state variables for SAS
    const [authenticationString, setAuthenticationString] = useState('');
    const [isVerified, setIsVerified] = useState(false); // Tracks if the user has confirmed the SAS

    // Add this with your other useRef declarations (around line 50)
    const notificationSoundRef = useRef(new Audio('/doki.mp3'));
    //track if the peer is typing
    const [isPeerTyping, setIsPeerTyping] = useState(false);
    
    const [copySuccess, setCopySuccess] = useState('')

    //const [incomingFileChunks, setIncomingFileChunks] = useState(new Map());
    const incomingFileChunksRef = useRef(new Map());

    //message queue
    const [queuedEncryptedMessages, setQueuedEncryptedMessages] = useState([]);

    // Timer state for showing code validity countdown
    const [codeValidityTime, setCodeValidityTime] = useState(0);
    const [isCodeActive, setIsCodeActive] = useState(false);
    const validityTimerRef = useRef(null);

    // WebRTC refs
    const peerConnectionRef = useRef(null);
    const dataChannelRef = useRef(null);
    const iceCandidatesQueueRef = useRef([]);

    // ===================================================================
    // Helper Functions
    // ===================================================================
    // Format code validity time for display
    const formatValidityTime = (seconds) => {
        if (seconds <= 0) return "00:00";
        
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Start code validity countdown timer
    const startCodeValidityTimer = () => {
        console.log("▶️ Starting code validity timer");
        setCodeValidityTime(60); // 60 seconds validity
        setIsCodeActive(true);
        
        if (validityTimerRef.current) {
            clearInterval(validityTimerRef.current);
        }
        
        validityTimerRef.current = setInterval(() => {
            setCodeValidityTime(prev => {
                if (prev <= 1) {
                    console.log("⏰ Code validity timer expired");
                    setIsCodeActive(false);
                    clearInterval(validityTimerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    // Stop code validity timer
    const stopCodeValidityTimer = () => {
        console.log("🛑 Stopping code validity timer, isCodeActive:", isCodeActive);
        if (validityTimerRef.current) {
            clearInterval(validityTimerRef.current);
            validityTimerRef.current = null;
            console.log("🛑 Timer interval cleared");
        }
        setCodeValidityTime(0);
        setIsCodeActive(false);
        console.log("🛑 Timer state reset: isCodeActive=false, codeValidityTime=0");
    };

    // ===================================================================
    // 2. All useCallback hooks SECOND
    // ===================================================================
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
            // This function now only handles TEXT messages.
            // File messages are handled directly in the data channel's onmessage.
            if (encryptedData.type !== 'text') {
                return;
            }
            
            const { content, iv } = encryptedData;
            const ciphertext = new Uint8Array(content).buffer;
            const ivArr = new Uint8Array(iv);

            const decryptedBuffer = await decryptMessage(secret, ciphertext, ivArr);
            const decryptedText = new TextDecoder().decode(decryptedBuffer);

            // Play notification sound when message is received
            notificationSoundRef.current.play().catch(err => {
                console.warn('Could not play notification sound:', err);
            });
            
            // If the page is hidden, increment the unread message count
            if (document.hidden) {
                setUnreadMessages(prev => prev + 1);
            }

            setChatMessages(prev => [...prev, { 
                sender: 'peer',
                content: decryptedText, 
                type: 'text',
                timestamp: new Date()            
            }]);

            zeroFill(ciphertext);
            zeroFill(ivArr.buffer);
        } catch (error) {
            console.error('Error decrypting message:', error);
            setStatusMessage('Failed to decrypt message: ' + error.message);
        }
    }, []); // No dependencies needed anymore

    const decryptAndDisplayMessage = useCallback(async (message, secret) => {
        await handleReceivedMessage(message, secret);
    }, [handleReceivedMessage]);

    // Callback to bind data channel events
    const bindDataChannelEvents = useCallback((dataChannel) => {
        dataChannel.onopen = () => {
            console.log('✅ WebRTC Data Channel OPEN!');
            setConnectionStatus('Secure WebRTC Channel Active');
            setStatusMessage('You are now directly connected peer-to-peer! Messaging is direct.');
            
            // Stop the code validity timer since P2P connection is now established
            stopCodeValidityTimer();
        };
       
        dataChannel.onmessage = async (event) => {
            try {
                const parsedData = JSON.parse(event.data);
                const secret = sharedSecretRef.current;

                if (!secret) {
                    console.warn("❌ No shared secret yet, queuing...");
                    setQueuedEncryptedMessages(prev => [...prev, parsedData]);
                    return;
                }

                switch (parsedData.type) {
                    case 'text':
                        console.log("📩 Received text message via data channel");
                        
                        // Play notification sound
                        notificationSoundRef.current.play().catch(err => {
                            console.warn('Could not play notification sound:', err);
                        });
                        
                        // If the page is hidden, increment the unread message count
                        if (document.hidden) {
                            setUnreadMessages(prev => prev + 1);
                        }
                        
                        await handleReceivedMessage(parsedData, secret);
                        break;

                    case 'file_meta':
                        console.log(`📂 Received metadata for file: ${parsedData.fileId}`);
                        // Use the ref directly. This is a synchronous update.
                        incomingFileChunksRef.current.set(parsedData.fileId, {
                            metadata: parsedData.fileMetadata,
                            totalChunks: parsedData.totalChunks,
                            chunks: []
                        });
                        setStatusMessage(`Receiving ephemeral file: ${parsedData.fileMetadata.name}...`);
                        setTransferringFile(true);
                        break;

                    case 'file_chunk':
                        // Read from the ref to get the most current data.
                        const transfer = incomingFileChunksRef.current.get(parsedData.fileId);
                        if (!transfer) {
                            console.warn(`Received chunk for unknown fileId: ${parsedData.fileId}`);
                            return;
                        }

                        transfer.chunks[parsedData.chunkIndex] = parsedData;
                        const receivedChunks = transfer.chunks.filter(c => c).length;
                        setStatusMessage(`Receiving file... ${Math.round((receivedChunks / transfer.totalChunks) * 100)}%`);

                        if (receivedChunks === transfer.totalChunks) {
                            console.log(`✅ All ${transfer.totalChunks} chunks received for ${transfer.metadata.name}. Assembling...`);
                            
                            const decryptedChunks = [];
                            for (let i = 0; i < transfer.totalChunks; i++) {
                                const chunkData = transfer.chunks[i];
                                const ciphertext = new Uint8Array(chunkData.content).buffer;
                                const ivArr = new Uint8Array(chunkData.iv);
                                const decryptedBuffer = await decryptMessage(secret, ciphertext, ivArr);
                                decryptedChunks.push(new Blob([decryptedBuffer]));
                            }

                            const fileBlob = new Blob(decryptedChunks, { type: transfer.metadata.mimeType });
                            const fileURL = URL.createObjectURL(fileBlob);

                            setCurrentFileDisplay({
                                url: fileURL,
                                name: transfer.metadata.name,
                                type: transfer.metadata.mimeType,
                                size: transfer.metadata.size,
                                duration: transfer.metadata.duration
                            });

                            if (fileTimerRef.current) clearTimeout(fileTimerRef.current);
                            fileTimerRef.current = setTimeout(() => {
                                clearFileDisplay();
                                setStatusMessage('Ephemeral file display expired and cleared.');
                            }, transfer.metadata.duration * 1000);
                            
                            // Clean up the completed transfer from the ref
                            incomingFileChunksRef.current.delete(parsedData.fileId);
                            setTransferringFile(false);
                        }
                        break;

                    case 'typing_start':
                        setIsPeerTyping(true);
                        break;

                    case 'typing_stop':
                        setIsPeerTyping(false);
                        break;
                    
                    default:
                        console.warn(`Unknown message type received on data channel: ${parsedData.type}`);
                }
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
    }, [handleReceivedMessage, clearFileDisplay]);

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
    
    // --- THIS IS THE CRITICAL PART: DEFINE resetSession HERE ---
    const resetSession = useCallback((message) => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (dataChannelRef.current) {
            dataChannelRef.current.close();
            dataChannelRef.current = null;
        }
        setSharedSecret(null);
        sharedSecretRef.current = null;
        setPeerPublicKey(null);
        setAuthenticationString('');
        setIsVerified(false);
        setChatMessages([]);
        setPeerConnectionCode('');
        peerConnectionCodeRef.current = '';
        setCurrentFileDisplay(null);
        setFileToShare(null);
        setIsPeerTyping(false);
        setConnectionStatus('Disconnected');
        setStatusMessage(message || 'Session terminated. Please refresh to start a new session.');
        
        // Stop the validity timer
        stopCodeValidityTimer();
    }, []); // Empty dependency array is correct here.

    // ===================================================================
    // 3. All useEffect hooks THIRD
    // ===================================================================
    // Cleanup validity timer on unmount
    useEffect(() => {
        return () => {
            if (validityTimerRef.current) {
                clearInterval(validityTimerRef.current);
            }
        };
    }, []);

    // Stop timer when shared secret is established
    useEffect(() => {
        if (sharedSecret) {
            console.log("🔐 Shared secret established, stopping code validity timer");
            stopCodeValidityTimer();
        }
    }, [sharedSecret]);

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
        const wsUrl = process.env.NODE_ENV === 'production'
        ? `wss://${window.location.host}` // Use secure 'wss' for production
        : 'ws://localhost:8080';       // Keep 'ws' for local development

        const socket = new WebSocket(wsUrl);

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
            
            // Register our code with the server
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'register_code', code: code }));
            }
            setStatusMessage(`Your ephemeral code is: ${code}. Share it with your peer.`);

            // Start the validity countdown timer
            startCodeValidityTimer();

            // Set a timer for the code to expire (on client-side)
            setTimeout(() => {
                setMyConnectionCode(currentCode => {
                    if (currentCode === code) { // Only expire if it's still the active code
                        setStatusMessage('Connection code expired. Generate a new one to invite a peer.');
                        stopCodeValidityTimer(); // Stop the countdown timer
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
                    // Stop the code validity timer immediately since someone is connecting
                    stopCodeValidityTimer();
                    
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
                        const sas = await generateShortAuthString(ss);
                        setAuthenticationString(sas);

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
                    // Stop the code validity timer immediately since we got a response
                    stopCodeValidityTimer();
                    
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
                       
                        const sas = await generateShortAuthString(ss);
                        setAuthenticationString(sas);


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
                
                case 'pong':
                    // Pong received, so the connection is alive. Clear the timeout.
                    console.log("Pong received.");
                    clearTimeout(pongTimeoutRef.current);
                    break;    

                case 'terminate_session':
                    console.log('Peer has terminated the session.');
                    resetSession('Your peer has terminated the session.');
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
    }, [handleReceivedMessage, setupWebRTC, handleWebRTCSignaling, decryptAndDisplayMessage, sharedSecret, resetSession]); // Added resetSession to dependencies

    // WebRTC retry useEffect
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
    }, [sharedSecret, setupWebRTC]);

    //Ping/Pong Intervals
    useEffect(() => {
        if (!ws) return;

        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                console.log("Sending ping...");
                ws.send(JSON.stringify({ type: 'ping' }));

                // Start a timer. If we don't get a pong back in 5s, the connection is dead.
                // We clear any previous timer before setting a new one.
                clearTimeout(pongTimeoutRef.current); 
                pongTimeoutRef.current = setTimeout(() => {
                    console.error("Pong timeout! Connection is likely dead.");
                    // We call resetSession to clean up the UI and state.
                    resetSession("Connection to server lost (ping timeout). Please refresh.");
                }, 5000); // 5-second timeout for the pong
            }
        }, 30000); // Send a ping every 30 seconds

        // Cleanup function when the component unmounts or ws changes
        return () => {
            clearInterval(pingInterval);
            clearTimeout(pongTimeoutRef.current);
        };
    }, [ws, resetSession]); // Dependencies on ws and resetSession

    //Chatbox Auto Scrolling
    useEffect(() => {
        // This effect runs whenever a new message is added to the chat
        if (messageListRef.current) {
            // The 'current' property of the ref points to the DOM element
            const messageList = messageListRef.current;
            
            // We set its scrollTop to its scrollHeight, which scrolls it to the bottom
            messageList.scrollTop = messageList.scrollHeight;
        }
    }, [chatMessages]); // The dependency array ensures this runs only when chatMessages changes

    // Tab title notification for unread messages
    useEffect(() => {
        // Function to handle visibility change
        const handleVisibilityChange = () => {
            // When the user returns to the tab, clear the unread count and reset the title
            if (!document.hidden) {
                setUnreadMessages(0);
                document.title = 'NYX Messenger';
            }
        };

        // If there are unread messages, update the title
        if (unreadMessages > 0) {
            document.title = `(${unreadMessages}) NYX Messenger`;
        } else {
            document.title = 'NYX Messenger';
        }

        // Add event listener for when the user switches back to the tab
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup function to remove the listener
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [unreadMessages]); // This effect runs whenever the unreadMessages count changes

    // ===================================================================
    // 4. All other regular functions (handlers, etc.) FOURTH
    // ===================================================================
    
    // --- Connection Code Generation & Handling ---
    const generateMyCodeAndSend = async () => {
        if (!sessionKeyPair) {
            setStatusMessage('Generating keys... please wait.');
            return;
        }
        const code = generateRandomCode(8); // 8-char alphanumeric
        setMyConnectionCode(code);
        myConnectionCodeRef.current = code; // Update ref

        setStatusMessage(`Share your one-time code below. It is valid for 60 seconds.`);
        
        // Start the validity countdown timer
        startCodeValidityTimer();
        
        // Register our code with the server
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'register_code', code: code }));
        }

        // Set a timer for the code to expire (on client-side, server will also handle it if not used)
        setTimeout(() => {
            setMyConnectionCode(currentCode => {
                if (currentCode === code) { // Only expire if it's still the active code
                    setStatusMessage('Connection code expired. Generate a new one to invite a peer.');
                    stopCodeValidityTimer(); // Stop the countdown timer
                    return '';
                }
                return currentCode;
            });
        }, 60 * 1000); // 60 seconds validity
    };

    const connectToPeer = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        // Stop the code validity timer immediately when user attempts to connect
        stopCodeValidityTimer();

        const peerCode = inputConnectionCode;

        try {
            console.log("🔹 connectToPeer triggered");

            if (!ws || ws.readyState !== WebSocket.OPEN) {
                setStatusMessage('Not connected to signaling server.');
                stopCodeValidityTimer(); // Stop timer even on error
                return;
            }
            if (!peerCode) {
                setStatusMessage('Please enter a peer code.');
                stopCodeValidityTimer(); // Stop timer even on error
                return;
            }
            if (!sessionKeyPair) {
                setStatusMessage('Generating keys... please wait.');
                stopCodeValidityTimer(); // Stop timer even on error
                return;
            }

            setPeerConnectionCode(peerCode);
            peerConnectionCodeRef.current = peerCode;
            console.log(`[connectToPeer] Setting peerConnectionCode to: ${peerCode}`);
            console.log(`[connectToPeer] myConnectionCode is: ${myConnectionCode}`);

            const ourPublicKeyJwk = await exportPublicKey(sessionKeyPair.publicKey);
            console.log("Exported JWK (sender):", ourPublicKeyJwk);

            ws.send(JSON.stringify({
                type: 'session_offer',
                toCode: peerCode,
                fromCode: myConnectionCodeRef.current,
                publicKeyJwk: ourPublicKeyJwk
            }));
            console.log(`[connectToPeer] Sent session_offer`);

            setStatusMessage(`Sending connection offer to peer with code: ${peerCode}`);
        } catch (err) {
            console.error("❌ connectToPeer error:", err);
            setStatusMessage('Error connecting to peer: ' + err.message);
            stopCodeValidityTimer(); // Stop timer even on error
        }
    };

    // --- Typing Indicator Functions ---
    const handleTyping = () => {
        // Don't send typing events if the channel isn't open
        if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
            return;
        }

        // Send a 'start' event immediately
        dataChannelRef.current.send(JSON.stringify({ type: 'typing_start' }));

        // Clear any existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set a new timeout. If the user doesn't type again for 2 seconds,
        // we'll send a 'stop' event.
        typingTimeoutRef.current = setTimeout(() => {
            if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
                dataChannelRef.current.send(JSON.stringify({ type: 'typing_stop' }));
            }
        }, 2000); // 2 seconds
    };

    // --- Messaging Functions ---
    const sendTextMessage = async () => {
        if (!sharedSecret) {
            setStatusMessage('Secure session not established. Cannot send messages.');
            return;
        }
        if (!messageInput.trim()) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
        if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
            dataChannelRef.current.send(JSON.stringify({ type: 'typing_stop' }));
        }

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
                // Add message to chat with timestamp
                setChatMessages(prev => [...prev, {
                    sender: 'me',
                    content: messageInput,
                    type: 'text',
                    relayed: false, // Sent P2P, not relayed
                    timestamp: new Date()
                }]);
            } else if (ws && ws.readyState === WebSocket.OPEN) {
                // Fallback to signaling server
                ws.send(JSON.stringify({
                    type: 'encrypted_message',
                    toCode: peerConnectionCodeRef.current,
                    message: messageData
                }));
                // Add message to chat with timestamp AND relayed flag
                setChatMessages(prev => [...prev, {
                    sender: 'me',
                    content: messageInput,
                    type: 'text',
                    relayed: true, // Sent via server, was relayed
                    timestamp: new Date()
                }]);
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
            setStatusMessage('No file selected or secure session not established.');
            return;
        }
        if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
            setStatusMessage('WebRTC data channel not open. Please wait for peer connection.');
            return;
        }
        
        setStatusMessage('Preparing to send file...');
        setTransferringFile(true);

        const CHUNK_SIZE = 64 * 1024; // 64 KB chunks
        const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const totalChunks = Math.ceil(fileToShare.size / CHUNK_SIZE);
        
        console.log(`Preparing to send ${fileToShare.name} (${fileToShare.size} bytes) in ${totalChunks} chunks.`);

        try {
            // Step 1: Send metadata message first
            const metadataMessage = {
                type: 'file_meta',
                fileId: fileId,
                totalChunks: totalChunks,
                fileMetadata: {
                    name: fileToShare.name,
                    mimeType: fileToShare.type,
                    size: fileToShare.size,
                    duration: viewDuration
                }
            };
            dataChannelRef.current.send(JSON.stringify(metadataMessage));
            console.log("Sent file metadata:", metadataMessage);

            // Step 2: Read and send each chunk
            let offset = 0;
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                // Use a promise to handle FileReader's async nature within the loop
                await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    const slice = fileToShare.slice(offset, offset + CHUNK_SIZE);
                    
                    reader.onload = async (event) => {
                        try {
                            const fileBuffer = event.target.result;
                            const { ciphertext, iv } = await encryptMessage(sharedSecret, fileBuffer);

                            const chunkMessage = {
                                type: 'file_chunk',
                                fileId: fileId,
                                chunkIndex: chunkIndex,
                                content: Array.from(new Uint8Array(ciphertext)),
                                iv: Array.from(iv)
                            };

                            // IMPORTANT: Wait for the buffer to clear before sending the next chunk
                            // to avoid overwhelming the receiver.
                            if (dataChannelRef.current.bufferedAmount > dataChannelRef.current.bufferedAmountLowThreshold) {
                                await new Promise(res => {
                                    dataChannelRef.current.onbufferedamountlow = () => res();
                                });
                            }

                            dataChannelRef.current.send(JSON.stringify(chunkMessage));
                            
                            // Clean up memory
                            zeroFill(fileBuffer);
                            zeroFill(new Uint8Array(ciphertext).buffer);
                            zeroFill(iv.buffer);

                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    };
                    
                    reader.onerror = (err) => reject(err);
                    reader.readAsArrayBuffer(slice);
                });
                
                offset += CHUNK_SIZE;
                setStatusMessage(`Sending file... ${Math.round((offset / fileToShare.size) * 100)}%`);
            }

            console.log(`✅ All ${totalChunks} chunks for ${fileId} have been sent.`);
            setStatusMessage('File sent successfully!');
            setFileToShare(null); // Clear selection

        } catch (error) {
            console.error('❌ Error sending file chunks:', error);
            setStatusMessage('Failed to send file: ' + error.message);
        } finally {
            setTransferringFile(false);
        }
    };

    const handleVerificationSuccess = () => {
        setIsVerified(true);
        setStatusMessage('Connection verified! Chat enabled.');
        
        // Stop the code validity timer since connection is now verified and active
        stopCodeValidityTimer();
    };

    const handleVerificationFail = () => {
        // This is a critical failure. Terminate the connection completely.
        if (ws) {
            ws.close();
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }
        // Reset all sensitive state
        setSharedSecret(null);
        sharedSecretRef.current = null;
        setPeerPublicKey(null);
        setAuthenticationString('');
        setIsVerified(false);
        setChatMessages([]);
        setPeerConnectionCode('');
        peerConnectionCodeRef.current = '';
        setConnectionStatus('Verification Failed - Connection Terminated');
        setStatusMessage('The security codes did not match. The connection has been closed to protect your privacy. Please refresh and try again.');
    };

    const handleTerminateSession = () => {
        console.log("Terminating session...");
    
        // Send a notification to the peer, if connected
        if (ws && ws.readyState === WebSocket.OPEN && peerConnectionCodeRef.current) {
            ws.send(JSON.stringify({
                type: 'terminate_session',
                toCode: peerConnectionCodeRef.current,
                fromCode: myConnectionCodeRef.current
            }));
        }
    
        // Clean up our own session immediately
        resetSession('You have terminated the session.');
    };

    // ===================================================================
    // 5. The final return statement LAST
    // ===================================================================
    return (
        <div className="App">
            <div className="animated-background">
                <div className="circuit-lines"></div>
                <div className="floating-particles"></div>
                <div className="grid-overlay"></div>
            </div>
            
            <motion.header 
                className="App-header"
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            >
                <motion.h1
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                >
                    NYX Messenger
                </motion.h1>
                
                <motion.div 
                    className="status-info"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                >
                    <p>
                        {connectionStatus === 'Connected to Signaling Server' && <FiWifi />}
                        {connectionStatus === 'Disconnected' && <FiWifiOff />}
                        {connectionStatus.includes('Secure') && <FiShield />}
                        {' '}Status: {connectionStatus}
                    </p>
                    <p>{statusMessage}</p>
                    {isCodeActive && (
                        <motion.p 
                            className={`validity-timer ${codeValidityTime <= 10 ? 'timer-warning' : ''}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.6 }}
                        >
                            ⏱️ Code Valid: {formatValidityTime(codeValidityTime)}
                        </motion.p>
                    )}
                </motion.div>

                <AnimatePresence mode="wait">
                    {!sharedSecret && (
                        <ConnectionManager
                            sessionKeyPair={sessionKeyPair}
                            myConnectionCode={myConnectionCode}
                            isCodeActive={isCodeActive}
                            formatValidityTime={formatValidityTime}
                            codeValidityTime={codeValidityTime}
                            generateMyCodeAndSend={generateMyCodeAndSend}
                            copySuccess={copySuccess}
                            setCopySuccess={setCopySuccess}
                            inputConnectionCode={inputConnectionCode}
                            setInputConnectionCode={setInputConnectionCode}
                            connectToPeer={connectToPeer}
                        />
                    )}

                    {sharedSecret && (
                        <motion.div
                            key="secured"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5 }}
                        >
                            <AnimatePresence mode="wait">
                                {!isVerified ? (
                                    <VerificationPrompt
                                        authenticationString={authenticationString}
                                        handleVerificationSuccess={handleVerificationSuccess}
                                        handleVerificationFail={handleVerificationFail}
                                    />
                                ) : (
                                    <ChatInterface
                                        handleTerminateSession={handleTerminateSession}
                                        messageListRef={messageListRef}
                                        chatMessages={chatMessages}
                                        isPeerTyping={isPeerTyping}
                                        messageInput={messageInput}
                                        setMessageInput={setMessageInput}
                                        handleTyping={handleTyping}
                                        sendTextMessage={sendTextMessage}
                                        sharedSecret={sharedSecret}
                                        dataChannelRef={dataChannelRef}
                                        ws={ws}
                                        handleFileChange={handleFileChange}
                                        viewDuration={viewDuration}
                                        setViewDuration={setViewDuration}
                                        sendFile={sendFile}
                                        fileToShare={fileToShare}
                                        transferringFile={transferringFile}
                                        currentFileDisplay={currentFileDisplay}
                                        clearFileDisplay={clearFileDisplay}
                                    />
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.header>
        </div>
    );
}

export default App;