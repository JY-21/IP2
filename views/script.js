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

    function renderTasks(tasks) {
    tasks.forEach(task => {
        const priority = task.priority ? String(task.priority).toLowerCase() : 'medium';
        
        const div = document.createElement("div");
        div.className = `task-bar ${priority}`;
        
        div.innerHTML = `
            <div class="task-info">
                <strong>${escapeHtml(task.title)}</strong>
                <span class="task-priority ${priority}">${getPriorityLabel(priority)}</span>
                <div class="meta">
                    <span class="category">📁 ${escapeHtml(task.category)}</span>
                    <span class="deadline">📅 ${formatDateForDisplay(task.deadline)}</span>
                    <span class="origin">📍 ${escapeHtml(task.origin)}</span>
                    ${task.destination ? `<span class="destination">🎯 ${escapeHtml(task.destination)}</span>` : ''}
                    ${task.remarks ? `<span class="remarks">💡 ${escapeHtml(task.remarks)}</span>` : ''}
                </div>
            </div>
            <div class="task-actions">
                <button class="route-btn" data-id="${task.id}" title="Plan Route">🗺️</button>
                <button class="edit-btn" data-id="${task.id}" title="Edit Task">✏️</button>
                <button class="complete-btn" data-id="${task.id}" title="Mark Complete">✔️</button>
                <button class="delete-btn" data-id="${task.id}" title="Delete Task">🗑️</button>
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

    // Open new task modal
    newTaskBtn.addEventListener("click", () => {
        taskForm.reset();
        setMinDate();
        modal.classList.add("show");
        
        const headerTitle = modal.querySelector(".modal-header h2");
        if (headerTitle) headerTitle.textContent = "Add Task";
        const hiddenId = document.getElementById("taskId");
        if (hiddenId) hiddenId.value = "";
    });

    // Close modal
    closeModal.addEventListener("click", () => modal.classList.remove("show"));
    window.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("show");
    });

    // Form submission
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

            // Validation
            if (!data.title || !data.category || !data.origin || !data.destination || !data.deadline) {
                alert("Please fill out all required fields:\n- Title\n- Category\n- Origin\n- Destination\n- Deadline\n- Urgency");
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

    // Handle button clicks
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

        else if (e.target.classList.contains("route-btn")) {
            showNotification('Route planning feature coming soon!', 'info');
            // You can integrate the map modal functionality here later
        }
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

    // Initial setup
    setMinDate();
    loadTasks();
});