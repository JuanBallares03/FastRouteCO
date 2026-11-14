# FastRouteCO web

Administrative web panel for FastRouteCO. It serves the platform administrator,
company administrator and logistics supervisor roles. The driver experience lives
in the mobile application.

## Stack

- React 19, TypeScript, Vite
- React Router
- Tailwind CSS
- Axios and Socket.IO client
- MapLibre GL

## Commands

Run commands from the repository root:

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web typecheck
```

## Environment

Copy `.env.example` to `.env` and set the values for your environment:

- `VITE_API_URL`: backend API base URL, including `/api/v1`.
- `VITE_WS_URL`: real-time server URL.
- `VITE_MAP_STYLE_URL`: MapLibre style URL.
- `VITE_WOMPI_PUBLIC_KEY`: public Wompi key used by the billing screen.

Never commit `.env` files.

## Structure

- `src/components`: shared layout, map and UI components.
- `src/lib`: shared formatting and validation helpers.
- `src/pages`: role and domain screens.
- `src/services`: HTTP and Socket.IO clients.

See the repository root `README.md` for the full project overview, backend setup
and database commands.
