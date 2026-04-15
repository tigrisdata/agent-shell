import { Bash, InMemoryFs, MountableFs } from "just-bash";
import { createTigrisCommands } from "../src/commands/index.js";
import { TigrisFs } from "../src/fs/tigris-fs.js";

async function main() {
	// Mount two different buckets at different paths
	const workspaceFs = new TigrisFs({ bucket: "ai-agent-shell-test" });
	const datasetsFs = new TigrisFs({ bucket: "ai-agent-shell-test-2" });

	const fs = new MountableFs({ base: new InMemoryFs() });
	fs.mount("/workspace", workspaceFs);
	fs.mount("/datasets", datasetsFs);

	const bash = new Bash({
		fs,
		cwd: "/workspace",
		customCommands: createTigrisCommands(workspaceFs.config),
	});

	// Write to each bucket
	console.log("--- Writing to /workspace (bucket 1) ---");
	await bash.exec('echo "workspace file" > output.txt');

	console.log("--- Writing to /datasets (bucket 2) ---");
	await bash.exec('echo "col1,col2\na,b\nc,d" > /datasets/data.csv');

	// Read across buckets
	console.log("\n--- Reading across buckets ---");
	const csv = await bash.exec("cat /datasets/data.csv");
	console.log("/datasets/data.csv:", csv.stdout.trim());

	// Copy from one bucket to another
	console.log("\n--- Copying across buckets ---");
	await bash.exec("cp /datasets/data.csv /workspace/local-data.csv");
	const copied = await bash.exec("cat /workspace/local-data.csv");
	console.log("/workspace/local-data.csv:", copied.stdout.trim());

	// Flush each bucket independently
	console.log("\n--- Flushing both buckets ---");
	await workspaceFs.flush();
	console.log("Bucket 1 flushed.");
	await datasetsFs.flush();
	console.log("Bucket 2 flushed.");
}

main().catch(console.error);
