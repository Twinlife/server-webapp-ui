/*
 *  Copyright (c) 2021-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

import axios from "axios";
import { AxiosError } from "axios";
import { fromZonedTime } from "date-fns-tz";
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

export enum ScheduleStatus {
	OUTSIDE_SCHEDULE,
	WITHIN_SCHEDULE,
	SOON_IN_SCHEDULE,
}

export type ScheduleState = {
	status: ScheduleStatus;
	delay: number;
};

function dateTimeToString(dt: DateTime): string {
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

	/**
	 * Check if the current time is within the schedule so that we are allows to make the call.
	 *
	 * @param schedule the schedule with its timezone.
	 * @returns the status of the schedule.
	 */
	public static isCurrentDateInRange(schedule: Schedule | null): ScheduleState {
		if (!schedule || schedule.timeRanges.length == 0) {
			return { status: ScheduleStatus.WITHIN_SCHEDULE, delay: 0 };
		}
		const timeZone = schedule.timeZone;
		const now = new Date();
		for (const timeRange of schedule.timeRanges) {
			const startDate = fromZonedTime(dateTimeToString(timeRange.start), timeZone);
			const endDate = fromZonedTime(dateTimeToString(timeRange.end), timeZone);

			if (now <= endDate) {
				const delay = startDate.getTime() - now.getTime();
				if (now >= startDate) {
					return { status: ScheduleStatus.WITHIN_SCHEDULE, delay: 0 };
				}
				const startLimit = new Date(startDate.getTime() - 5 * 60 * 1000);
				if (now >= startLimit) {
					return { status: ScheduleStatus.SOON_IN_SCHEDULE, delay: delay };
				}
			}
		}
		return { status: ScheduleStatus.OUTSIDE_SCHEDULE, delay: 0 };
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

		const startDate = fromZonedTime(dateTimeToString(range.start), timeZone);
		const endDate = fromZonedTime(dateTimeToString(range.end), timeZone);

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
