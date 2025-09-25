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
  const deleteModal = document.getElementById("deleteModal");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  let taskToDelete = null;

  if (!modal || !newTaskBtn || !closeModal || !taskList || !taskForm) {
    console.error("Missing required DOM elements. Check your HTML ids.");
    return;
  }

  //open delete modal when clickin X
  taskList.addEventListener("click", (e) => {
    const id = parseInt(e.target.dataset.id);
    if(e.target.classList.contains("delete-btn")){
      taskToDelete = id;
      deleteModal.classList.add("show");
    }
  });

  //cancel delete
  cancelDeleteBtn.addEventListener("click", () => {
    deleteModal.classList.remove("show");
    taskToDelete = null;
  });

  //confirm delete
  confirmDeleteBtn.addEventListener("click", async () => {
    if(!taskToDelete) return;

    try{
      const res = await fetch(`/tasks/${taskToDelete}`, { method: "DELETE" });
      if(!res.ok) throw new Error("Failed to delete task");

      //animate task removal
      const taskDiv = document.querySelector(`.delete-btn[data-id="${taskToDelete}"]`).closest(".task-bar");
      if(taskDiv){
        taskDiv.classList.add("fade-out"); //animation
        taskDiv.addEventListener("transitionend", () => taskDiv.remove(), { once: true });//remove after animation
      }

      deleteModal.classList.remove("show");
      taskToDelete = null;

    } catch (err) {
      console.error("Error deleting task: ", err);
    }
  });

  // RENDER TASKS
  let currentTasks = []; //store tasks from DB

  async function loadTasks() {

    try{
      const res = await fetch("/tasks");
      const tasks = await res.json();
      currentTasks = tasks;//store globally

      const taskList = document.getElementById("taskList");

      taskList.innerHTML = "";

      tasks.forEach(t => {
        const div = document.createElement("div");
        div.className = `task-bar ${t.priority ? t.priority.toLowerCase() : "medium"}`;
        div.innerHTML = `
          <div class="task-info">
            <strong>${escapeHtml(t.title)}</strong>
            <div class="meta">Location: ${escapeHtml(t.location)} <br> Origin: ${escapeHtml(t.origin)} <br> Category: ${t.category} <br> Deadline: ${t.deadline} <br> Priority: ${t.priority} <br> ${t.remarks}</div>
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
 taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  data["taskLocations[]"] = formData.getAll("taskLocations[]"); // preserve multiple locations

  // Normalize for backend
  data.location = Array.isArray(data["taskLocations[]"]) 
      ? data["taskLocations[]"].join(", ")
      : data["taskLocations[]"];

  if(!data.title || !data.category || !data.origin || !data.location || !data.deadline || !data.priority){
    alert("Please fill out all fields before saving a task.");
  }
  
  try {
    let res;
    if (data.id) {
      res = await fetch(`/tasks/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      res = await fetch("/add-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }

    if (!res.ok) throw new Error("Failed to save task");

    modal.classList.remove("show");
    taskForm.reset();
    loadTasks();
  } catch (err) {
    console.error("Error saving task:", err);
  }
});

  // ACTION BUTTONS (edit/delete/complete) - event delegation on taskList
  taskList.addEventListener("click", (e) => {
    const id = parseInt(e.target.dataset.id);
    if (e.target.classList.contains("delete-btn")) {
      taskToDelete = id;
      deleteModal.classList.add("show");
    } else if (e.target.classList.contains("edit-btn")) {
      const t = currentTasks.find(task => task.id === id);
      if (!t) return;

      // populate form for edit
      document.getElementById("taskId").value = t.id;
      document.getElementById("taskTitle").value = t.title || "";
      document.getElementById("taskCategory").value = t.category || "";
      document.getElementById("taskRemarks").value = t.remarks || "";
      document.getElementById("taskOrigin").value = t.origin || "";
      document.getElementById("taskDeadline").value = t.deadline || "";
      document.getElementById("taskPriority").value = t.priority || "Medium";

      // reset locations
      locationsContainer.innerHTML = "";
      const locs = t.location ? t.location.split(",") : [""];
      locs.forEach(loc => {
        const div = document.createElement("div");
        div.className = "location-input";
        div.innerHTML = `
          <input type="text" name="taskLocations[]" placeholder="Enter location" value="${escapeHtml(loc.trim())}">
          <button type="button" class="remove-location">-</button>
        `;
        locationsContainer.appendChild(div);
      });

      // show modal
      modal.classList.add("show");
      document.querySelector(".modal-header").textContent = "Edit Task";

    } else if (e.target.classList.contains("complete-btn")) {
      const t = currentTasks.find(task => task.id === id);
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
