import { ApplicationRepository } from "./db/repository.js";
import { env } from "./env.js";
import { serializeError } from "./errors/serialize-error.js";
import { ApplicationRunner } from "./runner/application-runner.js";

const repository = new ApplicationRepository();
const runner = new ApplicationRunner(repository);
let stopping = false;

process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

console.log(`ApplyQueue worker started (polling every ${env.WORKER_POLL_INTERVAL_MS}ms)`);

try {
  const recovered = await repository.failStaleProcessingApplications();
  if (recovered > 0) console.warn(`Marked ${recovered} stale processing application(s) as FAILED.`);
} catch (error) {
  console.error("Worker stale-run recovery failed", JSON.stringify(serializeError(error)));
}

while (!stopping) {
  try {
    const application = await repository.claimNext();
    if (application) {
      await runner.run(application);
      continue;
    }
  } catch (error) {
    console.error("Worker polling error", error);
  }
  await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_INTERVAL_MS));
}

console.log("ApplyQueue worker stopped");
