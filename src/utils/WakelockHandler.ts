/*
 *  Copyright (c) 2024 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Romain Kolb (romain.kolb@skyrock.com)
 */

const DEBUG = import.meta.env.VITE_APP_DEBUG === "true";

export class WakelockHandler {
	private wakeLock: WakeLockSentinel | null = null;

	public acquire() {
		try {

			this.release();

			navigator.wakeLock.request("screen").then(
				(wakeLock: WakeLockSentinel) => {
					this.wakeLock = wakeLock;
					if (DEBUG) {
						console.log("Wakelock acquired");
					}
				},
				(reason: any) => console.error("Could not acquire wakeLock", reason)
			);
		} catch (err) {
			// the wake lock request fails - usually system related, such being low on battery
			console.log("Could not acquire wakelock", err);
		}
	}

	public release() {
		if (this.wakeLock !== null) {
			this.wakeLock.release().then(
				() => {
					if (DEBUG) {
						console.log("Wakelock released");
					}
				},
				(reason) => {
					console.error("Could not release wakelock", reason);
				}
			);

			this.wakeLock = null;
		}
	}
}