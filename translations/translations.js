/*
 *  Copyright (c) 2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 */
import { readFile, readdir, writeFile } from "fs/promises";
import { join } from "path";

const dir = "./translations";
const jsonFromDesktopFilesDir = join(dir, "jsonFromDesktop");
const usedTranslationsDir = join(".", "src", "i18n");

const main = async () => {
	try {
		const jsonFromDesktopFiles = await readdir(jsonFromDesktopFilesDir);

		let translations = {};
		const data = await readFile(join(dir, "translations.json"));
		const json = JSON.parse(data);

		for (const row of json) {
			const key = row.key;
			for (const property of Object.keys(row)) {
				if (property != "key") {
					if (!translations[property]) {
						translations[property] = {};
					}
					translations[property][key] = row[property];
				}
			}
		}

		for (const translationKey of Object.keys(translations)) {
			if (jsonFromDesktopFiles.indexOf(translationKey + ".json") >= 0) {
				const dataFromDesktop = await readFile(join(jsonFromDesktopFilesDir, translationKey + ".json"));
				translations[translationKey] = Object.assign(
					{},
					translations[translationKey],
					JSON.parse(dataFromDesktop)
				);
			}

			await writeFile(
				join(usedTranslationsDir, translationKey + ".json"),
				JSON.stringify({ translation: translations[translationKey] }, null, 4)
			);
		}
	} catch (error) {
		console.error("Error", error);
		return;
	}
};

main();
