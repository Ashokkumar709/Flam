// src/server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const db = require("./db");
const { PID_FILE } = require("./worker");

const app = express();
const PORT = 3000;

const JOB_FILE = path.join(__dirname, "..", "data", "jobs.json");
const DLQ_FILE = path.join(__dirname, "..", "data", "dead_letter.json");

app.use(express.static(path.join(__dirname, "..", "public")));

function getStatus() {
  const allJobs = db.getAllJobs();
  const dlq = fs.existsSync(DLQ_FILE)
    ? JSON.parse(fs.readFileSync(DLQ_FILE, "utf8"))
    : [];

  return {
    pending: allJobs.filter((j) => j.state === "pending").length,
    processing: allJobs.filter((j) => j.state === "processing").length,
    completed: allJobs.filter((j) => j.state === "completed").length,
    failed: allJobs.filter((j) => j.state === "failed").length,
    dead: dlq.length,
    total: allJobs.length + dlq.length,
    workers: fs.existsSync(PID_FILE)
      ? [fs.readFileSync(PID_FILE, "utf8").trim()]
      : [],
    jobs: allJobs,
    dlq,
  };
}

app.get("/api/status", (req, res) => {
  res.json(getStatus());
});

app.get("/", (req, res) => {
  const html = `
  <html>
  <head>
    <title>QueueCTL Dashboard</title>
    <meta http-equiv="refresh" content="5">
    <style>
      body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 20px; }
      h1 { color: #333; }
      table { border-collapse: collapse; width: 100%; margin-top: 10px; background: white; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #007bff; color: white; }
      .summary { display: flex; gap: 15px; margin-bottom: 15px; }
      .card { background: white; padding: 10px 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    </style>
  </head>
  <body>
    <h1>📊 QueueCTL Dashboard</h1>
    <div id="summary" class="summary"></div>
    <h2>All Jobs</h2>
    <table id="jobsTable">
      <thead><tr><th>ID</th><th>Command</th><th>State</th><th>Attempts</th><th>Updated</th></tr></thead>
      <tbody></tbody>
    </table>
    <h2>Dead Letter Queue</h2>
    <table id="dlqTable">
      <thead><tr><th>ID</th><th>Command</th><th>Error</th><th>Failed At</th></tr></thead>
      <tbody></tbody>
    </table>
    <script>
      async function loadData() {
        const res = await fetch('/api/status');
        const data = await res.json();
        document.getElementById('summary').innerHTML = 
          Object.entries(data).filter(([k,v]) => typeof v === 'number')
            .map(([k,v]) => \`<div class='card'><b>\${k}</b><br>\${v}</div>\`).join('');

        const jobsBody = document.querySelector('#jobsTable tbody');
        jobsBody.innerHTML = data.jobs.map(j => 
          \`<tr><td>\${j.id}</td><td>\${j.command}</td><td>\${j.state}</td><td>\${j.attempts}</td><td>\${j.updated_at}</td></tr>\`
        ).join('');

        const dlqBody = document.querySelector('#dlqTable tbody');
        dlqBody.innerHTML = data.dlq.map(j => 
          \`<tr><td>\${j.id}</td><td>\${j.command}</td><td>\${j.last_error || "N/A"}</td><td>\${j.failed_at}</td></tr>\`
        ).join('');
      }
      loadData();
    </script>
  </body>
  </html>`;
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`🚀 QueueCTL Dashboard running at http://localhost:${PORT}`);
});
