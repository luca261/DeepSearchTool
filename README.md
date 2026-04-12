# OpenResearcher

A modern research dashboard with AI-powered automation through n8n integration. Built with React, Express, and SQLite.

## Features

- **User Authentication**: Secure login and registration with JWT tokens
- **Research Management**: Create, track, and manage research projects
- **n8n Integration**: Webhook-based automation for research workflows
- **Dark Navy Theme**: Professional, modern UI with dark navy color scheme
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Settings Management**: Configure integrations and preferences
- **Research History**: Track all past research with export capabilities

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for fast development and building
- Tailwind CSS for styling
- React Router for navigation
- Lucide React for icons
- Axios for API communication

### Backend
- Express.js with TypeScript
- SQLite for data persistence
- JWT for authentication
- bcryptjs for password hashing
- CORS support for cross-origin requests

## Project Structure

```
openresearcher/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── App.tsx        # Main app component
│   │   └── main.tsx       # Entry point
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── auth.ts        # Authentication utilities
│   │   ├── db.ts          # Database initialization
│   │   └── index.ts       # Server entry point
│   ├── .env.example
│   ├── tsconfig.json
│   └── package.json
└── package.json           # Monorepo root
```

## Installation

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Setup

1. Clone the repository
```bash
git clone https://gitlab.com/bc-consulting1/openresearcher.git
cd openresearcher
```

2. Install dependencies
```bash
pnpm install
```

3. Configure environment variables

Server:
```bash
cp server/.env.example server/.env
# Edit server/.env with your configuration
```

4. Initialize database
```bash
pnpm -r build
```

## Development

Start both frontend and backend in development mode:

```bash
pnpm dev
```

This will start:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## Building for Production

```bash
pnpm build
```

This creates optimized builds in:
- `client/dist/` - Frontend build
- `server/dist/` - Backend build

## Running in Production

```bash
# Start the server
cd server
pnpm start

# In another terminal, serve the frontend
cd client
pnpm preview
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/status` - Check authentication status
- `POST /auth/logout` - Logout user

### Research
- `POST /research/create` - Create new research
- `GET /research/recent` - Get recent researches
- `GET /research/history` - Get all researches
- `GET /research/:id` - Get specific research
- `PUT /research/:id` - Update research (n8n webhook)
- `DELETE /research/:id` - Delete research
- `GET /research/:id/export` - Export research as JSON

### Settings
- `GET /settings` - Get user settings
- `PUT /settings` - Update user settings

## n8n Integration

The application integrates with n8n through webhooks. Configure the webhook URL in settings:

1. Create a workflow in n8n
2. Add a webhook trigger node
3. Copy the webhook URL
4. Paste it in OpenResearcher Settings → Integration Settings
5. Research requests will automatically trigger your n8n workflow

The webhook receives:
```json
{
  "researchId": "uuid",
  "userId": "uuid",
  "title": "Research Title",
  "query": "Research Query",
  "timestamp": "ISO 8601 timestamp"
}
```

## Database Schema

### Users Table
- `id` - UUID primary key
- `email` - Unique email address
- `password` - Hashed password
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### Researches Table
- `id` - UUID primary key
- `userId` - Foreign key to users
- `title` - Research title
- `query` - Research query
- `status` - pending, completed, or failed
- `progress` - Progress percentage (0-100)
- `results` - JSON results from n8n
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### Settings Table
- `id` - UUID primary key
- `userId` - Foreign key to users (unique)
- `n8nWebhookUrl` - n8n webhook URL
- `apiKey` - API key for integrations
- `theme` - UI theme preference
- `notificationsEnabled` - Boolean flag
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

## Configuration

### Environment Variables

**Server (.env)**
- `NODE_ENV` - Development or production
- `PORT` - Server port (default: 5000)
- `DATABASE_URL` - SQLite database path
- `JWT_SECRET` - Secret key for JWT signing
- `JWT_EXPIRY` - Token expiration time
- `N8N_WEBHOOK_URL` - n8n webhook URL
- `API_KEY` - API key for integrations
- `CORS_ORIGIN` - Allowed CORS origins

## Security Considerations

- Passwords are hashed with bcryptjs (10 rounds)
- JWT tokens are used for authentication
- CORS is configured to restrict cross-origin requests
- SQL injection is prevented through parameterized queries
- Environment variables protect sensitive configuration

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

MIT

## Support

For issues and questions, please contact the development team or visit the project repository.

---

Made with Manus
