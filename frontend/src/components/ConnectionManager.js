import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCopy } from 'react-icons/fi';

const ConnectionManager = ({
    sessionKeyPair,
    myConnectionCode,
    isCodeActive,
    formatValidityTime,
    codeValidityTime,
    generateMyCodeAndSend,
    copySuccess,
    setCopySuccess,
    inputConnectionCode,
    setInputConnectionCode,
    connectToPeer
}) => {
    return (
        <motion.div 
            className="connection-section"
            key="connection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
        >
            <h2>Start Secure Session</h2>
            
            <AnimatePresence>
                {sessionKeyPair && !myConnectionCode && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.3 }}
                    >
                        <motion.button 
                            onClick={generateMyCodeAndSend}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            Generate Your One-Time Code
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {myConnectionCode && (
                    <motion.div 
                        className="code-display"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div>
                            Your Code: <code>{myConnectionCode}</code>
                            <motion.button
                                className="copy-button"
                                onClick={() => {
                                    navigator.clipboard.writeText(myConnectionCode);
                                    setCopySuccess('Copied!');
                                    setTimeout(() => setCopySuccess(''), 2000);
                                }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <FiCopy /> {copySuccess || 'Copy'}
                            </motion.button>
                        </div>
                        <p>Share this code with your peer.</p>
                    </motion.div>
                )}
            </AnimatePresence>
            
            <motion.div 
                className="margin-top"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
            >
                <input
                    type="text"
                    value={inputConnectionCode}
                    onChange={e => setInputConnectionCode(e.target.value)}
                    placeholder="Enter peer's code to connect"
                    inputMode="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck="false"
                    maxLength="8"
                />
                <motion.button 
                    type="button" 
                    onClick={connectToPeer}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    Connect to Peer
                </motion.button>
            </motion.div>
        </motion.div>
    );
};

export default ConnectionManager;
