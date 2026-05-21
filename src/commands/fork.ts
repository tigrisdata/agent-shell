import { createBucket, listForks } from "@tigrisdata/storage";
import { defineCommand, type ExecResult } from "just-bash";
import type { TigrisConfig } from "../types.js";
import { argError, type FlagSchema, parseFlags, sdkError } from "./args.js";

const USAGE = "fork <source-bucket> <fork-name> [--snapshot version] | fork <source-bucket> --list";
const SCHEMA: FlagSchema = {
	"--snapshot": "value",
	"--list": "boolean",
};

type ForkInput =
	| { mode: "create"; sourceBucket: string; forkName: string; snapshotVersion: string | undefined }
	| { mode: "list"; sourceBucket: string };

export function createForkCommand(config: TigrisConfig) {
	return defineCommand("fork", async (args) => {
		const input = parseInput(args);
		if ("stderr" in input) return input;

		if (input.mode === "list") return listForksOf(input.sourceBucket, config);

		const result = await createBucket(input.forkName, {
			sourceBucketName: input.sourceBucket,
			...(input.snapshotVersion !== undefined && {
				sourceBucketSnapshot: input.snapshotVersion,
			}),
			config,
		});
		if ("error" in result) return sdkError("fork", result.error);

		return { stdout: `${input.forkName}\n`, stderr: "", exitCode: 0 };
	});
}

function parseInput(args: string[]): ForkInput | ExecResult {
	const parsed = parseFlags(args, SCHEMA);
	if ("error" in parsed) return argError("fork", parsed.error, USAGE);
	const { flags, positional } = parsed;

	const isList = flags["--list"] === true;
	const snapshotVersion = typeof flags["--snapshot"] === "string" ? flags["--snapshot"] : undefined;

	if (isList && snapshotVersion !== undefined) {
		return argError("fork", "--snapshot and --list cannot be combined", USAGE);
	}

	if (isList) return parseListInput(positional);
	return parseCreateInput(positional, snapshotVersion);
}

function parseListInput(positional: string[]): ForkInput | ExecResult {
	if (positional.length === 0) return argError("fork", "missing <source-bucket>", USAGE);
	if (positional.length > 1) {
		return argError("fork", `unexpected argument: ${positional[1]}`, USAGE);
	}
	return { mode: "list", sourceBucket: positional[0] ?? "" };
}

function parseCreateInput(
	positional: string[],
	snapshotVersion: string | undefined,
): ForkInput | ExecResult {
	if (positional.length < 1) return argError("fork", "missing <source-bucket>", USAGE);
	if (positional.length < 2) return argError("fork", "missing <fork-name>", USAGE);
	if (positional.length > 2) {
		return argError("fork", `unexpected argument: ${positional[2]}`, USAGE);
	}

	const [sourceBucket, forkName] = positional as [string, string];
	if (sourceBucket === forkName) {
		return argError("fork", "<source-bucket> and <fork-name> must differ");
	}

	return { mode: "create", sourceBucket, forkName, snapshotVersion };
}

async function listForksOf(bucket: string, config: TigrisConfig) {
	const result = await listForks(bucket, { config });
	if ("error" in result) return sdkError("fork", result.error);

	const forks = result.data.forks;
	if (forks.length === 0) {
		return { stdout: "No forks.\n", stderr: "", exitCode: 0 };
	}
	const lines = forks.map((b) => b.name).join("\n");
	return { stdout: `${lines}\n`, stderr: "", exitCode: 0 };
}
