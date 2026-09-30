/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

// Copy the MediaPipe wasm runtime from node_modules to public so that the files served
// at /@mediapipe/wasm always match the @mediapipe/tasks-vision JS bundle that loads them.
const sourceDir = join(".", "node_modules", "@mediapipe", "tasks-vision", "wasm");
const targetDir = join(".", "public", "@mediapipe", "wasm");

function isSame(source, target) {
	try {
		if (statSync(source).size !== statSync(target).size) {
			return false;
		}
		return readFileSync(source).equals(readFileSync(target));
	} catch (ignored) {
		return false;
	}
}

mkdirSync(targetDir, { recursive: true });
let copied = 0;
for (const file of readdirSync(sourceDir)) {
	if (!file.startsWith("vision_wasm_")) {
		continue;
	}
	const source = join(sourceDir, file);
	const target = join(targetDir, file);
	if (!isSame(source, target)) {
		copyFileSync(source, target);
		copied++;
	}
}
console.log(`MediaPipe wasm files synchronized (${copied} copied).`);
