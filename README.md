# CollabSpace

CollabSpace is a full-stack collaboration workspace with direct and group chat, realtime presence, read receipts, typing indicators, meetings, saved messages, tasks, a whiteboard, analytics, and profile settings.

## Tech Stack

### Backend

- Python
- FastAPI
- SQLAlchemy ORM
- MySQL
- Redis Pub/Sub
- WebSockets
- JWT authentication
- Pydantic

### Frontend

- TypeScript
- React
- Vite
- Tailwind CSS
- shadcn/ui and Radix UI
- TanStack Query
- React Router
- WebRTC signaling over WebSockets

## Project Structure

```text
CollabSpace/
|-- Backend/
|   |-- app/
|   |   |-- core/       # Configuration, security, Redis
|   |   |-- db/         # SQLAlchemy database setup
|   |   |-- models/     # ORM models
|   |   |-- routes/     # REST and WebSocket routes
|   |   `-- schemas/    # Pydantic request and response schemas
|   `-- requirements.txt
|-- Frontend/
|   |-- src/
|   |   |-- components/
|   |   |-- contexts/
|   |   |-- pages/
|   |   `-- lib/
|   `-- package.json
`-- FrontendTest/       # Manual WebSocket and meeting test pages
```

## Prerequisites

- Python 3.13 or a compatible Python 3 version
- Node.js and npm
- MySQL
- Redis running locally on port `6379`

## Environment Variables

Create a root `.env` file:

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@localhost/DATABASE_NAME
SECRET_KEY=replace-with-a-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REDIS_URL=redis://localhost:6379
```

The frontend uses `Frontend/.env.development`:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

## Run Locally

Start MySQL and Redis first.

### Backend

```powershell
cd Backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API is available at `http://localhost:8000`. FastAPI documentation is available at `http://localhost:8000/docs`.

### Frontend

```powershell
cd Frontend
npm install
npm run dev
```

Open the local URL printed by Vite.

## Main Features

- User registration, login, JWT authentication, and profile settings
- Direct and group chats
- Realtime messages over WebSockets
- Redis Pub/Sub fan-out for chat and global presence events
- Typing indicators, read receipts, online status, and heartbeat checks
- Meeting creation, joining, ending, and WebRTC signaling
- Frontend workspaces for saved messages, tasks, whiteboard, and analytics

## Database Schema

The SQLAlchemy models define:

| Table | Purpose | Important constraints and indexes |
| --- | --- | --- |
| `users` | Accounts and profiles | Unique `username`, unique `email`, indexed primary key |
| `chats` | Direct and group conversations | Indexed primary key, optional creator foreign key |
| `chat_members` | Chat membership and read state | Unique `(chat_id, user_id)`, foreign keys to chats, users, and messages |
| `messages` | Chat history | Indexes on `(chat_id, created_at)` and `(chat_id, id)` |
| `meetings` | Active and ended meetings | Unique `room_name`, foreign keys to chats and users |

Message history uses cursor pagination:

```http
GET /messages/{chat_id}?limit=20&before_id=123
```

The response includes `messages`, `next_cursor`, and `has_more`. The page size defaults to `20` and is capped at `100`.

## Realtime Architecture

The FastAPI lifespan starts:

- A Redis subscriber for `chat:*` and `global_presence` channels
- A WebSocket heartbeat task for chat connections

Chat and presence events are published through Redis and delivered to WebSocket connections held by the local application process. Meeting signaling is currently stored in process-local memory.

## Testing

`FrontendTest/` contains manual HTML pages for exercising WebSocket chat and meeting behavior.

The repository does not currently include an automated test suite or load tests.

