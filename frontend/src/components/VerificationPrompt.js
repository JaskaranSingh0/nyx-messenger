import React from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiX } from 'react-icons/fi';

const VerificationPrompt = ({
    authenticationString,
    handleVerificationSuccess,
    handleVerificationFail
}) => {
    return (
        <motion.div 
            className="connection-section verification-section"
            key="verification"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5 }}
        >
            <h2>Verify Your Connection</h2>
            <p>To ensure your connection is secure and not intercepted, verbally confirm with your peer that you both see the same two words below.</p>
            
            <motion.div 
                className="verification-code"
                initial={{ opacity: 0, rotateY: 90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
            >
                <h3>{authenticationString}</h3>
            </motion.div>
            
            <p>Do the words match?</p>
            <div className="verification-buttons">
                <motion.button 
                    onClick={handleVerificationSuccess}
                    className="success-button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <FiCheck /> Yes, We Match
                </motion.button>
                <motion.button 
                    onClick={handleVerificationFail}
                    className="danger-button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <FiX /> No, It's Different
                </motion.button>
            </div>
        </motion.div>
    );
};

export default VerificationPrompt;
