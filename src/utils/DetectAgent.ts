/*
 *  Copyright (c) 2025 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

export type AgentType = "Android" | "iOS" | "Windows" | "Mac" | "Linux" | "Other";

export function getAgent(): AgentType {
	if (navigator.userAgent.indexOf("Android") >= 0) {
		return "Android";
	} else if (navigator.userAgent.match(/(iPhone|iPad|iPod)/)) {
		return "iOS";
	} else if (navigator.userAgent.indexOf("Win") >= 0) {
		return "Windows";
	} else if (navigator.userAgent.indexOf("Mac") >= 0) {
		return "Mac";
	} else if (navigator.userAgent.indexOf("Linux") >= 0) {
		return "Linux";
	} else {
		return "Other";
	}
}
