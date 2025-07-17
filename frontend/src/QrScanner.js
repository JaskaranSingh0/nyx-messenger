// frontend/src/QrScanner.js
import React, { useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QrScanner = ({ onScanSuccess, onClose }) => {
  useEffect(() => {
    // This function will get called when the component mounts
    const html5QrCode = new Html5Qrcode("qr-reader"); // The div ID to render the camera in

    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        // The QR code was successfully scanned
        onScanSuccess(decodedText);
        // We can stop the scanner here, which will be handled by the unmount cleanup
    };

    const config = { 
        fps: 10, // Frames per second to scan
        qrbox: { width: 250, height: 250 } // A visible box to guide the user
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
      html5QrCode.stop().then(ignore => {
        console.log("QR Code scanning stopped.");
      }).catch(err => {
        console.error("Failed to stop QR scanner.", err);
      });
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