/*
 *  Copyright (c) 2023-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AxiosError } from "axios";
import { ContactService, TwincodeInfo } from "../services/ContactService";
import SpinnerIcon from "./icons/SpinnerIcon";

interface InitializationPanelProps {
	twincodeId: string;
	twincode: TwincodeInfo;
	onComplete: (twincode: TwincodeInfo) => string | null;
}

export default function InitializationPanel({ twincodeId, onComplete }: InitializationPanelProps) {
	const { t } = useTranslation();
	const [twincodeError, setTwincodeError] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true; // Flag to avoid state updates if the component unmounts
		let retryTimeout: NodeJS.Timeout | null = null;

		const fetchTwincode = async () => {
			if (!twincodeId) return;

			setTwincodeError(null);
			ContactService.getTwincode(twincodeId)
				.then((response) => {
					const twincode = response.data;

					if (isMounted) {
						const msg: string | null = onComplete(twincode);
						if (msg) {
							setTwincodeError(msg);
						}
					}
				})
				.catch((error: unknown) => {
					let msg: string = "general_error_message";
					if (isMounted && error instanceof AxiosError) {
						const axiosError: AxiosError = error as AxiosError;
						if (axiosError.response && axiosError.response.status == 404) {
							msg = "twincode_not_found";
						} else if (axiosError.response && axiosError.response.status == 410) {
							msg = "twincode_expired";
						} else if (ContactService.isTransientError(axiosError)) {
							retryTimeout = setTimeout(() => fetchTwincode(), 5000);
							msg = "service_unavailable";
						} else {
							console.error("Twincode not found");
							msg = "network_error";
						}
					}
					if (isMounted) {
						setTwincodeError(msg);
					}
				});
		};

		// Reset error state when twincodeId changes
		fetchTwincode();

		return () => {
			isMounted = false; // Cleanup: prevent state updates if unmounted
			if (retryTimeout) {
				clearTimeout(retryTimeout);
			}
		};
	}, [twincodeId, onComplete]);

	return (
		<div className="flex flex-1 items-center justify-center">
			{twincodeError ? <div className="p-4 text-center">{t(twincodeError)}</div> : <SpinnerIcon />}
		</div>
	);
}
