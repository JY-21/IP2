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
    
    // Map Modal Elements
    const mapModal = document.getElementById("mapModal");
    const closeMapModal = document.getElementById("closeMapModal");
    const originSearch = document.getElementById("originSearch");
    const destinationSearch = document.getElementById("destinationSearch");
    const useCurrentLocation = document.getElementById("useCurrentLocation");
    const searchLocations = document.getElementById("searchLocations");
    const generateRoute = document.getElementById("generateRoute");
    const saveRoute = document.getElementById("saveRoute");
    const routeMap = document.getElementById("routeMap");
    const routeInfo = document.getElementById("routeInfo");
    
    let taskToDelete = null;
    let currentTasks = [];
    let currentTaskId = null;
    let map = null;
    let routeLayer = null;
    let originMarker = null;
    let destinationMarker = null;
    let currentRoute = null;

    // Initialize the application
    function init() {
        setMinDate();
        loadTasks();
        initMapModal();
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
            const res = await fetch("/tasks");
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            
            const tasks = await res.json();
            currentTasks = tasks;
            renderTasks(tasks);
        } catch (err) {
            console.error("Failed to load tasks:", err);
            showNotification('Failed to load tasks: ' + err.message, 'error');
        }
    }

   function renderTasks(tasks) {
    taskList.innerHTML = "";
    
    if (!tasks || tasks.length === 0) {
        taskList.innerHTML = '<div class="no-tasks">No tasks yet. Create your first task!</div>';
        return;
    }
    
    tasks.forEach(task => {
        const priority = task.priority ? String(task.priority).toLowerCase() : 'medium';
        const hasRoute = task.route_origin && task.route_destination;
        
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
                    ${hasRoute ? `
                        <div class="saved-route-info">
                            <span class="saved-route">🗺️ Route Saved</span>
                            <span class="route-details">${task.route_distance} km • ${Math.round(task.route_duration / 60)} min</span>
                        </div>
                    ` : ''}
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

    // Map Modal Functions
    function initMapModal() {
        if (!map) {
            map = L.map('routeMap').setView([51.505, -0.09], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);
            
            // Add click event to map for manual location selection
            map.on('click', function(e) {
                if (!originMarker) {
                    setOriginLocation(e.latlng.lat, e.latlng.lng);
                } else if (!destinationMarker) {
                    setDestinationLocation(e.latlng.lat, e.latlng.lng);
                }
            });
        }
        
        // Event listeners for map modal
        closeMapModal.addEventListener('click', closeMapModalHandler);
        useCurrentLocation.addEventListener('click', getCurrentLocation);
        searchLocations.addEventListener('click', searchLocationsHandler);
        generateRoute.addEventListener('click', generateRouteHandler);
        saveRoute.addEventListener('click', saveRouteHandler);
        
        window.addEventListener('click', (e) => {
            if (e.target === mapModal) closeMapModalHandler();
        });
    }

    function openMapModal(taskId) {
        currentTaskId = taskId;
        const task = currentTasks.find(t => t.id === taskId);
        
        if (task) {
            originSearch.value = task.origin || '';
            destinationSearch.value = task.destination || '';
        }
        
        // Reset map state
        clearMap();
        resetRouteUI();
        mapModal.classList.add("show");
        
        // Load existing route if available
        loadExistingRoute(taskId);
    }

    function closeMapModalHandler() {
        mapModal.classList.remove("show");
        clearMap();
        resetRouteUI();
        currentTaskId = null;
    }

    function clearMap() {
        if (routeLayer) {
            map.removeLayer(routeLayer);
            routeLayer = null;
        }
        if (originMarker) {
            map.removeLayer(originMarker);
            originMarker = null;
        }
        if (destinationMarker) {
            map.removeLayer(destinationMarker);
            destinationMarker = null;
        }
    }

    function resetRouteUI() {
        routeInfo.style.display = 'none';
        generateRoute.disabled = true;
        saveRoute.disabled = true;
        currentRoute = null;
    }

    async function getCurrentLocation() {
        if (!navigator.geolocation) {
            showNotification('Geolocation is not supported by your browser', 'error');
            return;
        }

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 10000,
                    maximumAge: 60000
                });
            });
            
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            setOriginLocation(lat, lon);
            const address = await reverseGeocode(lat, lon);
            if (address) {
                originSearch.value = address;
            }
            
        } catch (error) {
            console.error('Error getting current location:', error);
            showNotification('Could not get your current location', 'error');
        }
    }

    async function searchLocationsHandler() {
        const originQuery = originSearch.value.trim();
        const destinationQuery = destinationSearch.value.trim();

        if (originQuery) {
            await geocodeAndSetMarker(originQuery, 'origin');
        }
        if (destinationQuery) {
            await geocodeAndSetMarker(destinationQuery, 'destination');
        }

        if (originMarker && destinationMarker) {
            generateRoute.disabled = false;
        }
    }

    async function geocodeAndSetMarker(query, type) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
                {
                    headers: {
                        'User-Agent': 'TaskManagerApp/1.0'
                    }
                }
            );
            
            const data = await response.json();
            
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                
                if (type === 'origin') {
                    setOriginLocation(lat, lon);
                } else {
                    setDestinationLocation(lat, lon);
                }
                
                return true;
            } else {
                showNotification(`No results found for ${type}: ${query}`, 'error');
                return false;
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            showNotification(`Error searching for ${type}`, 'error');
            return false;
        }
    }

    function setOriginLocation(lat, lon) {
        if (originMarker) {
            map.removeLayer(originMarker);
        }
        
        originMarker = L.marker([lat, lon])
            .addTo(map)
            .bindPopup('Origin Location')
            .openPopup();
        
        map.setView([lat, lon], 13);
        checkRouteReady();
    }

    function setDestinationLocation(lat, lon) {
        if (destinationMarker) {
            map.removeLayer(destinationMarker);
        }
        
        destinationMarker = L.marker([lat, lon])
            .addTo(map)
            .bindPopup('Destination Location')
            .openPopup();
        
        checkRouteReady();
    }

    function checkRouteReady() {
        if (originMarker && destinationMarker) {
            generateRoute.disabled = false;
            // Fit map to show both markers
            const group = new L.featureGroup([originMarker, destinationMarker]);
            map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    async function generateRouteHandler() {
        if (!originMarker || !destinationMarker) return;

        try {
            const originLatLng = originMarker.getLatLng();
            const destLatLng = destinationMarker.getLatLng();

            const routeCoords = `${originLatLng.lng},${originLatLng.lat};${destLatLng.lng},${destLatLng.lat}`;
            
            const response = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${routeCoords}?overview=full&geometries=geojson`
            );
            
            const routeData = await response.json();

            if (routeData.code === 'Ok' && routeData.routes && routeData.routes.length > 0) {
                displayRoute(routeData.routes[0], originLatLng, destLatLng);
                saveRoute.disabled = false;
            } else {
                throw new Error('Could not calculate route');
            }
        } catch (error) {
            console.error('Route generation error:', error);
            showNotification('Error generating route', 'error');
        }
    }

    function displayRoute(route, originLatLng, destLatLng) {
        if (routeLayer) {
            map.removeLayer(routeLayer);
        }

        routeLayer = L.geoJSON(route.geometry, {
            style: {
                color: '#2e7d32',
                weight: 6,
                opacity: 0.8
            }
        }).addTo(map);

        const distance = (route.distance / 1000).toFixed(1);
        const duration = Math.round(route.duration / 60);

        currentRoute = {
            origin: originSearch.value,
            destination: destinationSearch.value,
            originLat: originLatLng.lat,
            originLon: originLatLng.lng,
            destLat: destLatLng.lat,
            destLon: destLatLng.lng,
            distance: distance,
            duration: duration * 60//convert to seconds for storage
        };

        // Update route info display
        document.getElementById('routeDistance').textContent = `${distance} km`;
        document.getElementById('routeDuration').textContent = `${duration} minutes`;
        document.getElementById('selectedOrigin').textContent = originSearch.value;
        document.getElementById('selectedDestination').textContent = destinationSearch.value;
        
        routeInfo.style.display = 'block';
    }

    async function saveRouteHandler() {
        if (!currentRoute || !currentTaskId) return;

        try {
            const res = await fetch(`/tasks/${currentTaskId}/route`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentRoute)
            });

            const result = await res.json();

            if (res.ok) {
                console.log('Route saved successfully');
                showNotification('Route saved successfully!', 'success');
                closeMapModalHandler();
                await loadTasks(); // Refresh tasks to show saved route
            } else {
                throw new Error('Failed to save route');
            }
        } catch (error) {
            console.error('Error saving route:', error);
            showNotification('Error saving route', 'error');
        }
    }

    async function loadExistingRoute(taskId) {
        try {
            console.log('Loading exisiting route for task:', taskId);
            const res = await fetch(`/tasks/${taskId}/route`);
            const data = await res.json();
            
            if (data.success && data.route) {
                const route = data.route;
                console.log('Found existing route:', route);

                // Set origin
                if (route.route_origin_lat && route.route_origin_lon) {
                    setOriginLocation(route.route_origin_lat, route.route_origin_lon);
                    originSearch.value = route.route_origin;
                }
                
                // Set destination
                if (route.route_dest_lat && route.route_dest_lon) {
                    setDestinationLocation(route.route_dest_lat, route.route_dest_lon);
                    destinationSearch.value = route.route_destination;
                }
                
                // Show route info
                if (route.route_distance && route.route_duration) {
                    document.getElementById('routeDistance').textContent = `${route.route_distance} km`;
                    document.getElementById('routeDuration').textContent = `${Math.round(route.route_duration / 60)} minutes`;
                    document.getElementById('selectedOrigin').textContent = route.route_origin;
                    document.getElementById('selectedDestination').textContent = route.route_destination;
                    routeInfo.style.display = 'block';

                    //Recreate the route on the map
                    if(originMarker && destinationMarker){
                        const originLatLng = originMarker.getLatLng();
                        const destLatLng = destinationMarker.getLatLng();
                        const routeCoords = `${originLatLng.lng},${originLatLng.lat};${destLatLng.lng},${destLatLng.lat}`;

                        //Regenerate the route display
                        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${routeCoords}?overview=full&geometries=geojson`);

                        const routeData = await response.json();

                        if(routeData.code === "Ok" && routeData.routes && routeData.routes.length > 0){
                            displayRoute(routeData.routes[0], originLatLng, destLatLng);
                            saveRoute.disabled = false;
                        }
                    }
                }
            } else {
                console.log('No existing route found');
            }
        } catch (error) {
            console.error('Error loading existing route:', error);
        }
    }

    async function reverseGeocode(lat, lon) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'TaskManagerApp/1.0'
                    }
                }
            );
            
            const data = await response.json();
            return data.display_name || '';
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return '';
        }
    }

    // Utility Functions
    function formatDateForInput(dateString) {
        if (!dateString) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatDateForDisplay(dateString) {
        if (!dateString) return 'No deadline';
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
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

    // Event Listeners for Task Actions
    taskList.addEventListener("click", async (e) => {
        const id = parseInt(e.target.dataset.id);

        if (e.target.classList.contains("delete-btn")) {
            taskToDelete = id;
            deleteModal.classList.add("show");
        }
        else if (e.target.classList.contains("edit-btn")) {
            const task = currentTasks.find(t => t.id === id);
            if (!task) {
                alert("Task not found");
                return;
            }

            document.getElementById("taskId").value = task.id;
            document.getElementById("taskTitle").value = task.title || "";
            document.getElementById("taskCategory").value = task.category || "";
            document.getElementById("taskRemarks").value = task.remarks || "";
            document.getElementById("taskOrigin").value = task.origin || "";
            document.getElementById("taskDestination").value = task.destination || "";
            document.getElementById("taskDeadline").value = formatDateForInput(task.deadline) || "";

            setMinDate();
            modal.classList.add("show");
            
            const headerTitle = modal.querySelector(".modal-header h2");
            if (headerTitle) headerTitle.textContent = "Edit Task";
        }
        else if (e.target.classList.contains("complete-btn")) {
            const task = currentTasks.find(t => t.id === id);
            if (task) {
                try {
                    const res = await fetch(`/tasks/${id}`, { 
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...task, complete: 1 })
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
            openMapModal(id);
        }
    });

    // Existing modal and form handlers
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
        const submitButton = document.querySelector('.save-btn');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Saving...';
        submitButton.disabled = true;

        try {
            const formData = new FormData(taskForm);
            const data = Object.fromEntries(formData.entries());
            
            if (!data.title || !data.category || !data.origin || !data.destination || !data.deadline) {
                alert("Please fill out all required fields");
                return;
            }

            data.complete = 0;
            const url = data.taskId ? `/tasks/${data.taskId}` : "/add-task";
            const method = data.taskId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) throw new Error(`Server error (${res.status})`);

            modal.classList.remove("show");
            taskForm.reset();
            await loadTasks();
            showNotification('Task saved successfully!', 'success');

        } catch (err) {
            console.error("Error saving task:", err);
            showNotification('Error: ' + err.message, 'error');
        } finally {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
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

    // Initialize the app
    init();
});