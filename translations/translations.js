import { readFile, readdir, unlink, writeFile } from "fs/promises";
import { join } from "path";

const dir = "./translations";
const jsonFilesDir = join(dir, "jsonFiles");
const jsonFromDesktopFilesDir = join(dir, "jsonFromDesktop");

const main = async () => {
	try {
		const jsonFiles = await readdir(jsonFilesDir);
		for (const jsonFile of jsonFiles) {
			await unlink(join(jsonFilesDir, jsonFile));
		}

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
				join(jsonFilesDir, translationKey + ".json"),
				JSON.stringify({ translation: translations[translationKey] })
			);
		}
	} catch (error) {
		console.error("Error", error);
		return;
	}
};

main();
