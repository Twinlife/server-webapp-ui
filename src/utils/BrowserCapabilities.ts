/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

export class BrowserCapabilities {
	readonly userAgent : string;

	constructor() {
		const userAgent = navigator.userAgent || navigator.vendor || window.opera;
		this.userAgent = userAgent ? userAgent : "Unknown";
	}
	isMobile(): boolean {
		return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Kindle|Silk|Windows Phone/i.test(this.userAgent);
	}
	isSafari(): boolean {
  		return /^((?!chrome|android).)*safari/i.test(this.userAgent);
	}
}

export const browser = new BrowserCapabilities();
export const isMobile = browser.isMobile();
export const isSafari = browser.isSafari();