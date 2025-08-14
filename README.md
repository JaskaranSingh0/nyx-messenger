# 🌐 NYX Messenger

> A secure, end-to-end encrypted messenger featuring peer-to-peer communication, ephemeral messaging, and a cyberpunk-inspired interface.

**🔗 Live Demo:** 


[![React](https://img.shields.io/badge/React-18.2.0-61dafb.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-339933.svg)](https://nodejs.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P-orange.svg)](https://webrtc.org/)
[![Security](https://img.shields.io/badge/Security-E2E%20Encrypted-green.svg)](https://github.com/JaskaranSingh0/nyx-messenger)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-green.svg)](https://web.dev/progressive-web-apps/)

## 📖 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Architecture](#️-architecture)
- [Usage Guide](#-usage-guide)
- [Security](#-security)
- [Development](#-development)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

## 🌟 Features

### 🔒 Security & Privacy
- **End-to-End Encryption** - ECDH P-256 key exchange with AES-256-GCM encryption
- **Ephemeral Messaging** - Messages disappear after being read (view-once functionality)
- **Short Authentication String (SAS)** - Cryptographic verification prevents MITM attacks
- **No Data Persistence** - Messages are never stored on servers
- **Memory Protection** - Secure key cleanup with zero-fill operations
- **Peer-to-Peer Communication** - Direct WebRTC connections bypass central servers

### 💬 Messaging
- **Real-time Communication** - Instant message delivery via WebRTC data channels
- **File Sharing** - Send files with ephemeral view-once functionality (up to 100MB)
- **Typing Indicators** - See when your peer is typing in real-time
- **Auto-reconnection** - Automatic reconnection handling with backoff strategy
- **Message Queuing** - Queued message delivery when connections are re-established
- **Audio Notifications** - Sound alerts for incoming messages
- **Server Relay Fallback** - Messages continue via server when P2P fails

### 🎨 User Experience
- **Cyberpunk Theme** - Futuristic dark interface with neon accents and smooth animations
- **Responsive Design** - Works seamlessly on desktop and mobile devices
- **Progressive Web App** - PWA support with offline capabilities
- **Code Validity Timer** - 60-second countdown timer for connection codes
- **Visual Feedback** - Comprehensive status indicators and notifications
- **Copy-to-Clipboard** - Easy code sharing with one-click copy functionality

### ⚙️ Technical Excellence
- **Modular Architecture** - Clean separation between container and presentational components
- **Modern React Patterns** - Hooks-based architecture with optimal performance
- **Production Monitoring** - Health checks and connection analytics
- **Enhanced Connectivity** - Multiple STUN/TURN servers for improved NAT traversal

## 🏗️ Architecture

NYX Messenger uses a modern, security-first architecture with clean component separation:

```
┌─────────────────────────────────────────────────────────────┐
│                     NYX Messenger                           │
├─────────────────────────────────────────────────────────────┤
│ 🎨 Frontend (React 18.2.0)                                 │
│   ├── App.js (Container Component)                         │
│   │   ├── State Management (useState/useRef hooks)         │
│   │   ├── WebSocket & WebRTC Logic                         │
│   │   ├── Encryption/Decryption (Web Crypto API)           │
│   │   └── Event Handlers & Business Logic                  │
│   ├── /components (Presentational)                         │
│   │   ├── ConnectionManager.js (Code Generation & UI)      │
│   │   ├── VerificationPrompt.js (SAS Security)             │
│   │   └── ChatInterface.js (Messaging & File Sharing)      │
│   └── cryptoUtils.js (ECDH P-256 & AES-256-GCM)           │
├─────────────────────────────────────────────────────────────┤
│ 🔧 Backend (Node.js + Express)                             │
│   ├── WebSocket Signaling Server                           │
│   ├── Session Management & Health Checks                   │
│   ├── Peer Discovery & Routing                             │
│   └── Static File Serving (React Build)                    │
├─────────────────────────────────────────────────────────────┤
│ 🔐 Security Layer                                          │
│   ├── ECDH P-256 Key Exchange                              │
│   ├── AES-256-GCM Encryption                               │
│   ├── SAS Verification                                     │
│   └── Memory Protection (Secure Cleanup)                   │
└─────────────────────────────────────────────────────────────┘
```

### 🔧 Technology Stack

**Frontend:**
- **React 18.2.0** - Modern React with hooks and concurrent features
- **Framer Motion 12.23.6** - Smooth animations and micro-interactions
- **React Icons 5.5.0** - Comprehensive icon library
- **Web Crypto API** - Browser-native cryptographic operations
- **WebRTC** - Direct peer-to-peer communication

**Backend:**
- **Node.js + Express 4.19.2** - Lightweight server framework
- **WebSocket (ws 8.17.0)** - Real-time bidirectional communication
- **dotenv 16.4.5** - Environment variable management

**Security:**
- **ECDH P-256** - Elliptic curve key exchange
- **AES-256-GCM** - Authenticated encryption
- **SHA-256** - Cryptographic hashing for SAS verification

## 🚀 Quick Start

### Prerequisites
- **Node.js 16+** and npm installed
- **Modern web browser** with WebRTC support (Chrome 88+, Firefox 84+, Safari 14+, Edge 88+)
- **HTTPS/WSS** support for production deployment

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/JaskaranSingh0/nyx-messenger.git
   cd nyx-messenger
   ```

2. **Install dependencies**
   ```bash
   # Install all dependencies (root, frontend, and backend)
   npm run build
   
   # OR install individually:
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. **Start the application**
   ```bash
   # Production mode - Start the backend server (serves built React app)
   npm start
   
   # Development mode - Start both servers
   # Terminal 1: Backend with auto-reload
   cd backend && npm run dev
   
   # Terminal 2: Frontend with hot reload  
   cd frontend && npm start
   ```

4. **Access the application**
   - **Production**: `http://localhost:8080` (backend serves React build)
   - **Development**: `http://localhost:3000` (React dev server) + `http://localhost:8080` (backend)
   - **Health check**: `http://localhost:8080/health`
   - **WebSocket status**: `http://localhost:8080/ws-status`

## 📋 Usage Guide

### Starting a Secure Session

1. **Generate Your Code**
   - Click **"Generate Your One-Time Code"** to create a secure 8-character connection code
   - Share this code with your peer (valid for 60 seconds with countdown timer)
   - Wait for your peer to connect using the code

2. **Connect to Peer**
   - Click **"Enter Peer's Code"**
   - Input the 8-character code shared by your peer
   - Wait for the cryptographic handshake to complete

3. **Verify Security**
   - Both peers will see a Short Authentication String (SAS) - two verification words
   - **Verbally confirm** the SAS matches on both devices (crucial for security!)
   - Click **"Yes, We Match"** if identical, or **"No, It's Different"** to terminate

4. **Start Messaging**
   - Send encrypted messages that are never stored on servers
   - Share files with customizable view duration (5 seconds to 5 minutes)
   - See real-time typing indicators and connection status

### Connection States
- 🔴 **Disconnected** - Not connected to signaling server
- 🟡 **Connected to Signaling Server** - Ready to generate codes
- 🟢 **Secure Session Active** - Encrypted connection established
- 🔵 **Secure WebRTC Channel Active** - Direct P2P connection

### File Sharing
1. **Select File** - Choose any file type (up to 100MB)
2. **Set Duration** - Pick viewing time (5 seconds to 5 minutes)
3. **Send** - File is encrypted and sent via WebRTC
4. **Auto-Delete** - File disappears after the set duration

## � Security

### Cryptographic Implementation
- **Key Exchange** - ECDH P-256 for secure key establishment
- **Encryption** - AES-256-GCM for message and file encryption
- **Authentication** - HMAC-based message authentication built into GCM mode
- **Verification** - SHA-256 based SAS generation for connection verification
- **Memory Security** - Zero-fill operations for sensitive data cleanup
- **Random Generation** - Cryptographically secure random code generation

### What NYX Messenger Protects Against
- **Man-in-the-Middle Attacks** - ECDH key exchange with SAS verification
- **Message Interception** - End-to-end AES-256-GCM encryption
- **Data Persistence** - Ephemeral messaging with no server storage
- **Connection Tampering** - Cryptographic integrity verification

### Security Best Practices
1. **Always verify the SAS** with your peer through a separate channel
2. **Use on trusted networks** when possible
3. **Keep browsers updated** for latest security patches
4. **Be aware of browser security** - avoid browser extensions that might intercept data

### Known Limitations
- Requires JavaScript and modern browser features
- Dependent on WebRTC support and network connectivity
- SAS verification requires out-of-band communication
- Server trust required for initial signaling
- Vulnerable to compromised devices

## 🔧 Development

### Project Structure
```
nyx-messenger/
├── package.json                 # Root package with build/start scripts
├── README.md                    # This documentation
├── .gitignore                   # Git ignore rules
├── backend/
│   ├── src/
│   │   └── server.js           # Express + WebSocket signaling server
│   ├── package.json            # Backend dependencies
│   └── .env.example            # Environment variables template
├── frontend/
│   ├── src/
│   │   ├── App.js              # Main React component (Container)
│   │   ├── App.css             # Cyberpunk styling & animations
│   │   ├── cryptoUtils.js      # Web Crypto API utilities
│   │   ├── index.js            # React app entry point
│   │   ├── index.css           # Global styles
│   │   └── components/         # Presentational components
│   │       ├── ConnectionManager.js
│   │       ├── VerificationPrompt.js
│   │       └── ChatInterface.js
│   ├── public/
│   │   ├── index.html          # HTML template
│   │   ├── manifest.json       # PWA manifest
│   │   ├── doki.mp3            # Notification sound
│   │   └── [favicon files]     # App icons for PWA
│   ├── build/                  # Production build output (generated)
│   └── package.json            # Frontend dependencies
└── .env                        # Environment variables (production)
```

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

### Component Architecture
NYX Messenger follows a **Container/Presentational component pattern**:

- **`App.js`** - Central hub containing all application logic
  - State management (useState, useRef hooks)
  - WebSocket and WebRTC connection handling
  - Encryption/decryption operations
  - Event handlers and business logic

- **Presentational Components** - Pure UI components that receive data via props
  - `ConnectionManager.js` - Initial connection UI
  - `VerificationPrompt.js` - Security verification step
  - `ChatInterface.js` - Main messaging interface

- **`cryptoUtils.js`** - Secure cryptographic operations
  - ECDH P-256 key generation and exchange
  - AES-256-GCM encryption/decryption
  - SAS generation and memory cleanup

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
2. Configure environment variables in `backend/.env`
3. Start the server: `npm start`
4. Ensure WebSocket connections are supported by your hosting provider
5. Configure HTTPS/WSS for production deployment

### Browser Compatibility

**Minimum Requirements:**
- ✅ Chrome 88+ (January 2021)
- ✅ Firefox 84+ (December 2020)
- ✅ Safari 14+ (September 2020)
- ✅ Edge 88+ (January 2021)

**Required Browser Features:**
- WebRTC Data Channels
- Web Crypto API (ECDH P-256, AES-GCM)
- WebSocket support
- ES6+ JavaScript features
- Service Worker support (for PWA)

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

## � Project Status

**Current Version:** 1.0.0
- **Production Ready** - Deployed on Render.com
- **Last Updated** - July 2025
- **Development Status** - Active maintenance and feature development
- **Code Quality** - Well-documented, modular architecture

### 🔧 Development Metrics
- **Backend** - 177 lines (server.js) - Lightweight and efficient
- **Frontend Core** - 1,677+ lines (App.js) - Comprehensive feature set
- **Components** - 3 modular UI components for maintainability
- **Crypto Utils** - 204 lines of secure cryptographic operations
- **Dependencies** - 11 production + 3 development dependencies

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Maintain code comments for crypto operations
- Test security features thoroughly
- Update documentation for new features

## 🔮 Future Enhancements

### 🎯 Planned Features
- [ ] Group messaging support with multi-party key exchange
- [ ] Voice/video calling integration via WebRTC
- [ ] Mobile app development (React Native)
- [ ] Advanced file encryption with metadata protection
- [ ] Custom themes and personalization options
- [ ] Message threading and organization
- [ ] Persistent session recovery
- [ ] End-to-end encrypted file storage

### ✅ Recent Improvements (2025)
- [x] Enhanced WebRTC connectivity with multiple TURN servers
- [x] Production network support for restrictive environments
- [x] Connection diagnostics and monitoring
- [x] Graceful fallbacks for failed P2P connections
- [x] Component architecture refactor for maintainability
- [x] Container/Presentational pattern implementation
- [x] Code validity timer with visual feedback
- [x] Enhanced error handling and user feedback
- [x] Memory security with zero-fill operations
- [x] Production monitoring and health checks
- [x] File transfer optimization with chunked uploads
- [x] Notification system with audio alerts

## 📜 License

This project is licensed under the ISC License.

## ⚠️ Disclaimer

NYX Messenger is designed for secure communication but should not be used for sensitive information without proper security review. The application is provided as-is without warranty.

## 🙏 Acknowledgments

- Web Crypto API for browser-based encryption
- WebRTC for peer-to-peer communication
- Framer Motion for smooth animations
- The cryptography community for security best practices

## 📞 Support

For questions, issues, or contributions:
- 🐛 **Bug Reports** - Create an issue on GitHub with detailed reproduction steps
- 💡 **Feature Requests** - Submit enhancement proposals via GitHub Issues
- 📚 **Documentation** - Comprehensive README.md and inline code comments
- 🔒 **Security** - Report security vulnerabilities responsibly via GitHub Issues

---

**Built with ❤️ using React, WebRTC, and modern cryptography**

⚠️ **Security Notice**: NYX Messenger is designed for privacy-conscious users but should not be considered bulletproof. Always verify the security of your deployment and use additional security measures for highly sensitive communications.

🌟 **Remember**: True security comes from understanding your tools. Review the code, verify the deployment, and use responsibly.
