# FastRouteCO mobile

Driver application for FastRouteCO, built with Expo and React Native. Drivers
receive their daily route, register arrivals and completions, capture evidence
photos and continue working when the connection is interrupted.

## Stack

- Expo SDK 58 and Expo Router
- React Native and TypeScript
- Expo Location, Camera, SQLite and Secure Store
- Axios and Socket.IO client

## Commands

Run commands from the repository root:

```bash
pnpm --filter mobile dev
pnpm --filter mobile lint
pnpm --filter mobile test
pnpm --filter mobile typecheck
```

Use `pnpm --filter mobile android` for a local Android build and
`pnpm --filter mobile ios` for an EAS iOS build.

## Environment

Copy `.env.example` to `.env` and set:

- `EXPO_PUBLIC_API_URL`: backend API base URL.
- `EXPO_PUBLIC_WS_URL`: real-time server URL.
- `EXPO_PUBLIC_MAP_STYLE_URL`: map style URL.

Never commit `.env` files.

## Structure

- `src/app`: Expo Router screens and layouts.
- `src/features`: auth, route and incident domain logic, including API clients.
- `src/components`: shared UI components.
- `src/services`: shared HTTP and Socket.IO clients.
- `src/theme`: colors, spacing and typography.

Location tracking runs while the route screen is active and the app is in the
foreground. See the repository root `README.md` for backend and database setup.
