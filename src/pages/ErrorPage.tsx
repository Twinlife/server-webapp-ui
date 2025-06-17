/*
 *  Copyright (c) 2023-2024 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 */
import { useTranslation } from "react-i18next";

export default function ErrorPage() {
	const { t } = useTranslation();

	return (
		<main className="relative isolate min-h-full bg-white">
			<img
				src="https://twin.me/wp-content/uploads/2016/01/header.png"
				alt=""
				className="absolute inset-0 -z-10 h-full w-full object-cover object-top"
			/>
			<div className="mx-auto max-w-7xl px-6 py-32 text-center sm:py-40 lg:px-8">
				<h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
					{t("general_error_title")}
				</h1>
				<p className="mt-4 text-base text-zinc-900/70 sm:mt-6">{t("general_error_message")}</p>
			</div>
		</main>
	);
}
