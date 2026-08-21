# EasyCart Mobile

Customer-facing React Native application for the EasyCart backend. The app uses
Expo SDK 54, Expo Router, React Query, FlashList, encrypted token storage, and
the same API contracts as the web storefront.

## Included customer flows

- Infinite, virtualized two-column product catalog
- Search and category filtering
- Product details and live stock visibility
- Persistent cart with stock-aware quantity controls
- Customer registration and secure sign-in
- Email verification required by backend checkout policy
- Cash-on-delivery and bank-transfer checkout
- Account order history with infinite loading
- Public order tracking by order number and phone
- Order confirmation and status timeline
- Android, iOS, and web-compatible Expo project

## Run locally

Requirements: Node.js 22.13 or newer, npm, and the backend API.

1. Copy `.env.example` to `.env`.
2. For a physical phone, replace `192.168.1.100` with the development
   computer's LAN IP. The phone and computer must be on the same network.
3. Start the backend on port `5188`.
4. From this directory, run `npm start` and scan the QR code with Expo Go.

The default API URL is `http://10.0.2.2:5188/api` on an Android emulator and
`http://localhost:5188/api` on iOS/web. Production builds should always set
`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_ASSET_URL` to HTTPS endpoints.

## Quality checks

```text
npm run typecheck
npm run lint
npx expo-doctor
```

## Builds

`eas.json` contains development, preview APK, and production profiles. Set up
an Expo account and run `eas build --profile preview --platform android` for an
installable test APK, or use the production profile for store submissions.

Before publishing, confirm the Android package and iOS bundle identifiers in
`app.json` are owned by the publishing organization.
