/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_APP_NAME: string;
	readonly VITE_APP_WEBSITE: string;
	readonly VITE_APP_LOGO: string;
	readonly VITE_APP_LOGO_BIG: string;
	readonly VITE_APP_THANKS_IMAGE: string;
	readonly VITE_APP_TRANSFER: string;

	readonly VITE_REST_URL: string;
	readonly VITE_INVITE_URL: string;
	readonly VITE_PROXY_URL: string;

	readonly VITE_STORE_IOS: string;
	readonly VITE_STORE_ANDROID: string;
	readonly VITE_STORE_MAC: string;
	readonly VITE_STORE_WINDOWS: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

interface IconProps {
	className?: string;
}
