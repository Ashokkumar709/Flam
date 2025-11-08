#!/usr/bin/env node
const { program } = require("commander");
const pkg = require("../package.json");
const queue = require("../src/queue");
const config = require("../src/config");
const { WorkerPool } = require("../src/worker");
program.version(pkg.version);
program.command("enqueue <jobJson>").action((j) => {
  const job = queue.enqueue(j);
  console.log("Enqueued", job.id);
});
program
  .command("worker:start")
  .option("--count <n>", "count", Number, 1)
  .action((o) => {
    new WorkerPool(o.count).start();
  });
program.command("worker:stop").action(() => WorkerPool.stopDaemon());
program.command("status").action(() => {
  const s = queue.status();
  console.log(s);
});
program
  .command("list")
  .option("--state <state>")
  .action((o) => {
    console.log(queue.listJobs(o.state));
  });
program
  .command("dlq:retryDLQJob <id>")
  .description("Retry a job from the Dead Letter Queue by ID")
  .action((id) => {
    const queue = require("../src/queue");
    queue.retryDLQJob(id);
  });
program.command("dlq:retry <id>").action((id) => {
  console.log(queue.dlqRetry(id));
});
program.command("config:get").action(() => {
  console.log(config.getAll());
});
program.command("config:set <k> <v>").action((k, v) => {
  config.set(k, v);
  console.log("set", k, v);
});
program.parse(process.argv);
