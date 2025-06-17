/*
 *  Copyright (c) 2023-2025 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 */
import clsx from "clsx";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface GuestNameFormsProps {
	update: boolean;
	guestName: string;
	guestNameError: boolean;
	setGuestName: (newGuestName: string) => void;
	updateGuestName: (newGuestName: string) => void;
}

export default function GuestNameForms({
	update,
	guestName,
	guestNameError,
	setGuestName,
	updateGuestName,
}: GuestNameFormsProps) {
	const { t } = useTranslation();

	return (
		<>
			{guestNameError && <div className="animate-skaheX py-1 text-orange-600">{t("nickname_empty_error")}</div>}
			<div
				className={[
					"rounded-lg border-2 border-solid border-transparent bg-black/70 px-2 py-1 transition",
					guestNameError ? "!border-orange-600" : "",
				].join(" ")}
			>
				{!update && (
					<>
						<input
							type="text"
							value={guestName}
							className=" bg-transparent placeholder:font-light placeholder:text-[#656565] focus:outline-none "
							placeholder="Entrez un pseudo"
							onChange={(e) => setGuestName(e.target.value)}
						/>
					</>
				)}
				{update && <UpdateGuestNameForm defaultValue={guestName} updateGuestName={updateGuestName} />}
			</div>
		</>
	);
}

interface UpdateGuestNameFormProps {
	defaultValue: string;
	updateGuestName: (newGuestName: string) => void;
}

function UpdateGuestNameForm({ defaultValue, updateGuestName }: UpdateGuestNameFormProps) {
	const [localGuestName, setLocalGuestName] = useState(defaultValue);

	const inputRef = useRef<HTMLInputElement>(null);

	return (
		<form
			className={clsx(
				"-m-2 flex flex-row items-center rounded-md border-2 border-solid border-transparent p-1 transition",
				localGuestName !== defaultValue && (localGuestName === "" ? "border-orange-600" : "border-white/50"),
			)}
			onSubmit={(e) => {
				e.preventDefault();
				if (localGuestName !== defaultValue) {
					updateGuestName(localGuestName);
					inputRef.current?.blur();
				}
			}}
		>
			<input
				ref={inputRef}
				type="text"
				value={localGuestName}
				className="bg-transparent placeholder:font-light placeholder:text-[#656565] hover:cursor-pointer focus:outline-none"
				placeholder="Entrez un pseudo"
				onChange={(e) => setLocalGuestName(e.target.value)}
			/>
			{localGuestName !== defaultValue && (
				<button
					type="button"
					className="text-white"
					onClick={() => {
						setLocalGuestName(defaultValue);
					}}
				>
					<X size={16} />
				</button>
			)}
		</form>
	);
}
