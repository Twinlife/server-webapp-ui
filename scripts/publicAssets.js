/*
 *  Copyright (c) 2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 */
import { copyFileSync, readdirSync } from "fs";
import { join } from "path";

const BUILD_TYPE_TWINME = "twinme";
const BUILD_TYPE_SKRED = "skred";

function main() {
	const buildType = process.argv[2];
	if (!buildType) {
		console.error("You must provide a build type.");
		console.log(`Available build types: ${BUILD_TYPE_TWINME} | ${BUILD_TYPE_SKRED}`);
		console.log();
		return;
	}

	if (buildType !== BUILD_TYPE_TWINME && buildType !== BUILD_TYPE_SKRED) {
		console.error("Bad build type.");
		console.log(`Available build types: ${BUILD_TYPE_TWINME} | ${BUILD_TYPE_SKRED}`);
		console.log();
		return;
	}

	try {
		const assetsPath = join(".", "publicAssets", buildType);
		const publicDir = join(".", "public");

		const assetsDir = readdirSync(assetsPath);
		for (const file of assetsDir) {
			copyFileSync(join(assetsPath, file), join(publicDir, file));
		}
		console.log("Assets copy done.");
	} catch (error) {
		console.error(error);
	}
}

main();
