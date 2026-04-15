const STORAGE_KEY = "hrc-tip-checklist-v1";
const DEFAULT_WAITERS = [
  "Camarero 1",
  "Camarero 2",
  "Camarero 3",
  "Camarero 4",
  "Camarero 5",
  "Camarero 6",
  "Camarero 7",
  "Camarero 8",
  "Camarero 9",
  "Camarero 10",
];
const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const weekPicker = document.getElementById("weekPicker");
const roleSelect = document.getElementById("roleSelect");
const userSelect = document.getElementById("userSelect");
const tableHead = document.querySelector("#checklistTable thead");
const tableBody = document.querySelector("#checklistTable tbody");
const pendingGrid = document.getElementById("pendingGrid");
const dayCellTemplate = document.getElementById("dayCellTemplate");

const state = {
  data: loadState(),
};

function getCurrentWeekValue() {
  const now = new Date();
  const temp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((temp - yearStart) / 86400000 + 1) / 7);
  return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.waiters) && parsed.weeks) {
        return parsed;
      }
    } catch {
      // fallback al estado base
    }
  }

  return {
    waiters: DEFAULT_WAITERS.map((name, index) => ({ id: `w${index + 1}`, name })),
    weeks: {},
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function ensureWeekData(weekId) {
  if (!state.data.weeks[weekId]) {
    const waiterRows = {};
    state.data.waiters.forEach((w) => {
      waiterRows[w.id] = DAY_LABELS.map(() => ({ waiterStatus: "", adminApproved: false }));
    });
    state.data.weeks[weekId] = { rows: waiterRows };
    saveState();
  }
}

function syncUserSelect() {
  userSelect.innerHTML = "";
  const isAdmin = roleSelect.value === "admin";

  if (isAdmin) {
    const adminOption = document.createElement("option");
    adminOption.value = "admin-main";
    adminOption.textContent = "Administrador";
    userSelect.append(adminOption);
    userSelect.disabled = true;
    return;
  }

  state.data.waiters.forEach((waiter) => {
    const option = document.createElement("option");
    option.value = waiter.id;
    option.textContent = waiter.name;
    userSelect.append(option);
  });
  userSelect.disabled = false;
}

function buildTableHead() {
  const tr = document.createElement("tr");
  const nameTh = document.createElement("th");
  nameTh.textContent = "Camarero";
  tr.append(nameTh);

  DAY_LABELS.forEach((day) => {
    const th = document.createElement("th");
    th.textContent = day;
    tr.append(th);
  });

  tableHead.innerHTML = "";
  tableHead.append(tr);
}

function isWaiterCurrentRow(waiterId) {
  return roleSelect.value === "camarero" && userSelect.value === waiterId;
}

function updatePendingGrid(weekId) {
  const weekRows = state.data.weeks[weekId].rows;
  pendingGrid.innerHTML = "";

  DAY_LABELS.forEach((day, dayIndex) => {
    const notCompleted = state.data.waiters.filter((waiter) => {
      const cell = weekRows[waiter.id]?.[dayIndex];
      return !(cell && cell.waiterStatus && cell.adminApproved);
    });

    const card = document.createElement("article");
    card.className = "pending-card";

    const title = document.createElement("h3");
    title.textContent = day;
    card.append(title);

    if (notCompleted.length === 0) {
      const okText = document.createElement("p");
      okText.className = "ok-day";
      okText.textContent = "Todo completo";
      card.append(okText);
    } else {
      const list = document.createElement("ul");
      notCompleted.forEach((waiter) => {
        const item = document.createElement("li");
        item.textContent = waiter.name;
        list.append(item);
      });
      card.append(list);
    }

    pendingGrid.append(card);
  });
}

function renderWeek() {
  const weekId = weekPicker.value;
  ensureWeekData(weekId);

  const weekRows = state.data.weeks[weekId].rows;
  tableBody.innerHTML = "";

  state.data.waiters.forEach((waiter) => {
    if (!weekRows[waiter.id]) {
      weekRows[waiter.id] = DAY_LABELS.map(() => ({ waiterStatus: "", adminApproved: false }));
    }

    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    const nameWrap = document.createElement("div");
    nameWrap.className = "waiter-name-wrap";

    if (roleSelect.value === "admin") {
      const input = document.createElement("input");
      input.className = "waiter-name-input";
      input.value = waiter.name;
      input.addEventListener("change", () => {
        waiter.name = input.value.trim() || waiter.name;
        syncUserSelect();
        saveState();
        renderWeek();
      });
      nameWrap.append(input);
    } else {
      const strong = document.createElement("strong");
      strong.textContent = waiter.name;
      nameWrap.append(strong);
    }

    nameTd.append(nameWrap);
    tr.append(nameTd);

    DAY_LABELS.forEach((_, dayIndex) => {
      const td = document.createElement("td");
      const fragment = dayCellTemplate.content.cloneNode(true);

      const statusSelect = fragment.querySelector(".waiter-status");
      const adminCheck = fragment.querySelector(".admin-check");
      const pill = fragment.querySelector(".state-pill");

      const cellState = weekRows[waiter.id][dayIndex];
      statusSelect.value = cellState.waiterStatus;
      adminCheck.checked = !!cellState.adminApproved;

      const canEditWaiterCell = isWaiterCurrentRow(waiter.id);
      statusSelect.disabled = !canEditWaiterCell;

      const canEditAdmin = roleSelect.value !== "admin";
      adminCheck.disabled = canEditAdmin;

      statusSelect.addEventListener("change", () => {
        if (!canEditWaiterCell) return;
        cellState.waiterStatus = statusSelect.value;
        saveState();
        renderWeek();
      });

      adminCheck.addEventListener("change", () => {
        if (canEditAdmin) return;
        cellState.adminApproved = adminCheck.checked;
        saveState();
        renderWeek();
      });

      const complete = Boolean(cellState.waiterStatus) && cellState.adminApproved;
      pill.classList.toggle("completed", complete);
      pill.classList.toggle("pending", !complete);
      pill.textContent = complete ? `Completo: ${cellState.waiterStatus}` : "Pendiente";

      td.append(fragment);
      tr.append(td);
    });

    tableBody.append(tr);
  });

  saveState();
  updatePendingGrid(weekId);
}

function init() {
  weekPicker.value = getCurrentWeekValue();
  buildTableHead();
  syncUserSelect();
  renderWeek();

  weekPicker.addEventListener("change", renderWeek);

  roleSelect.addEventListener("change", () => {
    syncUserSelect();
    renderWeek();
  });

  userSelect.addEventListener("change", renderWeek);
}

init();
