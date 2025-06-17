/*
 *  Copyright (c) 2021-2023 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

import axios from "axios";

const url = import.meta.env.VITE_REST_URL;

export type TwincodeInfo = {
	name: string | null;
	description: string | null;
	avatarId: string | null;
	audio: boolean;
	video: boolean;
	transfer: boolean;
	schedule: Schedule | null;
};

export type Schedule = {
	timeZone: string;
	timeRanges: Array<TimeRange>;
};

export type TimeRange = DateTimeRange;

export type DateTimeRange = {
	start: DateTime;
	end: DateTime;
};

export type DateTime = {
	date: TLDate;
	time: TLTime;
};

export type TLTime = {
	hour: number;
	minute: number;
};

export type TLDate = {
	year: number;
	month: number;
	day: number;
};

export function dateTimeToString(dt: DateTime): string {
	return (
		pad(dt.date.year, 4) +
		"-" +
		pad(dt.date.month) +
		"-" +
		pad(dt.date.day) +
		" " +
		pad(dt.time.hour) +
		":" +
		pad(dt.time.minute)
	);
}

function pad(n: number, maxLen: number = 2): string {
	return n.toString().padStart(maxLen, "0");
}

/**
 * Simple service to get the contact information (aka twincode attributes).
 */
export class ContactService {
	public static getTwincode(id: string) {
		return axios.get<TwincodeInfo>(url + "/twincodes/" + id);
	}
}
