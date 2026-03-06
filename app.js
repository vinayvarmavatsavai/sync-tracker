// file: app.js

// ================= CONFIG =================
const MANAGER_EMAILS = [
  "vinayvarmavatsavai@gmail.com",
  "harshithgosula@gmail.com",
  "vinnu24.vinay@gmail.com",
  "manojvasanthram@gmail.com",
].map(e => e.toLowerCase());

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
  "Vicky","Harshith","Jamie","Abhi","Abhishek","Vasanth","Maharaja",
  "Ganesh","Lokesh","Suriya","Rahul","Sreejith"
];

const PROJECTS = [
  "OOI based robotic prosthetic",
  "Kriya",
  "Sync Collab*",
  "Hustle Trail",
  "My Checkout",
  "Out of the box Experience",
  "Bik",
  "Bakery App",
  "CA app"
];

const TASK_STATUSES = ["Backlog", "To Do", "In Progress", "Review", "Done", "Blocked"];
const TASK_PRIORITIES = ["Low", "Medium", "High"];
const MILESTONE_TYPES = ["Milestone", "Deadline", "Sprint", "Release", "Blocker"];
const MILESTONE_STATUSES = ["Planned", "In Progress", "Done", "Delayed"];

// ================= HELPERS =================
function qs(id){ return document.getElementById(id); }
function qsa(selector){ return Array.from(document.querySelectorAll(selector)); }
function go(path){ window.location.href = path; }

function isManager(email){
  return MANAGER_EMAILS.includes((email || "").toLowerCase());
}

function todayISO(){
  const d = new Date();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function isAllowedName(name){
  return FRIEND_NAMES.includes((name || "").trim());
}

function isAllowedProject(project){
  return PROJECTS.includes((project || "").trim());
}

function fillSelectOptions(selectEl, items, { keepFirstOption = true } = {}){
  if (!selectEl) return;
  const first = keepFirstOption ? (selectEl.querySelector("option")?.outerHTML || "") : "";
  selectEl.innerHTML = first + items.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
}

function priorityRank(priority){
  return ({ High: 3, Medium: 2, Low: 1 }[priority] || 0);
}

function priorityChipClass(priority){
  const p = String(priority || "").toLowerCase();
  if (p === "high") return "high";
  if (p === "medium") return "medium";
  return "low";
}

function statusPillClass(health){
  if (health === "Completed") return "completed";
  if (health === "At Risk") return "atrisk";
  if (health === "Delayed") return "delayed";
  return "ontrack";
}

function calcPercent(done, total){
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function isOverdue(dateStr, status){
  if (!dateStr) return false;
  if (status === "Done") return false;
  const today = todayISO();
  return dateStr < today;
}

function formatDateSafe(dateStr){
  return dateStr ? escapeHtml(dateStr) : "—";
}

function resetValue(id, value = ""){
  const el = qs(id);
  if (el) el.value = value;
}

// Wait until Chart.js is ready (or show an error)
async function waitForChartJs({ tries = 12, delayMs = 200 } = {}){
  for (let i = 0; i < tries; i++){
    if (typeof window.Chart !== "undefined") return true;
    await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

function setChartError(cardTitle, msg){
  console.warn("[Chart Error]", cardTitle, msg);

  const map = {
    "Status split (Today)": "statusChart",
    "Updates trend (Last 7 days)": "trendChart",
    "Top projects (Today)": "projectChart"
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
async function ensureUserProfile(user, nameGuess){
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
      createdAt: serverTimestamp
    });
  } else {
    const data = snap.data() || {};
    const patch = {};

    if (typeof data.name !== "string" || !data.name) patch.name = fallbackName;
    if (typeof data.email !== "string") patch.email = user.email || "";
    if (typeof data.active !== "boolean") patch.active = true;

    if (typeof data.approved !== "boolean") patch.approved = manager ? true : false;
    if (manager && data.approved !== true) patch.approved = true;

    if (Object.keys(patch).length) await ref.update(patch);
  }

  const latest = await ref.get();
  return latest.data();
}

async function getMyProfile(uid){
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? snap.data() : null;
}

async function getUserByName(name){
  if (!name) return null;
  const snap = await db.collection("users").where("name", "==", name).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

// ================= AUTH GUARD =================
async function requireAuth({ mustBeApproved = false, mustBeManager = false }){
  return new Promise((resolve) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) return go("index.html");

      const profile = await ensureUserProfile(user, user.displayName);

      if (mustBeManager && !isManager(user.email)) return go("dashboard.html");
      if (mustBeApproved && (!profile?.approved || !profile?.active)) return go("pending.html");

      resolve({ user, profile });
    });
  });
}

// ================= AUTH PAGE (index.html) =================
function initAuthPage(){
  const form = qs("loginForm");
  if (!form) return;

  let mode = "login";

  const nameWrap = qs("nameWrap");
  const nameEl = qs("name");

  fillSelectOptions(nameEl, FRIEND_NAMES, { keepFirstOption: true });

  function setMode(m){
    mode = m;

    if (m === "signup") {
      nameWrap.style.display = "block";
      nameEl.required = true;
    } else {
      nameWrap.style.display = "none";
      nameEl.required = false;
      nameEl.value = "";
    }

    qs("title").innerText = (m === "signup") ? "Join the team" : "Welcome back";
    qs("submitBtn").innerText = (m === "signup") ? "Create account" : "Login";
    qs("msg").className = "msg";
    qs("msg").innerText = "";
  }

  qs("modeSignup")?.addEventListener("click", ()=>setMode("signup"));
  qs("modeLogin")?.addEventListener("click", ()=>setMode("login"));
  setMode("login");

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();

    const name = (nameEl?.value || "").trim();
    const email = (qs("email")?.value || "").trim();
    const pass = qs("password")?.value || "";

    qs("msg").className = "msg";
    qs("msg").innerText = "Please wait…";

    if (mode === "signup" && !isAllowedName(name)){
      qs("msg").className = "msg bad";
      qs("msg").innerText = "Please select your name from the list.";
      return;
    }

    try{
      let cred;
      if (mode === "signup"){
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

    } catch (err){
      console.error(err);
      qs("msg").className = "msg bad";
      qs("msg").innerText = err.message || "Failed";
    }
  });
}

// ================= PENDING PAGE =================
async function initPendingPage(){
  if (!qs("pendingBox")) return;

  const { user, profile } = await requireAuth({ mustBeApproved: false });

  qs("meEmail").innerText = user.email || "";
  qs("meName").innerText = profile?.name || user.displayName || "Friend";

  qs("logoutBtn")?.addEventListener("click", async ()=>{
    await auth.signOut();
    go("index.html");
  });

  if (profile?.approved) go("dashboard.html");
}

// ================= DASHBOARD PAGE =================
// ================= DASHBOARD PAGE =================
async function initDashboardPage(){
  if (!qs("dashboardPage")) return;

  const { user, profile } = await requireAuth({ mustBeApproved:true });

  qs("helloName").innerText = profile?.name || "Friend";
  qs("today").value = todayISO();

  fillSelectOptions(qs("project"), PROJECTS, { keepFirstOption:true });

  if (isManager(user.email) && qs("managerLink")) qs("managerLink").style.display = "inline-flex";
  if (isManager(user.email) && qs("scrumLink")) qs("scrumLink").style.display = "inline-flex";

  qs("logoutBtn")?.addEventListener("click", async ()=>{
    await auth.signOut();
    go("index.html");
  });

  qs("saveBtn")?.addEventListener("click", async ()=>{
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
      createdAt: serverTimestamp
    };

    qs("saveMsg").className = "msg";
    qs("saveMsg").innerText = "Saving…";

    if (!data.project || !data.tasks){
      qs("saveMsg").className = "msg bad";
      qs("saveMsg").innerText = "Project and Tasks are required.";
      return;
    }

    if (!isAllowedProject(data.project)){
      qs("saveMsg").className = "msg bad";
      qs("saveMsg").innerText = "Please select a valid project.";
      return;
    }

    try{
      saveBtn.disabled = true;
      await db.collection("updates").add(data);
      qs("saveMsg").className = "msg ok";
      qs("saveMsg").innerText = "Saved ✅";
      qs("tasks").value = "";
      qs("blockers").value = "";
      qs("notes").value = "";
      await loadMyUpdates(user.uid);
    } catch(err){
      console.error(err);
      qs("saveMsg").className = "msg bad";
      qs("saveMsg").innerText = err.message || "Failed";
    } finally {
      saveBtn.disabled = false;
    }
  });

  await loadMyAssignedTasks(user.uid);
  await loadMyUpdates(user.uid);

  async function loadMyAssignedTasks(uid){
    const listEl = qs("assignedTasksList");
    if (!listEl) return;

    listEl.innerHTML = `<div class="small">Loading assigned tasks…</div>`;

    try{
      const snap = await db.collection("boardTasks").where("assignedUid","==",uid).get();
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      docs.sort((a,b) => {
        const rankDiff = priorityRank(b.priority) - priorityRank(a.priority);
        if (rankDiff !== 0) return rankDiff;
        return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
      });

      const today = todayISO();
      const newTasks = docs.filter(t => t.seenByAssignee === false).length;
      const dueToday = docs.filter(t => (t.dueDate || "") === today && t.status !== "Done").length;
      const blocked = docs.filter(t => t.status === "Blocked").length;

      if (qs("assignedCount")) qs("assignedCount").innerText = String(docs.length);
      if (qs("newAssignedCount")) qs("newAssignedCount").innerText = String(newTasks);
      if (qs("dueTodayCount")) qs("dueTodayCount").innerText = String(dueToday);
      if (qs("assignedBlockedCount")) qs("assignedBlockedCount").innerText = String(blocked);

      if (!docs.length){
        listEl.innerHTML = `<div class="emptyState">No tasks assigned to you yet.</div>`;
        return;
      }

      listEl.innerHTML = docs.map(task => `
        <div class="card" style="padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
            <div style="flex:1; min-width:220px;">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                <div style="font-size:16px; font-weight:800;">${escapeHtml(task.title || "Untitled Task")}</div>
                ${task.seenByAssignee === false ? `<span class="pill ontrack">New</span>` : ``}
              </div>

              <div class="taskMeta">
                <span class="chip">${escapeHtml(task.project || "No project")}</span>
                <span class="chip ${priorityChipClass(task.priority)}">${escapeHtml(task.priority || "Medium")}</span>
                <span class="chip">${escapeHtml(task.status || "Backlog")}</span>
                ${task.dueDate ? `<span class="chip">Due ${escapeHtml(task.dueDate)}</span>` : ``}
              </div>

              ${task.description ? `<div class="taskText" style="margin-top:8px;">${escapeHtml(task.description)}</div>` : ``}
              ${task.blockers ? `<div class="taskText" style="margin-top:8px;">Blockers: ${escapeHtml(task.blockers)}</div>` : ``}
            </div>

            <div style="display:flex; flex-direction:column; gap:8px; min-width:220px;">
              <select data-task-status="${escapeHtml(task.id)}">
                ${TASK_STATUSES.map(status => `
                  <option value="${escapeHtml(status)}" ${status === (task.status || "Backlog") ? "selected" : ""}>
                    ${escapeHtml(status)}
                  </option>
                `).join("")}
              </select>

              <button class="btn" type="button" data-start-task="${escapeHtml(task.id)}">Start</button>
              <button class="btn primary" type="button" data-done-task="${escapeHtml(task.id)}">Mark Done</button>
              <button class="btn danger" type="button" data-blocked-task="${escapeHtml(task.id)}">Mark Blocked</button>
            </div>
          </div>
        </div>
      `).join("");

      const unseenDocs = docs.filter(t => t.seenByAssignee === false);
      for (const task of unseenDocs){
        await db.collection("boardTasks").doc(task.id).update({
          seenByAssignee: true,
          updatedAt: serverTimestamp
        });
      }

      document.querySelectorAll("[data-task-status]").forEach(el => {
        el.addEventListener("change", async ()=>{
          const taskId = el.getAttribute("data-task-status");
          try{
            await db.collection("boardTasks").doc(taskId).update({
              status: el.value,
              updatedAt: serverTimestamp,
              completedAt: el.value === "Done" ? serverTimestamp : null,
              completedBy: el.value === "Done" ? user.uid : null
            });
            await loadMyAssignedTasks(uid);
          } catch (err){
            console.error(err);
          }
        });
      });

      document.querySelectorAll("[data-start-task]").forEach(btn => {
        btn.addEventListener("click", async ()=>{
          const taskId = btn.getAttribute("data-start-task");
          try{
            await db.collection("boardTasks").doc(taskId).update({
              status: "In Progress",
              updatedAt: serverTimestamp
            });
            await loadMyAssignedTasks(uid);
          } catch (err){
            console.error(err);
          }
        });
      });

      document.querySelectorAll("[data-done-task]").forEach(btn => {
        btn.addEventListener("click", async ()=>{
          const taskId = btn.getAttribute("data-done-task");
          try{
            await db.collection("boardTasks").doc(taskId).update({
              status: "Done",
              updatedAt: serverTimestamp,
              completedAt: serverTimestamp,
              completedBy: user.uid
            });
            await loadMyAssignedTasks(uid);
          } catch (err){
            console.error(err);
          }
        });
      });

      document.querySelectorAll("[data-blocked-task]").forEach(btn => {
        btn.addEventListener("click", async ()=>{
          const taskId = btn.getAttribute("data-blocked-task");
          try{
            await db.collection("boardTasks").doc(taskId).update({
              status: "Blocked",
              updatedAt: serverTimestamp
            });
            await loadMyAssignedTasks(uid);
          } catch (err){
            console.error(err);
          }
        });
      });

    } catch (err){
      console.error(err);
      listEl.innerHTML = `<div class="emptyState">Unable to load assigned tasks.</div>`;
    }
  }

  async function loadMyUpdates(uid){
    qs("rows").innerHTML = `<tr><td colspan="7" class="small">Loading…</td></tr>`;

    const snap = await db.collection("updates").where("uid","==",uid).get();
    let docs = snap.docs.map(d => d.data());

    docs.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    if (!docs.length){
      qs("rows").innerHTML = `<tr><td colspan="7" class="small">No updates yet.</td></tr>`;
      return;
    }

    qs("rows").innerHTML = docs.map(r => `
      <tr>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.project)}</td>
        <td>${escapeHtml(r.status)}</td>
        <td>${escapeHtml(r.priority)}</td>
        <td>${escapeHtml(r.tasks)}</td>
        <td>${escapeHtml(r.blockers)}</td>
        <td>${escapeHtml(r.notes)}</td>
      </tr>
    `).join("");
  }
}

// ================= MANAGER PAGE (OVERVIEW) =================
async function initManagerPage(){
  if (!qs("managerPage")) return;

  const { user } = await requireAuth({ mustBeApproved: false, mustBeManager: true });

  qs("logoutBtn")?.addEventListener("click", async ()=>{
    await auth.signOut();
    go("index.html");
  });

  fillSelectOptions(qs("projectFilter"), PROJECTS, { keepFirstOption: true });

  let statusChart = null;
  let trendChart = null;
  let projectChart = null;

  function destroyChart(ch){
    try { ch && ch.destroy(); } catch(_) {}
  }

  async function loadPendingApprovals(){
    if (!qs("pendingList")) return;

    qs("pendingList").innerHTML = `<div class="small">Loading…</div>`;

    try{
      const snap = await db.collection("users").where("approved", "==", false).get();
      const users = snap.docs.map(d => d.data());

      users.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      if (!users.length){
        qs("pendingList").innerHTML = `<div class="small">No pending requests 🎉</div>`;
        return;
      }

      qs("pendingList").innerHTML = users.map(u => `
        <div class="card" style="padding:14px;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div>
              <div style="font-weight:800;">${escapeHtml(u.name || "Friend")}</div>
              <div class="small">${escapeHtml(u.email || "")}</div>
            </div>
            <button class="btn primary" data-approve="${escapeHtml(u.uid)}" type="button">Approve</button>
          </div>
        </div>
      `).join("");

      document.querySelectorAll("[data-approve]").forEach(btn => {
        btn.addEventListener("click", async ()=>{
          const uid = btn.getAttribute("data-approve");
          btn.disabled = true;
          btn.innerText = "Approving…";

          await db.collection("users").doc(uid).update({
            approved: true,
            approvedAt: serverTimestamp,
            approvedBy: user.uid
          });

          await loadPendingApprovals();
        });
      });

    } catch(err){
      console.error(err);
      qs("pendingList").innerHTML = `<div class="small" style="color:#ff5b6e;">Error loading pending approvals</div>`;
    }
  }

  async function loadTodayAndCharts({ skipCharts = false } = {}){
    const filterProject = (qs("projectFilter")?.value || "__ALL__").trim();
    const today = todayISO();

    const snap = await db.collection("updates").where("date","==",today).get();
    let updates = snap.docs.map(d => d.data());

    if (filterProject !== "__ALL__") {
      updates = updates.filter(u => (u.project || "").trim() === filterProject);
    }

    if (qs("todayRows")){
      if (!updates.length){
        qs("todayRows").innerHTML = `<tr><td colspan="6" class="small">No updates for today.</td></tr>`;
      } else {
        updates.sort((a,b) => priorityRank(b.priority) - priorityRank(a.priority));

        qs("todayRows").innerHTML = updates.map(u => `
          <tr>
            <td>${escapeHtml(u.name)}</td>
            <td>${escapeHtml(u.project)}</td>
            <td>${escapeHtml(u.status)}</td>
            <td>${escapeHtml(u.priority)}</td>
            <td>${escapeHtml(u.tasks)}</td>
            <td>${escapeHtml(u.blockers)}</td>
          </tr>
        `).join("");
      }
    }

    const blocked = updates.filter(u => (u.status || "") === "Blocked");
    if (qs("blockedRows")){
      if (!blocked.length){
        qs("blockedRows").innerHTML = `<tr><td colspan="5" class="small">No blockers today 🎉</td></tr>`;
      } else {
        qs("blockedRows").innerHTML = blocked.map(u => `
          <tr>
            <td>${escapeHtml(u.name)}</td>
            <td>${escapeHtml(u.project)}</td>
            <td>${escapeHtml(u.tasks)}</td>
            <td>${escapeHtml(u.blockers)}</td>
            <td>${escapeHtml(u.notes)}</td>
          </tr>
        `).join("");
      }
    }

    if (qs("statTotalUpdates")) qs("statTotalUpdates").innerText = String(updates.length);
    if (qs("statDoneCount")) qs("statDoneCount").innerText = String(updates.filter(u => u.status === "Done").length);
    if (qs("statBlockedCount")) qs("statBlockedCount").innerText = String(blocked.length);
    if (qs("statHighPriorityCount")) qs("statHighPriorityCount").innerText = String(updates.filter(u => u.priority === "High").length);

    if (skipCharts) return;
    if (typeof window.Chart === "undefined") return;

    const statusCounts = { Done: 0, "In Progress": 0, Blocked: 0 };
    updates.forEach(u => {
      const s = u.status || "In Progress";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    destroyChart(statusChart);
    const statusCtx = qs("statusChart")?.getContext?.("2d");
    if (statusCtx){
      statusChart = new Chart(statusCtx, {
        type: "doughnut",
        data: {
          labels: Object.keys(statusCounts),
          datasets: [{ data: Object.values(statusCounts) }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } }
        }
      });
    }

    const days = [];
    for (let i = 6; i >= 0; i--){
      const d = new Date();
      d.setDate(d.getDate() - i);
      const mm = String(d.getMonth()+1).padStart(2,"0");
      const dd = String(d.getDate()).padStart(2,"0");
      days.push(`${d.getFullYear()}-${mm}-${dd}`);
    }

    const trendSnap = await db.collection("updates").where("date", ">=", days[0]).get();
    let last = trendSnap.docs.map(d => d.data());

    if (filterProject !== "__ALL__") {
      last = last.filter(u => (u.project || "").trim() === filterProject);
    }

    const dayCounts = {};
    days.forEach(d => dayCounts[d] = 0);
    last.forEach(u => { if (dayCounts[u.date] != null) dayCounts[u.date] += 1; });

    destroyChart(trendChart);
    const trendCtx = qs("trendChart")?.getContext?.("2d");
    if (trendCtx){
      trendChart = new Chart(trendCtx, {
        type: "line",
        data: {
          labels: days.map(d => d.slice(5)),
          datasets: [{ data: days.map(d => dayCounts[d]) }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });
    }

    const projectCounts = {};
    updates.forEach(u => {
      const p = (u.project || "Unknown").trim();
      projectCounts[p] = (projectCounts[p] || 0) + 1;
    });

    const top = Object.entries(projectCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const topLabels = top.map(x => x[0]);
    const topValues = top.map(x => x[1]);

    destroyChart(projectChart);
    const projCtx = qs("projectChart")?.getContext?.("2d");
    if (projCtx){
      projectChart = new Chart(projCtx, {
        type: "bar",
        data: { labels: topLabels, datasets: [{ data: topValues }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });
    }
  }

  await loadPendingApprovals();

  const ok = await waitForChartJs();
  await loadTodayAndCharts({ skipCharts: !ok });

  qs("projectFilter")?.addEventListener("change", () => {
    loadTodayAndCharts({ skipCharts: (typeof window.Chart === "undefined") }).catch(console.error);
  });
}

// ================= SCRUM BOARD PAGE =================
async function initScrumBoardPage(){
  if (!qs("scrumPage")) return;

  const { user } = await requireAuth({ mustBeApproved: false, mustBeManager: true });

  qs("logoutBtn")?.addEventListener("click", async ()=>{
    await auth.signOut();
    go("index.html");
  });

  fillSelectOptions(qs("taskProject"), PROJECTS, { keepFirstOption: true });
  fillSelectOptions(qs("filterProject"), PROJECTS, { keepFirstOption: true });
  fillSelectOptions(qs("taskAssignee"), FRIEND_NAMES, { keepFirstOption: true });
  fillSelectOptions(qs("filterAssignee"), FRIEND_NAMES, { keepFirstOption: true });

  let editingTaskId = null;

  function resetTaskForm(){
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

  function getBoardColumnElements(){
    return {
      Backlog: { count: qs("countBacklog"), list: qs("colBacklog") },
      "To Do": { count: qs("countTodo"), list: qs("colTodo") },
      "In Progress": { count: qs("countProgress"), list: qs("colProgress") },
      Review: { count: qs("countReview"), list: qs("colReview") },
      Done: { count: qs("countDone"), list: qs("colDone") },
      Blocked: { count: qs("countBlocked"), list: qs("colBlocked") }
    };
  }

  async function loadBoard(){
    const filterProject = qs("filterProject")?.value || "__ALL__";
    const filterAssignee = qs("filterAssignee")?.value || "__ALL__";
    const filterPriority = qs("filterPriority")?.value || "__ALL__";

    const snap = await db.collection("boardTasks").get();
    let tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (filterProject !== "__ALL__"){
      tasks = tasks.filter(t => (t.project || "") === filterProject);
    }

    if (filterAssignee !== "__ALL__"){
      tasks = tasks.filter(t => (t.assignedTo || "") === filterAssignee);
    }

    if (filterPriority !== "__ALL__"){
      tasks = tasks.filter(t => (t.priority || "") === filterPriority);
    }

    tasks.sort((a,b) => {
      const dateDiff = (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
      if (dateDiff !== 0) return dateDiff;
      return priorityRank(b.priority) - priorityRank(a.priority);
    });

    const columns = getBoardColumnElements();

    Object.values(columns).forEach(({ count, list }) => {
      if (count) count.innerText = "0";
      if (list) list.innerHTML = "";
    });

    TASK_STATUSES.forEach(status => {
      const group = tasks.filter(t => (t.status || "Backlog") === status);
      const col = columns[status];
      if (!col?.list) return;

      if (col.count) col.count.innerText = String(group.length);

      if (!group.length){
        col.list.innerHTML = `<div class="emptyState">No tasks</div>`;
        return;
      }

      col.list.innerHTML = group.map(t => `
        <div class="taskCard">
          <div class="taskCardTitle">${escapeHtml(t.title || "Untitled Task")}</div>

          <div class="taskMeta">
            <div class="chip">${escapeHtml(t.project || "No project")}</div>
            <div class="chip">${escapeHtml(t.assignedTo || "Unassigned")}</div>
            <div class="chip ${priorityChipClass(t.priority)}">${escapeHtml(t.priority || "Medium")}</div>
            ${t.dueDate ? `<div class="chip">Due ${escapeHtml(t.dueDate)}</div>` : ""}
          </div>

          ${t.description ? `<div class="taskText">${escapeHtml(t.description)}</div>` : ""}
          ${t.blockers ? `<div class="taskText" style="margin-top:8px;">Blockers: ${escapeHtml(t.blockers)}</div>` : ""}

          <div class="taskControls">
            <div class="row">
              <select data-move-task="${escapeHtml(t.id)}">
                ${TASK_STATUSES.map(s => `<option value="${escapeHtml(s)}" ${s === t.status ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}
              </select>
            </div>

            <div class="row">
              <button class="btn" type="button" data-edit-task="${escapeHtml(t.id)}">Edit</button>
              <button class="btn danger" type="button" data-delete-task="${escapeHtml(t.id)}">Delete</button>
            </div>
          </div>
        </div>
      `).join("");
    });

    document.querySelectorAll("[data-move-task]").forEach(el => {
      el.addEventListener("change", async ()=>{
        const taskId = el.getAttribute("data-move-task");
        await db.collection("boardTasks").doc(taskId).update({
          status: el.value,
          updatedAt: serverTimestamp
        });
        await loadBoard();
      });
    });

    document.querySelectorAll("[data-delete-task]").forEach(btn => {
      btn.addEventListener("click", async ()=>{
        const taskId = btn.getAttribute("data-delete-task");
        await db.collection("boardTasks").doc(taskId).delete();
        if (editingTaskId === taskId) resetTaskForm();
        await loadBoard();
      });
    });

    document.querySelectorAll("[data-edit-task]").forEach(btn => {
      btn.addEventListener("click", async ()=>{
        const taskId = btn.getAttribute("data-edit-task");
        const doc = await db.collection("boardTasks").doc(taskId).get();
        if (!doc.exists) return;

        const task = doc.data() || {};
        editingTaskId = taskId;

        if (qs("taskId")) qs("taskId").value = taskId;
        if (qs("taskTitle")) qs("taskTitle").value = task.title || "";
        if (qs("taskProject")) qs("taskProject").value = task.project || "";
        if (qs("taskAssignee")) qs("taskAssignee").value = task.assignedTo || "";
        if (qs("taskPriority")) qs("taskPriority").value = task.priority || "Medium";
        if (qs("taskStatus")) qs("taskStatus").value = task.status || "In Progress";
        if (qs("taskDueDate")) qs("taskDueDate").value = task.dueDate || "";
        if (qs("taskDescription")) qs("taskDescription").value = task.description || "";
        if (qs("taskBlockers")) qs("taskBlockers").value = task.blockers || "";
        if (qs("taskSaveBtn")) qs("taskSaveBtn").innerText = "Update Task";
        if (qs("taskMsg")) {
          qs("taskMsg").className = "msg";
          qs("taskMsg").innerText = "Editing selected task.";
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  qs("taskSaveBtn")?.addEventListener("click", async ()=>{
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

    if (!title || !project){
      qs("taskMsg").className = "msg bad";
      qs("taskMsg").innerText = "Task title and project are required.";
      return;
    }

    if (!isAllowedProject(project)){
      qs("taskMsg").className = "msg bad";
      qs("taskMsg").innerText = "Please select a valid project.";
      return;
    }

    if (assignedTo && !isAllowedName(assignedTo)){
      qs("taskMsg").className = "msg bad";
      qs("taskMsg").innerText = "Please select a valid teammate.";
      return;
    }

    try{
      saveBtn.disabled = true;

      let assignedUid = "";
      if (assignedTo){
        const assignedUser = await getUserByName(assignedTo);
        assignedUid = assignedUser?.uid || assignedUser?.id || "";
      }

      const payload = {
        title,
        project,
        assignedTo,
        assignedUid,
        priority: TASK_PRIORITIES.includes(priority) ? priority : "Medium",
        status: TASK_STATUSES.includes(status) ? status : "In Progress",
        dueDate,
        description,
        blockers,
        updatedAt: serverTimestamp
      };

      if (editingTaskId){
        await db.collection("boardTasks").doc(editingTaskId).update(payload);
        qs("taskMsg").className = "msg ok";
        qs("taskMsg").innerText = "Task updated ✅";
      } else {
        await db.collection("boardTasks").add({
          ...payload,
          seenByAssignee: false,
          createdBy: user.uid,
          createdAt: serverTimestamp
        });
        qs("taskMsg").className = "msg ok";
        qs("taskMsg").innerText = "Task created ✅";
      }

      resetTaskForm();
      await loadBoard();
    } catch (err){
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
async function initProjectStatusPage(){
  if (!qs("projectStatusPage")) return;

  await requireAuth({ mustBeApproved: false, mustBeManager: true });

  qs("logoutBtn")?.addEventListener("click", async ()=>{
    await auth.signOut();
    go("index.html");
  });

  fillSelectOptions(qs("statusProjectFilter"), PROJECTS, { keepFirstOption: true });

  async function loadProjectStatus(){
    const filterProject = qs("statusProjectFilter")?.value || "__ALL__";

    const [taskSnap, milestoneSnap] = await Promise.all([
      db.collection("boardTasks").get(),
      db.collection("projectMilestones").get()
    ]);

    let tasks = taskSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    let milestones = milestoneSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (filterProject !== "__ALL__"){
      tasks = tasks.filter(t => (t.project || "") === filterProject);
      milestones = milestones.filter(m => (m.project || "") === filterProject);
    }

    const projectsToShow = filterProject === "__ALL__" ? PROJECTS : [filterProject];

    const rows = [];
    let onTrackCount = 0;
    let atRiskCount = 0;
    let delayedCount = 0;
    let completedCount = 0;

    projectsToShow.forEach(projectName => {
      const projectTasks = tasks.filter(t => (t.project || "") === projectName);
      const projectMilestones = milestones
        .filter(m => (m.project || "") === projectName)
        .sort((a,b) => String(b.date || "").localeCompare(String(a.date || "")));

      const total = projectTasks.length;
      const done = projectTasks.filter(t => t.status === "Done").length;
      const inProgress = projectTasks.filter(t => t.status === "In Progress" || t.status === "Review" || t.status === "To Do").length;
      const blocked = projectTasks.filter(t => t.status === "Blocked").length;
      const high = projectTasks.filter(t => t.priority === "High").length;
      const overdue = projectTasks.filter(t => isOverdue(t.dueDate, t.status)).length;
      const completion = calcPercent(done, total);
      const latestMilestone = projectMilestones[0]?.title || "—";

      let health = "On Track";
      if (total > 0 && done === total) health = "Completed";
      else if (blocked > 0 || overdue > 0) health = "At Risk";
      else if (total === 0) health = "Delayed";
      else health = "On Track";

      if (health === "Completed") completedCount++;
      else if (health === "At Risk") atRiskCount++;
      else if (health === "Delayed") delayedCount++;
      else onTrackCount++;

      rows.push(`
        <tr>
          <td>${escapeHtml(projectName)}</td>
          <td><span class="pill ${statusPillClass(health)}">${escapeHtml(health)}</span></td>
          <td>${total}</td>
          <td>${done}</td>
          <td>${inProgress}</td>
          <td>${blocked}</td>
          <td>${high}</td>
          <td>${overdue}</td>
          <td>
            <div class="progressTrack">
              <div class="progressFill" style="width:${completion}%"></div>
            </div>
            <div class="small" style="margin-top:6px;">${completion}%</div>
          </td>
          <td>${escapeHtml(latestMilestone)}</td>
        </tr>
      `);
    });

    qs("projectStatusRows").innerHTML = rows.length
      ? rows.join("")
      : `<tr><td colspan="10" class="small">No project data found.</td></tr>`;

    if (qs("projectsOnTrack")) qs("projectsOnTrack").innerText = String(onTrackCount);
    if (qs("projectsAtRisk")) qs("projectsAtRisk").innerText = String(atRiskCount);
    if (qs("projectsDelayed")) qs("projectsDelayed").innerText = String(delayedCount);
    if (qs("projectsCompleted")) qs("projectsCompleted").innerText = String(completedCount);
  }

  qs("statusProjectFilter")?.addEventListener("change", loadProjectStatus);
  await loadProjectStatus();
}

// ================= PROJECT TIMELINE PAGE =================
async function initProjectTimelinePage(){
  if (!qs("projectTimelinePage")) return;

  const { user } = await requireAuth({ mustBeApproved: false, mustBeManager: true });

  qs("logoutBtn")?.addEventListener("click", async ()=>{
    await auth.signOut();
    go("index.html");
  });

  fillSelectOptions(qs("milestoneProject"), PROJECTS, { keepFirstOption: true });
  fillSelectOptions(qs("timelineProjectFilter"), PROJECTS, { keepFirstOption: true });

  let editingMilestoneId = null;

  function resetMilestoneForm(){
    editingMilestoneId = null;
    resetValue("milestoneId");
    resetValue("milestoneTitle");
    resetValue("milestoneDate");
    resetValue("milestoneDescription");
    if (qs("milestoneProject")) qs("milestoneProject").value = "";
    if (qs("milestoneType")) qs("milestoneType").value = "Milestone";
    if (qs("milestoneStatus")) qs("milestoneStatus").value = "In Progress";
    if (qs("timelineFormTitle")) qs("timelineFormTitle").innerText = "Add milestone";
    if (qs("milestoneSaveBtn")) qs("milestoneSaveBtn").innerText = "Save Milestone";
    if (qs("milestoneCancelBtn")) qs("milestoneCancelBtn").style.display = "none";
    if (qs("milestoneMsg")) {
      qs("milestoneMsg").className = "msg";
      qs("milestoneMsg").innerText = "";
    }
  }

  async function loadTimeline(){
    const filterProject = qs("timelineProjectFilter")?.value || "__ALL__";

    const snap = await db.collection("projectMilestones").get();
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (filterProject !== "__ALL__"){
      items = items.filter(i => (i.project || "") === filterProject);
    }

    items.sort((a,b) => String(a.date || "").localeCompare(String(b.date || "")));

    const grouped = {};
    items.forEach(item => {
      const key = item.project || "Unknown Project";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    const projectNames = filterProject === "__ALL__"
      ? Object.keys(grouped).sort((a,b) => a.localeCompare(b))
      : [filterProject];

    const html = projectNames.map(projectName => {
      const list = grouped[projectName] || [];

      if (!list.length){
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
            ${list.map(i => `
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
            `).join("")}
          </div>
        </div>
      `;
    }).join("");

    qs("timelineList").innerHTML = html || `<div class="emptyState">No milestones</div>`;

    document.querySelectorAll("[data-delete-milestone]").forEach(btn => {
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-delete-milestone");
        await db.collection("projectMilestones").doc(id).delete();
        if (editingMilestoneId === id) resetMilestoneForm();
        await loadTimeline();
      });
    });

    document.querySelectorAll("[data-edit-milestone]").forEach(btn => {
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-edit-milestone");
        const doc = await db.collection("projectMilestones").doc(id).get();
        if (!doc.exists) return;

        const data = doc.data() || {};
        editingMilestoneId = id;

        if (qs("milestoneId")) qs("milestoneId").value = id;
        if (qs("milestoneProject")) qs("milestoneProject").value = data.project || "";
        if (qs("milestoneTitle")) qs("milestoneTitle").value = data.title || "";
        if (qs("milestoneDate")) qs("milestoneDate").value = data.date || "";
        if (qs("milestoneType")) qs("milestoneType").value = data.type || "Milestone";
        if (qs("milestoneStatus")) qs("milestoneStatus").value = data.status || "In Progress";
        if (qs("milestoneDescription")) qs("milestoneDescription").value = data.description || "";
        if (qs("timelineFormTitle")) qs("timelineFormTitle").innerText = "Edit milestone";
        if (qs("milestoneSaveBtn")) qs("milestoneSaveBtn").innerText = "Update Milestone";
        if (qs("milestoneCancelBtn")) qs("milestoneCancelBtn").style.display = "inline-flex";
        if (qs("milestoneMsg")) {
          qs("milestoneMsg").className = "msg";
          qs("milestoneMsg").innerText = "Editing selected milestone.";
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  qs("milestoneSaveBtn")?.addEventListener("click", async ()=>{
    const saveBtn = qs("milestoneSaveBtn");
    const project = (qs("milestoneProject")?.value || "").trim();
    const title = (qs("milestoneTitle")?.value || "").trim();
    const date = qs("milestoneDate")?.value || "";
    const type = qs("milestoneType")?.value || "Milestone";
    const status = qs("milestoneStatus")?.value || "In Progress";
    const description = (qs("milestoneDescription")?.value || "").trim();

    qs("milestoneMsg").className = "msg";
    qs("milestoneMsg").innerText = editingMilestoneId ? "Updating milestone…" : "Saving milestone…";

    if (!project || !title || !date){
      qs("milestoneMsg").className = "msg bad";
      qs("milestoneMsg").innerText = "Project, title, and date are required.";
      return;
    }

    if (!isAllowedProject(project)){
      qs("milestoneMsg").className = "msg bad";
      qs("milestoneMsg").innerText = "Please select a valid project.";
      return;
    }

    try{
      saveBtn.disabled = true;

      const payload = {
        project,
        title,
        date,
        type: MILESTONE_TYPES.includes(type) ? type : "Milestone",
        status: MILESTONE_STATUSES.includes(status) ? status : "In Progress",
        description,
        updatedAt: serverTimestamp
      };

      if (editingMilestoneId){
        await db.collection("projectMilestones").doc(editingMilestoneId).update(payload);
        qs("milestoneMsg").className = "msg ok";
        qs("milestoneMsg").innerText = "Milestone updated ✅";
      } else {
        await db.collection("projectMilestones").add({
          ...payload,
          createdBy: user.uid,
          createdAt: serverTimestamp
        });
        qs("milestoneMsg").className = "msg ok";
        qs("milestoneMsg").innerText = "Milestone saved ✅";
      }

      resetMilestoneForm();
      await loadTimeline();
    } catch (err){
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