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
  const mapSection = document.querySelector('.map-section');
  let taskToDelete = null;
  let currentTasks = [];
  let map;
  let taskMarkers = [];
  let routeLayer = null;

  if (!modal || !newTaskBtn || !closeModal || !taskList || !taskForm) {
    console.error("Missing required DOM elements. Check your HTML ids.");
    return;
  }

  // 🔹 FORCE hide map section on page load
  if (mapSection) {
    mapSection.style.display = 'none';
  }
  const taskMapElement = document.getElementById('taskMap');
  if (taskMapElement) {
    taskMapElement.style.display = 'none';
  }

  // 🔹 Enhanced styles for task bars with vertical buttons
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
    
    .route-btn {
      background: #28a745;
      color: white;
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
    
    .route-info {
      background: #e9ecef;
      padding: 15px;
      margin-top: 15px;
      border-radius: 4px;
      border-left: 4px solid #28a745;
    }
    
    .clear-route-btn {
      background: #dc3545;
      color: white;
      border: none;
      padding: 8px 15px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 10px;
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

    .fade-out {
      opacity: 0;
      transition: opacity 0.5s ease;
    }

    /* CRITICAL: Hide map controls by default */
    .map-controls {
      display: none !important;
    }
    
    #taskMap {
      display: none !important;
    }
    
    .map-section {
      display: none !important;
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

  // 🔹 Get priority label
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

  // 🔹 Geocode address to coordinates
  async function geocodeAddress(address) {
    try {
      console.log('Geocoding address:', address);
      
      // Add delay to respect rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        {
          headers: {
            'User-Agent': 'TaskManagerApp/1.0'
          }
        }
      );
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        console.log('Geocoding result:', data[0]);
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon)
        };
      }
      console.log('No geocoding results found for:', address);
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  // 🔹 Render tasks - Uses priority from backend (ML model)
  function renderTasks(tasks) {
    console.log('Rendering tasks:', tasks);
    taskList.innerHTML = "";
    
    if (!tasks || tasks.length === 0) {
      taskList.innerHTML = '<div class="no-tasks">No tasks yet. Create your first task!</div>';
      return;
    }
    
    tasks.forEach(t => {
      console.log('Rendering task:', t);
      
      // Use priority from backend (set by ML model)
      // Default to 'medium' if not provided
      const priority = t.priority ? String(t.priority).toLowerCase() : 'medium';
      
      const div = document.createElement("div");
      div.className = `task-bar ${priority}`;
      
      // Check if task has valid coordinates
      const hasValidCoordinates = t.originLat && t.originLon && 
                                   !isNaN(parseFloat(t.originLat)) && 
                                   !isNaN(parseFloat(t.originLon));
      
      // Only show route button if coordinates exist and are valid
      const routeButton = hasValidCoordinates ? 
        `<button class="route-btn" data-id="${t.id}" title="Show Route">🗺️</button>` : '';
      
      div.innerHTML = `
        <div class="task-info">
          <strong>${escapeHtml(t.title)}</strong>
          <span class="task-priority ${priority}">${getPriorityLabel(priority)}</span>
          <div class="meta">
            <span class="category">📁 ${escapeHtml(t.category)}</span>
            <span class="deadline">📅 ${formatDateForDisplay(t.deadline)}</span>
            <span class="origin">📍 ${escapeHtml(t.origin)}</span>
            ${t.location ? `<span class="destination">🎯 ${escapeHtml(t.location)}</span>` : ''}
            ${t.remarks ? `<span class="remarks">💡 ${escapeHtml(t.remarks)}</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          ${routeButton}
          <button class="edit-btn" data-id="${t.id}" title="Edit Task">✏️</button>
          <button class="complete-btn" data-id="${t.id}" title="Mark Complete">✔️</button>
          <button class="delete-btn" data-id="${t.id}" title="Delete Task">🗑️</button>
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
    
    // Reset locations to single input
    locationsContainer.innerHTML = `
      <div class="location-input">
        <input type="text" name="taskLocations[]" placeholder="Enter Location" required>
        <button type="button" class="remove-location">-</button>
      </div>
    `;
    
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
      <input type="text" name="taskLocations[]" placeholder="Enter destination (e.g., Times Square, New York)">
      <button type="button" class="remove-location">-</button>
    `;
    locationsContainer.appendChild(div);
  });

  // 🔹 Remove location input
  locationsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-location")) {
      const locationInputs = locationsContainer.querySelectorAll(".location-input");
      // Keep at least one location input
      if (locationInputs.length > 1) {
        e.target.closest(".location-input").remove();
      } else {
        alert("At least one location is required");
      }
    }
  });

  // 🔹 Form submission - Backend will handle ML priority prediction
  taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log('=== FORM SUBMISSION STARTED ===');
    
    // Find submit button
    const submitButton = document.querySelector('button[form="taskForm"]') || 
                         document.querySelector('.save-btn');
    
    if (!submitButton) {
      console.error('Submit button not found');
      alert('Form configuration error - submit button not found');
      return;
    }
    
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Saving...';
    submitButton.disabled = true;

    try {
      // Collect form data
      const formData = new FormData(e.target);
      
      // Build data object
      const data = {
        title: formData.get('title'),
        category: formData.get('category'),
        origin: formData.get('origin'),
        deadline: formData.get('deadline'),
        remarks: formData.get('remarks') || '',
        taskId: formData.get('taskId') || '',
        complete: 0
      };
      
      // Get locations as array
      const locationInputs = formData.getAll("taskLocations[]").filter(loc => loc && loc.trim());
      data.location = locationInputs.join(", ");
      
      console.log('Form data collected:', data);

      // Validation
      if (!data.title || !data.category || !data.origin || !data.deadline) {
        alert("Please fill out all required fields:\n- Title\n- Category\n- Origin\n- Deadline");
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        return;
      }

      if (locationInputs.length === 0 || !locationInputs[0]) {
        alert("Please add at least one destination location");
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        return;
      }

      // Validate deadline
      const selectedDate = new Date(data.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        alert("Deadline must be today or in the future.");
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        return;
      }

      // SAVE TASK - Backend will predict priority using ML
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

      const savedTaskId = result.id || data.taskId;
      
      // Close modal
      modal.classList.remove("show");
      taskForm.reset();
      await loadTasks();
      showNotification('Task saved successfully!', 'success');

      // Geocode in background
      if (savedTaskId) {
        geocodeTaskAddresses(savedTaskId, data.origin, locationInputs);
      }

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

  // 🔹 Geocode addresses AFTER task is saved
  async function geocodeTaskAddresses(taskId, origin, destinations) {
    console.log('Starting background geocoding for task:', taskId);
    
    try {
      const originCoords = await geocodeAddress(origin);
      
      const locationCoords = [];
      for (const dest of destinations) {
        if (dest && dest.trim()) {
          const coords = await geocodeAddress(dest.trim());
          if (coords) {
            locationCoords.push({
              address: dest.trim(),
              lat: coords.lat,
              lon: coords.lon
            });
          }
        }
      }

      if (originCoords) {
        const updateData = {
          originLat: originCoords.lat,
          originLon: originCoords.lon,
          locations: locationCoords
        };

        console.log('Updating task with coordinates:', updateData);

        const res = await fetch(`/tasks/${taskId}/coordinates`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });

        if (res.ok) {
          console.log('Coordinates updated successfully');
          await loadTasks();
          showNotification('Location data added - route now available!', 'success');
        }
      }
    } catch (err) {
      console.error('Background geocoding error:', err);
    }
  }

  // 🔹 Handle button clicks
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
      document.getElementById("taskDeadline").value = formatDateForInput(t.deadline) || "";

      setMinDate();

      // Load locations
      locationsContainer.innerHTML = "";
      
      let locs = [];
      if (t.location && typeof t.location === 'string') {
        locs = t.location.split(",").map(l => l.trim()).filter(l => l);
      }
      
      if (locs.length === 0) {
        locs = [""];
      }
      
      locs.forEach((loc) => {
        const div = document.createElement("div");
        div.className = "location-input";
        div.innerHTML = `
          <input type="text" name="taskLocations[]" placeholder="Enter destination" value="${escapeHtml(loc)}" required>
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
      console.log('Route button clicked for task:', id);
      showRouteForTask(id);
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

  // 🔹 Route generation
  async function showRouteForTask(taskId) {
    try {
      const task = currentTasks.find(t => t.id === taskId);
      if (!task) {
        alert('Task not found');
        return;
      }

      if (!task.originLat || !task.originLon) {
        alert('This task does not have location data yet.\n\nPlease wait for the address to be processed.');
        return;
      }

      if (mapSection) mapSection.style.display = 'block';
      if (taskMapElement) taskMapElement.style.display = 'block';

      if (!map) {
        initMap();
      }

      let userLat, userLon;
      
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              maximumAge: 60000
            });
          });
          
          userLat = position.coords.latitude;
          userLon = position.coords.longitude;
        } catch (geoError) {
          userLat = task.originLat;
          userLon = task.originLon;
        }
      } else {
        userLat = task.originLat;
        userLon = task.originLon;
      }

      const waypoints = [`${task.originLon},${task.originLat}`];
      const routeCoords = [`${userLon},${userLat}`, ...waypoints].join(';');
      
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${routeCoords}?overview=full&geometries=geojson`
      );
      
      const routeData = await response.json();

      if (routeData.code === 'Ok' && routeData.routes && routeData.routes.length > 0) {
        displayRouteOnMap(routeData.routes[0], task, userLat, userLon);
        showRouteInfo(routeData.routes[0], task);
      } else {
        throw new Error('Could not calculate route');
      }

    } catch (error) {
      console.error('Route error:', error);
      
      const task = currentTasks.find(t => t.id === taskId);
      if (task && task.originLat && task.originLon) {
        if (!map) initMap();
        
        if (mapSection) mapSection.style.display = 'block';
        if (taskMapElement) taskMapElement.style.display = 'block';
        
        map.setView([task.originLat, task.originLon], 13);
        
        L.marker([task.originLat, task.originLon])
          .addTo(map)
          .bindPopup(`<strong>${escapeHtml(task.title)}</strong><br>${escapeHtml(task.origin)}`)
          .openPopup();
        
        showSimpleRouteInfo(task);
      } else {
        showNotification('Error showing route', 'error');
      }
    }
  }

  function displayRouteOnMap(route, task, userLat, userLon) {
    if (routeLayer) {
      map.removeLayer(routeLayer);
    }
    
    taskMarkers.forEach(marker => map.removeLayer(marker));
    taskMarkers = [];

    routeLayer = L.geoJSON(route.geometry, {
      style: {
        color: '#2e7d32',
        weight: 5,
        opacity: 0.7
      }
    }).addTo(map);

    const startMarker = L.marker([userLat, userLon])
      .addTo(map)
      .bindPopup('<strong>Start</strong><br>Your location');
    taskMarkers.push(startMarker);

    const destMarker = L.marker([task.originLat, task.originLon])
      .addTo(map)
      .bindPopup(`<strong>${escapeHtml(task.title)}</strong><br>${escapeHtml(task.origin)}`);
    taskMarkers.push(destMarker);

    const bounds = routeLayer.getBounds();
    map.fitBounds(bounds, { padding: [50, 50] });
  }

  function showRouteInfo(route, task) {
    const distance = (route.distance / 1000).toFixed(1);
    const duration = Math.round(route.duration / 60);

    let routeInfo = document.getElementById('routeInfo');
    if (!routeInfo) {
      routeInfo = document.createElement('div');
      routeInfo.id = 'routeInfo';
      routeInfo.className = 'route-info';
      mapSection.appendChild(routeInfo);
    }

    routeInfo.innerHTML = `
      <h3>Route to: ${escapeHtml(task.title)}</h3>
      <p><strong>Distance:</strong> ${distance} km</p>
      <p><strong>Time:</strong> ${duration} minutes</p>
      <p><strong>Destination:</strong> ${escapeHtml(task.origin)}</p>
      <button id="clearRouteBtn" class="clear-route-btn">Clear Route</button>
    `;

    document.getElementById('clearRouteBtn').addEventListener('click', clearRoute);
  }

  function showSimpleRouteInfo(task) {
    let routeInfo = document.getElementById('routeInfo');
    if (!routeInfo) {
      routeInfo = document.createElement('div');
      routeInfo.id = 'routeInfo';
      routeInfo.className = 'route-info';
      mapSection.appendChild(routeInfo);
    }

    routeInfo.innerHTML = `
      <h3>${escapeHtml(task.title)}</h3>
      <p><strong>Location:</strong> ${escapeHtml(task.origin)}</p>
      <button id="clearRouteBtn" class="clear-route-btn">Clear Map</button>
    `;

    document.getElementById('clearRouteBtn').addEventListener('click', clearRoute);
  }

  function clearRoute() {
    if (routeLayer) {
      map.removeLayer(routeLayer);
      routeLayer = null;
    }

    taskMarkers.forEach(marker => map.removeLayer(marker));
    taskMarkers = [];

    const routeInfo = document.getElementById('routeInfo');
    if (routeInfo) {
      routeInfo.remove();
    }
    
    if (mapSection) mapSection.style.display = 'none';
    if (taskMapElement) taskMapElement.style.display = 'none';
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

  function initMap() {
    if (!map) {
      map = L.map('taskMap').setView([51.505, -0.09], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);
    }
    return map;
  }

  // Initial setup
  setMinDate();
  loadTasks();
});