document.addEventListener("DOMContentLoaded", () => {
  // ELEMENTS
  const modal = document.getElementById("taskModal");
  const newTaskBtn = document.getElementById("newTaskBtn");
  const closeModal = document.getElementById("closeModal");
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

  // Remove map-related variables and code
  const style = document.createElement('style');
  style.textContent = `
    .task-bar {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      padding: 15px;
      margin: 10px 0;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 6px solid #6c757d;
      min-height: 100px;
    }
    
    .task-bar.high {
      border-left-color: #dc3545;
    }
    
    .task-bar.medium {
      border-left-color: #ffc107;
    }
    
    .task-bar.low {
      border-left-color: #28a745;
    }
    
    .task-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .task-info strong {
      display: block;
      font-size: 1.2em;
      margin-bottom: 5px;
      color: #333;
    }
    
    .task-priority {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 600;
      margin-bottom: 8px;
      width: fit-content;
    }
    
    .task-priority.high {
      background: #ffe5e5;
      color: #dc3545;
    }
    
    .task-priority.medium {
      background: #fff4e5;
      color: #ff9800;
    }
    
    .task-priority.low {
      background: #e5f5e5;
      color: #28a745;
    }
    
    .meta {
      font-size: 0.9em;
      color: #666;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .meta span {
      display: block;
    }
    
    .task-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-left: 15px;
      justify-content: center;
    }
    
    .task-actions button {
      padding: 10px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1.2em;
      width: 45px;
      height: 45px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .task-actions button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
    
    .task-actions button:active {
      transform: translateY(0);
    }
    
    .edit-btn {
      background: #17a2b8;
      color: white;
    }
    
    .complete-btn {
      background: #28a745;
      color: white;
    }
    
    .delete-btn {
      background: #dc3545;
      color: white;
    }
    
    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      background: #28a745;
      color: white;
      border-radius: 4px;
      transform: translateX(400px);
      transition: transform 0.3s ease;
      z-index: 10000;
    }
    
    .notification.show {
      transform: translateX(0);
    }
    
    .notification.error {
      background: #dc3545;
    }
    
    .no-tasks {
      text-align: center;
      padding: 2rem;
      color: #666;
      font-style: italic;
    }
  `;
  document.head.appendChild(style);

  function formatDateForInput(dateString) {
    if (!dateString) return '';
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
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

  function getPriorityLabel(priority) {
    if (!priority) return 'Medium Priority';
    
    const priorityLower = String(priority).toLowerCase();
    const labels = {
      'high': 'High Priority',
      'medium': 'Medium Priority',
      'low': 'Low Priority'
    };
    return labels[priorityLower] || 'Medium Priority';
  }

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

  async function loadTasks() {
    try {
      console.log('Loading tasks from backend...');
      const res = await fetch("/tasks");
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const tasks = await res.json();
      console.log('Tasks loaded:', tasks);
      currentTasks = tasks;
      renderTasks(tasks);
    } catch (err) {
      console.error("Failed to load tasks:", err);
      showNotification('Failed to load tasks: ' + err.message, 'error');
    }
  }

  // Remove geocodeAddress function entirely

  function renderTasks(tasks) {
    console.log('Rendering tasks:', tasks);
    taskList.innerHTML = "";
    
    if (!tasks || tasks.length === 0) {
      taskList.innerHTML = '<div class="no-tasks">No tasks yet. Create your first task!</div>';
      return;
    }
    
    tasks.forEach(t => {
      console.log('Rendering task:', t);
      
      const priority = t.priority ? String(t.priority).toLowerCase() : 'medium';
      
      const div = document.createElement("div");
      div.className = `task-bar ${priority}`;
      
      // Remove route button since we don't have coordinates
      div.innerHTML = `
        <div class="task-info">
          <strong>${escapeHtml(t.title)}</strong>
          <span class="task-priority ${priority}">${getPriorityLabel(priority)}</span>
          <div class="meta">
            <span class="category">📁 ${escapeHtml(t.category)}</span>
            <span class="deadline">📅 ${formatDateForDisplay(t.deadline)}</span>
            <span class="origin">📍 ${escapeHtml(t.origin)}</span>
            ${t.destination ? `<span class="destination">🎯 ${escapeHtml(t.destination)}</span>` : ''}
            ${t.remarks ? `<span class="remarks">💡 ${escapeHtml(t.remarks)}</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="edit-btn" data-id="${t.id}" title="Edit Task">✏️</button>
          <button class="complete-btn" data-id="${t.id}" title="Mark Complete">✔️</button>
          <button class="delete-btn" data-id="${t.id}" title="Delete Task">🗑️</button>
        </div>
      `;
      taskList.appendChild(div);
    });
  }

  function escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str).replace(/[&<>"']/g, s =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s])
    );
  }

  newTaskBtn.addEventListener("click", () => {
    taskForm.reset();
    setMinDate();
    modal.classList.add("show");
    
    const headerTitle = modal.querySelector(".modal-header h2");
    if (headerTitle) headerTitle.textContent = "Add Task";
    const hiddenId = document.getElementById("taskId");
    if (hiddenId) hiddenId.value = "";
  });

  closeModal.addEventListener("click", () => modal.classList.remove("show"));
  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("show");
  });

  taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log('=== FORM SUBMISSION STARTED ===');
    
    const submitButton = document.querySelector('.save-btn');
    
    if (!submitButton) {
      console.error('Submit button not found');
      alert('Form configuration error - submit button not found');
      return;
    }
    
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Saving...';
    submitButton.disabled = true;

    try {
      const formData = new FormData(taskForm);
      const data = Object.fromEntries(formData.entries());
      
      console.log('Form data collected:', data);

      // Remove coordinate fields from data
      delete data.originLat;
      delete data.originLon;
      delete data.destLat;
      delete data.destLon;

      // Validation
      if (!data.title || !data.category || !data.origin || !data.destination || !data.deadline) {
        alert("Please fill out all required fields:\n- Title\n- Category\n- Origin\n- Destination\n- Deadline");
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        return;
      }

      const selectedDate = new Date(data.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        alert("Deadline must be today or in the future.");
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        return;
      }

      data.complete = 0;
      
      console.log('Final data to send:', data);

      const url = data.taskId ? `/tasks/${data.taskId}` : "/add-task";
      const method = data.taskId ? "PUT" : "POST";

      console.log('Sending to backend:', { url, method, data });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      console.log('Response status:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server error (${res.status}): ${errorText}`);
      }

      const result = await res.json();
      console.log('Server response:', result);

      // Remove geocoding call
      
      modal.classList.remove("show");
      taskForm.reset();
      await loadTasks();
      showNotification('Task saved successfully!', 'success');

    } catch (err) {
      console.error("=== ERROR SAVING TASK ===");
      console.error("Error details:", err);
      
      alert("Error saving task:\n" + err.message + "\n\nCheck the console for details.");
      showNotification('Error: ' + err.message, 'error');
    } finally {
      if (submitButton) {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
      }
    }
  });

  // Remove geocodeTaskAddresses function entirely

  taskList.addEventListener("click", async (e) => {
    const id = parseInt(e.target.dataset.id);

    if (e.target.classList.contains("delete-btn")) {
      taskToDelete = id;
      deleteModal.classList.add("show");
    }

    else if (e.target.classList.contains("edit-btn")) {
      const t = currentTasks.find(task => task.id === id);
      if (!t) {
        alert("Task not found");
        return;
      }

      document.getElementById("taskId").value = t.id;
      document.getElementById("taskTitle").value = t.title || "";
      document.getElementById("taskCategory").value = t.category || "";
      document.getElementById("taskRemarks").value = t.remarks || "";
      document.getElementById("taskOrigin").value = t.origin || "";
      document.getElementById("taskDestination").value = t.destination || "";
      document.getElementById("taskDeadline").value = formatDateForInput(t.deadline) || "";

      setMinDate();
      modal.classList.add("show");
      
      const headerTitle = modal.querySelector(".modal-header h2");
      if (headerTitle) headerTitle.textContent = "Edit Task";
    }

    else if (e.target.classList.contains("complete-btn")) {
      const t = currentTasks.find(task => task.id === id);
      if (t) {
        try {
          const res = await fetch(`/tasks/${id}`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...t, complete: 1 })
          });
          if (res.ok) {
            await loadTasks();
            showNotification('Task completed!', 'success');
          }
        } catch (err) {
          console.error('Error completing task:', err);
        }
      }
    }

    // Remove route-btn handling
  });

  cancelDeleteBtn.addEventListener("click", () => {
    deleteModal.classList.remove("show");
    taskToDelete = null;
  });

  confirmDeleteBtn.addEventListener("click", async () => {
    if (!taskToDelete) return;

    try {
      const res = await fetch(`/tasks/${taskToDelete}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      
      deleteModal.classList.remove("show");
      taskToDelete = null;
      
      await loadTasks();
      showNotification('Task deleted!', 'success');
    } catch (err) {
      console.error("Error deleting task:", err);
      showNotification('Error deleting: ' + err.message, 'error');
    }
  });

  // Remove all route and map functions:
  // - showRouteForTask
  // - displayRouteOnMap
  // - showRouteInfo
  // - showSimpleRouteInfo
  // - clearRoute
  // - initMap

  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Initial setup
  setMinDate();
  loadTasks();
});