// src/db.js
// Simple JSON-based persistence layer — no native modules!

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "jobs.json");

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Load all jobs from file
function load() {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return [];
  }
}

// Save all jobs to file
function save(jobs) {
  fs.writeFileSync(DB_FILE, JSON.stringify(jobs, null, 2));
}

// CRUD functions
function getAllJobs() {
  return load();
}

function addJob(job) {
  const jobs = load();
  jobs.push(job);
  save(jobs);
}

function updateJob(id, updates) {
  const jobs = load();
  const index = jobs.findIndex((j) => j.id === id);
  if (index !== -1) {
    jobs[index] = { ...jobs[index], ...updates };
    save(jobs);
  }
}

function removeJob(id) {
  const jobs = load().filter((j) => j.id !== id);
  save(jobs);
}

module.exports = {
  getAllJobs,
  addJob,
  updateJob,
  removeJob,
};
