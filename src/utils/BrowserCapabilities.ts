/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

export class BrowserCapabilities {
	isMobile(): boolean {
		const userAgent = navigator.userAgent || navigator.vendor || window.opera;
		if (
			userAgent &&
			/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Kindle|Silk|Windows Phone/i.test(userAgent)
		) {
			return true;
		}
		return false;
	}
}

export const browser = new BrowserCapabilities();
export const isMobile = browser.isMobile();
