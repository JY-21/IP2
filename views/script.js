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

    // Initialize the application
    function init() {
        setMinDate();
        loadTasks();
        initMapModal();
    }

    // Add mobile menu toggle functionality
    function initMobileMenu() {
        const menuToggle = document.createElement('button');
        menuToggle.className = 'menu-toggle';
        menuToggle.innerHTML = '☰';
        menuToggle.setAttribute('aria-label', 'Toggle menu');
        
        const sidebarOverlay = document.createElement('div');
        sidebarOverlay.className = 'sidebar-overlay';
        
        document.body.appendChild(menuToggle);
        document.body.appendChild(sidebarOverlay);
        
        const sideMenu = document.querySelector('.side-menu');
        
        menuToggle.addEventListener('click', () => {
            sideMenu.classList.toggle('expanded');
        });
        
        sidebarOverlay.addEventListener('click', () => {
            sideMenu.classList.remove('expanded');
        });
        
        // Close sidebar when clicking on nav items on mobile
        const navItems = document.querySelectorAll('.nav-item a');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sideMenu.classList.remove('expanded');
                }
            });
        });
        
        // Close sidebar on window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sideMenu.classList.remove('expanded');
            }
        });
    }

    // Initialize mobile menu when DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
        initMobileMenu();
    });

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
            console.log('📋 Loaded tasks with route data:', tasks);
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
            
            // Check if coordinates exist for route - IMPROVED CHECK
            const hasRoute = task.origin_lat !== null && task.dest_lat !== null && 
                            task.route_distance !== null && task.route_duration !== null;
            
            // Safely format distance and duration - FIXED
            const distance = hasRoute && task.route_distance ? parseFloat(task.route_distance).toFixed(1) : '0';
            const duration = hasRoute && task.route_duration ? Math.round(task.route_duration / 60) : 0;

            console.log(`📊 Rendering Task ${task.id}:`, { 
                hasRoute, 
                distance, 
                duration,
                origin_lat: task.origin_lat,
                dest_lat: task.dest_lat,
                route_distance: task.route_distance,
                route_duration: task.route_duration
            });

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
                                <span class="route-details">${distance} km • ${duration} min</span>
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
            map = L.map('routeMap').setView([4.2105, 101.9758], 10); // Default to Malaysia center
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

            map.whenReady(function() {
                console.log('🗺️ Map is ready');
            });
        }

        // Event listeners
        originSearch.addEventListener('input', (e) => {
            currentSearchType = 'origin';
            handleSearchInput(e.target.value, 'originAutocomplete');
        });

        destinationSearch.addEventListener('input', (e) => {
            currentSearchType = 'destination';
            handleSearchInput(e.target.value, 'destinationAutocomplete');
        });

        document.addEventListener('click', (e) => {
            if(!e.target.closest('.input-with-button')) {
                hideAllAutocompletes();
            }
        });
        
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
        console.log('🗺️ OPENING MAP MODAL FOR TASK:', taskId);
        currentTaskId = taskId;
        
        // COMPLETELY RESET EVERYTHING FIRST
        resetMapModalState();
        
        const task = currentTasks.find(t => t.id === taskId);
        console.log('🗺️ Task data for map:', task);
        
        if (task) {
            originSearch.value = task.origin || '';
            destinationSearch.value = task.destination || '';
        }
        
        mapModal.classList.add("show");

        // Fix map display and load existing route
        setTimeout(() => {
            if (map) {
                map.invalidateSize(true);
                loadExistingRoute(taskId);
            }
        }, 100);
    }

    function resetMapModalState() {
        console.log('🗺️ Resetting map modal state');
        
        // Clear map
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
        
        // Reset UI
        routeInfo.style.display = 'none';
        routeInfo.classList.remove('show');
        
        // Remove compact class from map container
        const mapContainer = document.querySelector('.map-container');
        if (mapContainer) {
            mapContainer.classList.remove('compact');
        }
        
        generateRoute.disabled = true;
        saveRoute.disabled = true;
        
        // Reset form inputs
        originSearch.value = '';
        destinationSearch.value = '';
        
        // Reset current route
        currentRoute = null;
        
        // Clear autocomplete
        hideAllAutocompletes();
        document.getElementById('originAutocomplete').innerHTML = '';
        document.getElementById('destinationAutocomplete').innerHTML = '';
    }

    function closeMapModalHandler() {
        console.log('🗺️ Closing map modal');
        mapModal.classList.remove("show");
        resetMapModalState();
        currentTaskId = null;
    }

    // NEW: Generate and display route from existing coordinates
    async function generateAndDisplayExistingRoute(route) {
        if (!route.origin_lat || !route.origin_lon || !route.dest_lat || !route.dest_lon) {
            console.log('❌ Missing coordinates for route generation');
            return;
        }

        try {
            const routeCoords = `${parseFloat(route.origin_lon)},${parseFloat(route.origin_lat)};${parseFloat(route.dest_lon)},${parseFloat(route.dest_lat)}`;

            console.log('🗺️ Generating route from coordinates:', routeCoords);
            
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${routeCoords}?overview=full&geometries=geojson`);
            const routeData = await response.json();

            if (routeData.code === "Ok" && routeData.routes && routeData.routes.length > 0) {
                // Clear existing route
                if (routeLayer) {
                    map.removeLayer(routeLayer);
                }
                
                // Draw new route
                routeLayer = L.geoJSON(routeData.routes[0].geometry, {
                    style: {
                        color: '#2e7d32',
                        weight: 6,
                        opacity: 0.8
                    }
                }).addTo(map);
                
                console.log('✅ Route display generated successfully from existing coordinates');
                
                // Update currentRoute object
                currentRoute = {
                    origin: route.origin || originSearch.value,
                    destination: route.destination || destinationSearch.value,
                    originLat: parseFloat(route.origin_lat),
                    originLon: parseFloat(route.origin_lon),
                    destLat: parseFloat(route.dest_lat),
                    destLon: parseFloat(route.dest_lon),
                    distance: route.route_distance ? parseFloat(route.route_distance) : 0,
                    duration: route.route_duration ? parseInt(route.route_duration) : 0
                };
                
                return true;
            } else {
                console.log('❌ Could not generate route from OSRM');
                return false;
            }
        } catch (error) {
            console.error('❌ Error generating route from existing coordinates:', error);
            return false;
        }
    }

    // UPDATED: Show compact route information
function showRouteInfo(route) {
    const distance = route.route_distance ? parseFloat(route.route_distance).toFixed(1) : '0';
    const duration = route.route_duration ? Math.round(route.route_duration / 60) : 0;

    document.getElementById('routeDistance').textContent = `${distance} km`;
    document.getElementById('routeDuration').textContent = `${duration} min`;
    
    const routeInfoElement = document.getElementById('routeInfo');
    const mapContainer = document.querySelector('.map-container');
    
    // Show route info with smooth animation
    routeInfoElement.style.display = 'block';
    
    setTimeout(() => {
        routeInfoElement.classList.add('show');
        mapContainer.classList.add('compact');
    }, 50);
}

    // COMPLETELY REWRITTEN: Load existing route for a task
    async function loadExistingRoute(taskId) {
        try {
            console.log('🗺️ Loading existing route for task:', taskId);
            const res = await fetch(`/tasks/${taskId}/route`);
            
            if (!res.ok) {
                console.log('❌ No existing route found or error loading');
                // Set a reasonable default view
                map.setView([4.2105, 101.9758], 10); // Malaysia center
                return;
            }
            
            const data = await res.json();
            console.log('🗺️ Route API response:', data);
            
            if (data.success && data.route) {
                const route = data.route;
                console.log('✅ FOUND EXISTING ROUTE DATA:', {
                    origin: `${route.origin_lat}, ${route.origin_lon}`,
                    destination: `${route.dest_lat}, ${route.dest_lon}`,
                    distance: route.route_distance,
                    duration: route.route_duration
                });

                // Clear any existing markers and route
                if (originMarker) map.removeLayer(originMarker);
                if (destinationMarker) map.removeLayer(destinationMarker);
                if (routeLayer) map.removeLayer(routeLayer);

                // Set origin marker
                if (route.origin_lat && route.origin_lon) {
                    console.log('🗺️ Setting origin marker:', route.origin_lat, route.origin_lon);
                    originMarker = L.marker([parseFloat(route.origin_lat), parseFloat(route.origin_lon)])
                        .addTo(map)
                        .bindPopup('<strong>📍 Origin</strong><br>' + (route.origin || 'Selected location'))
                        .openPopup();
                    originSearch.value = route.origin || 'Selected location';
                }
                
                // Set destination marker
                if (route.dest_lat && route.dest_lon) {
                    console.log('🗺️ Setting destination marker:', route.dest_lat, route.dest_lon);
                    destinationMarker = L.marker([parseFloat(route.dest_lat), parseFloat(route.dest_lon)])
                        .addTo(map)
                        .bindPopup('<strong>🎯 Destination</strong><br>' + (route.destination || 'Selected location'))
                        .openPopup();
                    destinationSearch.value = route.destination || 'Selected location';
                }
                
                // Generate and display the route if we have both coordinates
                if (originMarker && destinationMarker) {
                    console.log('🗺️ Both markers present, generating route display...');
                    await generateAndDisplayExistingRoute(route);
                    
                    // Show route info
                    if (route.route_distance !== null && route.route_duration !== null) {
                        showRouteInfo(route);
                    }
                    
                    // Fit map to show both markers and route
                    const group = new L.featureGroup([originMarker, destinationMarker]);
                    if (routeLayer) {
                        group.addLayer(routeLayer);
                    }
                    map.fitBounds(group.getBounds().pad(0.2));
                } else {
                    console.log('❌ Missing markers for route regeneration');
                    if (route.origin_lat && route.origin_lon) {
                        map.setView([parseFloat(route.origin_lat), parseFloat(route.origin_lon)], 13);
                    }
                }
                
                saveRoute.disabled = false;
                generateRoute.disabled = false;
            } else {
                console.log('ℹ️ No existing route found for this task');
                map.setView([4.2105, 101.9758], 10); // Malaysia center
            }
        } catch (error) {
            console.error('❌ Error loading existing route:', error);
            map.setView([4.2105, 101.9758], 10); // Malaysia center
        }
    }

    function handleSearchInput(query, autocompleteId) {
        const autocomplete = document.getElementById(autocompleteId);

        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        if (query.length < 3) {
            autocomplete.classList.remove('show');
            return;
        }

        autocomplete.innerHTML = '<div class="autocomplete-item">Searching...</div>';
        autocomplete.classList.add('show');
        
        searchTimeout = setTimeout(async () => {
            await performSearch(query, autocompleteId);
        }, 300);
    }

    async function performSearch(query, autocompleteId) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'TaskManagerApp/1.0',
                        'Accept-Language': 'en'
                    }
                }
            );
            
            const data = await response.json();
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

    async function geocodeAndSetMarker(query, type) {
        try {
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
                
                if (type === 'origin') {
                    setOriginLocation(lat, lon);
                    originSearch.value = displayName;
                } else {
                    setDestinationLocation(lat, lon);
                    destinationSearch.value = displayName;
                }
                
                return true;
            } else {
                showNotification(`No results found for "${query}". Try a more specific address.`, 'error');
                return false;
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            showNotification('Error searching for location. Please try again.', 'error');
            return false;
        }
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

    function setOriginLocation(lat, lon) {
        if (originMarker) {
            map.removeLayer(originMarker);
        }
        
        originMarker = L.marker([lat, lon])
            .addTo(map)
            .bindPopup('<strong>📍 Origin</strong>')
            .openPopup();
        
        checkRouteReady();
    }

    function setDestinationLocation(lat, lon) {
        if (destinationMarker) {
            map.removeLayer(destinationMarker);
        }
        
        destinationMarker = L.marker([lat, lon])
            .addTo(map)
            .bindPopup('<strong>🎯 Destination</strong>')
            .openPopup();
        
        checkRouteReady();
    }

    function checkRouteReady() {
        if (originMarker && destinationMarker) {
            generateRoute.disabled = false;
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

        const distance = route.distance ? (route.distance / 1000).toFixed(1) : '0';
        const duration = route.duration ? Math.round(route.duration / 60) : 0;

        currentRoute = {
            origin: originSearch.value,
            destination: destinationSearch.value,
            originLat: originLatLng.lat,
            originLon: originLatLng.lng,
            destLat: destLatLng.lat,
            destLon: destLatLng.lng,
            distance: distance,
            duration: duration * 60
        };

        console.log('Route details for saving:', currentRoute);

        // Use the new showRouteInfo function
        showRouteInfo({
            route_distance: distance,
            route_duration: duration * 60,
            origin: originSearch.value,
            destination: destinationSearch.value
        });
        
        saveRoute.disabled = false;
    }

    async function saveRouteHandler() {
        if (!currentRoute || !currentTaskId) {
            showNotification('No route to save. Please generate a route first.', 'error');
            return;
        }

        console.log('💾 Attempting to save route for task:', currentTaskId);

        try {
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
                duration: parseInt(currentRoute.duration) || 0
            };

            console.log('💾 Sending to server:', routeData);

            const res = await fetch(`/tasks/${currentTaskId}/route`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(routeData)
            });

            const result = await res.json();
            console.log('💾 Server response:', result);
            
            if (res.ok && result.success) {
                showNotification('✅ Route saved successfully!', 'success');
                closeMapModalHandler();
                await loadTasks(); // Reload tasks to get updated route info
            } else {
                throw new Error(result.error || `Server error: ${res.status}`);
            }
        } catch (error) {
            console.error('💾 Save route error:', error);
            showNotification(`Failed to save route: ${error.message}`, 'error');
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
                    // Add fade-out animation to task bar
                    const taskBar = e.target.closest('.task-bar');
                    taskBar.classList.add('fade-out');
                    
                    // Wait for animation to complete before updating
                    setTimeout(async () => {
                        const now = new Date().toISOString();
                        const res = await fetch(`/tasks/${id}`, { 
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                ...task, 
                                complete: 1,
                                completedAt: now
                            })
                        });
                        
                        if (res.ok) {
                            // Remove from DOM
                            taskBar.remove();
                            
                            // Reload tasks to update the list
                            await loadTasks();
                            
                            showNotification('✅ Task completed! Check Task History.', 'success');
                        } else {
                            // Remove fade-out if failed
                            taskBar.classList.remove('fade-out');
                            showNotification('Failed to complete task', 'error');
                        }
                    }, 500); // Match the CSS transition duration
                    
                } catch (err) {
                    console.error('Error completing task:', err);
                    showNotification('Error completing task', 'error');
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