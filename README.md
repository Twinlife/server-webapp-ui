# twinme Click to Call webapp

## Setup and local run

```
npm install
npm start
```

## Configuration

Environment variables should be defined in a **uncommited** file `.env.local` at the project's root/

#### Local server configuration

```
VITE_APP_NAME=twinme
VITE_APP_WEBSITE=https://twin.me
VITE_APP_LOGO=twinme.png
VITE_APP_LOGO_BIG=twinme-big.webp
VITE_APP_THANKS_IMAGE=thanks_twinme.webp

VITE_REST_URL=http://localhost:8081/rest
VITE_INVITE_URL="https://invite.mytwinlife.net?twincodeId="
VITE_PROXY_URL=ws://localhost:8081/p2p/connect

VITE_STORE_IOS=...
VITE_STORE_ANDROID=...
VITE_STORE_MAC=...
VITE_STORE_WINDOWS=...
```

#### Dev distant server configuration

```
VITE_APP_NAME=twinme
VITE_APP_WEBSITE=https://twin.me
VITE_APP_LOGO=twinme.png
VITE_APP_LOGO_BIG=twinme-big.webp
VITE_APP_THANKS_IMAGE=thanks_twinme.webp

VITE_REST_URL=https://call.mytwinlife.net/rest
VITE_INVITE_URL="https://invite.mytwinlife.net?twincodeId="
VITE_PROXY_URL=wss://call.mytwinlife.net/p2p/connect

VITE_STORE_IOS=...
VITE_STORE_ANDROID=...
VITE_STORE_MAC=...
VITE_STORE_WINDOWS=...
```

## Build Skred and Twinme

With Skred configuration in `.env.skred` and Twinme configuration in `.env.twinme`, run one of the following commands.
This will copy corresponding favicon assets and manifest as well.

```
npm run build:skred
```

```
npm run build:twinme
```

```
npm run build:mytwinlife
```
