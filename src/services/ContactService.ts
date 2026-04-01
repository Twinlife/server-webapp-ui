/*
 *  Copyright (c) 2021-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

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

export class Response<T> {
	readonly data: T;
	readonly status: number;

	constructor(status: number, data: T) {
		this.status = status;
		this.data = data;
	}
}

export class RestError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export type Schedule = {
	timeZone: string;
	timeRanges: Array<TimeRange>;
};

export type TimeRange = DateTimeRange;

export type DateTimeRange = {
	start: DateTime | TLTime;
	end: DateTime | TLTime;
	days: Array<string> | null;
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
	startDate?: string;
	endDate?: string;
	startTime?: string;
	endTime?: string;
	days?: string;
	fromTime?: string;
	toTime?: string;
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

function timeToString(time: TLTime): string {
	return pad(time.hour) + ":" + pad(time.minute);
}

function dateTimeToString(dt: DateTime | TLTime): string {
	if ((dt as DateTime).date !== undefined) {
		const date: DateTime = dt as DateTime;
		return (
			pad(date.date.year, 4) +
			"-" +
			pad(date.date.month) +
			"-" +
			pad(date.date.day) +
			" " +
			timeToString(date.time)
		);
	} else {
		return timeToString(dt as TLTime);
	}
}

function pad(n: number, maxLen: number = 2): string {
	return n.toString().padStart(maxLen, "0");
}

//e.g. "13:30"
const timeFormat = new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" });
//e.g. "1 Décembre 2023"
const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" });

const NETWORK_ERROR: number = 1;

/**
 * Simple service to get the contact information (aka twincode attributes).
 */
export class ContactService {
	public static isTransientError(error: RestError): boolean {
		if (error.status) {
			return error.status == 503 || error.status == NETWORK_ERROR;
		} else if (error.message) {
			return error.message.includes("network error");
		} else {
			return false;
		}
	}

	public static isAllowedDay(day: number, allowed: Array<string>): boolean {
		const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
		const dayIndex = day === 7 ? 0 : day;
		const dayName = dayNames[dayIndex];
		return allowed.includes(dayName);
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
			if ((timeRange.start as DateTime).date !== undefined) {
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
			} else {
				const day = now.getDay();
				if (timeRange.days && this.isAllowedDay(day, timeRange.days)) {
					const isoDateString = now.toISOString().split("T")[0];
					const startDate = fromZonedTime(
						isoDateString + " " + timeToString(timeRange.start as TLTime),
						timeZone,
					);
					const endDate = fromZonedTime(
						isoDateString + " " + timeToString(timeRange.end as TLTime),
						timeZone,
					);

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

		if ((range.start as DateTime).date === undefined) {
			const now = new Date();
			const isoDateString = now.toISOString().split("T")[0];
			const startTime = fromZonedTime(isoDateString + " " + timeToString(range.start as TLTime), timeZone);
			const endTime = fromZonedTime(isoDateString + " " + timeToString(range.end as TLTime), timeZone);

			const start = timeToString({ hour: startTime.getHours(), minute: startTime.getMinutes() });
			const end = timeToString({ hour: endTime.getHours(), minute: endTime.getMinutes() });

			return {
				days: range.days?.join(", "),
				fromTime: start,
				toTime: end,
			};
		} else {
			const startDate = fromZonedTime(dateTimeToString(range.start), timeZone);
			const endDate = fromZonedTime(dateTimeToString(range.end), timeZone);

			return {
				startDate: dateFormat.format(startDate),
				endDate: dateFormat.format(endDate),
				startTime: timeFormat.format(startDate),
				endTime: timeFormat.format(endDate),
			};
		}
	}

	public static isSameDay(start: DateTime, end: DateTime): boolean {
		return (
			start.date.day === end.date.day && start.date.month == end.date.month && start.date.year == end.date.year
		);
	}

	public static getSchedule(schedule: Schedule): string {
		const timeRange = schedule.timeRanges[0];
		const start = timeRange.start;
		const end = timeRange.end;
		// const labels : ScheduleLabels = this.getScheduleLabels(schedule);

		if ((start as DateTime).date === undefined || (end as DateTime).date === undefined) {
			return "call_periodic_schedule";
		} else if (this.isSameDay(start as DateTime, end as DateTime)) {
			return "audio_call_activity_terminate_schedule_single_day";
		} else {
			return "audio_call_activity_terminate_schedule_multiple_days";
		}
	}

	public static getTwincode(id: string): Promise<Response<TwincodeInfo>> {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open("GET", url + "/twincodes/" + id, true);
			xhr.setRequestHeader("Accept", "application/json");
			xhr.onreadystatechange = function () {
				if (xhr.readyState === 4) {
					if (xhr.status === 200) {
						try {
							const response = JSON.parse(xhr.responseText);
							resolve(new Response<TwincodeInfo>(xhr.status, response));
						} catch (ignored: unknown) {
							reject(new RestError(xhr.status, "Failed to parse response"));
						}
					} else {
						reject(new RestError(xhr.status, "Request failed"));
					}
				}
			};
			xhr.onerror = function () {
				reject(new RestError(NETWORK_ERROR, "Network error"));
			};
			xhr.send();
		});
	}
}
