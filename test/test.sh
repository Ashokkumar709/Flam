#!/usr/bin/env bash
set -e

echo " Cleaning old jobs..."
echo "[]" > data/jobs.json
echo "[]" > data/dead_letter.json

echo "----------------------------------"
echo " Starting QueueCTL Demo Test"
echo "----------------------------------"

# 1️ Enqueue a successful job
echo " Enqueuing successful job..."
node bin/queuectl.js enqueue '{"id":"job1","command":"echo Hello from QueueCTL"}'

# 2️ Enqueue a failing job (to test retry + DLQ)
echo " Enqueuing failing job..."
node bin/queuectl.js enqueue '{"id":"job2","command":"thiswillfail"}'

# 3️ Enqueue a web opening job (Windows example)
echo " Enqueuing open website job..."
if [[ "$OS" == "Windows_NT" ]]; then
  node bin/queuectl.js enqueue '{"id":"job3","command":"start https://flamapp.com"}'
else
  node bin/queuectl.js enqueue '{"id":"job3","command":"xdg-open https://flamapp.com"}'
fi

# 4️ Start worker(s)
echo " Starting 2 workers..."
node bin/queuectl.js worker:start --count 2 &
WORKER_PID=$!

# Wait while jobs process (some retries may happen)
echo " Waiting for workers to process jobs..."
sleep 15

# 5️ Stop workers
echo " Stopping workers..."
node bin/queuectl.js worker:stop || true
kill $WORKER_PID 2>/dev/null || true

# 6️ Show status
echo " Final Queue Status:"
node bin/queuectl.js status

# 7️ Show DLQ
echo " Dead Letter Queue contents:"
node bin/queuectl.js dlq:list

# 8️ Retry DLQ jobs (if any)
DLQ_IDS=$(node bin/queuectl.js dlq:list | grep -o '"id": *"[^"]*"' | cut -d'"' -f4)
for id in $DLQ_IDS; do
  echo " Retrying DLQ job: $id"
  node bin/queuectl.js dlq:retry "$id"
done

# 9️ Show final job list
echo " All Jobs:"
node bin/queuectl.js list

echo "----------------------------------"
echo " Demo Test Completed Successfully"
echo "----------------------------------"
