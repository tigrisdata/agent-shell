import type { BashExecResult } from "just-bash";
import { Bash, InMemoryFs, MountableFs } from "just-bash";
import { createTigrisCommands } from "./commands/index.js";
import { TigrisStorageFs } from "./fs/tigris-storage-fs.js";
import type { ShellOptions, TigrisConfig } from "./types.js";

/**
 * A virtual bash environment for AI agents, backed by Tigris object storage.
 *
 * Provides a full bash shell where:
 * - /workspace is backed by a Tigris bucket (persistent)
 * - /tmp is in-memory (scratch space, lost on session end)
 * - Tigris commands (presign, snapshot, fork, bundle) are built in
 *
 * Writes stay cached locally until flush() is called.
 */
export class TigrisShell {
	private readonly bash: Bash;
	private readonly storageFs: TigrisStorageFs;

	constructor(config?: TigrisConfig, shellOptions?: ShellOptions) {
		this.storageFs = new TigrisStorageFs(config);

		const fs = new MountableFs({ base: new InMemoryFs() });
		fs.mount("/workspace", this.storageFs);

		const tigrisCommands = createTigrisCommands(this.storageFs.config);

		this.bash = new Bash({
			fs,
			cwd: shellOptions?.cwd ?? "/workspace",
			...(shellOptions?.env !== undefined && { env: shellOptions.env }),
			customCommands: tigrisCommands,
		});
	}

	/** Execute a bash command. */
	async exec(command: string): Promise<BashExecResult> {
		return this.bash.exec(command);
	}

	/** Flush all cached writes to Tigris and delete removed objects. */
	async flush(): Promise<void> {
		return this.storageFs.flush();
	}

	/** Access the underlying just-bash instance. */
	get engine(): Bash {
		return this.bash;
	}

	/** Access the underlying TigrisStorageFs instance. */
	get fs(): TigrisStorageFs {
		return this.storageFs;
	}
}
