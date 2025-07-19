import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiUpload, FiX } from 'react-icons/fi';

const ChatInterface = ({
    handleTerminateSession,
    messageListRef,
    chatMessages,
    isPeerTyping,
    messageInput,
    setMessageInput,
    handleTyping,
    sendTextMessage,
    sharedSecret,
    dataChannelRef,
    ws,
    handleFileChange,
    viewDuration,
    setViewDuration,
    sendFile,
    fileToShare,
    transferringFile,
    currentFileDisplay,
    clearFileDisplay
}) => {
    return (
        <motion.div 
            className="chat-section"
            key="chat"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Secure Chat (Verified)</h2>
                <motion.button  
                    type="button"
                    onClick={handleTerminateSession}
                    className="danger-button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <FiX /> Terminate Session
                </motion.button>
            </div>
            
            <div ref={messageListRef} className="message-list">
                <AnimatePresence>
                    {chatMessages.map((msg, index) => (
                        <motion.p 
                            key={index} 
                            className={msg.sender === 'me' ? 'my-message' : 'peer-message'}
                            initial={{ opacity: 0, x: msg.sender === 'me' ? 50 : -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: msg.sender === 'me' ? 50 : -50 }}
                            transition={{ duration: 0.3 }}
                        >
                            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>
                                    <strong>{msg.sender === 'me' ? 'You:' : 'Peer:'}</strong> {msg.content}
                                    {msg.relayed && <span title="Message sent via server relay (not P2P)"> ☁️</span>}
                                </span>
                                <span style={{ fontSize: '0.7em', color: '#999', paddingLeft: '15px' }}>
                                    {msg.timestamp && msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </span>
                        </motion.p>
                    ))}
                </AnimatePresence>
            </div>
            
            <div className="typing-indicator">
                <AnimatePresence>
                    {isPeerTyping && (
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            Peer is typing...
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
            
            <div className="message-input">
                <input
                    type="text"
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={handleTyping}
                    onKeyPress={e => { if (e.key === 'Enter') sendTextMessage(); }}
                    placeholder="Type your ephemeral message..."
                />
                <motion.button
                    onClick={sendTextMessage}
                    disabled={
                        !sharedSecret ||
                        (dataChannelRef.current?.readyState !== 'open' && ws?.readyState !== WebSocket.OPEN)
                    }
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <FiSend /> Send Message
                </motion.button>
            </div>

            <motion.div 
                className="file-sharing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
            >
                <h3>Ephemeral File Share</h3>
                <div className="file-controls">
                    <input type="file" onChange={handleFileChange} />
                    <select value={viewDuration} onChange={(e) => setViewDuration(parseInt(e.target.value))}>
                        <option value={5}>5 seconds</option>
                        <option value={10}>10 seconds</option>
                        <option value={30}>30 seconds</option>
                        <option value={60}>1 minute</option>
                        <option value={300}>5 minutes</option>
                    </select>
                    <motion.button
                        onClick={sendFile}
                        disabled={
                            !fileToShare ||
                            !dataChannelRef.current ||
                            dataChannelRef.current.readyState !== 'open' ||
                            transferringFile
                        }
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <FiUpload /> {transferringFile ? 'Sending...' : 'Send File (View Once)'}
                    </motion.button>
                </div>
                
                <AnimatePresence>
                    {fileToShare && (
                        <motion.div
                            className="file-info"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            <p>Selected: {fileToShare.name} ({fileToShare.size} bytes)</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {currentFileDisplay && (
                        <motion.div 
                            className="file-display"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.5 }}
                        >
                            <p>Ephemeral File (Viewing for {currentFileDisplay.duration}s)</p>
                            {currentFileDisplay.type.startsWith('image/') && (
                                <motion.img 
                                    src={currentFileDisplay.url} 
                                    alt={currentFileDisplay.name} 
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3 }}
                                />
                            )}
                            {currentFileDisplay.type.startsWith('video/') && (
                                <motion.video 
                                    src={currentFileDisplay.url} 
                                    controls 
                                    autoPlay 
                                    onEnded={clearFileDisplay}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3 }}
                                />
                            )}
                            <motion.button 
                                onClick={clearFileDisplay}
                                className="danger-button"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <FiX /> Clear Now
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>
                
                <AnimatePresence>
                    {transferringFile && !currentFileDisplay && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            <p>Processing file transfer...</p>
                            <div className="loading"></div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};

export default ChatInterface;
