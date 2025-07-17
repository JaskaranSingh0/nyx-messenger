// frontend/src/QrScanner.js
import React, { useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QrScanner = ({ onScanSuccess, onClose }) => {
  useEffect(() => {
    // This function will get called when the component mounts
    const html5QrCode = new Html5Qrcode("qr-reader"); // The div ID to render the camera in

    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        // This is the most important log. If you see this, the scanner WORKED.
        console.log("--- SCANNER SUCCESS ---", decodedText);
        
        // An alert is a great way to be 100% sure this function was called.
        alert(`QR Code Scanned!\nSee console for details.`);

        // Stop the scanner to prevent multiple scans
        html5QrCode.stop(); 

        // Now, call the original function from App.js
        onScanSuccess(decodedText);
    }


    const config = { 
        fps: 10, // Frames per second to scan
        qrbox: { width: 250, height: 250 }, // A visible box to guide the user
        verbose: true
    };

    // Start the scanner
    // The 'environment' facingMode will try to use the back camera on mobile
    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
      .catch(err => {
        console.error("Unable to start QR scanner", err);
        // Fallback for devices that don't have a back camera
        html5QrCode.start({ facingMode: "user" }, config, qrCodeSuccessCallback)
            .catch(errUser => {
                console.error("Unable to start any camera", errUser);
                alert("Could not start QR scanner. Please check camera permissions.");
                onClose();
            });
      });

    // This is the cleanup function that will be called when the component unmounts
    return () => {
      console.log("QR Scanner component unmounting - running cleanup...");
      // Check if html5QrCode is still running before trying to stop it
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(ignore => {
          console.log("QR Code scanning stopped successfully.");
        }).catch(err => {
          console.error("Failed to stop QR scanner cleanly.", err);
        });
      } else {
        console.log("QR Scanner cleanup: scanner was not running or already stopped.");
      }
    };
  }, [onScanSuccess, onClose]);

  // Basic styling for the scanner overlay
  const scannerStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  return (
    <div style={scannerStyle}>
      <div id="qr-reader" style={{ width: '300px' }}></div>
      <button 
        onClick={onClose} 
        style={{ marginTop: '20px', padding: '10px 15px', fontSize: '1rem' }}
      >
        Cancel
      </button>
    </div>
  );
};

export default QrScanner;