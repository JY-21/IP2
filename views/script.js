document.addEventListener("DOMContentLoaded", () => {

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
  const taskDeadlineInput = document.getElementById("taskDeadline");
  let taskToDelete = null;
  let currentTasks = [];

  if (!modal || !newTaskBtn || !closeModal || !taskList || !taskForm) {
    console.error("Missing required DOM elements. Check your HTML ids.");
    return;
  }

  function formatDateForInput(dateString) {
    if (!dateString) return '';
    
    // If the date is already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Otherwise, parse and format
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  function formatDateForDisplay(dateString) {
    if (!dateString) return 'No deadline';
    
    const date = new Date(dateString);
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    };
    
    return date.toLocaleDateString('en-US', options);
  }

  // 🔹 Set minimum date to today
  function setMinDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const minDate = `${yyyy}-${mm}-${dd}`;
    
    if (taskDeadlineInput) {
      taskDeadlineInput.min = minDate;
    }
  }

  // 🔹 Load tasks from backend
  async function loadTasks() {
    try {
      const res = await fetch("/tasks");
      const tasks = await res.json();
      currentTasks = tasks;
      renderTasks(tasks);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  }

  // 🔹 Render tasks
  function renderTasks(tasks) {
    taskList.innerHTML = "";
    tasks.forEach(t => {
      const div = document.createElement("div");
      div.className = `task-bar ${t.priority ? t.priority.toLowerCase() : "medium"}`;
      div.innerHTML = `
        <div class="task-info">
          <strong>${escapeHtml(t.title)}</strong>
          <div class="meta">
            Location: ${escapeHtml(t.location)} <br>
            Origin: ${escapeHtml(t.origin)} <br>
            Category: ${escapeHtml(t.category)} <br>
            Deadline: ${formatDateForDisplay(t.deadline)} <br> 
            Priority: ${t.priority || "N/A"} <br>
            ${t.remarks || ""}
          </div>
        </div>
        <div class="task-actions">
          <button class="edit-btn" data-id="${t.id}" title="Edit">✏️</button>
          <button class="delete-btn" data-id="${t.id}" title="Delete">❌</button>
          <button class="complete-btn" data-id="${t.id}" title="Complete">✔️</button>
        </div>
      `;
      taskList.appendChild(div);
    });
  }

  // Simple HTML escaper
  function escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str).replace(/[&<>"']/g, s =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s])
    );
  }

  // 🔹 Open new task modal
  newTaskBtn.addEventListener("click", () => {
    taskForm.reset();
    const extras = locationsContainer.querySelectorAll(".location-input");
    extras.forEach((el, idx) => { if (idx > 0) el.remove(); });
    
    // Set min date when opening modal for new task
    setMinDate();
    
    modal.classList.add("show");
    const headerTitle = modal.querySelector(".modal-header h2");
    if (headerTitle) headerTitle.textContent = "Add Task";
    const hiddenId = document.getElementById("taskId");
    if (hiddenId) hiddenId.value = "";
  });

  // 🔹 Close modal
  closeModal.addEventListener("click", () => modal.classList.remove("show"));
  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("show");
  });

  // 🔹 Add new location input
  addLocationBtn.addEventListener("click", () => {
    const div = document.createElement("div");
    div.className = "location-input";
    div.innerHTML = `
      <input type="text" name="taskLocations[]" placeholder="Enter location">
      <button type="button" class="remove-location">-</button>
    `;
    locationsContainer.appendChild(div);
  });

  // 🔹 Remove location input
  locationsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-location")) {
      e.target.closest(".location-input").remove();
    }
  });

  // 🔹 Handle form submit (add / edit task)
  taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    data["taskLocations[]"] = formData.getAll("taskLocations[]");
    if (!data.priority) data.priority = "Medium";

    data.location = Array.isArray(data["taskLocations[]"])
      ? data["taskLocations[]"].join(", ")
      : data["taskLocations[]"];

    // Additional validation: Check if deadline is in the past
    const selectedDate = new Date(data.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time part for accurate comparison
    
    if (selectedDate < today) {
      alert("Please select a deadline that is today or in the future.");
      return;
    }

    if (!data.title || !data.category || !data.origin || !data.location || !data.deadline) {
      alert("Please fill out all fields before saving a task.");
      return;
    }

    try {
      const url = data.taskId ? `/tasks/${data.taskId}` : "/add-task";
      const method = data.taskId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to save task");

      modal.classList.remove("show");
      taskForm.reset();
      loadTasks();

    } catch (err) {
      console.error("Error saving task:", err);
      alert("Error saving task: " + err.message);
    }
  });

  // 🔹 Handle edit / delete / complete buttons
  taskList.addEventListener("click", (e) => {
    const id = parseInt(e.target.dataset.id);
    console.log("🖱 Clicked:", e.target);

    if (e.target.classList.contains("delete-btn")) {
      taskToDelete = id;
      deleteModal.classList.add("show");
    }

    else if (e.target.classList.contains("edit-btn")) {
      console.log("✏️ Edit clicked for id:", id);
      const t = currentTasks.find(task => task.id === id);
      console.log("Found task:", t);
      if (!t) {
        alert("Task not found");
        return;
      }

      // populate modal with task data
      document.getElementById("taskId").value = t.id;
      document.getElementById("taskTitle").value = t.title || "";
      document.getElementById("taskCategory").value = t.category || "";
      document.getElementById("taskRemarks").value = t.remarks || "";
      document.getElementById("taskOrigin").value = t.origin || "";
      document.getElementById("taskDeadline").value = formatDateForInput(t.deadline) || "";

      // Set min date when opening modal for editing
      setMinDate();

      // load locations
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

      modal.classList.add("show");
      const headerTitle = modal.querySelector(".modal-header h2");
      if (headerTitle) headerTitle.textContent = "Edit Task";
    }

    else if (e.target.classList.contains("complete-btn")) {
      const t = currentTasks.find(task => task.id === id);
      if (t) {
        t.complete = 1;
        loadTasks();
      }
    }
  });

  cancelDeleteBtn.addEventListener("click", () => {
    deleteModal.classList.remove("show");
    taskToDelete = null;
  });

// 🔹 Delete confirmation modal
confirmDeleteBtn.addEventListener("click", async () => {
  if (!taskToDelete) return;

  try {
    // Find the task element to animate
    const taskElement = document.querySelector(`[data-id="${taskToDelete}"]`)?.closest('.task-bar');
    
    if (taskElement) {
      // Add fade-out animation
      taskElement.classList.add('fade-out');
      
      // Wait for animation to complete before deleting
      setTimeout(async () => {
        const res = await fetch(`/tasks/${taskToDelete}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete task");
        
        // Remove from DOM after animation
        taskElement.remove();
        deleteModal.classList.remove("show");
        taskToDelete = null;
        
        // Also reload tasks to ensure sync with backend
        loadTasks();
      }, 500); // Match this with your CSS animation duration
    } else {
      // Fallback if element not found
      const res = await fetch(`/tasks/${taskToDelete}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      deleteModal.classList.remove("show");
      taskToDelete = null;
      loadTasks();
    }
  } catch (err) {
    console.error("Error deleting task:", err);
    alert("Error deleting task: " + err.message);
  }
});

  // 🔹 Set min date on initial page load
  setMinDate();
  
  // 🔹 Initial load
  loadTasks();
});