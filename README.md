# CollabSpace – Collaboration Platform

A full-stack, real-time collaboration workspace designed for seamless communication and productivity. Built with a modern **FastAPI, PostgreSQL, Redis, and React** stack, integrating **LiveKit WebRTC** for instant video conferencing.

## 🚀 Key Highlights

- **Real-Time Messaging Engine:** Engineered a highly scalable backend utilizing **Redis Pub/Sub** to fan-out events across multiple **FastAPI workers**. Supports direct messages (DMs), group chats, live typing indicators, WhatsApp-style read receipts, and real-time presence tracking over persistent WebSockets.
- **Secure Architecture:** Implemented robust **JWT-based authentication** with bcrypt hashing. Enforced strict token validation on both standard REST endpoints and during WebSocket handshakes to completely prevent unauthorized real-time access.
- **WebRTC Video Conferencing:** Integrated **LiveKit Cloud** to power low-latency video calls. Built the full end-to-end workflow, including FastAPI JWT token generation for room access, cross-socket incoming call signaling, accept/reject workflows with an interactive UI, and Redis-backed call state synchronization.

## 💻 Tech Stack

### Backend
- **Python / FastAPI:** High-performance async API framework.
- **PostgreSQL / SQLAlchemy:** Relational database with async connection pooling.
- **Redis:** Pub/Sub message broker for cross-worker WebSocket communication and caching.
- **LiveKit Server SDK:** Secure token generation for WebRTC rooms.
- **JWT & Bcrypt:** Secure password hashing and stateless session management.

### Frontend
- **React / TypeScript / Vite:** Lightning-fast, strictly typed modern frontend.
- **Tailwind CSS & shadcn/ui:** Beautiful, accessible, and responsive user interfaces.
- **LiveKit Components:** Pre-built, customizable WebRTC video and audio UI components.

## 📁 Project Structure

```text
CollabSpace/
├── Backend/
│   ├── app/
│   │   ├── core/       # Config, Security, and Redis Pub/Sub listeners
│   │   ├── db/         # SQLAlchemy async engine setup
│   │   ├── models/     # Database tables (Users, Chats, Messages)
│   │   ├── routes/     # REST endpoints & WebSocket connections
│   │   └── schemas/    # Pydantic data validation schemas
│   ├── alembic/        # Database migrations
│   └── requirements.txt
├── Frontend/
│   ├── src/
│   │   ├── components/ # Reusable UI, Modals, and Chat Interfaces
│   │   ├── contexts/   # Global React State (Auth, WebSockets, Calls)
│   │   └── lib/        # API utilities
│   ├── index.html
│   └── package.json
```

## 🛠️ Local Development Setup

### Prerequisites
- Python 3.10+
- Node.js & npm
- PostgreSQL running locally (or a cloud DB like Neon)
- Redis running locally on port `6379` (or a cloud cache like Upstash)
- [LiveKit Cloud](https://livekit.io/) Project Credentials

### 1. Environment Variables
Create a `.env` file in the `Backend/` directory:
```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost/collabspace
SECRET_KEY=your_super_secret_key
ALGORITHM=xxxxx
ACCESS_TOKEN_EXPIRE_MINUTES=xxxx
REDIS_URL=redis://localhost:xxxx

# LiveKit WebRTC Configuration
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:5173
```

Create a `.env.local` file in the `Frontend/` directory:
```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### 2. Start the Backend
```bash
cd Backend
python -m venv venv
# On Windows: .\venv\Scripts\Activate
# On Mac/Linux: source venv/bin/activate
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

### 3. Start the Frontend
```bash
cd Frontend
npm install
npm run dev
```
