// src/config.js
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULT_CONFIG = {
  retry: {
    base: 2,
    max_retries: 3,
  },
  worker: {
    poll_interval_ms: 2000,
  },
};

// Load config from disk or create default one
function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }

  try {
    const data = fs.readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(data || "{}");
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }
}

// Save config back to file
function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
}

// Get full config
function getAll() {
  return loadConfig();
}

// Set a config key using dot notation, e.g. "retry.max_retries"
function set(key, value) {
  const config = loadConfig();
  const parts = key.split(".");
  let current = config;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }

  const finalKey = parts[parts.length - 1];

  // Try to convert numeric values to number type
  const numValue = Number(value);
  current[finalKey] = !isNaN(numValue) ? numValue : value;

  saveConfig(config);
  console.log(`✅ Config updated: ${key} = ${value}`);
}

module.exports = {
  getAll,
  set,
};
