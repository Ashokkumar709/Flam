// src/worker.js
// Worker pool for JSON-based job storage (no better-sqlite3 required)

const { getAllJobs, updateJob, removeJob } = require("./db");
// const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PID_FILE = path.resolve(__dirname, "..", "data", "queuectl.pid");
const DEAD_LETTER_FILE = path.resolve(__dirname, "..", "data", "dead_letter.json");

if (!fs.existsSync(path.dirname(PID_FILE))) fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
if (!fs.existsSync(DEAD_LETTER_FILE)) fs.writeFileSync(DEAD_LETTER_FILE, "[]");

function writePid(pid) {
  fs.writeFileSync(PID_FILE, String(pid));
}
function readPid() {
  return fs.existsSync(PID_FILE) ? Number(fs.readFileSync(PID_FILE, "utf-8")) : null;
}
function removePid() {
  try {
    fs.unlinkSync(PID_FILE);
  } catch {}
}

const { exec } = require("child_process");

function executeCommand(job) {
  return new Promise((resolve) => {
    const command = job.command.trim();
    console.log(`\n[debug] Running command: ${command}\n`);

    exec(command, (error, stdout, stderr) => {
      console.log("[debug] stdout:", stdout);
      console.log("[debug] stderr:", stderr);
      console.log("[debug] error:", error ? error.message : "none");

      if (error) {
        resolve({
          code: error.code || 1,
          stdout,
          stderr: stderr || error.message,
        });
      } else {
        resolve({ code: 0, stdout, stderr });
      }
    });
  });
}

function scheduleRetry(job, attempts, base) {
  const delaySec = Math.pow(base, attempts);
  return new Date(Date.now() + delaySec * 1000).toISOString();
}

function getNextJob() {
  const jobs = getAllJobs();
  return jobs.find((j) => j.state === "pending");
}

function moveToDeadLetter(job, errMsg) {
  const dlq = JSON.parse(fs.readFileSync(DEAD_LETTER_FILE, "utf8"));
  dlq.push({ ...job, last_error: errMsg, failed_at: new Date().toISOString() });
  fs.writeFileSync(DEAD_LETTER_FILE, JSON.stringify(dlq, null, 2));
  removeJob(job.id);
}

class WorkerPool {
  constructor(count = 1) {
    this.count = count;
    this.running = false;
    this.pollInterval = 2000; // ms
    this.base = 2; // backoff base
    this.defaultMaxRetries = 3;
    this.active = new Set();
  }

  async start() {
    if (this.running) return;
    this.running = true;
    writePid(process.pid);
    console.log(`[queuectl] starting ${this.count} worker(s)`);

    process.on("SIGINT", async () => {
      await this.stop();
      process.exit(0);
    });
    process.on("SIGTERM", async () => {
      await this.stop();
      process.exit(0);
    });

    for (let i = 0; i < this.count; i++) this.loop(i);
  }

  stop() {
    return new Promise((resolve) => {
      this.running = false;
      const check = () => {
        if (this.active.size === 0) {
          removePid();
          resolve();
        } else setTimeout(check, 500);
      };
      check();
    });
  }

  loop(index) {
    const iter = async () => {
      if (!this.running) return;
      const job = getNextJob();
      if (job) {
        this.active.add(job.id);
        const result = await executeCommand(job);
        const now = new Date().toISOString();

        if (result.code === 0) {
          updateJob(job.id, {
            state: "completed",
            attempts: job.attempts + 1,
            updated_at: now,
            output: result.stdout,
          });
          console.log(`[worker-${index + 1}] ✅ Completed job ${job.id}`);
        } else {
          const attempts = job.attempts + 1;
          const max = job.max_retries || this.defaultMaxRetries;
          const err = result.stderr || result.stdout || "Unknown failure";
          if (attempts > max) {
            console.log(`[worker-${index + 1}] ❌ Job ${job.id} failed permanently`);
            moveToDeadLetter(job, err);
          } else {
            const sched = scheduleRetry(job, attempts, this.base);
            updateJob(job.id, {
              state: "pending",
              attempts,
              last_error: err,
              scheduled_at: sched,
              updated_at: now,
            });
            console.log(
              `[worker-${index + 1}] ⚠️ Job ${job.id} failed (attempt ${attempts}/${max}), retry scheduled at ${sched}`
            );
          }
        }

        this.active.delete(job.id);
      }
      if (this.running) setTimeout(iter, this.pollInterval);
    };
    iter();
  }

  static stopDaemon() {
    const pid = readPid();
    if (!pid) {
      console.log("No worker PID file found.");
      return;
    }
    try {
      process.kill(pid, "SIGTERM");
      console.log("Stopped worker process:", pid);
    } catch (e) {
      console.log("Stop failed:", e.message);
    }
  }
}

module.exports = { WorkerPool, PID_FILE };
