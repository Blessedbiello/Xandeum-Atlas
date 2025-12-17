# Xandeum Atlas

**Real-time Analytics Platform for Xandeum pNodes**

A production-ready analytics dashboard for monitoring the Xandeum pNode network, built for the Xandeum Bounty Program.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Real-time Network Monitoring** - Live data from pNode gossip network
- **Node Discovery** - Automatic discovery via seed nodes using pRPC
- **Performance Metrics** - CPU, RAM, uptime, and network statistics
- **Status Tracking** - Online, degraded, and offline node detection
- **Search & Filter** - Find nodes by pubkey or IP address
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Auto-refresh** - Data updates every 30-60 seconds

## Screenshots

```
┌─────────────────────────────────────────────────────────────────┐
│  XANDEUM ATLAS - pNode Analytics Platform                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │ 52      │  │ 94.2%   │  │ 12.3%   │  │ 1.2 TB  │           │
│  │ Nodes   │  │ Health  │  │ Avg CPU │  │ Storage │           │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
│                                                                 │
│  [Node Table with Status, Pubkey, CPU, RAM, Uptime...]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| State | TanStack Query (React Query) |
| Charts | Recharts |
| Icons | Lucide React |

## Quick Start

### Prerequisites

- Node.js 18.17 or higher
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/xandeum-atlas.git
cd xandeum-atlas

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

### Environment Variables

Create a `.env.local` file:

```env
# Required for production (optional for development)
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Optional: For persistent storage (Supabase)
DATABASE_URL="postgresql://..."

# Optional: For caching (Upstash Redis)
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# Optional: For cron job security
CRON_SECRET="your-secret-here"
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Dashboard home
│   ├── nodes/             # Node list and detail pages
│   ├── health/            # Network health page
│   └── api/               # API routes
│       ├── nodes/         # Node endpoints
│       ├── stats/         # Statistics endpoint
│       └── health/        # Health check endpoint
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── dashboard/         # Dashboard components
│   └── nodes/             # Node-specific components
├── lib/
│   ├── prpc/              # pRPC client implementation
│   ├── hooks/             # React hooks
│   └── utils/             # Utility functions
└── types/                 # TypeScript type definitions
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/nodes` | GET | List all nodes with pagination |
| `/api/nodes/[pubkey]` | GET | Get specific node details |
| `/api/stats` | GET | Network-wide statistics |
| `/api/health` | GET | API and seed node health |

### Query Parameters for `/api/nodes`

- `status` - Filter by status (online, degraded, offline)
- `search` - Search by pubkey or IP
- `sort` - Sort field (uptime, cpu, ram, last_seen)
- `order` - Sort order (asc, desc)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)

## pRPC Integration

This platform uses the Xandeum pRPC (pNode RPC) protocol to fetch data:

```typescript
// Endpoint format
POST http://{IP}:6000/rpc
Content-Type: application/json

// Available methods
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "get-pods",  // or "get-stats", "get-pods-with-stats"
  "params": []
}
```

### Seed Nodes

```
173.212.220.65    161.97.97.41      192.190.136.36
192.190.136.38    207.244.255.1     192.190.136.28
192.190.136.29    173.212.203.145
```

## Deployment

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/xandeum-atlas)

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables (if needed)
4. Deploy

### Manual Deployment

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Development

```bash
# Run development server
pnpm dev

# Type checking
pnpm type-check

# Linting
pnpm lint

# Build
pnpm build
```

## Documentation

- [Engineering Blueprint](./ENGINEERING_BLUEPRINT.md) - Complete technical specification
- [Quick Start Guide](./QUICKSTART.md) - Implementation guide

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Acknowledgments

- [Xandeum Network](https://xandeum.network) - For the pNode infrastructure
- [xandeum-prpc](https://crates.io/crates/xandeum-prpc) - Rust client reference
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [Vercel](https://vercel.com) - Hosting platform

---

Built with care for the Xandeum Bounty Program
