import { createBucketSnapshot, listBucketSnapshots } from "@tigrisdata/storage";
import { defineCommand, type ExecResult } from "just-bash";
import type { TigrisConfig } from "../types.js";
import { argError, type FlagSchema, parseFlags, sdkError } from "./args.js";

const USAGE = "snapshot <bucket> [--name label] [--list]";
const SCHEMA: FlagSchema = {
	"--name": "value",
	"--list": "boolean",
};

interface SnapshotInput {
	bucket: string;
	mode: "list" | "create";
	name: string | undefined;
}

export function createSnapshotCommand(config: TigrisConfig) {
	return defineCommand("snapshot", async (args) => {
		const input = parseInput(args);
		if ("stderr" in input) return input;

		if (input.mode === "list") return listSnapshots(input.bucket, config);

		const result = await createBucketSnapshot(input.bucket, {
			...(input.name !== undefined && { name: input.name }),
			config,
		});
		if ("error" in result) return sdkError("snapshot", result.error);

		return { stdout: `${result.data.snapshotVersion}\n`, stderr: "", exitCode: 0 };
	});
}

function parseInput(args: string[]): SnapshotInput | ExecResult {
	const parsed = parseFlags(args, SCHEMA);
	if ("error" in parsed) return argError("snapshot", parsed.error, USAGE);
	const { flags, positional } = parsed;

	if (positional.length === 0) return argError("snapshot", "missing <bucket>", USAGE);
	if (positional.length > 1) {
		return argError("snapshot", `unexpected argument: ${positional[1]}`, USAGE);
	}

	const isList = flags["--list"] === true;
	const name = typeof flags["--name"] === "string" ? flags["--name"] : undefined;
	if (isList && name !== undefined) {
		return argError("snapshot", "--name and --list cannot be combined", USAGE);
	}

	return { bucket: positional[0] ?? "", mode: isList ? "list" : "create", name };
}

async function listSnapshots(bucket: string, config: TigrisConfig) {
	const result = await listBucketSnapshots(bucket, { config });
	if ("error" in result) return sdkError("snapshot", result.error);

	const snapshots = result.data.snapshots;
	if (snapshots.length === 0) {
		return { stdout: "No snapshots.\n", stderr: "", exitCode: 0 };
	}
	const lines = snapshots.map((s) => {
		const label = s.name ? ` (${s.name})` : "";
		const date = s.creationDate?.toISOString() ?? "unknown";
		return `${s.version}${label}  ${date}`;
	});
	return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
}
