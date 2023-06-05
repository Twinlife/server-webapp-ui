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
VITE_REST_URL=http://localhost:8081/rest
VITE_INVITE_URL="https://invite.mytwinlife.net?twincodeId="
VITE_PROXY_URL=ws://localhost:8081/p2p/connect
```

#### Dev distant server configuration

```
VITE_APP_NAME=twinme
VITE_REST_URL=https://call.mytwinlife.net/rest
VITE_INVITE_URL="https://invite.mytwinlife.net?twincodeId="
VITE_PROXY_URL=wss://call.mytwinlife.net/p2p/connect
```

## Build Skred and Twinme

With Skred configuration in `.env.skred` and Twinme configuration in `.env.twinme`, run one of:

```
npm run build -- --mode skred
```

```
npm run build -- --mode twinme
```
