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
import { ContactService, TwincodeInfo } from "../services/ContactService";
import SpinnerIcon from "./icons/SpinnerIcon";

interface InitializationPanelProps {
	twincodeId: string;
	twincode: TwincodeInfo;
	onComplete: (twincode: TwincodeInfo) => void;
}

export default function InitializationPanel({ twincodeId, onComplete }: InitializationPanelProps) {
	const { t } = useTranslation();
	const [twincodeError, setTwincodeError] = useState<boolean>(false);

	useEffect(() => {
		let isMounted = true; // Flag to avoid state updates if the component unmounts

		const fetchTwincode = async () => {
			if (!twincodeId) return;

			setTwincodeError(false);
			try {
				const response = await ContactService.getTwincode(twincodeId);
				const twincode = response.data;

				if (isMounted) {
					if (twincode.audio) {
						onComplete(twincode);
					} else {
						setTwincodeError(true);
					}
				}
			} catch (e) {
				console.error("retrieveInformation", e);
				if (isMounted) {
					setTwincodeError(true);
				}
			}
		};

		// Reset error state when twincodeId changes
		fetchTwincode();

		return () => {
			isMounted = false; // Cleanup: prevent state updates if unmounted
		};
	}, [twincodeId, onComplete]);

	return (
		<div className="flex flex-1 items-center justify-center">
			{twincodeError ? <div className="p-4 text-center">{t("twincode_error")}</div> : <SpinnerIcon />}
		</div>
	);
}
