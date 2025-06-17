/*
 *  Copyright (c) 2023-2025 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 */
import { AxiosResponse } from "axios";
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
		if (twincodeId) {
			setTwincodeError(false);
			ContactService.getTwincode(twincodeId)
				.then(async (response: AxiosResponse<TwincodeInfo, unknown>) => {
					const twincode = response.data;
					if (twincode.audio) {
						onComplete(twincode);
					} else {
						setTwincodeError(true);
					}
				})
				.catch((e) => {
					console.error("retrieveInformation", e);
					setTwincodeError(true);
				});
		}
	}, [twincodeId, onComplete]);

	return (
		<div className="flex flex-1 items-center justify-center">
			{twincodeError ? <div className="p-4 text-center">{t("twincode_error")}</div> : <SpinnerIcon />}
		</div>
	);
}
