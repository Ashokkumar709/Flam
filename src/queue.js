// src/queue.js
// JSON-based persistent queue (cross-platform, retry, DLQ support)

const { v4: uuidv4 } = require("uuid");
const { execSync } = require("child_process");
const db = require("./db");
const fs = require("fs");
const path = require("path");

const DEAD_LETTER_FILE = path.join(__dirname, "..", "data", "dead_letter.json");
if (!fs.existsSync(DEAD_LETTER_FILE)) fs.writeFileSync(DEAD_LETTER_FILE, "[]");

// --- Enqueue a new job ---
function enqueue(jobJson) {
  let obj;
  try {
    obj = typeof jobJson === "string" ? JSON.parse(jobJson) : jobJson;
  } catch (e) {
    console.error("❌ Invalid JSON for enqueue:", jobJson);
    process.exit(1);
  }

  const job = {
    id: obj.id || uuidv4(),
    command: obj.command,
    state: "pending",
    attempts: 0,
    max_retries: obj.max_retries || 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    scheduled_at: new Date().toISOString(),
  };

  db.addJob(job);
  return job;
}

// --- List jobs ---
function listJobs(state) {
  const all = db.getAllJobs();
  return state ? all.filter((j) => j.state === state) : all;
}

// --- Move job to DLQ ---
function moveToDeadLetter(job, errMsg) {
  const dlq = JSON.parse(fs.readFileSync(DEAD_LETTER_FILE, "utf8"));
  dlq.push({ ...job, last_error: errMsg, failed_at: new Date().toISOString() });
  fs.writeFileSync(DEAD_LETTER_FILE, JSON.stringify(dlq, null, 2));
  db.removeJob(job.id);
}

// --- Retry logic ---
function scheduleRetry(job, base, attempts) {
  const EXPdelay = Math.pow(base, attempts) * 1000; // ms
  const scheduled_at = new Date(Date.now() + EXPdelay).toISOString();
  db.updateJob(job.id, {
    state: "pending",
    attempts,
    updated_at: new Date().toISOString(),
    scheduled_at,
  });
  console.log(
    `[queuectl] ⚠️ Job ${job.id} failed (attempt ${attempts}/${job.max_retries}), retry scheduled in ${
      EXPdelay / 1000
    }s`
  );
}

// --- Process a job ---
function processJob(job, workerId = "worker-1") {
  const now = new Date().toISOString();
  db.updateJob(job.id, { state: "processing", updated_at: now });

  const isWindows = process.platform === "win32";
  const options = isWindows ? { stdio: "pipe", shell: "cmd.exe" } : { stdio: "pipe", shell: "/bin/sh" };

  console.log(`[${workerId}] ▶️ Running: ${job.command}`);

  try {
    const output = execSync(job.command, options).toString();
    db.updateJob(job.id, {
      state: "completed",
      attempts: job.attempts + 1,
      output,
      updated_at: new Date().toISOString(),
    });
    console.log(`[${workerId}] ✅ Completed job ${job.id}`);
  } catch (err) {
    const attempts = job.attempts + 1;
    const max = job.max_retries || 3;
    if (attempts >= max) {
      console.log(`[${workerId}] ❌ Job ${job.id} failed permanently.`);
      moveToDeadLetter(job, err.message);
    } else {
      scheduleRetry(job, 2, attempts); // exponential backoff base = 2
    }
  }
}
function retryDLQJob(id) {
  const dlq = JSON.parse(fs.readFileSync(DEAD_LETTER_FILE, "utf8"));
  const jobIndex = dlq.findIndex((j) => j.id === id);
  if (jobIndex === -1) {
    console.log(`❌ No job found in DLQ with ID: ${id}`);
    return;
  }

  const job = dlq[jobIndex];
  const newJob = {
    ...job,
    state: "pending",
    attempts: 0,
    last_error: null,
    updated_at: new Date().toISOString(),
  };

  // Add to main queue
  db.addJob(newJob);

  // Remove from DLQ file
  dlq.splice(jobIndex, 1);
  fs.writeFileSync(DEAD_LETTER_FILE, JSON.stringify(dlq, null, 2));

  console.log(`🔁 Job ${id} retried and moved back to pending queue`);
}


function status() {
  const allJobs = db.getAllJobs();
  const dlq = fs.existsSync(DEAD_LETTER_FILE)
    ? JSON.parse(fs.readFileSync(DEAD_LETTER_FILE, "utf8"))
    : [];

  const summary = {
    pending: allJobs.filter((j) => j.state === "pending").length,
    processing: allJobs.filter((j) => j.state === "processing").length,
    completed: allJobs.filter((j) => j.state === "completed").length,
    failed: allJobs.filter((j) => j.state === "failed").length,
    dead: dlq.length,
    total: allJobs.length + dlq.length,
  };

  console.log("=== Queue Status ===");
  for (const [key, value] of Object.entries(summary)) {
    console.log(`${key.padEnd(12)} : ${value}`);
  }

  return summary;
}

// --- Start worker(s) ---
function startWorker(count = 1) {
  console.log(`[queuectl] Starting ${count} worker(s)...`);

  for (let i = 0; i < count; i++) {
    const workerId = `worker-${i + 1}`;
    setInterval(() => {
      const jobs = db.getAllJobs();
      const next = jobs.find((j) => j.state === "pending" && (!j.scheduled_at || new Date(j.scheduled_at) <= new Date()));

      if (next) processJob(next, workerId);
    }, 2000);
  }
}

module.exports = {
  enqueue,
  listJobs,
  startWorker,
  retryDLQJob,
  status,
};
