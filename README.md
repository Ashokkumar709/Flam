
DEMO VIDEO LINK: https://drive.google.com/file/d/1o8GtVi8jW8yRR1yklu4d-AWe732d2vCn/view?usp=sharing

# ⚙️ **QueueCTL — CLI-Based Background Job Queue System**

> **Author:** Ashok  
> **Tech Stack:** Node.js  
> **Description:** A production-grade, CLI-based background job system with worker pools, retries, DLQ, and a monitoring dashboard.  

---

## 🚀 **Overview**

**QueueCTL** is a command-line job queue manager designed for background job execution.  
It supports **multiple workers**, **persistent storage**, **automatic retries with exponential backoff**, and a **Dead Letter Queue (DLQ)** for failed jobs.

You can manage all jobs directly through the CLI and visualize their states on a built-in **web dashboard**.

---

## 🧩 **Features**

✅ Persistent job storage (survives restarts)  
✅ Multiple worker support  
✅ Automatic retries with exponential backoff  
✅ Dead Letter Queue (DLQ) for failed jobs  
✅ Graceful worker shutdown  
✅ Configurable retry and backoff  
✅ Web dashboard for monitoring  
✅ Cross-platform support (Windows, Mac, Linux)

---

## 🗂️ **Project Structure**

```
queuectl_project/
├── bin/queuectl.js          # CLI entry point
├── src/
│   ├── db.js                # Persistent storage
│   ├── queue.js             # Job management logic
│   ├── worker.js            # Worker pool & retries
│   ├── config.js            # Configuration management
│   ├── server.js            # Express dashboard
├── data/
│   ├── jobs.json
│   ├── dead_letter.json
│   └── queuectl.pid
├── tests/demo.sh            # Automated test demo
└── package.json
```

---

## ⚙️ **Installation**

### Requirements
- Node.js 18+
- npm or yarn
- bash / PowerShell

### Setup
```bash
git clone https://github.com/Ashokkumar709/Flam.git
cd queuectl_project
npm install
npm link
```

Then run:
```bash
queuectl --help
```

---

## 💻 **CLI Commands**

| Category | Command | Description |
|-----------|----------|-------------|
| Enqueue | `queuectl enqueue '{"command":"echo Hello"}'` | Add new job |
| Workers | `queuectl worker:start --count 2` | Start workers |
|  | `queuectl worker:stop` | Stop workers |
| Status | `queuectl status` | View overall status |
| Jobs | `queuectl list --state pending` | List jobs by state |
| DLQ | `queuectl list` | View failed jobs |
|  | `queuectl dlq:retry <id>` | Retry DLQ job |
| Config | `queuectl config:get` | Show config |
|  | `queuectl config:set retry.max_retries 5` | Change config |
| Dashboard | `node src/server.js` | Launch dashboard |

---

## 🔄 **Retry Logic**

If a job fails, QueueCTL retries automatically using **exponential backoff**:

```
delay = base ^ attempts
```

Example (base=2):
| Attempt | Delay (s) |
|----------|-----------|
| 1 | 2 |
| 2 | 4 |
| 3 | 8 |

---

## 🧠 **Job Lifecycle**

| State | Meaning |
|--------|----------|
| pending | Waiting to run |
| processing | Being executed |
| completed | Finished successfully |
| failed | Failed but retryable |
| dead | Moved to DLQ |

---

## 🧾 **Dead Letter Queue (DLQ)**

Failed jobs after all retries are saved in `data/dead_letter.json`.  
Retry them manually:

```bash
queuectl dlq:list
queuectl dlq:retry <job-id>
```

---

## 📊 **Web Dashboard**

Run:
```bash
node src/server.js
```
Visit → [http://localhost:3000](http://localhost:3000)

View job summary, DLQ, and states in real-time.

---

## 🧪 **Automated Demo Test**

A ready-to-run test is included.

Run:
```bash
npm test
```

It will automatically:
- Clear old jobs  
- Enqueue success + failing jobs  
- Start workers  
- Retry & DLQ failed ones  
- Display final job status

---

## 🧩 **Architecture**

```
CLI → Queue (jobs.json) → Workers → Retry / DLQ → Dashboard
```

---

## 👨‍💻 **Author**

**Ashok**  
Backend Developer (Node.js) 
🌐 [github.com/Ashokkumar709](https://github.com/Ashokkumar709)

---

## 🏁 **Conclusion**

QueueCTL is a lightweight yet powerful background job system —  
ideal for background automation, worker queue testing, or task scheduling pipelines.
