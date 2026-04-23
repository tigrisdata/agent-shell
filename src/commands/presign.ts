import { getPresignedUrl } from "@tigrisdata/storage";
import { defineCommand } from "just-bash";
import type { TigrisConfig } from "../types.js";

/**
 * presign <path> [--expires N] [--put]
 *
 * Generate a presigned URL for a Tigris object.
 * Defaults to GET with 1 hour expiry.
 */
function parsePresignArgs(args: string[]): {
	expiresIn: number;
	operation: "get" | "put";
} {
	let expiresIn = 3600;
	let operation: "get" | "put" = "get";

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--expires" && args[i + 1]) {
			expiresIn = Number.parseInt(args[i + 1] ?? "3600", 10);
			i++;
		} else if (args[i] === "--put") {
			operation = "put";
		}
	}

	return { expiresIn, operation };
}

/** Resolve an absolute path to { bucket, key } using mount lookup. */
function resolvePath(
	absolutePath: string,
	configBucket: string | undefined,
	resolveBucket?: (path: string) => { bucket: string; key: string } | null,
): { bucket: string; key: string } | null {
	// Static bucket from config — strip leading slash for key
	if (configBucket) {
		const key = absolutePath.startsWith("/") ? absolutePath.slice(1) : absolutePath;
		return { bucket: configBucket, key };
	}

	// Dynamic resolution from mounts
	if (resolveBucket) {
		return resolveBucket(absolutePath);
	}

	return null;
}

export interface PresignOptions {
	/** Resolve an absolute path to bucket + key from the mount table. */
	resolveBucket?: (path: string) => { bucket: string; key: string } | null;
}

export function createPresignCommand(config: TigrisConfig, options?: PresignOptions) {
	return defineCommand("presign", async (args, ctx) => {
		const rawPath = args[0];
		if (!rawPath) {
			return {
				stdout: "",
				stderr: "presign: missing path argument\nUsage: presign <path> [--expires N] [--put]\n",
				exitCode: 1,
			};
		}

		if (!config.accessKeyId) {
			return {
				stdout: "",
				stderr: "presign: requires access key auth. Use 'configure' instead of 'login'.\n",
				exitCode: 1,
			};
		}

		// Resolve relative paths against cwd
		const absolutePath = rawPath.startsWith("/")
			? rawPath
			: `${ctx.cwd.replace(/\/$/, "")}/${rawPath}`;

		const resolved = resolvePath(absolutePath, config.bucket, options?.resolveBucket);
		if (!resolved) {
			return {
				stdout: "",
				stderr: "presign: cannot determine bucket. cd into a mounted bucket first.\n",
				exitCode: 1,
			};
		}

		const { expiresIn, operation } = parsePresignArgs(args.slice(1));
		const result = await getPresignedUrl(resolved.key, {
			operation,
			expiresIn,
			config: { ...config, bucket: resolved.bucket },
		});

		if ("error" in result) {
			return {
				stdout: "",
				stderr: `presign: ${result.error.message}\n`,
				exitCode: 1,
			};
		}

		return {
			stdout: `${result.data.url}\n`,
			stderr: "",
			exitCode: 0,
		};
	});
}
