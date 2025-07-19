# 🌐 NYX Messenger

A secure, end-to-end encrypted messenger with peer-to-peer communication, featuring ephemeral messaging and a cyberpunk-inspired interface. NYX Messenger

A secure, end-to-end encrypted messenger with peer-to-peer communication, featuring ephemeral messaging and a cyberpunk-inspired interface.

**🔗 Live Demo:** [https://nyx-messenger.onrender.com/](https://nyx-messenger.onrender.com/)

## 🌟 Features

### 🔒 Security & Privacy
- **End-to-End Encryption**: ECDH P-256 key exchange with AES-256-GCM encryption
- **Ephemeral Messaging**: Messages disappear after being read (view-once functionality)
- **Short Authentication String (SAS)**: Verify connection integrity with cryptographic hashes
- **No Data Persistence**: Messages are never stored on servers
- **Peer-to-Peer Communication**: Direct WebRTC connections bypass central servers

### 💬 Messaging Features
- **Real-time Communication**: Instant message delivery via WebRTC data channels
- **File Sharing**: Send files with ephemeral view-once functionality
- **Typing Indicators**: See when your peer is typing
- **Connection Status**: Real-time connection state monitoring
- **Auto-reconnection**: Automatic reconnection handling with backoff strategy

### 🎨 User Experience
- **Cyberpunk Theme**: Futuristic dark interface with neon accents
- **Smooth Animations**: Powered by Framer Motion for fluid interactions
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Code Validity Timer**: 60-second countdown timer for connection codes
- **Visual Feedback**: Comprehensive status indicators and notifications

## 🏗️ Architecture

```
NYX Messenger
├── 🎨 Frontend (React 18.2.0)
│   ├── WebRTC Peer Connections
│   ├── Crypto API Integration
│   ├── Real-time UI Updates
│   └── Cyberpunk Interface
├── 🔧 Backend (Node.js + Express)
│   ├── WebSocket Signaling Server
│   ├── Session Management
│   └── Peer Discovery
└── 🔐 Security Layer
    ├── ECDH Key Exchange
    ├── AES-256-GCM Encryption
    └── SAS Verification
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- Modern web browser with WebRTC support

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/JaskaranSingh0/nyx-messenger.git
   cd nyx-messenger
   ```

2. **Install dependencies**
   ```bash
   # Install all dependencies (frontend + backend)
   npm run build
   ```

3. **Start the application**
   ```bash
   # Start the backend server
   npm start
   ```

4. **Access the application**
   - Open your browser to `http://localhost:8080`
   - The frontend will automatically connect to the backend

### Development Mode

For development with hot reloading:

```bash
# Terminal 1 - Start backend
cd backend
npm run dev

# Terminal 2 - Start frontend
cd frontend
npm start
```

## 📖 How to Use

### Starting a Session
1. Click **"Generate Code"** to create a 6-digit connection code
2. Share this code with your peer (valid for 60 seconds)
3. Wait for your peer to connect using the code

### Joining a Session
1. Click **"Enter Code"** 
2. Input the 6-digit code shared by your peer
3. Wait for the connection to establish

### Secure Communication
1. **Verify Connection**: Both peers will see a Short Authentication String (SAS)
2. **Compare SAS**: Verbally confirm the SAS matches on both devices
3. **Start Messaging**: Once verified, send messages and files securely

### Message Features
- Type and send messages that disappear after being read
- Share files with ephemeral viewing
- See typing indicators in real-time
- Monitor connection status

## 🔧 Technical Details

### Frontend Stack
- **React 18.2.0**: Modern React with hooks and concurrent features
- **Framer Motion**: Smooth animations and transitions
- **Web Crypto API**: Browser-native cryptographic operations
- **WebRTC**: Direct peer-to-peer communication
- **React Icons**: Comprehensive icon library

### Backend Stack
- **Node.js + Express**: Lightweight server framework
- **WebSocket (ws)**: Real-time bidirectional communication
- **dotenv**: Environment variable management

### Cryptographic Implementation
- **Key Exchange**: ECDH P-256 for secure key establishment
- **Encryption**: AES-256-GCM for message encryption
- **Authentication**: HMAC-based message authentication
- **Verification**: SHA-256 based SAS generation

### WebRTC Features
- **Data Channels**: Reliable ordered message delivery
- **ICE Candidates**: NAT traversal for peer connections
- **Connection Management**: Automatic reconnection and error handling

## 🔐 Security Considerations

### What NYX Messenger Protects Against
- **Man-in-the-Middle Attacks**: ECDH key exchange with SAS verification
- **Message Interception**: End-to-end AES-256-GCM encryption
- **Data Persistence**: Ephemeral messaging with no server storage
- **Connection Tampering**: Cryptographic integrity verification

### Security Best Practices
1. **Always verify the SAS** with your peer through a separate channel
2. **Use on trusted networks** when possible
3. **Keep browsers updated** for latest security patches
4. **Be aware of browser security** - avoid browser extensions that might intercept data

### Limitations
- Requires JavaScript and modern browser features
- Dependent on WebRTC support and network connectivity
- SAS verification requires out-of-band communication

## 🌍 Deployment

### Environment Variables
Create a `.env` file in the backend directory:
```env
PORT=8080
NODE_ENV=production
```

### Production Deployment
The application is deployed on Render.com with:
- Automatic builds from the main branch
- Environment-based configuration
- Static file serving for the React frontend

### Self-Hosting
1. Build the frontend: `npm run build --prefix frontend`
2. Configure environment variables
3. Start the server: `npm start`
4. Ensure WebSocket connections are supported by your hosting provider

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## ⚠️ Disclaimer

NYX Messenger is designed for secure communication but should not be used for sensitive information without proper security review. The application is provided as-is without warranty.

## 🔮 Future Enhancements

- [ ] Group messaging support
- [ ] Voice/video calling integration
- [ ] Mobile app development
- [ ] Advanced file encryption
- [ ] Custom themes and personalization
- [ ] Message threading and organization

---

**Built with ❤️ using React, WebRTC, and modern cryptography**

![NYX Messenger](https://img.shields.io/badge/Status-Active-brightgreen)
![Security](https://img.shields.io/badge/Security-E2E%20Encrypted-blue)
![WebRTC](https://img.shields.io/badge/P2P-WebRTC-orange)
![React](https://img.shields.io/badge/Frontend-React-61dafb)
![Node.js](https://img.shields.io/badge/Backend-Node.js-green)

## 🚀 Overview

NYX Messenger is a privacy-focused, real-time communication platform that prioritizes security and ephemeral messaging. Built with modern web technologies, it provides secure peer-to-peer communication through WebRTC with fallback server relay, ensuring your conversations remain private and temporary.

### ✨ Key Features

- **🔐 End-to-End Encryption**: ECDH key exchange with AES-256-GCM encryption
- **⏱️ Ephemeral Codes**: Time-limited connection codes (60-second validity)
- **🔗 Direct P2P Connection**: WebRTC-based peer-to-peer communication
- **📁 Temporary File Sharing**: Send files that auto-delete after viewing
- **🛡️ Security Verification**: Short Authentication String (SAS) verification
- **💬 Real-time Messaging**: Instant messaging with typing indicators
- **🌊 Responsive Design**: Beautiful cyberpunk-themed UI with animations
- **🔔 Notifications**: Audio alerts and unread message counts
- **📱 Cross-Platform**: Works on desktop and mobile browsers

## 🏗️ Architecture

```
┌─────────────────┐    WebSocket     ┌─────────────────┐
│   Frontend      │◄─────────────────►│    Backend      │
│   (React)       │                   │   (Node.js)     │
└─────────────────┘                   └─────────────────┘
         │                                     │
         │         WebRTC P2P Connection       │
         └─────────────────────────────────────┘
                    (Direct Connection)
```

### 🔧 Tech Stack

**Frontend:**
- React 18.2.0
- Framer Motion (animations)
- React Icons
- Web Crypto API
- WebRTC API

**Backend:**
- Node.js
- Express.js
- WebSocket (ws)
- dotenv

**Security:**
- ECDH P-256 key exchange
- AES-256-GCM encryption
- Cryptographically secure random codes

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm
- Modern web browser with WebRTC support
- HTTPS/WSS for production deployment

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/JaskaranSingh0/nyx-messenger.git
   cd nyx-messenger
   ```

2. **Install dependencies:**
   ```bash
   # Install root dependencies
   npm install
   
   # Install backend dependencies
   cd backend && npm install
   
   # Install frontend dependencies
   cd ../frontend && npm install
   ```

3. **Development Setup:**
   ```bash
   # Terminal 1: Start backend server
   cd backend
   npm run dev
   
   # Terminal 2: Start frontend development server
   cd frontend
   npm start
   ```

4. **Production Build:**
   ```bash
   # Build frontend for production
   npm run build
   
   # Start production server
   npm start
   ```

### 🌐 Deployment

The application serves the React build files from the backend server:

```bash
# Production deployment
npm run build  # Builds frontend and installs all dependencies
npm start      # Starts the production server on PORT (default: 8080)
```

## 🔐 Security Features

### Encryption Protocol

1. **Key Exchange**: ECDH P-256 curve for secure key agreement
2. **Symmetric Encryption**: AES-256-GCM for message encryption
3. **Authentication**: HMAC verification built into GCM mode
4. **Forward Secrecy**: New session keys for each connection

### Security Verification

NYX Messenger implements Short Authentication String (SAS) verification:
- Both users see the same two words
- Verbal confirmation prevents man-in-the-middle attacks
- Connection terminates if words don't match

### Privacy Features

- **Ephemeral Codes**: Connection codes expire after 60 seconds
- **No Message Storage**: Messages are never stored on servers
- **Memory Cleanup**: Sensitive data is zeroed after use
- **Direct P2P**: Messages bypass servers when WebRTC is active

## 📋 Usage Guide

### Starting a Secure Session

1. **Generate Your Code:**
   - Click "Generate Your One-Time Code"
   - Share the 8-character code with your peer
   - Code is valid for 60 seconds (countdown timer shows remaining time)

2. **Connect to Peer:**
   - Enter your peer's code in the input field
   - Click "Connect to Peer"
   - Wait for cryptographic handshake

3. **Verify Security:**
   - Both users will see the same two verification words
   - Verbally confirm the words match
   - Click "Yes, We Match" if they're identical
   - Click "No, It's Different" to terminate if they don't match

4. **Start Messaging:**
   - Send encrypted messages in real-time
   - See typing indicators when your peer is typing
   - Share temporary files that auto-delete

### File Sharing

1. **Select File**: Choose any file type
2. **Set Duration**: Pick viewing time (5 seconds to 5 minutes)
3. **Send**: File is encrypted and sent via WebRTC
4. **Auto-Delete**: File disappears after the set duration

### Connection States

- **🔴 Disconnected**: Not connected to signaling server
- **🟡 Connected to Signaling Server**: Ready to generate codes
- **🟢 Secure Session Active**: Encrypted connection established
- **🔵 Secure WebRTC Channel Active**: Direct P2P connection

## 🔧 Configuration

### Environment Variables

Create `.env` files in the backend directory:

```env
PORT=8080
NODE_ENV=production
```

### Network Configuration

For production deployment, ensure:
- HTTPS/WSS support for secure contexts
- STUN/TURN servers for NAT traversal
- Proper firewall configuration for WebRTC

## 🏗️ Project Structure

```
nyx-messenger/
├── README.md
├── package.json                 # Root package configuration
├── backend/
│   ├── src/
│   │   └── server.js           # WebSocket signaling server
│   ├── package.json            # Backend dependencies
│   └── .gitignore
├── frontend/
│   ├── src/
│   │   ├── App.js              # Main React component
│   │   ├── App.css             # Cyberpunk styling
│   │   ├── cryptoUtils.js      # Encryption utilities
│   │   ├── index.js            # React entry point
│   │   └── index.css           # Global styles
│   ├── public/
│   │   ├── index.html          # HTML template
│   │   ├── manifest.json       # PWA manifest
│   │   ├── doki.mp3            # Notification sound
│   │   └── [favicon files]     # App icons
│   ├── build/                  # Production build output
│   └── package.json            # Frontend dependencies
└── .gitignore                  # Git ignore rules
```

## 🔌 API Reference

### WebSocket Messages

#### Client → Server

```javascript
// Register connection code
{
  type: 'register_code',
  code: 'ABC12345'
}

// Send session offer
{
  type: 'session_offer',
  toCode: 'DEF67890',
  fromCode: 'ABC12345',
  publicKeyJwk: {...}
}

// WebRTC signaling
{
  type: 'webrtc_offer',
  sdp: {...},
  toCode: 'DEF67890',
  fromCode: 'ABC12345'
}
```

#### Server → Client

```javascript
// Registration confirmation
{
  type: 'registration_success',
  code: 'ABC12345'
}

// Session response
{
  type: 'session_answer',
  fromCode: 'DEF67890',
  publicKeyJwk: {...}
}

// Error handling
{
  type: 'error',
  message: 'Peer not found'
}
```

### Crypto API

```javascript
// Key generation
const keyPair = await generateSessionKeyPair();

// Derive shared secret
const secret = await deriveSharedSecret(privateKey, peerPublicKey);

// Encrypt message
const {ciphertext, iv} = await encryptMessage(secret, "Hello World");

// Decrypt message
const decrypted = await decryptMessage(secret, ciphertext, iv);
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] Code generation and expiry
- [ ] Peer connection establishment
- [ ] Message encryption/decryption
- [ ] File sharing and auto-deletion
- [ ] WebRTC P2P connection
- [ ] SAS verification
- [ ] Connection termination
- [ ] Error handling

### Browser Compatibility

- ✅ Chrome 88+
- ✅ Firefox 84+
- ✅ Safari 14+
- ✅ Edge 88+

## 🚨 Security Considerations

### Known Limitations

1. **Server Trust**: Initial signaling requires trusting the WebSocket server
2. **Browser Security**: Relies on browser's Web Crypto API implementation
3. **Network Monitoring**: Traffic analysis may reveal communication patterns
4. **Device Security**: Vulnerable to compromised devices

### Best Practices

1. **Verify Deployment**: Ensure HTTPS/WSS in production
2. **Code Sharing**: Use secure channels to share connection codes
3. **Regular Updates**: Keep dependencies updated for security patches
4. **Network Security**: Use VPN for additional privacy

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow ESLint configuration
- Maintain code comments for crypto operations
- Test security features thoroughly
- Update documentation for new features

## 📜 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Web Crypto API for browser-based encryption
- WebRTC for peer-to-peer communication
- Framer Motion for smooth animations
- The cryptography community for security best practices

## 📞 Support

For questions, issues, or contributions:
- Create an issue on GitHub
- Contact: [Your Contact Information]

---

⚠️ **Security Notice**: NYX Messenger is designed for privacy-conscious users but should not be considered bulletproof. Always verify the security of your deployment and use additional security measures for highly sensitive communications.

🌟 **Remember**: True security comes from understanding your tools. Review the code, verify the deployment, and use responsibly.
