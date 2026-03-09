/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

export enum ViewMode {
	// Default view
	VIEW_DEFAULT,

	// View focuses on a participant.
	VIEW_FOCUS_PARTICIPANT,

	// View focuses on local camera
	VIEW_FOCUS_CAMERA,

	// View focuses on a screen sharing
	VIEW_SHARE_SCREEN,
}
