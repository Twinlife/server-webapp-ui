/*
 *  Copyright (c) 2021-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

import axios from "axios";
import { AxiosError } from "axios";
import { toZonedTime } from "date-fns-tz";
import i18n from "i18next";

const url = import.meta.env.VITE_REST_URL;

export type TwincodeInfo = {
	name: string | null;
	description: string | null;
	avatarId: string | null;
	audio: boolean;
	video: boolean;
	transfer: boolean;
	conference: boolean;
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

export type ScheduleLabels = {
	startDate: string;
	endDate: string;
	startTime: string;
	endTime: string;
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

//e.g. "13:30"
const timeFormat = new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" });
//e.g. "1 Décembre 2023"
const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" });

/**
 * Simple service to get the contact information (aka twincode attributes).
 */
export class ContactService {
	public static isTransientError(error: AxiosError): boolean {
		if (error.response) {
			return error.response.status == 503;
		} else if (error.code) {
			return error.code == "ERR_NETWORK";
		} else {
			return false;
		}
	}

	public static isCurrentDateInRange(schedule: Schedule): boolean {
		if (schedule.timeRanges.length == 0) {
			return true;
		}

		const now = new Date();
		for (const timeRange of schedule.timeRanges) {
			const startDate = new Date(
				timeRange.start.date.year,
				timeRange.start.date.month - 1,
				timeRange.start.date.day,
				timeRange.start.time.hour,
				timeRange.start.time.minute,
			);

			const endDate = new Date(
				timeRange.end.date.year,
				timeRange.end.date.month - 1,
				timeRange.end.date.day,
				timeRange.end.time.hour,
				timeRange.end.time.minute,
			);
			if (now >= startDate && now <= endDate) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Returns values for the schedule error messages, localized in i18next's current langage
	 */
	public static getScheduleLabels(schedule: Schedule | null): ScheduleLabels | null {
		if (!schedule?.timeRanges[0]) {
			return null;
		}

		const range = schedule.timeRanges[0];
		const timeZone = schedule.timeZone;

		const startDate = toZonedTime(dateTimeToString(range.start), timeZone);
		const endDate = toZonedTime(dateTimeToString(range.end), timeZone);

		return {
			startDate: dateFormat.format(startDate),
			endDate: dateFormat.format(endDate),
			startTime: timeFormat.format(startDate),
			endTime: timeFormat.format(endDate),
		};
	}

	public static getSchedule(schedule: Schedule): string {
		const timeRange = schedule.timeRanges[0];
		const start = timeRange.start.date;
		const end = timeRange.end.date;
		// const labels : ScheduleLabels = this.getScheduleLabels(schedule);

		if (start.day === end.day && start.month === end.month && start.year === end.year) {
			return "audio_call_activity_terminate_schedule_single_day";
		} else {
			return "audio_call_activity_terminate_schedule_multiple_days";
		}
	}

	public static getTwincode(id: string) {
		return axios.get<TwincodeInfo>(url + "/twincodes/" + id);
	}
}
