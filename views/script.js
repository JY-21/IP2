// script.js (replace existing file completely)
document.addEventListener("DOMContentLoaded", () => {
  // In-memory tasks for demo (will be replaced by server calls later)
  const tasks = [
    {id: 1, title: "Buy Groceries", location: "Tesco", duration: 1, date: "2025-09-02", priority: "High"},
    {id: 2, title: "Doctor Appointment", location: "Clinic", duration: 0.5, date: "2025-09-03", priority: "Medium"}
  ];

  // ELEMENTS
  const modal = document.getElementById("taskModal");
  const newTaskBtn = document.getElementById("newTaskBtn");
  const closeModal = document.getElementById("closeModal");
  const locationsContainer = document.getElementById("locationsContainer");
  const addLocationBtn = document.getElementById("addLocationBtn");
  const taskList = document.getElementById("taskList");
  const taskForm = document.getElementById("taskForm");

  if (!modal || !newTaskBtn || !closeModal || !taskList || !taskForm) {
    console.error("Missing required DOM elements. Check your HTML ids.");
    return;
  }

  // RENDER TASKS
  async function loadTasks() {

    try{
      const res = await fetch("/tasks");
      const tasks = await res.json();

      const taskList = document.getElementById("taskList");

      taskList.innerHTML = "";

      tasks.forEach(t => {
        const div = document.createElement("div");
        div.className = `task-bar ${t.priority ? t.priority.toLowerCase() : "medium"}`;
        div.innerHTML = `
          <div class="task-info">
            <strong>${escapeHtml(t.title)}</strong>
            <div class="meta">${escapeHtml(t.location)} • ${t.duration} hr • Due: ${t.date}</div>
          </div>
          <div class="task-actions">
            <button class="edit-btn" data-id="${t.id}" title="Edit">✏️</button>
            <button class="delete-btn" data-id="${t.id}" title="Delete">❌</button>
            <button class="complete-btn" data-id="${t.id}" title="Complete">✔️</button>
          </div>
        `;
        taskList.appendChild(div);
      });
    } catch (err){
      console.error("Failed to load tasks: ", err);
    }
  }
document.addEventListener("DOMContentLoaded", loadTasks);

  // Simple HTML escaper
  function escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  // OPEN / CLOSE MODAL
  newTaskBtn.addEventListener("click", () => {
    // reset form
    taskForm.reset();
    // remove existing extra location inputs (keep one default)
    const extras = locationsContainer.querySelectorAll(".location-input");
    extras.forEach((el, idx) => { if (idx>0) el.remove(); });
    modal.classList.add("show");
    document.getElementById("modalTitle").innerText = "Add Task";
    document.getElementById("taskId").value = "";
  });

  closeModal.addEventListener("click", () => modal.classList.remove("show"));
  window.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("show"); });

  //handle task form submission
  document.getElementById("taskForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    //if multiple locations[]
     data["taskLocations[]"] = formData.getAll("taskLocations[]");

    try{
      await fetch("/add-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      document.getElementById("taskModal").classList.remove("show");
      loadTasks();
    } catch (err) {
      console.error("Error adding tasks:", err);
    }
  });
  
  // ADD/REMOVE LOCATION INPUTS (delegated)
  addLocationBtn.addEventListener("click", () => {
    const div = document.createElement("div");
    div.className = "location-input";
    div.innerHTML = `<input type="text" name="taskLocations[]" placeholder="Enter location"><button type="button" class="remove-location">-</button>`;
    locationsContainer.appendChild(div);
  });

  locationsContainer.addEventListener("click", (e) => {
    if (e.target && e.target.classList.contains("remove-location")) {
      const parent = e.target.closest(".location-input");
      if (parent) parent.remove();
    }
  });

  // FORM SUBMIT: collect fields, push to tasks array and re-render
  taskForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const idVal = document.getElementById("taskId").value;
    const title = document.getElementById("taskTitle").value.trim();
    const origin = document.getElementById("taskOrigin").value.trim();
    const locationInputs = Array.from(document.querySelectorAll("input[name='taskLocations[]']")).map(i => i.value.trim()).filter(x=>x);
    const duration = parseFloat(document.getElementById("taskDuration").value) || 0;
    const date = document.getElementById("taskDate").value;
    const priority = document.getElementById("taskPriority").value || "Medium";

    // Build task object (locations array stored in custom field for now)
    const newTask = {
      id: idVal ? parseInt(idVal) : (tasks.length ? Math.max(...tasks.map(t=>t.id)) + 1 : 1),
      title,
      origin,
      locations: locationInputs,
      location: locationInputs[0] || "", // keep backward-compat display
      duration,
      date,
      priority
    };

    if (idVal) {
      // edit existing
      const idx = tasks.findIndex(t => t.id === newTask.id);
      if (idx > -1) tasks[idx] = newTask;
    } else {
      tasks.push(newTask);
    }

    loadTasks();
    modal.classList.remove("show");
    taskForm.reset();
  });

  // ACTION BUTTONS (edit/delete/complete) - event delegation on taskList
  taskList.addEventListener("click", (e) => {
    const id = parseInt(e.target.dataset.id);
    if (e.target.classList.contains("delete-btn")) {
      const idx = tasks.findIndex(t => t.id === id);
      if (idx > -1) tasks.splice(idx, 1);
      loadTasks();
    } else if (e.target.classList.contains("edit-btn")) {
      const t = tasks.find(t => t.id === id);
      if (!t) return;
      // populate form for edit
      document.getElementById("taskTitle").value = t.title || "";
      document.getElementById("taskOrigin").value = t.origin || "";
      document.getElementById("taskDuration").value = t.duration || "";
      document.getElementById("taskDate").value = t.date || "";
      document.getElementById("taskPriority").value = t.priority || "Medium";

      // reset locations container, then populate
      locationsContainer.innerHTML = "";
      const locs = t.locations && t.locations.length ? t.locations : [t.location || ""];
      locs.forEach((loc, i) => {
        const div = document.createElement("div");
        div.className = "location-input";
        div.innerHTML = `<input type="text" name="taskLocations[]" placeholder="Enter location" value="${escapeHtml(loc)}"><button type="button" class="remove-location">-</button>`;
        locationsContainer.appendChild(div);
      });

      modal.classList.add("show");
      document.getElementById("modalTitle").innerText = "Edit Task";
    } else if (e.target.classList.contains("complete-btn")) {
      const t = tasks.find(t => t.id === id);
      if (t) {
        t.complete = 1;
        // simple visual: add a style for completed tasks or remove them
        loadTasks();
      }
    }
  });

  // initial render
  loadTasks();
});
