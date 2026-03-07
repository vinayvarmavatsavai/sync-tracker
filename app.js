// file: app.js

// ================= CONFIG =================
const MANAGER_EMAILS = [
  "vinayvarmavatsavai@gmail.com",
  "harshithgosula@gmail.com",
  "vinnu24.vinay@gmail.com",
  "manojvasanthram@gmail.com",
].map((e) => e.toLowerCase());

const firebaseConfig = {
  apiKey: "AIzaSyCDmPXgIWSxlmmbW6lNhWKw-LMJ9BgaURE",
  authDomain: "tracker-86fb6.firebaseapp.com",
  projectId: "tracker-86fb6",
  storageBucket: "tracker-86fb6.firebasestorage.app",
  messagingSenderId: "687088709316",
  appId: "1:687088709316:web:32a3336558abe12ae6a391",
};

// ================= FIXED LISTS =================
const FRIEND_NAMES = [
  "Vicky",
  "Harshith",
  "Jamie",
  "Abhi",
  "Abhishek",
  "Vasanth",
  "Maharaja",
  "Ganesh",
  "Lokesh",
  "Suriya",
  "Rahul",
  "Sreejith",
];

const PROJECTS = [
  "OOI",
  "OOI based robotic prosthetic",
  "Kriya",
  "Sphere Net",
  "Hustle Trail",
  "My Checkout",
  "Out of the box Experience",
  "Bik",
  "Bakery App",
  "CA app",
];

/*
  Replace these placeholder names with your real fixed POCs.
*/
const PROJECT_OWNERS = {
  OOI: "Harshith,Ganesh,Jamie",
  "OOI based robotic prosthetic": "Harshith",
  Kriya: "Harshith,Jamie,Abhi",
  "Sphere Net": "Harshith,Jamie,Vicky,Abhi",
  "Hustle Trail": "Vicky",
  "My Checkout": "Abhi,Vicky",
  "Out of the box Experience": "Vasanth",
  Bik: "Hrashith",
  "Bakery App": "Vasanth",
  "CA app": "Jamie",
};

const TASK_STATUSES = [
  "Backlog",
  "To Do",
  "In Progress",
  "Review",
  "Done",
  "Blocked",
];
const TASK_PRIORITIES = ["Low", "Medium", "High"];
const MILESTONE_TYPES = [
  "Milestone",
  "Deadline",
  "Sprint",
  "Release",
  "Blocker",
];
const MILESTONE_STATUSES = ["Planned", "In Progress", "Done", "Delayed"];

// ================= HELPERS =================
function qs(id) {
  return document.getElementById(id);
}
function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}
function go(path) {
  window.location.href = path;
}

function isManager(email) {
  return MANAGER_EMAILS.includes((email || "").toLowerCase());
}

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isAllowedName(name) {
  return FRIEND_NAMES.includes((name || "").trim());
}

function isAllowedProject(project) {
  return PROJECTS.includes((project || "").trim());
}

function fillSelectOptions(selectEl, items, { keepFirstOption = true } = {}) {
  if (!selectEl) return;
  const first = keepFirstOption
    ? selectEl.querySelector("option")?.outerHTML || ""
    : "";
  selectEl.innerHTML =
    first +
    items
      .map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)
      .join("");
}

function priorityRank(priority) {
  return { High: 3, Medium: 2, Low: 1 }[priority] || 0;
}

function priorityChipClass(priority) {
  const p = String(priority || "").toLowerCase();
  if (p === "high") return "high";
  if (p === "medium") return "medium";
  return "low";
}

function statusPillClass(health) {
  if (health === "Completed") return "completed";
  if (health === "At Risk") return "atrisk";
  if (health === "Delayed") return "delayed";
  return "ontrack";
}

function stagePillClass(stage) {
  const s = String(stage || "").toLowerCase();

  if (s.includes("completed")) return "completed";
  if (s.includes("blocked")) return "blocked";
  if (s.includes("review")) return "review";
  if (s.includes("testing")) return "review";
  if (s.includes("development")) return "development";
  if (s.includes("planning")) return "planning";
  if (s.includes("not started")) return "notstarted";

  return "planning";
}

function deriveProjectStage(projectTasks) {
  const total = projectTasks.length;
  if (!total) return "Not Started";

  const done = projectTasks.filter((t) => t.status === "Done").length;
  const blocked = projectTasks.filter((t) => t.status === "Blocked").length;
  const review = projectTasks.filter((t) => t.status === "Review").length;
  const inProgress = projectTasks.filter(
    (t) => t.status === "In Progress",
  ).length;
  const todo = projectTasks.filter((t) => t.status === "To Do").length;
  const backlog = projectTasks.filter((t) => t.status === "Backlog").length;

  if (done === total) return "Completed";
  if (blocked > 0 && done === 0 && inProgress === 0 && review === 0)
    return "Blocked";
  if (review > 0) return "Review / Testing";
  if (inProgress > 0) return "Development";
  if (todo > 0 || backlog > 0) return "Planning";

  return "Planning";
}

function deriveHealth({ total, done, blocked, overdue, pending }) {
  if (total > 0 && done === total) return "Completed";
  if (overdue >= 2 || blocked >= 2) return "At Risk";
  if (overdue >= 1 || blocked >= 1) return "Delayed";
  if (total === 0) return "Delayed";
  if (pending > 0) return "On Track";
  return "On Track";
}

function getLatestMilestone(projectMilestones) {
  if (!projectMilestones.length) return null;

  return [...projectMilestones].sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || "")),
  )[0];
}

function getUpcomingMilestone(projectMilestones) {
  const today = todayISO();

  const upcoming = projectMilestones
    .filter((m) => (m.status || "") !== "Done" && (m.date || "") >= today)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  return upcoming[0] || null;
}

function getNextTaskStep(projectTasks) {
  const openTasks = projectTasks
    .filter((t) => t.status !== "Done")
    .sort((a, b) => {
      const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority);
      if (priorityDiff !== 0) return priorityDiff;

      const aDue = a.dueDate || "9999-12-31";
      const bDue = b.dueDate || "9999-12-31";
      return aDue.localeCompare(bDue);
    });

  return openTasks[0] || null;
}

function deriveNextStep(projectTasks, projectMilestones) {
  const nextTask = getNextTaskStep(projectTasks);
  const upcomingMilestone = getUpcomingMilestone(projectMilestones);

  if (!projectTasks.length && !projectMilestones.length) {
    return "Create initial tasks and first milestone";
  }

  if (nextTask && nextTask.title) {
    if (nextTask.dueDate) {
      return `${nextTask.title} (due ${nextTask.dueDate})`;
    }
    return nextTask.title;
  }

  if (upcomingMilestone && upcomingMilestone.title) {
    if (upcomingMilestone.date) {
      return `${upcomingMilestone.title} (${upcomingMilestone.date})`;
    }
    return upcomingMilestone.title;
  }

  if (projectTasks.length && projectTasks.every((t) => t.status === "Done")) {
    return "Close out project and confirm completion";
  }

  return "Review open work and update plan";
}

function getProjectOwner(projectName) {
  return PROJECT_OWNERS[projectName] || "—";
}

function getTeamSize(projectTasks) {
  return [
    ...new Set(
      projectTasks.map((t) => (t.assignedTo || "").trim()).filter(Boolean),
    ),
  ].length;
}

function getLatestTaskActivity(projectTasks) {
  if (!projectTasks.length) return null;

  return [...projectTasks].sort(
    (a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0),
  )[0];
}

function getDaysSinceTimestamp(ts) {
  if (!ts?.seconds) return null;
  const now = Date.now();
  const then = ts.seconds * 1000;
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function getActivityLabel(days) {
  if (days == null) return { text: "—", cls: "" };
  if (days <= 2) return { text: `${days}d ago`, cls: "activityGood" };
  if (days <= 6) return { text: `${days}d ago`, cls: "activityWarn" };
  return { text: `${days}d ago`, cls: "activityBad" };
}

function getHealthReason({ total, done, blocked, overdue, pending }) {
  if (total === 0) return "No tasks created yet";
  if (done === total) return "All tasks completed";
  if (blocked > 0 && overdue > 0)
    return `${blocked} blocked, ${overdue} overdue`;
  if (blocked > 0) return `${blocked} blocked task${blocked === 1 ? "" : "s"}`;
  if (overdue > 0) return `${overdue} overdue item${overdue === 1 ? "" : "s"}`;
  return `${pending} task${pending === 1 ? "" : "s"} remaining`;
}

function calcPercent(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function isOverdue(dateStr, status) {
  if (!dateStr) return false;
  if (status === "Done") return false;
  const today = todayISO();
  return dateStr < today;
}

function formatDateSafe(dateStr) {
  return dateStr ? escapeHtml(dateStr) : "—";
}

function resetValue(id, value = "") {
  const el = qs(id);
  if (el) el.value = value;
}

// Wait until Chart.js is ready (or show an error)
async function waitForChartJs({ tries = 12, delayMs = 200 } = {}) {
  for (let i = 0; i < tries; i++) {
    if (typeof window.Chart !== "undefined") return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

function setChartError(cardTitle, msg) {
  console.warn("[Chart Error]", cardTitle, msg);

  const map = {
    "Status split (Today)": "statusChart",
    "Updates trend (Last 7 days)": "trendChart",
    "Top projects (Today)": "projectChart",
  };
  const canvasId = map[cardTitle];
  const canvas = qs(canvasId);
  if (!canvas) return;

  const parent = canvas.parentElement;
  if (!parent) return;

  parent.innerHTML = `<div class="small" style="color:#ff5b6e; padding:10px;">${escapeHtml(msg)}</div>`;
}

// ================= INIT FIREBASE =================
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();

// ================= USER PROFILE =================
async function ensureUserProfile(user, nameGuess) {
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();

  const manager = isManager(user.email);
  const fallbackName = nameGuess || user.displayName || "Friend";

  if (!snap.exists) {
    await ref.set({
      uid: user.uid,
      name: fallbackName,
      email: user.email || "",
      approved: manager ? true : false,
      active: true,
      createdAt: serverTimestamp,
    });
  } else {
    const data = snap.data() || {};
    const patch = {};

    if (typeof data.name !== "string" || !data.name) patch.name = fallbackName;
    if (typeof data.email !== "string") patch.email = user.email || "";
    if (typeof data.active !== "boolean") patch.active = true;

    if (typeof data.approved !== "boolean")
      patch.approved = manager ? true : false;
    if (manager && data.approved !== true) patch.approved = true;

    if (Object.keys(patch).length) await ref.update(patch);
  }

  const latest = await ref.get();
  return latest.data();
}

async function getMyProfile(uid) {
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? snap.data() : null;
}

async function getUserByName(name) {
  if (!name) return null;

  const cleanName = normalizeName(name);

  const exactSnap = await db
    .collection("users")
    .where("name", "==", name)
    .limit(1)
    .get();

  if (!exactSnap.empty) {
    const doc = exactSnap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  const allSnap = await db.collection("users").get();
  const match = allSnap.docs.find((doc) => {
    const data = doc.data() || {};
    return normalizeName(data.name) === cleanName;
  });

  if (!match) return null;
  return { id: match.id, ...match.data() };
}

// ================= AUTH GUARD =================
async function requireAuth({ mustBeApproved = false, mustBeManager = false }) {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) return go("index.html");

      const profile = await ensureUserProfile(user, user.displayName);

      if (mustBeManager && !isManager(user.email)) return go("dashboard.html");
      if (mustBeApproved && (!profile?.approved || !profile?.active))
        return go("pending.html");

      resolve({ user, profile });
    });
  });
}

// ================= AUTH PAGE (index.html) =================
function initAuthPage() {
  const form = qs("loginForm");
  if (!form) return;

  let mode = "login";

  const nameWrap = qs("nameWrap");
  const nameEl = qs("name");

  fillSelectOptions(nameEl, FRIEND_NAMES, { keepFirstOption: true });

  function setMode(m) {
    mode = m;

    if (m === "signup") {
      nameWrap.style.display = "block";
      nameEl.required = true;
    } else {
      nameWrap.style.display = "none";
      nameEl.required = false;
      nameEl.value = "";
    }

    qs("title").innerText = m === "signup" ? "Join the team" : "Welcome back";
    qs("submitBtn").innerText = m === "signup" ? "Create account" : "Login";
    qs("msg").className = "msg";
    qs("msg").innerText = "";
  }

  qs("modeSignup")?.addEventListener("click", () => setMode("signup"));
  qs("modeLogin")?.addEventListener("click", () => setMode("login"));
  setMode("login");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = (nameEl?.value || "").trim();
    const email = (qs("email")?.value || "").trim();
    const pass = qs("password")?.value || "";

    qs("msg").className = "msg";
    qs("msg").innerText = "Please wait…";

    if (mode === "signup" && !isAllowedName(name)) {
      qs("msg").className = "msg bad";
      qs("msg").innerText = "Please select your name from the list.";
      return;
    }

    try {
      let cred;
      if (mode === "signup") {
        cred = await auth.createUserWithEmailAndPassword(email, pass);
        await cred.user.updateProfile({ displayName: name });
        await ensureUserProfile(cred.user, name);
      } else {
        cred = await auth.signInWithEmailAndPassword(email, pass);
        await ensureUserProfile(cred.user, cred.user.displayName);
      }

      const profile = await getMyProfile(cred.user.uid);

      if (isManager(cred.user.email)) return go("manager.html");
      if (profile?.approved) go("dashboard.html");
      else go("pending.html");
    } catch (err) {
      console.error(err);
      qs("msg").className = "msg bad";
      qs("msg").innerText = err.message || "Failed";
    }
  });
}

// ================= PENDING PAGE =================
async function initPendingPage() {
  if (!qs("pendingBox")) return;

  const { user, profile } = await requireAuth({ mustBeApproved: false });

  qs("meEmail").innerText = user.email || "";
  qs("meName").innerText = profile?.name || user.displayName || "Friend";

  qs("logoutBtn")?.addEventListener("click", async () => {
    await auth.signOut();
    go("index.html");
  });

  if (profile?.approved) go("dashboard.html");
}

// ================= DASHBOARD PAGE =================
async function initDashboardPage() {
  if (!qs("dashboardPage")) return;

  const { user, profile } = await requireAuth({ mustBeApproved: true });

  qs("helloName").innerText = profile?.name || "Friend";
  qs("today").value = todayISO();

  fillSelectOptions(qs("project"), PROJECTS, { keepFirstOption: true });

  if (isManager(user.email) && qs("managerLink"))
    qs("managerLink").style.display = "inline-flex";
  if (isManager(user.email) && qs("scrumLink"))
    qs("scrumLink").style.display = "inline-flex";

  qs("logoutBtn")?.addEventListener("click", async () => {
    await auth.signOut();
    go("index.html");
  });

  qs("saveBtn")?.addEventListener("click", async () => {
    const saveBtn = qs("saveBtn");

    const data = {
      uid: user.uid,
      name: profile?.name || user.displayName || "Friend",
      date: qs("today").value,
      project: (qs("project")?.value || "").trim(),
      tasks: (qs("tasks")?.value || "").trim(),
      status: qs("status")?.value || "In Progress",
      priority: qs("priority")?.value || "Medium",
      blockers: (qs("blockers")?.value || "").trim(),
      notes: (qs("notes")?.value || "").trim(),
      createdAt: serverTimestamp,
    };

    qs("saveMsg").className = "msg";
    qs("saveMsg").innerText = "Saving…";

    if (!data.project || !data.tasks) {
      qs("saveMsg").className = "msg bad";
      qs("saveMsg").innerText = "Project and Tasks are required.";
      return;
    }

    if (!isAllowedProject(data.project)) {
      qs("saveMsg").className = "msg bad";
      qs("saveMsg").innerText = "Please select a valid project.";
      return;
    }

    try {
      saveBtn.disabled = true;
      await db.collection("updates").add(data);
      qs("saveMsg").className = "msg ok";
      qs("saveMsg").innerText = "Saved ✅";
      qs("tasks").value = "";
      qs("blockers").value = "";
      qs("notes").value = "";
      await loadMyUpdates(user.uid);
    } catch (err) {
      console.error(err);
      qs("saveMsg").className = "msg bad";
      qs("saveMsg").innerText = err.message || "Failed";
    } finally {
      saveBtn.disabled = false;
    }
  });

  await loadMyAssignedTasks(user.uid, profile);
  await loadMyUpdates(user.uid);

  async function loadMyAssignedTasks(uid, profileData) {
    const listEl = qs("assignedTasksList");
    if (!listEl) return;

    listEl.innerHTML = `<div class="small">Loading assigned tasks…</div>`;

    try {
      const myName = normalizeName(profileData?.name || user.displayName || "");

      const snap = await db
        .collection("boardTasks")
        .where("assignedUid", "==", uid)
        .get();

      let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      docs.sort((a, b) => {
        const rankDiff = priorityRank(b.priority) - priorityRank(a.priority);
        if (rankDiff !== 0) return rankDiff;
        return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
      });

      const today = todayISO();
      const newTasks = docs.filter((t) => t.seenByAssignee === false).length;
      const dueToday = docs.filter(
        (t) => (t.dueDate || "") === today && t.status !== "Done",
      ).length;
      const blocked = docs.filter((t) => t.status === "Blocked").length;

      if (qs("assignedCount")) {
        qs("assignedCount").innerText = String(docs.length);
      }
      if (qs("newAssignedCount")) {
        qs("newAssignedCount").innerText = String(newTasks);
      }
      if (qs("dueTodayCount")) {
        qs("dueTodayCount").innerText = String(dueToday);
      }
      if (qs("assignedBlockedCount")) {
        qs("assignedBlockedCount").innerText = String(blocked);
      }

      if (!docs.length) {
        listEl.innerHTML = `<div class="emptyState">No tasks assigned to you yet.</div>`;
        return;
      }

      listEl.innerHTML = docs
        .map(
          (task) => `
        <div class="card" style="padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
            <div style="flex:1; min-width:220px;">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                <div style="font-size:16px; font-weight:800;">${escapeHtml(task.title || "Untitled Task")}</div>
                ${task.seenByAssignee === false ? `<span class="pill ontrack">New</span>` : ``}
              </div>

              <div class="taskMetaRow">
                <span class="taskChip">${escapeHtml(task.project || "No project")}</span>
                <span class="taskChip ${priorityChipClass(task.priority)}">${escapeHtml(task.priority || "Medium")}</span>
                <span class="taskChip">${escapeHtml(task.status || "Backlog")}</span>
                ${task.dueDate ? `<span class="taskChip">Due ${escapeHtml(task.dueDate)}</span>` : ``}
              </div>

              ${task.description ? `<div class="taskCardDesc" style="margin-top:8px;">${escapeHtml(task.description)}</div>` : ``}
              ${task.blockers ? `<div class="taskCardDesc" style="margin-top:8px;">Blockers: ${escapeHtml(task.blockers)}</div>` : ``}
            </div>

            <div style="display:flex; flex-direction:column; gap:8px; min-width:220px;">
              <select data-task-status="${escapeHtml(task.id)}">
                ${TASK_STATUSES.map(
                  (status) => `
                  <option value="${escapeHtml(status)}" ${status === (task.status || "Backlog") ? "selected" : ""}>
                    ${escapeHtml(status)}
                  </option>
                `,
                ).join("")}
              </select>

              <button class="btn" type="button" data-start-task="${escapeHtml(task.id)}">Start</button>
              <button class="btn primary" type="button" data-done-task="${escapeHtml(task.id)}">Mark Done</button>
              <button class="btn danger" type="button" data-blocked-task="${escapeHtml(task.id)}">Mark Blocked</button>
            </div>
          </div>
        </div>
      `,
        )
        .join("");

      const unseenDocs = docs.filter((t) => t.seenByAssignee === false);
      for (const task of unseenDocs) {
        await db.collection("boardTasks").doc(task.id).update({
          seenByAssignee: true,
          updatedAt: serverTimestamp,
        });
      }

      document.querySelectorAll("[data-task-status]").forEach((el) => {
        el.addEventListener("change", async () => {
          const taskId = el.getAttribute("data-task-status");
          try {
            await db
              .collection("boardTasks")
              .doc(taskId)
              .update({
                status: el.value,
                updatedAt: serverTimestamp,
                completedAt: el.value === "Done" ? serverTimestamp : null,
                completedBy: el.value === "Done" ? user.uid : null,
              });
            await loadMyAssignedTasks(uid, profileData);
          } catch (err) {
            console.error(err);
          }
        });
      });

      document.querySelectorAll("[data-start-task]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const taskId = btn.getAttribute("data-start-task");
          try {
            await db.collection("boardTasks").doc(taskId).update({
              status: "In Progress",
              updatedAt: serverTimestamp,
            });
            await loadMyAssignedTasks(uid, profileData);
          } catch (err) {
            console.error(err);
          }
        });
      });

      document.querySelectorAll("[data-done-task]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const taskId = btn.getAttribute("data-done-task");
          try {
            await db.collection("boardTasks").doc(taskId).update({
              status: "Done",
              updatedAt: serverTimestamp,
              completedAt: serverTimestamp,
              completedBy: user.uid,
            });
            await loadMyAssignedTasks(uid, profileData);
          } catch (err) {
            console.error(err);
          }
        });
      });

      document.querySelectorAll("[data-blocked-task]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const taskId = btn.getAttribute("data-blocked-task");
          try {
            await db.collection("boardTasks").doc(taskId).update({
              status: "Blocked",
              updatedAt: serverTimestamp,
            });
            await loadMyAssignedTasks(uid, profileData);
          } catch (err) {
            console.error(err);
          }
        });
      });
    } catch (err) {
      console.error(err);
      listEl.innerHTML = `<div class="emptyState">Unable to load assigned tasks.</div>`;
    }
  }

  async function loadMyUpdates(uid) {
    qs("rows").innerHTML =
      `<tr><td colspan="7" class="small">Loading…</td></tr>`;

    const snap = await db.collection("updates").where("uid", "==", uid).get();
    let docs = snap.docs.map((d) => d.data());

    docs.sort(
      (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
    );

    if (!docs.length) {
      qs("rows").innerHTML =
        `<tr><td colspan="7" class="small">No updates yet.</td></tr>`;
      return;
    }

    qs("rows").innerHTML = docs
      .map(
        (r) => `
      <tr>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.project)}</td>
        <td>${escapeHtml(r.status)}</td>
        <td>${escapeHtml(r.priority)}</td>
        <td>${escapeHtml(r.tasks)}</td>
        <td>${escapeHtml(r.blockers)}</td>
        <td>${escapeHtml(r.notes)}</td>
      </tr>
    `,
      )
      .join("");
  }
}

// ================= MANAGER PAGE (OVERVIEW) =================
async function initManagerPage() {
  if (!qs("managerPage")) return;

  const { user } = await requireAuth({
    mustBeApproved: false,
    mustBeManager: true,
  });

  qs("logoutBtn")?.addEventListener("click", async () => {
    await auth.signOut();
    go("index.html");
  });

  fillSelectOptions(qs("projectFilter"), PROJECTS, { keepFirstOption: true });

  let statusChart = null;
  let trendChart = null;
  let projectChart = null;

  function destroyChart(ch) {
    try {
      ch && ch.destroy();
    } catch (_) {}
  }

  async function loadPendingApprovals() {
    if (!qs("pendingList")) return;

    qs("pendingList").innerHTML = `<div class="small">Loading…</div>`;

    try {
      const snap = await db
        .collection("users")
        .where("approved", "==", false)
        .get();
      const users = snap.docs.map((d) => d.data());

      users.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
      );

      if (!users.length) {
        qs("pendingList").innerHTML =
          `<div class="small">No pending requests 🎉</div>`;
        return;
      }

      qs("pendingList").innerHTML = users
        .map(
          (u) => `
        <div class="card" style="padding:14px;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div>
              <div style="font-weight:800;">${escapeHtml(u.name || "Friend")}</div>
              <div class="small">${escapeHtml(u.email || "")}</div>
            </div>
            <button class="btn primary" data-approve="${escapeHtml(u.uid)}" type="button">Approve</button>
          </div>
        </div>
      `,
        )
        .join("");

      document.querySelectorAll("[data-approve]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const uid = btn.getAttribute("data-approve");
          btn.disabled = true;
          btn.innerText = "Approving…";

          await db.collection("users").doc(uid).update({
            approved: true,
            approvedAt: serverTimestamp,
            approvedBy: user.uid,
          });

          await loadPendingApprovals();
        });
      });
    } catch (err) {
      console.error(err);
      qs("pendingList").innerHTML =
        `<div class="small" style="color:#ff5b6e;">Error loading pending approvals</div>`;
    }
  }

  async function loadTodayAndCharts({ skipCharts = false } = {}) {
    const filterProject = (qs("projectFilter")?.value || "__ALL__").trim();
    const today = todayISO();

    const snap = await db
      .collection("updates")
      .where("date", "==", today)
      .get();
    let updates = snap.docs.map((d) => d.data());

    if (filterProject !== "__ALL__") {
      updates = updates.filter(
        (u) => (u.project || "").trim() === filterProject,
      );
    }

    if (qs("todayRows")) {
      if (!updates.length) {
        qs("todayRows").innerHTML =
          `<tr><td colspan="6" class="small">No updates for today.</td></tr>`;
      } else {
        updates.sort(
          (a, b) => priorityRank(b.priority) - priorityRank(a.priority),
        );

        qs("todayRows").innerHTML = updates
          .map(
            (u) => `
          <tr>
            <td>${escapeHtml(u.name)}</td>
            <td>${escapeHtml(u.project)}</td>
            <td>${escapeHtml(u.status)}</td>
            <td>${escapeHtml(u.priority)}</td>
            <td>${escapeHtml(u.tasks)}</td>
            <td>${escapeHtml(u.blockers)}</td>
          </tr>
        `,
          )
          .join("");
      }
    }

    const blocked = updates.filter((u) => (u.status || "") === "Blocked");
    if (qs("blockedRows")) {
      if (!blocked.length) {
        qs("blockedRows").innerHTML =
          `<tr><td colspan="5" class="small">No blockers today 🎉</td></tr>`;
      } else {
        qs("blockedRows").innerHTML = blocked
          .map(
            (u) => `
          <tr>
            <td>${escapeHtml(u.name)}</td>
            <td>${escapeHtml(u.project)}</td>
            <td>${escapeHtml(u.tasks)}</td>
            <td>${escapeHtml(u.blockers)}</td>
            <td>${escapeHtml(u.notes)}</td>
          </tr>
        `,
          )
          .join("");
      }
    }

    if (qs("statTotalUpdates"))
      qs("statTotalUpdates").innerText = String(updates.length);
    if (qs("statDoneCount"))
      qs("statDoneCount").innerText = String(
        updates.filter((u) => u.status === "Done").length,
      );
    if (qs("statBlockedCount"))
      qs("statBlockedCount").innerText = String(blocked.length);
    if (qs("statHighPriorityCount"))
      qs("statHighPriorityCount").innerText = String(
        updates.filter((u) => u.priority === "High").length,
      );

    if (skipCharts) return;
    if (typeof window.Chart === "undefined") return;

    const statusCounts = { Done: 0, "In Progress": 0, Blocked: 0 };
    updates.forEach((u) => {
      const s = u.status || "In Progress";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    destroyChart(statusChart);
    const statusCtx = qs("statusChart")?.getContext?.("2d");
    if (statusCtx) {
      statusChart = new Chart(statusCtx, {
        type: "doughnut",
        data: {
          labels: Object.keys(statusCounts),
          datasets: [{ data: Object.values(statusCounts) }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
        },
      });
    }

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      days.push(`${d.getFullYear()}-${mm}-${dd}`);
    }

    const trendSnap = await db
      .collection("updates")
      .where("date", ">=", days[0])
      .get();
    let last = trendSnap.docs.map((d) => d.data());

    if (filterProject !== "__ALL__") {
      last = last.filter((u) => (u.project || "").trim() === filterProject);
    }

    const dayCounts = {};
    days.forEach((d) => (dayCounts[d] = 0));
    last.forEach((u) => {
      if (dayCounts[u.date] != null) dayCounts[u.date] += 1;
    });

    destroyChart(trendChart);
    const trendCtx = qs("trendChart")?.getContext?.("2d");
    if (trendCtx) {
      trendChart = new Chart(trendCtx, {
        type: "line",
        data: {
          labels: days.map((d) => d.slice(5)),
          datasets: [{ data: days.map((d) => dayCounts[d]) }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
      });
    }

    const projectCounts = {};
    updates.forEach((u) => {
      const p = (u.project || "Unknown").trim();
      projectCounts[p] = (projectCounts[p] || 0) + 1;
    });

    const top = Object.entries(projectCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const topLabels = top.map((x) => x[0]);
    const topValues = top.map((x) => x[1]);

    destroyChart(projectChart);
    const projCtx = qs("projectChart")?.getContext?.("2d");
    if (projCtx) {
      projectChart = new Chart(projCtx, {
        type: "bar",
        data: { labels: topLabels, datasets: [{ data: topValues }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
      });
    }
  }

  await loadPendingApprovals();

  const ok = await waitForChartJs();
  await loadTodayAndCharts({ skipCharts: !ok });

  qs("projectFilter")?.addEventListener("change", () => {
    loadTodayAndCharts({
      skipCharts: typeof window.Chart === "undefined",
    }).catch(console.error);
  });
}

// ================= SCRUM BOARD PAGE =================
async function initScrumBoardPage() {
  if (!qs("scrumPage")) return;

  const { user } = await requireAuth({
    mustBeApproved: false,
    mustBeManager: true,
  });

  qs("logoutBtn")?.addEventListener("click", async () => {
    await auth.signOut();
    go("index.html");
  });

  fillSelectOptions(qs("taskProject"), PROJECTS, { keepFirstOption: true });
  fillSelectOptions(qs("filterProject"), PROJECTS, { keepFirstOption: true });
  fillSelectOptions(qs("taskAssignee"), FRIEND_NAMES, {
    keepFirstOption: true,
  });
  fillSelectOptions(qs("filterAssignee"), FRIEND_NAMES, {
    keepFirstOption: true,
  });

  let editingTaskId = null;

  function resetTaskForm() {
    editingTaskId = null;
    resetValue("taskId");
    resetValue("taskTitle");
    resetValue("taskDescription");
    resetValue("taskBlockers");
    resetValue("taskDueDate");

    if (qs("taskProject")) qs("taskProject").value = "";
    if (qs("taskAssignee")) qs("taskAssignee").value = "";
    if (qs("taskPriority")) qs("taskPriority").value = "Medium";
    if (qs("taskStatus")) qs("taskStatus").value = "In Progress";
    if (qs("taskSaveBtn")) qs("taskSaveBtn").innerText = "Save Task";

    if (qs("taskMsg")) {
      qs("taskMsg").className = "msg";
      qs("taskMsg").innerText = "";
    }
  }

  function getBoardColumnElements() {
    return {
      Backlog: {
        count: qs("countBacklog"),
        summary: qs("summaryBacklog"),
        list: qs("colBacklog"),
        empty: "No backlog tasks yet.",
      },
      "To Do": {
        count: qs("countTodo"),
        summary: qs("summaryTodo"),
        list: qs("colTodo"),
        empty: "No to-do tasks yet.",
      },
      "In Progress": {
        count: qs("countProgress"),
        summary: qs("summaryProgress"),
        list: qs("colProgress"),
        empty: "No tasks in progress yet.",
      },
      Review: {
        count: qs("countReview"),
        summary: qs("summaryReview"),
        list: qs("colReview"),
        empty: "No review tasks yet.",
      },
      Done: {
        count: qs("countDone"),
        summary: qs("summaryDone"),
        list: qs("colDone"),
        empty: "No completed tasks yet.",
      },
      Blocked: {
        count: qs("countBlocked"),
        summary: qs("summaryBlocked"),
        list: qs("colBlocked"),
        empty: "No blocked tasks yet.",
      },
    };
  }

  function renderTaskCard(task) {
    const title = escapeHtml(task.title || "Untitled Task");
    const project = escapeHtml(task.project || "No project");
    const assignee = escapeHtml(task.assignedTo || "Unassigned");
    const priority = escapeHtml(task.priority || "Medium");
    const priorityClass = priorityChipClass(task.priority || "Medium");
    const dueDate = task.dueDate
      ? `<span class="taskDue">Due: ${escapeHtml(task.dueDate)}</span>`
      : `<span class="taskDue">No due date</span>`;

    const descHtml = task.description
      ? `<p class="taskCardDesc">${escapeHtml(task.description)}</p>`
      : `<p class="taskCardDesc">No description added yet.</p>`;

    const blockersHtml = task.blockers
      ? `<div class="taskMetaRow"><span class="taskChip">Blocker: ${escapeHtml(task.blockers)}</span></div>`
      : ``;

    return `
      <div class="taskCard">
        <h4 class="taskCardTitle">${title}</h4>

        ${descHtml}

        <div class="taskMetaRow">
          <span class="taskChip">${project}</span>
          <span class="taskChip ${priorityClass}">${priority}</span>
        </div>

        ${blockersHtml}

        <div class="taskFooter">
          <span class="taskAssignee">${assignee}</span>
          ${dueDate}
        </div>

        <div class="taskControls">
          <div class="row">
            <select data-move-task="${escapeHtml(task.id)}">
              ${TASK_STATUSES.map(
                (s) => `
                  <option value="${escapeHtml(s)}" ${s === (task.status || "Backlog") ? "selected" : ""}>
                    ${escapeHtml(s)}
                  </option>
                `,
              ).join("")}
            </select>
          </div>

          <div class="row">
            <button class="btn" type="button" data-edit-task="${escapeHtml(task.id)}">Edit</button>
            <button class="btn danger" type="button" data-delete-task="${escapeHtml(task.id)}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  const boardParams = new URLSearchParams(window.location.search);
  const projectFromUrl = boardParams.get("project");

  if (projectFromUrl && qs("filterProject")) {
    qs("filterProject").value = projectFromUrl;
  }

  async function loadBoard() {
    const filterProject = qs("filterProject")?.value || "__ALL__";
    const filterAssignee = qs("filterAssignee")?.value || "__ALL__";
    const filterPriority = qs("filterPriority")?.value || "__ALL__";

    try {
      const snap = await db.collection("boardTasks").get();
      let tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (filterProject !== "__ALL__") {
        tasks = tasks.filter((t) => (t.project || "") === filterProject);
      }

      if (filterAssignee !== "__ALL__") {
        tasks = tasks.filter((t) => (t.assignedTo || "") === filterAssignee);
      }

      if (filterPriority !== "__ALL__") {
        tasks = tasks.filter((t) => (t.priority || "") === filterPriority);
      }

      tasks.sort((a, b) => {
        const priorityDiff =
          priorityRank(b.priority) - priorityRank(a.priority);
        if (priorityDiff !== 0) return priorityDiff;
        return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
      });

      const columns = getBoardColumnElements();

      Object.values(columns).forEach(({ count, summary, list, empty }) => {
        if (count) count.innerText = "0";
        if (summary) summary.innerText = "0";
        if (list)
          list.innerHTML = `<div class="boardEmpty">${escapeHtml(empty)}</div>`;
      });

      TASK_STATUSES.forEach((status) => {
        const group = tasks.filter((t) => (t.status || "Backlog") === status);
        const col = columns[status];
        if (!col?.list) return;

        if (col.count) col.count.innerText = String(group.length);
        if (col.summary) col.summary.innerText = String(group.length);

        if (!group.length) {
          col.list.innerHTML = `<div class="boardEmpty">${escapeHtml(col.empty)}</div>`;
          return;
        }

        col.list.innerHTML = group.map(renderTaskCard).join("");
      });

      document.querySelectorAll("[data-move-task]").forEach((el) => {
        el.addEventListener("change", async () => {
          const taskId = el.getAttribute("data-move-task");
          try {
            await db
              .collection("boardTasks")
              .doc(taskId)
              .update({
                status: el.value,
                updatedAt: serverTimestamp,
                completedAt: el.value === "Done" ? serverTimestamp : null,
                completedBy: el.value === "Done" ? user.uid : null,
              });
            await loadBoard();
          } catch (err) {
            console.error(err);
          }
        });
      });

      document.querySelectorAll("[data-delete-task]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const taskId = btn.getAttribute("data-delete-task");
          try {
            await db.collection("boardTasks").doc(taskId).delete();
            if (editingTaskId === taskId) resetTaskForm();
            await loadBoard();
          } catch (err) {
            console.error(err);
          }
        });
      });

      document.querySelectorAll("[data-edit-task]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const taskId = btn.getAttribute("data-edit-task");
          try {
            const doc = await db.collection("boardTasks").doc(taskId).get();
            if (!doc.exists) return;

            const task = doc.data() || {};
            editingTaskId = taskId;

            if (qs("taskId")) qs("taskId").value = taskId;
            if (qs("taskTitle")) qs("taskTitle").value = task.title || "";
            if (qs("taskProject")) qs("taskProject").value = task.project || "";
            if (qs("taskAssignee"))
              qs("taskAssignee").value = task.assignedTo || "";
            if (qs("taskPriority"))
              qs("taskPriority").value = task.priority || "Medium";
            if (qs("taskStatus"))
              qs("taskStatus").value = task.status || "In Progress";
            if (qs("taskDueDate")) qs("taskDueDate").value = task.dueDate || "";
            if (qs("taskDescription"))
              qs("taskDescription").value = task.description || "";
            if (qs("taskBlockers"))
              qs("taskBlockers").value = task.blockers || "";

            if (qs("taskSaveBtn")) qs("taskSaveBtn").innerText = "Update Task";
            if (qs("taskMsg")) {
              qs("taskMsg").className = "msg";
              qs("taskMsg").innerText = "Editing selected task.";
            }

            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch (err) {
            console.error(err);
          }
        });
      });
    } catch (err) {
      console.error(err);
    }
  }

  qs("taskSaveBtn")?.addEventListener("click", async () => {
    const saveBtn = qs("taskSaveBtn");
    const title = (qs("taskTitle")?.value || "").trim();
    const project = (qs("taskProject")?.value || "").trim();
    const assignedTo = (qs("taskAssignee")?.value || "").trim();
    const priority = qs("taskPriority")?.value || "Medium";
    const status = qs("taskStatus")?.value || "In Progress";
    const dueDate = qs("taskDueDate")?.value || "";
    const description = (qs("taskDescription")?.value || "").trim();
    const blockers = (qs("taskBlockers")?.value || "").trim();

    qs("taskMsg").className = "msg";
    qs("taskMsg").innerText = editingTaskId ? "Updating task…" : "Saving task…";

    if (!title || !project) {
      qs("taskMsg").className = "msg bad";
      qs("taskMsg").innerText = "Task title and project are required.";
      return;
    }

    if (!isAllowedProject(project)) {
      qs("taskMsg").className = "msg bad";
      qs("taskMsg").innerText = "Please select a valid project.";
      return;
    }

    if (assignedTo && !isAllowedName(assignedTo)) {
      qs("taskMsg").className = "msg bad";
      qs("taskMsg").innerText = "Please select a valid teammate.";
      return;
    }

    try {
      saveBtn.disabled = true;

      let assignedUid = "";
      let assignedEmail = "";

      if (assignedTo) {
        const assignedUser = await getUserByName(assignedTo);
        assignedUid = assignedUser?.uid || assignedUser?.id || "";
        assignedEmail = assignedUser?.email || "";
      }

      const payload = {
        title,
        project,
        assignedTo,
        assignedUid,
        assignedEmail,
        priority: TASK_PRIORITIES.includes(priority) ? priority : "Medium",
        status: TASK_STATUSES.includes(status) ? status : "In Progress",
        dueDate,
        description,
        blockers,
        updatedAt: serverTimestamp,
      };

      if (editingTaskId) {
        await db.collection("boardTasks").doc(editingTaskId).update(payload);
        qs("taskMsg").className = "msg ok";
        qs("taskMsg").innerText = "Task updated ✅";
      } else {
        await db.collection("boardTasks").add({
          ...payload,
          seenByAssignee: false,
          createdBy: user.uid,
          createdAt: serverTimestamp,
        });
        qs("taskMsg").className = "msg ok";
        qs("taskMsg").innerText = "Task created ✅";
      }

      resetTaskForm();
      await loadBoard();
    } catch (err) {
      console.error(err);
      qs("taskMsg").className = "msg bad";
      qs("taskMsg").innerText = err.message || "Failed to save task.";
    } finally {
      saveBtn.disabled = false;
    }
  });

  qs("filterProject")?.addEventListener("change", loadBoard);
  qs("filterAssignee")?.addEventListener("change", loadBoard);
  qs("filterPriority")?.addEventListener("change", loadBoard);

  await loadBoard();
}

// ================= PROJECT STATUS PAGE =================
async function initProjectStatusPage() {
  if (!qs("projectStatusPage")) return;

  await requireAuth({ mustBeApproved: false, mustBeManager: true });

  qs("logoutBtn")?.addEventListener("click", async () => {
    await auth.signOut();
    go("index.html");
  });

  fillSelectOptions(qs("statusProjectFilter"), PROJECTS, {
    keepFirstOption: true,
  });

  async function loadProjectStatus() {
    const filterProject = qs("statusProjectFilter")?.value || "__ALL__";

    qs("projectStatusRows").innerHTML = `
      <tr>
        <td colspan="14" class="small">Loading project data…</td>
      </tr>
    `;

    const [taskSnap, milestoneSnap] = await Promise.all([
      db.collection("boardTasks").get(),
      db.collection("projectMilestones").get(),
    ]);

    let tasks = taskSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    let milestones = milestoneSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (filterProject !== "__ALL__") {
      tasks = tasks.filter((t) => (t.project || "") === filterProject);
      milestones = milestones.filter(
        (m) => (m.project || "") === filterProject,
      );
    }

    const projectsToShow =
      filterProject === "__ALL__" ? PROJECTS : [filterProject];

    const rows = [];

    let totalProjectsCount = 0;
    let activeProjectsCount = 0;
    let atRiskCount = 0;
    let completedCount = 0;

    const stageCounts = {
      "Not Started": 0,
      Planning: 0,
      Development: 0,
      "Review / Testing": 0,
      Blocked: 0,
      Completed: 0,
    };

    let projectsWithBlocked = 0;
    let projectsWithOverdue = 0;
    let projectsWithHighPending = 0;

    projectsToShow.forEach((projectName) => {
      const projectTasks = tasks.filter(
        (t) => (t.project || "") === projectName,
      );
      const projectMilestones = milestones.filter(
        (m) => (m.project || "") === projectName,
      );

      const total = projectTasks.length;
      const done = projectTasks.filter((t) => t.status === "Done").length;
      const blocked = projectTasks.filter((t) => t.status === "Blocked").length;
      const overdue = projectTasks.filter((t) =>
        isOverdue(t.dueDate, t.status),
      ).length;
      const pending = Math.max(total - done, 0);
      const completion = calcPercent(done, total);

      const currentStage = deriveProjectStage(projectTasks);
      const health = deriveHealth({ total, done, blocked, overdue, pending });
      const healthReason = getHealthReason({
        total,
        done,
        blocked,
        overdue,
        pending,
      });

      const latestMilestoneObj = getLatestMilestone(projectMilestones);
      const latestMilestone = latestMilestoneObj?.title || "—";

      const upcomingMilestone = getUpcomingMilestone(projectMilestones);
      const nextStep = deriveNextStep(projectTasks, projectMilestones);

      const owner = getProjectOwner(projectName);
      const teamSize = getTeamSize(projectTasks);

      const latestTaskActivity = getLatestTaskActivity(projectTasks);
      const inactiveDays = getDaysSinceTimestamp(latestTaskActivity?.updatedAt);
      const activity = getActivityLabel(inactiveDays);

      const rowClass =
        blocked >= 2 || overdue >= 2
          ? "projectRow projectDanger"
          : "projectRow";

      totalProjectsCount++;

      if (health === "Completed") completedCount++;
      else activeProjectsCount++;

      if (health === "At Risk" || health === "Delayed") atRiskCount++;

      if (stageCounts[currentStage] != null) {
        stageCounts[currentStage] += 1;
      }

      if (blocked > 0) projectsWithBlocked++;
      if (overdue > 0) projectsWithOverdue++;
      if (pending >= 3) projectsWithHighPending++;

      rows.push(`
        <tr class="${rowClass}" data-project="${escapeHtml(projectName)}">
          <td>
            <div class="metricStack">
              <div class="metricMain">${escapeHtml(projectName)}</div>
              <div class="metricSub">${total} total task${total === 1 ? "" : "s"}</div>
            </div>
          </td>

          <td class="ownerCell">
            <div class="metricMain">${escapeHtml(owner)}</div>
          </td>

          <td class="teamCell">
            <span class="teamBadge">${teamSize}</span>
          </td>

          <td>
            <span class="stagePill ${stagePillClass(currentStage)}">${escapeHtml(currentStage)}</span>
          </td>

          <td class="healthCell">
            <span class="pill ${statusPillClass(health)}">${escapeHtml(health)}</span>
            <div class="healthReason">${escapeHtml(healthReason)}</div>
          </td>

          <td class="progressCell">
            <div class="progressTrack">
              <div class="progressFill" style="width:${completion}%"></div>
            </div>
            <div class="progressMeta">${completion}% complete</div>
          </td>

          <td>
            <div class="metricStack">
              <div class="metricMain">${pending}</div>
              <div class="metricSub">${done} done / ${total} total</div>
            </div>
          </td>

          <td>
            <div class="metricStack">
              <div class="metricMain">${blocked}</div>
              <div class="metricSub">blocked task${blocked === 1 ? "" : "s"}</div>
            </div>
          </td>

          <td>
            <div class="metricStack">
              <div class="metricMain">${overdue}</div>
              <div class="metricSub">overdue item${overdue === 1 ? "" : "s"}</div>
            </div>
          </td>

          <td class="activityCell">
            <div class="metricMain ${activity.cls}">${escapeHtml(activity.text)}</div>
          </td>

          <td class="nextStepText">
            ${escapeHtml(nextStep)}
          </td>

          <td class="milestoneCell">
            ${escapeHtml(latestMilestone)}
          </td>

          <td class="targetCell">
            ${upcomingMilestone?.date ? escapeHtml(upcomingMilestone.date) : "—"}
          </td>

          <td>
            <div class="actionButtons">
              <button class="btn actionBtnMini" type="button" data-open-board="${escapeHtml(projectName)}">Board</button>
              <button class="btn ghost actionBtnMini" type="button" data-open-timeline="${escapeHtml(projectName)}">Timeline</button>
            </div>
          </td>
        </tr>
      `);
    });

    qs("projectStatusRows").innerHTML = rows.length
      ? rows.join("")
      : `<tr><td colspan="14" class="small">No project data found.</td></tr>`;

    if (qs("projectsTotal"))
      qs("projectsTotal").innerText = String(totalProjectsCount);
    if (qs("projectsActive"))
      qs("projectsActive").innerText = String(activeProjectsCount);
    if (qs("projectsAtRisk"))
      qs("projectsAtRisk").innerText = String(atRiskCount);
    if (qs("projectsCompleted"))
      qs("projectsCompleted").innerText = String(completedCount);

    const stageBreakdownHtml = Object.entries(stageCounts)
      .filter(([, count]) => count > 0)
      .map(
        ([stage, count]) => `
        <div class="insightItem">
          <div class="insightLeft">
            <div class="insightTitle">${escapeHtml(stage)}</div>
            <div class="insightNote">Projects currently in this stage</div>
          </div>
          <div class="insightValue">${count}</div>
        </div>
      `,
      )
      .join("");

    if (qs("stageBreakdownList")) {
      qs("stageBreakdownList").innerHTML =
        stageBreakdownHtml ||
        `
        <div class="emptyState">No stage data available yet.</div>
      `;
    }

    const attentionItems = [
      {
        title: "Projects with blocked tasks",
        note: "Needs unblock or dependency follow-up",
        value: projectsWithBlocked,
        cls: projectsWithBlocked > 0 ? "statusBad" : "statusGood",
      },
      {
        title: "Projects with overdue work",
        note: "Missed due dates in active tasks or actions",
        value: projectsWithOverdue,
        cls: projectsWithOverdue > 0 ? "statusWarn" : "statusGood",
      },
      {
        title: "Projects with high pending work",
        note: "Three or more open tasks still remaining",
        value: projectsWithHighPending,
        cls: projectsWithHighPending > 0 ? "statusWarn" : "statusGood",
      },
    ];

    if (qs("attentionList")) {
      qs("attentionList").innerHTML = attentionItems
        .map(
          (item) => `
        <div class="insightItem">
          <div class="insightLeft">
            <div class="insightTitle">${escapeHtml(item.title)}</div>
            <div class="insightNote">${escapeHtml(item.note)}</div>
          </div>
          <div class="insightValue ${item.cls}">${item.value}</div>
        </div>
      `,
        )
        .join("");
    }

    document.querySelectorAll(".projectRow").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        const project = row.getAttribute("data-project");
        if (project)
          go(`scrum-board.html?project=${encodeURIComponent(project)}`);
      });
    });

    document.querySelectorAll("[data-open-board]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const project = btn.getAttribute("data-open-board");
        if (project)
          go(`scrum-board.html?project=${encodeURIComponent(project)}`);
      });
    });

    document.querySelectorAll("[data-open-timeline]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const project = btn.getAttribute("data-open-timeline");
        if (project)
          go(`project-timeline.html?project=${encodeURIComponent(project)}`);
      });
    });
  }

  qs("statusProjectFilter")?.addEventListener("change", loadProjectStatus);
  await loadProjectStatus();
}

// ================= PROJECT TIMELINE PAGE =================
async function initProjectTimelinePage() {
  if (!qs("projectTimelinePage")) return;

  const { user } = await requireAuth({
    mustBeApproved: false,
    mustBeManager: true,
  });

  qs("logoutBtn")?.addEventListener("click", async () => {
    await auth.signOut();
    go("index.html");
  });

  fillSelectOptions(qs("milestoneProject"), PROJECTS, {
    keepFirstOption: true,
  });
  fillSelectOptions(qs("timelineProjectFilter"), PROJECTS, {
    keepFirstOption: true,
  });

  const timelineParams = new URLSearchParams(window.location.search);
  const projectFromUrl = timelineParams.get("project");

  if (projectFromUrl && qs("timelineProjectFilter")) {
    qs("timelineProjectFilter").value = projectFromUrl;
  }

  let editingMilestoneId = null;

  function resetMilestoneForm() {
    editingMilestoneId = null;
    resetValue("milestoneId");
    resetValue("milestoneTitle");
    resetValue("milestoneDate");
    resetValue("milestoneDescription");
    if (qs("milestoneProject")) qs("milestoneProject").value = "";
    if (qs("milestoneType")) qs("milestoneType").value = "Milestone";
    if (qs("milestoneStatus")) qs("milestoneStatus").value = "In Progress";
    if (qs("timelineFormTitle"))
      qs("timelineFormTitle").innerText = "Add milestone";
    if (qs("milestoneSaveBtn"))
      qs("milestoneSaveBtn").innerText = "Save Milestone";
    if (qs("milestoneCancelBtn"))
      qs("milestoneCancelBtn").style.display = "none";
    if (qs("milestoneMsg")) {
      qs("milestoneMsg").className = "msg";
      qs("milestoneMsg").innerText = "";
    }
  }

  async function loadTimeline() {
    const filterProject = qs("timelineProjectFilter")?.value || "__ALL__";

    const snap = await db.collection("projectMilestones").get();
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (filterProject !== "__ALL__") {
      items = items.filter((i) => (i.project || "") === filterProject);
    }

    items.sort((a, b) =>
      String(a.date || "").localeCompare(String(b.date || "")),
    );

    const grouped = {};
    items.forEach((item) => {
      const key = item.project || "Unknown Project";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    const projectNames =
      filterProject === "__ALL__"
        ? Object.keys(grouped).sort((a, b) => a.localeCompare(b))
        : [filterProject];

    const html = projectNames
      .map((projectName) => {
        const list = grouped[projectName] || [];

        if (!list.length) {
          return `
          <div class="card">
            <h3 class="timelineProjectTitle">${escapeHtml(projectName)}</h3>
            <div class="emptyState">No milestones yet.</div>
          </div>
        `;
        }

        return `
        <div class="card">
          <h3 class="timelineProjectTitle">${escapeHtml(projectName)}</h3>
          <div class="timelineGroup">
            ${list
              .map(
                (i) => `
              <div class="timelineItem">
                <div class="timelineTop">
                  <h3 class="timelineTitle">${escapeHtml(i.title || "Untitled")}</h3>
                  <div class="timelineDate">${formatDateSafe(i.date)}</div>
                </div>

                <div class="timelineMeta">
                  <div class="chip">${escapeHtml(i.type || "Milestone")}</div>
                  <div class="chip">${escapeHtml(i.status || "Planned")}</div>
                </div>

                ${i.description ? `<div class="taskText">${escapeHtml(i.description)}</div>` : ""}

                <div class="actionRow" style="margin-top:12px;">
                  <button class="btn" type="button" data-edit-milestone="${escapeHtml(i.id)}">Edit</button>
                  <button class="btn danger" type="button" data-delete-milestone="${escapeHtml(i.id)}">Delete</button>
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
      })
      .join("");

    qs("timelineList").innerHTML =
      html || `<div class="emptyState">No milestones</div>`;

    document.querySelectorAll("[data-delete-milestone]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete-milestone");
        await db.collection("projectMilestones").doc(id).delete();
        if (editingMilestoneId === id) resetMilestoneForm();
        await loadTimeline();
      });
    });

    document.querySelectorAll("[data-edit-milestone]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-edit-milestone");
        const doc = await db.collection("projectMilestones").doc(id).get();
        if (!doc.exists) return;

        const data = doc.data() || {};
        editingMilestoneId = id;

        if (qs("milestoneId")) qs("milestoneId").value = id;
        if (qs("milestoneProject"))
          qs("milestoneProject").value = data.project || "";
        if (qs("milestoneTitle")) qs("milestoneTitle").value = data.title || "";
        if (qs("milestoneDate")) qs("milestoneDate").value = data.date || "";
        if (qs("milestoneType"))
          qs("milestoneType").value = data.type || "Milestone";
        if (qs("milestoneStatus"))
          qs("milestoneStatus").value = data.status || "In Progress";
        if (qs("milestoneDescription"))
          qs("milestoneDescription").value = data.description || "";
        if (qs("timelineFormTitle"))
          qs("timelineFormTitle").innerText = "Edit milestone";
        if (qs("milestoneSaveBtn"))
          qs("milestoneSaveBtn").innerText = "Update Milestone";
        if (qs("milestoneCancelBtn"))
          qs("milestoneCancelBtn").style.display = "inline-flex";
        if (qs("milestoneMsg")) {
          qs("milestoneMsg").className = "msg";
          qs("milestoneMsg").innerText = "Editing selected milestone.";
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  qs("milestoneSaveBtn")?.addEventListener("click", async () => {
    const saveBtn = qs("milestoneSaveBtn");
    const project = (qs("milestoneProject")?.value || "").trim();
    const title = (qs("milestoneTitle")?.value || "").trim();
    const date = qs("milestoneDate")?.value || "";
    const type = qs("milestoneType")?.value || "Milestone";
    const status = qs("milestoneStatus")?.value || "In Progress";
    const description = (qs("milestoneDescription")?.value || "").trim();

    qs("milestoneMsg").className = "msg";
    qs("milestoneMsg").innerText = editingMilestoneId
      ? "Updating milestone…"
      : "Saving milestone…";

    if (!project || !title || !date) {
      qs("milestoneMsg").className = "msg bad";
      qs("milestoneMsg").innerText = "Project, title, and date are required.";
      return;
    }

    if (!isAllowedProject(project)) {
      qs("milestoneMsg").className = "msg bad";
      qs("milestoneMsg").innerText = "Please select a valid project.";
      return;
    }

    try {
      saveBtn.disabled = true;

      const payload = {
        project,
        title,
        date,
        type: MILESTONE_TYPES.includes(type) ? type : "Milestone",
        status: MILESTONE_STATUSES.includes(status) ? status : "In Progress",
        description,
        updatedAt: serverTimestamp,
      };

      if (editingMilestoneId) {
        await db
          .collection("projectMilestones")
          .doc(editingMilestoneId)
          .update(payload);
        qs("milestoneMsg").className = "msg ok";
        qs("milestoneMsg").innerText = "Milestone updated ✅";
      } else {
        await db.collection("projectMilestones").add({
          ...payload,
          createdBy: user.uid,
          createdAt: serverTimestamp,
        });
        qs("milestoneMsg").className = "msg ok";
        qs("milestoneMsg").innerText = "Milestone saved ✅";
      }

      resetMilestoneForm();
      await loadTimeline();
    } catch (err) {
      console.error(err);
      qs("milestoneMsg").className = "msg bad";
      qs("milestoneMsg").innerText = err.message || "Failed to save milestone.";
    } finally {
      saveBtn.disabled = false;
    }
  });

  qs("milestoneCancelBtn")?.addEventListener("click", resetMilestoneForm);
  qs("timelineProjectFilter")?.addEventListener("change", loadTimeline);

  await loadTimeline();
}

// ================= AUTO RUN =================
initAuthPage();
initPendingPage();
initDashboardPage();
initManagerPage();
initScrumBoardPage();
initProjectStatusPage();
initProjectTimelinePage();
