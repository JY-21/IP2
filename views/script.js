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
    let searchTimeout = null;
    let currentSearchType = null;

    // Add this function to check session status
async function checkSession() {
    try {
        const res = await fetch('/api/session-check');
        const data = await res.json();
        console.log('🔐 Session check:', data);
        return data.user !== undefined;
    } catch (error) {
        console.error('Session check failed:', error);
        return false;
    }
}

// Update your saveRouteHandler to check session first
async function saveRouteHandler() {
    if (!currentRoute || !currentTaskId) {
        showNotification('No route to save. Please generate a route first.', 'error');
        return;
    }

    console.log('Attempting to save route for task:', currentTaskId);

    // Check session first
    const hasValidSession = await checkSession();
    if (!hasValidSession) {
        showNotification('Your session has expired. Please log in again.', 'error');
        window.location.href = '/login';
        return;
    }

    try {
        // ... rest of your existing saveRouteHandler code ...
        
        const res = await fetch(`/tasks/${currentTaskId}/route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(routeData)
        });

        console.log(' Response status:', res.status);

        const text = await res.text();
        console.log('Raw response:', text);

        let result;
        try {
            result = JSON.parse(text);
        } catch (parseError) {
            console.error('Failed to parse response as JSON:', parseError);
            throw new Error(`Server returned invalid JSON: ${text.substring(0, 200)}`);
        }

        console.log('Parsed response:', result);
        
        if (result.success) {
            showNotification('Route saved successfully!', 'success');
            closeMapModalHandler();
            await loadTasks();
        } else {
            throw new Error(result.error || `Server error: ${res.status}`);
        }
    } catch (error) {
        console.error('Save route error:', error);
        showNotification(`Failed to save route: ${error.message}`, 'error');
    }
}

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
        
        // Check if coordinates exist for route
        const hasRoute = task.origin_lat !== null && task.dest_lat !== null;

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

            //fix map display on modal open
            map.whenReady(function() {
                console.log('Map is ready');
            })
        }

        //add search input event listeners for autocomplete
        originSearch.addEventListener('input', (e) => {
            currentSearchType = 'origin';
            handleSearchInput(e.target.value, 'originAutocomplete');
        });

        destinationSearch.addEventListener('input', (e) => {
            currentSearchType = 'destination';
            handleSearchInput(e.target.value, 'destinationAutocomplete');
        });

        //close autocomplte when clicking outside
        document.addEventListener('click', (e) => {
            if(!e.target.closest('.input-with-button')) {
                hideAllAutocompletes();
            }
        });
        
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

    function handleSearchInput (query, autocompleteId){
        const autocomplete = document.getElementById(autocompleteId);

        //clear previous timeout
        if(searchTimeout){
            clearTimeout(searchTimeout);
        }

        //hide autocomplete if query is too short
        if(query.length < 3){
            autocomplete.classList.remove('show');
            return;
        }

         // Show loading state
        autocomplete.innerHTML = '<div class="autocomplete-item">Searching...</div>';
        autocomplete.classList.add('show');
        
        // Debounce search
        searchTimeout = setTimeout(async () => {
            await performSearch(query, autocompleteId);
        }, 300);
    }

    async function performSearch(query, autocompleteId) {
    try {
        console.log('🔍 Searching for:', query);
        
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'TaskManagerApp/1.0',
                    'Accept-Language': 'en' // Request English results
                }
            }
        );
        
        const data = await response.json();
        console.log('🔍 Search results:', data);
        
        displayAutocompleteResults(data, autocompleteId);
        
    } catch (error) {
        console.error('Search error:', error);
        const autocomplete = document.getElementById(autocompleteId);
        autocomplete.innerHTML = '<div class="autocomplete-item">Error searching. Please try again.</div>';
    }
}

    function displayAutocompleteResults(results, autocompleteId) {
        const autocomplete = document.getElementById(autocompleteId);
        
        if (!results || results.length === 0) {
            autocomplete.innerHTML = '<div class="autocomplete-item">No results found</div>';
            return;
        }
        
        autocomplete.innerHTML = '';
        
        results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerHTML = `
                <div class="name">${escapeHtml(result.display_name.split(',')[0])}</div>
                <div class="address">${escapeHtml(result.display_name)}</div>
            `;
            
            item.addEventListener('click', () => {
                selectAutocompleteResult(result, autocompleteId);
            });
            
            autocomplete.appendChild(item);
        });
    }

    function selectAutocompleteResult(result, autocompleteId) {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        const displayName = result.display_name;
        
        if (autocompleteId === 'originAutocomplete') {
            originSearch.value = displayName;
            setOriginLocation(lat, lon);
        } else {
            destinationSearch.value = displayName;
            setDestinationLocation(lat, lon);
        }
        
        hideAllAutocompletes();
        checkRouteReady();
    }

    function hideAllAutocompletes() {
        document.querySelectorAll('.search-autocomplete').forEach(ac => {
            ac.classList.remove('show');
        });
    }

    // Improved geocoding function with better error handling
    async function geocodeAndSetMarker(query, type) {
        try {
            console.log('🗺️ Geocoding:', query);
            
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'TaskManagerApp/1.0',
                        'Accept-Language': 'en'
                    }
                }
            );
            
            const data = await response.json();
            
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                const displayName = data[0].display_name;
                
                console.log('✅ Geocoding successful:', { lat, lon, displayName });
                
                if (type === 'origin') {
                    setOriginLocation(lat, lon);
                    originSearch.value = displayName;
                } else {
                    setDestinationLocation(lat, lon);
                    destinationSearch.value = displayName;
                }
                
                return true;
            } else {
                console.log('❌ No geocoding results for:', query);
                showNotification(`No results found for "${query}". Try a more specific address.`, 'error');
                return false;
            }
        } catch (error) {
            console.error('❌ Geocoding error:', error);
            showNotification('Error searching for location. Please try again.', 'error');
            return false;
        }
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

        //Fix map display - wait for map to be visible
        setTimeout(() => {
            if(map) {
               map.invalidateSize();
               map.setView([51.505, -0.09], 13);
            }
        }, 100);
        
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
        duration: duration * 60 // Convert to seconds for storage
    };

    console.log('Route details for saving:', currentRoute);

    // Update route info display with smooth animation
    document.getElementById('routeDistance').textContent = `${distance} km`;
    document.getElementById('routeDuration').textContent = `${duration} minutes`;
    document.getElementById('selectedOrigin').textContent = originSearch.value || 'Selected location';
    document.getElementById('selectedDestination').textContent = destinationSearch.value || 'Selected location';
    
    // Smooth show animation
    const routeInfo = document.getElementById('routeInfo');
    routeInfo.style.display = 'block';
    routeInfo.classList.add('show');
    
    saveRoute.disabled = false;
    
    // Auto-scroll to show route info
    setTimeout(() => {
        routeInfo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 400);
}

    async function saveRouteHandler() {
    if (!currentRoute || !currentTaskId) {
        showNotification('No route to save. Please generate a route first.', 'error');
        return;
    }

    console.log('Attempting to save route...');
    console.log('Route data:', currentRoute);

    try {
        // Validate all required fields
        const requiredFields = ['originLat', 'originLon', 'destLat', 'destLon'];
        const missingFields = requiredFields.filter(field => !currentRoute[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        const routeData = {
            originLat: parseFloat(currentRoute.originLat),
            originLon: parseFloat(currentRoute.originLon),
            destLat: parseFloat(currentRoute.destLat),
            destLon: parseFloat(currentRoute.destLon),
            distance: parseFloat(currentRoute.distance) || 0,
            duration: parseFloat(currentRoute.duration) || 0
        };

        console.log('Sending to server:', routeData);

        const res = await fetch(`/tasks/${currentTaskId}/route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(routeData)
        });

        console.log('Response status:', res.status);
        console.log('Response headers:', res.headers);

        //Check if response is HTML (error page)
        const contentType = res.headers.get('content-type');
        if(!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            console.error('Server returned non-JSON response:', text.substring(0, 500));

            //Check for common HTML error patterns
            if(text.includes('<!DOCTYPE') || text.includes('<html')){
                throw new Error('Server returned HTML error page. Check server logs.');
            } else {
                throw new Error(`Server returned: ${text.substring(0, 200)}`);
            }
        }

        const result = await res.json();
        console.log('Response data:', result);
        
        if (res.ok && result.success) {
            showNotification('✅ Route saved successfully!', 'success');
            closeMapModalHandler();
            await loadTasks();
        } else {
            throw new Error(result.error || `Server error: ${res.status}`);
        }
    } catch (error) {
        console.error('Save route error:', error);
        showNotification(`Failed to save route: ${error.message}`, 'error');
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