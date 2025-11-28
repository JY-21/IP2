
function isPublicPage() {
    const path = window.location.pathname.toLowerCase();
    
    // Check for login page
    if (path === '/login' || 
        path === '/login.html' || 
        path.includes('login_page') ||
        path.endsWith('login_page.html')) {
        return 'login';
    }
    
    // Check for signup page
    if (path === '/signup' || 
        path === '/signup.html' || 
        path.includes('sign_up') ||
        path.endsWith('sign_up_page.html')) {
        return 'signup';
    }
    
    // Check for landing page
    if (path === '/' || path === '/index.html') {
        return 'landing';
    }
    
    return null; // Not a public page
}

// Authentication and session management
async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.log('Not authenticated, redirecting to login');
            window.location.href = '/login';
            return false;
        }
        
        const data = await response.json();
        console.log('User authenticated:', data.user.username);
        return true;
        
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login';
        return false;
    }
}

function initLoginPage() {
    const loginForm = document.getElementById("loginForm");
    const loginError = document.getElementById("loginError");

    if (!loginForm) {
        console.error('Login form not found!');
        return;
    }

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        if (loginError) {
            loginError.style.display = 'none';
        }

        try {
            const res = await fetch("/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify(data),
            });

            const result = await res.json();

            if (!res.ok || !result.success) {
                if (loginError) {
                    loginError.textContent = result.message || "Login failed!";
                    loginError.style.display = 'block';
                }
            } else {
                window.location.href = "/home";
            }
        } catch (err) {
            console.error("Login error:", err);
            if (loginError) {
                loginError.textContent = "Something went wrong. Please try again.";
                loginError.style.display = 'block';
            }
        }
    });

    // Hide error when user starts typing
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    if (usernameInput) {
        usernameInput.addEventListener('input', hideLoginError);
    }
    if (passwordInput) {
        passwordInput.addEventListener('input', hideLoginError);
    }
}

function hideLoginError() {
    const loginError = document.getElementById('loginError');
    if (loginError) {
        loginError.style.display = 'none';
    }
}

function initSignupPage() {
    console.log('Initializing signup page');
    const signupForm = document.getElementById('signupForm');
    const formMessage = document.getElementById('formMessage');
    const submitBtn = document.getElementById('submitBtn');

    if (signupForm) {
        signupForm.addEventListener('submit', handleSignupSubmit);

        // Hide message when user starts typing
        const inputs = signupForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                if (formMessage && formMessage.style.display !== 'none') {
                    formMessage.style.display = 'none';
                }
            });
        });
    } else {
        console.log('Signup form not found');
    }
}

async function handleSignupSubmit(e) {
    e.preventDefault();
    
    const signupForm = document.getElementById('signupForm');
    const formMessage = document.getElementById('formMessage');
    const submitBtn = document.getElementById('submitBtn');
    
    if (!signupForm || !submitBtn) return;

    // Get form data
    const formData = new FormData(signupForm);
    const data = Object.fromEntries(formData.entries());
    
    // Validate required fields
    if (!data.first_name || !data.last_name || !data.email || !data.username || !data.password) {
        showFormMessage('Please fill in all required fields.', 'error', formMessage);
        return;
    }

    // Show loading state
    submitBtn.textContent = 'Creating Account...';
    submitBtn.disabled = true;
    
    if (formMessage) {
        formMessage.style.display = 'none';
    }

    try {
        const response = await fetch('/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Success - show success message and redirect
            showFormMessage('Account created successfully! Redirecting to login...', 'success', formMessage);
            
            // Redirect to login page after 2 seconds
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            // Error - show error message
            showFormMessage(result.message || 'Account creation failed. Please try again.', 'error', formMessage);
        }
    } catch (error) {
        console.error('Signup error:', error);
        showFormMessage('Network error. Please check your connection and try again.', 'error', formMessage);
    } finally {
        // Reset button state
        submitBtn.textContent = 'Create Account';
        submitBtn.disabled = false;
    }
}

function showFormMessage(message, type, formMessage) {
    if (!formMessage) return;
    
    formMessage.textContent = message;
    formMessage.className = type === 'success' ? 'success-message' : 'error-message';
    formMessage.style.display = 'block';
    
    // Scroll to message
    formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function initApp() {
    const currentPage = getCurrentPage();
    
    console.log('Initializing app for page:', currentPage);
    
    // Handle different page types
    if (currentPage === 'login') {
        initLoginPage();
        return;
    }
    
    if (currentPage === 'signup') {
        initSignupPage();
        return;
    }
    
    // For all other pages (home, profile, history), check authentication
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        console.log('Auth successful, initializing page');
        init();
    } else {
        console.log('Auth failed, redirecting to login');
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const currentPage = getCurrentPage();
    
    console.log(' Page loaded:', currentPage);
    
    if (currentPage === 'login') {
        initLoginPage();
    } else if (currentPage === 'signup') {
        initSignupPage();
    } else {
        await initApp();
        startSessionHeartbeat();
    }
});

function getCurrentPage() {
    const path = window.location.pathname.toLowerCase();
    const page = path.split('/').pop() || '';
    
    console.log('📍 Current path:', path, 'Page:', page);
  
    // Check for different pages
    if (path === '/' || path.includes('home') || page === 'home' || page === 'home.html' || page === 'index.html') {
        return 'home';
    }
    if (path.includes('login') || page === 'login' || page === 'login_page.html') {
        return 'login';
    }
    if (path.includes('signup') || page === 'signup' || page === 'sign_up_page.html' || path.includes('sign_up')) {
        return 'signup';
    }
    if (path.includes('history') || page === 'history' || page === 'history.html') {
        return 'history';
    }
    if (path.includes('profile') || page === 'profile' || page === 'profile.html') {
        return 'profile';
    }
    
    return 'home'; // default
}

// ELEMENTS
let modal, newTaskBtn, closeModal, taskList, taskForm, deleteModal, confirmDeleteBtn, cancelDeleteBtn, taskDeadlineInput;
let mapModal, closeMapModal, originSearch, destinationSearch, useCurrentLocation, searchLocations, generateRoute, saveRoute, routeMap, routeInfo;

// Application state
let taskToDelete = null;
let currentTasks = [];
let completedTasks = [];
let currentTaskId = null;
let map = null;
let routeLayer = null;
let originMarker = null;
let destinationMarker = null;
let currentRoute = null;
let searchTimeout = null;
let currentSearchType = null;
let completedTaskList;

function initializeElements() {
    // Task Modal Elements
    modal = document.getElementById("taskModal");
    newTaskBtn = document.getElementById("newTaskBtn");
    closeModal = document.getElementById("closeModal");
    taskList = document.getElementById("taskList");
    completedTaskList = document.getElementById("completedTaskList");
    taskForm = document.getElementById("taskForm");
    deleteModal = document.getElementById("deleteModal");
    confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    taskDeadlineInput = document.getElementById("taskDeadline");
    
    // Map Modal Elements
    mapModal = document.getElementById("mapModal");
    closeMapModal = document.getElementById("closeMapModal");
    originSearch = document.getElementById("originSearch");
    destinationSearch = document.getElementById("destinationSearch");
    useCurrentLocation = document.getElementById("useCurrentLocation");
    searchLocations = document.getElementById("searchLocations");
    generateRoute = document.getElementById("generateRoute");
    saveRoute = document.getElementById("saveRoute");
    routeMap = document.getElementById("routeMap");
    routeInfo = document.getElementById("routeInfo");
}

// Initialize the application
function init() {
    const currentPage = getCurrentPage();

    initializeElements();
    setupEventListeners();
    setupMobileMenu();
    updateWelcomeMessage();

    if(currentPage === 'home'){
        setMinDate();
        loadTasks();
        initMapModal();
    } else if (currentPage === 'history'){
        loadHistoryStats();
        loadCompletedTasks();
    } else if (currentPage === 'profile'){
        loadProfile();
    }
}

function updateWelcomeMessage(){
    const welcomeElement = document.getElementById('welcomeMessage');
    const dateTimeElement = document.getElementById('currentDateTime');

    const currentPage = getCurrentPage();
    
    if (welcomeElement) {
        if (currentPage === 'history') {
            // Remove greeting for history page
            welcomeElement.textContent = 'Task History';
        } else {
            const userName = getUserName();
            welcomeElement.textContent = `Welcome, ${userName || 'User'}!`;
        }
    }

    if(dateTimeElement){
        updateDateTime();
        setInterval(updateDateTime, 1000); //update every second for real time
    }
}
function getUserName(){
    return localStorage.getItem('username') || 'User';
}

function updateDateTime(){
    const dateTimeElement = document.getElementById('currentDateTime');
    if(dateTimeElement){
        const now = new Date();

        // Convert to Malaysian time (UTC+8)
        const malaysiaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));

        // Manual formatting for Malaysian time
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        const dayName = days[malaysiaTime.getUTCDay()];
        const date = malaysiaTime.getUTCDate();
        const month = months[malaysiaTime.getUTCMonth()];
        const year = malaysiaTime.getUTCFullYear();
        
        let hours = malaysiaTime.getUTCHours();
        const minutes = malaysiaTime.getUTCMinutes().toString().padStart(2, '0');
        const seconds = malaysiaTime.getUTCSeconds().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        
        const timeString = `${hours}:${minutes}:${seconds} ${ampm}`;
        const dateString = `${dayName}, ${date} ${month} ${year}`;
        
        dateTimeElement.textContent = `${dateString} • ${timeString} (MYT)`;
    }
}

// Setup mobile menu functionality
function setupMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const sideMenu = document.querySelector('.side-menu');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    
    if (menuToggle && sideMenu && sidebarOverlay) {
        // Toggle sidebar on mobile
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            sideMenu.classList.toggle('expanded');
            sidebarOverlay.classList.toggle('active');
            document.body.classList.toggle('sidebar-open');
        });
        
        // Close sidebar when clicking on overlay
        sidebarOverlay.addEventListener('click', function() {
            sideMenu.classList.remove('expanded');
            sidebarOverlay.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        });
        
        // Close sidebar when clicking on nav links on mobile
        const navLinks = document.querySelectorAll('.nav-item a');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    sideMenu.classList.remove('expanded');
                    sidebarOverlay.classList.remove('active');
                    document.body.classList.remove('sidebar-open');
                }
            });
        });
        
        // Handle window resize
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                // Reset mobile states on larger screens
                sideMenu.classList.remove('expanded');
                sidebarOverlay.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function(event) {
            if (window.innerWidth <= 768 && 
                sideMenu.classList.contains('expanded') &&
                !sideMenu.contains(event.target) &&
                !menuToggle.contains(event.target)) {
                sideMenu.classList.remove('expanded');
                sidebarOverlay.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
        });
    }
}

function setupEventListeners() {
    const currentPage = getCurrentPage();
    
    // Task modal events
    if (newTaskBtn) newTaskBtn.addEventListener("click", openNewTaskModal);
    if (closeModal) closeModal.addEventListener("click", closeTaskModal);
    if (taskForm) taskForm.addEventListener("submit", handleTaskSubmit);
    
    // Delete modal events
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener("click", confirmDelete);
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener("click", cancelDelete);
    
    // Map modal events
    if (closeMapModal) closeMapModal.addEventListener('click', closeMapModalHandler);
    if (useCurrentLocation) useCurrentLocation.addEventListener('click', getCurrentLocation);
    if (searchLocations) searchLocations.addEventListener('click', searchLocationsHandler);
    if (generateRoute) generateRoute.addEventListener('click', generateRouteHandler);
    if (saveRoute) saveRoute.addEventListener('click', saveRouteHandler);
    
    if(currentPage == 'history' && completedTaskList){
        completedTaskList.addEventListener("click", handleHistoryTaskActions);
    }

    // Global click events
    window.addEventListener('click', handleGlobalClicks);
    if (taskList) taskList.addEventListener("click", handleTaskActions);
    
    // Setup logout
    setupLogout();
}

function handleGlobalClicks(e) {
    if (e.target === modal) closeTaskModal();
    if (e.target === mapModal) closeMapModalHandler();
    if (!e.target.closest('.input-with-button')) hideAllAutocompletes();
}

// Page detection
function getCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('history.html')) return 'history';
    if (path.includes('profile.html')) return 'profile';
    if (path.includes('home.html') || path === '/home') return 'home';
    return 'home'; // default
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
        const res = await fetch("/tasks", {
            credentials: 'include'
        });
        
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const tasks = await res.json();
        
        // Filter to show only INCOMPLETE tasks on home page
        const incompleteTasks = tasks.filter(task => task.complete === 0);
        currentTasks = incompleteTasks;
        
        console.log('Loaded incomplete tasks:', incompleteTasks);
        renderTasks(incompleteTasks);
    } catch (err) {
        console.error("Failed to load tasks:", err);
        showNotification('Failed to load tasks: ' + err.message, 'error');
    }
}

function renderTasks(tasks) {
    if (!taskList) return;
    
    taskList.innerHTML = "";
    
    if (!tasks || tasks.length === 0) {
        taskList.innerHTML = '<div class="no-tasks">No tasks yet. Create your first task!</div>';
        return;
    }
    
    tasks.forEach(task => {
        const priority = task.priority ? String(task.priority).toLowerCase() : 'medium';
        
        // Check if coordinates exist for route
        const hasRoute = task.origin_lat !== null && task.dest_lat !== null && 
                        task.route_distance !== null && task.route_duration !== null;
        
        // Safely format distance and duration
        const distance = hasRoute && task.route_distance ? parseFloat(task.route_distance).toFixed(1) : '0';
        const duration = hasRoute && task.route_duration ? Math.round(task.route_duration / 60) : 0;

        console.log(`Rendering Task ${task.id}:`, { 
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
    if (!mapModal || !routeMap) return;
    
    if (!map) {
        map = L.map('routeMap').setView([4.2105, 101.9758], 10);
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

    // Search input events
    if (originSearch) {
        originSearch.addEventListener('input', (e) => {
            currentSearchType = 'origin';
            handleSearchInput(e.target.value, 'originAutocomplete');
        });
    }

    if (destinationSearch) {
        destinationSearch.addEventListener('input', (e) => {
            currentSearchType = 'destination';
            handleSearchInput(e.target.value, 'destinationAutocomplete');
        });
    }
}

function openMapModal(taskId) {
    console.log('🗺️ OPENING MAP MODAL FOR TASK:', taskId);
    currentTaskId = taskId;
    
    // Reset everything first
    resetMapModalState();
    
    const task = currentTasks.find(t => t.id === taskId);
    console.log('🗺️ Task data for map:', task);
    
    if (task && originSearch && destinationSearch) {
        originSearch.value = task.origin || '';
        destinationSearch.value = task.destination || '';
    }
    
    if (mapModal) mapModal.classList.add("show");

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
    if (routeLayer && map) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }
    if (originMarker && map) {
        map.removeLayer(originMarker);
        originMarker = null;
    }
    if (destinationMarker && map) {
        map.removeLayer(destinationMarker);
        destinationMarker = null;
    }
    
    // Reset UI
    if (routeInfo) {
        routeInfo.style.display = 'none';
        routeInfo.classList.remove('show');
    }
    
    // Remove compact class from map container
    const mapContainer = document.querySelector('.map-container');
    if (mapContainer) {
        mapContainer.classList.remove('compact');
    }
    
    if (generateRoute) generateRoute.disabled = true;
    if (saveRoute) saveRoute.disabled = true;
    
    // Reset form inputs
    if (originSearch) originSearch.value = '';
    if (destinationSearch) destinationSearch.value = '';
    
    // Reset current route
    currentRoute = null;
    
    // Clear autocomplete
    hideAllAutocompletes();
    const originAutocomplete = document.getElementById('originAutocomplete');
    const destinationAutocomplete = document.getElementById('destinationAutocomplete');
    if (originAutocomplete) originAutocomplete.innerHTML = '';
    if (destinationAutocomplete) destinationAutocomplete.innerHTML = '';
}

function closeMapModalHandler() {
    console.log('🗺️ Closing map modal');
    if (mapModal) mapModal.classList.remove("show");
    resetMapModalState();
    currentTaskId = null;
}

// Generate and display route from existing coordinates
async function generateAndDisplayExistingRoute(route) {
    if (!route.origin_lat || !route.origin_lon || !route.dest_lat || !route.dest_lon) {
        console.log(' Missing coordinates for route generation');
        return false;
    }

    try {
        const routeCoords = `${parseFloat(route.origin_lon)},${parseFloat(route.origin_lat)};${parseFloat(route.dest_lon)},${parseFloat(route.dest_lat)}`;

        console.log('🗺️ Generating route from coordinates:', routeCoords);
        
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${routeCoords}?overview=full&geometries=geojson`);
        const routeData = await response.json();

        if (routeData.code === "Ok" && routeData.routes && routeData.routes.length > 0) {
            // Clear existing route
            if (routeLayer && map) {
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
            
            console.log('Route display generated successfully from existing coordinates');
            
            // Update currentRoute object
            currentRoute = {
                origin: route.origin || (originSearch ? originSearch.value : ''),
                destination: route.destination || (destinationSearch ? destinationSearch.value : ''),
                originLat: parseFloat(route.origin_lat),
                originLon: parseFloat(route.origin_lon),
                destLat: parseFloat(route.dest_lat),
                destLon: parseFloat(route.dest_lon),
                distance: route.route_distance ? parseFloat(route.route_distance) : 0,
                duration: route.route_duration ? parseInt(route.route_duration) : 0
            };
            
            return true;
        } else {
            console.log('Could not generate route from OSRM');
            return false;
        }
    } catch (error) {
        console.error('Error generating route from existing coordinates:', error);
        return false;
    }
}

// Show compact route information
function showRouteInfo(route) {
    const distance = route.route_distance ? parseFloat(route.route_distance).toFixed(1) : '0';
    const duration = route.route_duration ? Math.round(route.route_duration / 60) : 0;

    const routeDistance = document.getElementById('routeDistance');
    const routeDuration = document.getElementById('routeDuration');
    
    if (routeDistance) routeDistance.textContent = `${distance} km`;
    if (routeDuration) routeDuration.textContent = `${duration} min`;
    
    const routeInfoElement = document.getElementById('routeInfo');
    const mapContainer = document.querySelector('.map-container');
    
    if (routeInfoElement) {
        routeInfoElement.style.display = 'block';
        
        setTimeout(() => {
            routeInfoElement.classList.add('show');
            if (mapContainer) mapContainer.classList.add('compact');
        }, 50);
    }
}

// Load existing route for a task
async function loadExistingRoute(taskId) {
    try {
        console.log('Loading existing route for task:', taskId);
        const res = await fetch(`/tasks/${taskId}/route`, {
            credentials: 'include'
        });
        
        if (!res.ok) {
            console.log(' No existing route found or error loading');
            if (map) map.setView([4.2105, 101.9758], 10);
            return;
        }
        
        const data = await res.json();
        console.log('🗺️ Route API response:', data);
        
        if (data.success && data.route) {
            const route = data.route;
            console.log('FOUND EXISTING ROUTE DATA:', {
                origin: `${route.origin_lat}, ${route.origin_lon}`,
                destination: `${route.dest_lat}, ${route.dest_lon}`,
                distance: route.route_distance,
                duration: route.route_duration
            });

            // Clear any existing markers and route
            if (originMarker && map) map.removeLayer(originMarker);
            if (destinationMarker && map) map.removeLayer(destinationMarker);
            if (routeLayer && map) map.removeLayer(routeLayer);

            // Set origin marker
            if (route.origin_lat && route.origin_lon) {
                console.log('🗺️ Setting origin marker:', route.origin_lat, route.origin_lon);
                originMarker = L.marker([parseFloat(route.origin_lat), parseFloat(route.origin_lon)])
                    .addTo(map)
                    .bindPopup('<strong>📍 Origin</strong><br>' + (route.origin || 'Selected location'))
                    .openPopup();
                if (originSearch) originSearch.value = route.origin || 'Selected location';
            }
            
            // Set destination marker
            if (route.dest_lat && route.dest_lon) {
                console.log('🗺️ Setting destination marker:', route.dest_lat, route.dest_lon);
                destinationMarker = L.marker([parseFloat(route.dest_lat), parseFloat(route.dest_lon)])
                    .addTo(map)
                    .bindPopup('<strong>🎯 Destination</strong><br>' + (route.destination || 'Selected location'))
                    .openPopup();
                if (destinationSearch) destinationSearch.value = route.destination || 'Selected location';
            }
            
            // Generate and display the route if we have both coordinates
            if (originMarker && destinationMarker) {
                console.log('Both markers present, generating route display...');
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
                if (map) map.fitBounds(group.getBounds().pad(0.2));
            } else {
                console.log(' Missing markers for route regeneration');
                if (route.origin_lat && route.origin_lon && map) {
                    map.setView([parseFloat(route.origin_lat), parseFloat(route.origin_lon)], 13);
                }
            }
            
            if (saveRoute) saveRoute.disabled = false;
            if (generateRoute) generateRoute.disabled = false;
        } else {
            console.log(' No existing route found for this task');
            if (map) map.setView([4.2105, 101.9758], 10);
        }
    } catch (error) {
        console.error(' Error loading existing route:', error);
        if (map) map.setView([4.2105, 101.9758], 10);
    }
}

function handleSearchInput(query, autocompleteId) {
    const autocomplete = document.getElementById(autocompleteId);
    if (!autocomplete) return;

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
        if (autocomplete) {
            autocomplete.innerHTML = '<div class="autocomplete-item">Error searching. Please try again.</div>';
        }
    }
}

function displayAutocompleteResults(results, autocompleteId) {
    const autocomplete = document.getElementById(autocompleteId);
    if (!autocomplete) return;
    
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
        if (originSearch) originSearch.value = displayName;
        setOriginLocation(lat, lon);
    } else {
        if (destinationSearch) destinationSearch.value = displayName;
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
                if (originSearch) originSearch.value = displayName;
            } else {
                setDestinationLocation(lat, lon);
                if (destinationSearch) destinationSearch.value = displayName;
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
        if (address && originSearch) {
            originSearch.value = address;
        }
        
    } catch (error) {
        console.error('Error getting current location:', error);
        showNotification('Could not get your current location', 'error');
    }
}

async function searchLocationsHandler() {
    if (!originSearch || !destinationSearch) return;
    
    const originQuery = originSearch.value.trim();
    const destinationQuery = destinationSearch.value.trim();

    if (originQuery) {
        await geocodeAndSetMarker(originQuery, 'origin');
    }
    if (destinationQuery) {
        await geocodeAndSetMarker(destinationQuery, 'destination');
    }

    if (originMarker && destinationMarker && generateRoute) {
        generateRoute.disabled = false;
    }
}

function setOriginLocation(lat, lon) {
    if (!map) return;
    
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
    if (!map) return;
    
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
    if (originMarker && destinationMarker && generateRoute) {
        generateRoute.disabled = false;
        const group = new L.featureGroup([originMarker, destinationMarker]);
        if (map) map.fitBounds(group.getBounds().pad(0.1));
    }
}

async function generateRouteHandler() {
    if (!originMarker || !destinationMarker || !map) return;

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
            if (saveRoute) saveRoute.disabled = false;
        } else {
            throw new Error('Could not calculate route');
        }
    } catch (error) {
        console.error('Route generation error:', error);
        showNotification('Error generating route', 'error');
    }
}

function displayRoute(route, originLatLng, destLatLng) {
    if (!map) return;
    
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
        origin: originSearch ? originSearch.value : '',
        destination: destinationSearch ? destinationSearch.value : '',
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
        origin: originSearch ? originSearch.value : '',
        destination: destinationSearch ? destinationSearch.value : ''
    });
    
    if (saveRoute) saveRoute.disabled = false;
}

async function saveRouteHandler() {
    if (!currentRoute || !currentTaskId) {
        showNotification('No route to save. Please generate a route first.', 'error');
        return;
    }

    console.log(' Attempting to save route for task:', currentTaskId);

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

        console.log(' Sending to server:', routeData);

        const res = await fetch(`/tasks/${currentTaskId}/route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(routeData)
        });

        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }

        const result = await res.json();
        console.log('Server response:', result);
        
        if (res.ok && result.success) {
            showNotification(' Route saved successfully!', 'success');
            closeMapModalHandler();
            await loadTasks(); // Reload tasks to get updated route info
        } else {
            throw new Error(result.error || `Server error: ${res.status}`);
        }
    } catch (error) {
        console.error(' Save route error:', error);
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

// Task Modal Functions
function openNewTaskModal() {
    if (!taskForm || !modal) return;
    
    taskForm.reset();
    setMinDate();
    modal.classList.add("show");
    const headerTitle = modal.querySelector(".modal-header h2");
    if (headerTitle) headerTitle.textContent = "Add Task";
    const hiddenId = document.getElementById("taskId");
    if (hiddenId) hiddenId.value = "";
}

function closeTaskModal() {
    if (modal) modal.classList.remove("show");
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    const submitButton = document.querySelector('.save-btn');
    if (!submitButton) return;
    
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
            credentials: 'include',
            body: JSON.stringify(data),
        });

        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!res.ok) throw new Error(`Server error (${res.status})`);

        if (modal) modal.classList.remove("show");
        if (taskForm) taskForm.reset();
        await loadTasks();
        showNotification('Task saved successfully!', 'success');

    } catch (err) {
        console.error("Error saving task:", err);
        showNotification('Error: ' + err.message, 'error');
    } finally {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

// Delete Functions
function confirmDelete() {
    if (!taskToDelete) return;
    
    (async () => {
        try {
            const res = await fetch(`/tasks/${taskToDelete}`, { 
                method: "DELETE",
                credentials: 'include'
            });
            
            if (res.status === 401) {
                window.location.href = '/login';
                return;
            }
            
            if (!res.ok) throw new Error("Failed to delete task");
            if (deleteModal) deleteModal.classList.remove("show");
            taskToDelete = null;
            await loadTasks();
            showNotification('Task deleted!', 'success');
        } catch (err) {
            console.error("Error deleting task:", err);
            showNotification('Error deleting: ' + err.message, 'error');
        }
    })();
}

function cancelDelete() {
    if (deleteModal) deleteModal.classList.remove("show");
    taskToDelete = null;
}

// Task Actions Handler
function handleTaskActions(e) {
    const id = parseInt(e.target.dataset.id);

    if (e.target.classList.contains("delete-btn")) {
        taskToDelete = id;
        if (deleteModal) deleteModal.classList.add("show");
    }
    else if (e.target.classList.contains("edit-btn")) {
        const task = currentTasks.find(t => t.id === id);
        if (!task) {
            alert("Task not found");
            return;
        }

        const taskId = document.getElementById("taskId");
        const taskTitle = document.getElementById("taskTitle");
        const taskCategory = document.getElementById("taskCategory");
        const taskRemarks = document.getElementById("taskRemarks");
        const taskOrigin = document.getElementById("taskOrigin");
        const taskDestination = document.getElementById("taskDestination");
        const taskDeadline = document.getElementById("taskDeadline");

        if (taskId) taskId.value = task.id;
        if (taskTitle) taskTitle.value = task.title || "";
        if (taskCategory) taskCategory.value = task.category || "";
        if (taskRemarks) taskRemarks.value = task.remarks || "";
        if (taskOrigin) taskOrigin.value = task.origin || "";
        if (taskDestination) taskDestination.value = task.destination || "";
        if (taskDeadline) taskDeadline.value = formatDateForInput(task.deadline) || "";

        setMinDate();
        if (modal) modal.classList.add("show");
        
        const headerTitle = modal.querySelector(".modal-header h2");
        if (headerTitle) headerTitle.textContent = "Edit Task";
    }
    else if (e.target.classList.contains("complete-btn")) {
        completeTask(id, e.target);
    }
    else if (e.target.classList.contains("route-btn")) {
        openMapModal(id);
    }
}

async function completeTask(taskId, buttonElement) {
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) {
        showNotification('Task not found', 'error');
        return;
    }

    try {
        // Add smooth fade-out animation to task bar
        const taskBar = buttonElement.closest('.task-bar');
        if (taskBar) {
            taskBar.style.transition = 'all 0.5s ease-in-out';
            taskBar.style.opacity = '0';
            taskBar.style.transform = 'translateX(-100%)';
            taskBar.style.height = taskBar.offsetHeight + 'px';
            
            // Wait a bit before starting the collapse animation
            setTimeout(() => {
                taskBar.style.height = '0';
                taskBar.style.margin = '0';
                taskBar.style.padding = '0';
                taskBar.style.overflow = 'hidden';
            }, 200);
        }
        
        // Wait for animation to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Send completion request to backend
        const now = new Date().toISOString();
        console.log('🔄 Completing task:', taskId, 'at:', now);
        
        const res = await fetch(`/tasks/${taskId}`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
                complete: 1,
                completedAt: now
            })
        });
        
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        if (!res.ok) {
            let errorMessage = `HTTP error! status: ${res.status}`;
            try {
                const errorText = await res.text();
                errorMessage += `, message: ${errorText}`;
            } catch (e) {
                // If we can't read the error text, use the status
            }
            throw new Error(errorMessage);
        }
        
        const result = await res.json();
        console.log(' Task completion response:', result);
        
        if (result.success) {
            // Remove from currentTasks array
            currentTasks = currentTasks.filter(t => t.id !== taskId);
            
            // Remove from DOM after successful backend update
            if (taskBar) {
                taskBar.remove();
            }
            
            showNotification(' Task completed! Check Task History.', 'success');
            
            // Update task list if empty
            if (currentTasks.length === 0 && taskList) {
                taskList.innerHTML = '<div class="no-tasks">No tasks yet. Create your first task!</div>';
            }
        } else {
            throw new Error(result.error || 'Unknown error');
        }
        
    } catch (err) {
        console.error(' Error completing task:', err);
        
        // Revert animation if failed
        const taskBar = buttonElement.closest('.task-bar');
        if (taskBar) {
            taskBar.style.transition = 'all 0.3s ease-in-out';
            taskBar.style.opacity = '1';
            taskBar.style.transform = 'translateX(0)';
            taskBar.style.height = '';
            taskBar.style.margin = '';
            taskBar.style.padding = '';
        }
        
        showNotification('Failed to complete task: ' + err.message, 'error');
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
    if (!dateString) return 'No date';
    
    try {
        // Handle different date formats
        let date;
        if (dateString instanceof Date) {
            date = dateString;
        } else if (typeof dateString === 'string') {
            // Try parsing as ISO string first
            date = new Date(dateString);
            
            // If that fails, try other common formats
            if (isNaN(date.getTime())) {
                // Try MySQL datetime format: YYYY-MM-DD HH:MM:SS
                const mysqlFormat = dateString.replace(' ', 'T');
                date = new Date(mysqlFormat);
            }
            
            // If still invalid, return original string
            if (isNaN(date.getTime())) {
                return dateString;
            }
        } else {
            return 'Invalid date';
        }
        
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    } catch (error) {
        console.error('Date formatting error:', error);
        return dateString || 'Unknown date';
    }
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

// ==================== HISTORY PAGE FUNCTIONS ====================

// Load history statistics
async function loadHistoryStats() {
    try {
        const response = await fetch('/api/history-stats', {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        if (!response.ok) throw new Error('Failed to load history stats');
        
        const stats = await response.json();
        updateStatsDisplay(stats);
        
    } catch (error) {
        console.error('Error loading history stats:', error);
        showNotification('Failed to load history statistics', 'error');
    }
}

// Update statistics display
function updateStatsDisplay(stats) {
    const totalCompleted = document.getElementById('totalCompleted');
    const thisWeek = document.getElementById('thisWeek');
    const thisMonth = document.getElementById('thisMonth');
    
    if (totalCompleted) totalCompleted.textContent = stats.total_completed || 0;
    if (thisWeek) thisWeek.textContent = stats.this_week || 0;
    if (thisMonth) thisMonth.textContent = stats.this_month || 0;
}

// Load completed tasks
async function loadCompletedTasks() {
    try {
        const response = await fetch('/api/completed-tasks', {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        if (!response.ok) throw new Error('Failed to load completed tasks');
        
        const tasks = await response.json();
        completedTasks = tasks;
        console.log(' Loaded completed tasks:', tasks);
        renderCompletedTasks(tasks);
        
    } catch (error) {
        console.error('Error loading completed tasks:', error);
        showNotification('Failed to load completed tasks', 'error');
    }
}

// Render completed tasks (reusing home page styling)
function renderCompletedTasks(tasks) {
    if (!completedTaskList) return;
    
    completedTaskList.innerHTML = "";
    
    if (!tasks || tasks.length === 0) {
        completedTaskList.innerHTML = `
            <div class="no-tasks">
                <div style="text-align: center; padding: 3rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">📭</div>
                    <h3 style="color: #666; margin-bottom: 0.5rem;">No Completed Tasks Yet</h3>
                    <p style="color: #888;">Tasks you complete will appear here</p>
                    <button onclick="window.location.href='/home'" 
                            style="margin-top: 1rem; padding: 10px 20px; background: #2e7d32; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Go to Tasks
                    </button>
                </div>
            </div>
        `;
        return;
    }
    
    tasks.forEach(task => {
        const priority = task.priority ? String(task.priority).toLowerCase() : 'medium';
        
        // Check if coordinates exist for route
        const hasRoute = task.origin_lat !== null && task.dest_lat !== null && 
                        task.route_distance !== null && task.route_duration !== null;
        
        // Safely format distance and duration
        const distance = hasRoute && task.route_distance ? parseFloat(task.route_distance).toFixed(1) : '0';
        const duration = hasRoute && task.route_duration ? Math.round(task.route_duration / 60) : 0;

        // Format completion date - fix for completedAt field
        let completedDate = 'Unknown';
        if (task.completedAt) {
            completedDate = formatDateForDisplay(task.completedAt);
        } else if (task.completed_at) { // Fallback for different column name
            completedDate = formatDateForDisplay(task.completed_at);
        }

        const div = document.createElement("div");
        div.className = `task-bar ${priority} completed`;
        
        div.innerHTML = `
            <div class="task-info">
                <div class="task-header">
                    <strong>${escapeHtml(task.title)}</strong>
                    <div class="completion-info">
                        <span class="completed-date">✅ Completed: ${completedDate}</span>
                    </div>
                </div>
                <span class="task-priority ${priority}">${getPriorityLabel(priority)}</span>
                <div class="meta">
                    <span class="category">📁 ${escapeHtml(task.category)}</span>
                    <span class="deadline">📅 Original Deadline: ${formatDateForDisplay(task.deadline)}</span>
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
                <button class="delete-btn" data-id="${task.id}" title="Delete Task">🗑️</button>
            </div>
        `;
        completedTaskList.appendChild(div);
    });
}

// Handle task actions in history page
function handleHistoryTaskActions(e) {
    const id = parseInt(e.target.dataset.id);

    if (e.target.classList.contains("delete-btn")) {
        deleteCompletedTask(id);
    }
}

// Delete completed task
async function deleteCompletedTask(taskId) {
    if (!confirm("Are you sure you want to permanently delete this completed task? This action cannot be undone.")) {
        return;
    }

    try {
        const response = await fetch(`/tasks/${taskId}`, { 
            method: "DELETE",
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        if (!response.ok) throw new Error("Failed to delete task");
        
        showNotification(' Task deleted permanently!', 'success');
        
        // Reload both tasks and stats
        await Promise.all([
            loadCompletedTasks(),
            loadHistoryStats()
        ]);
        
    } catch (err) {
        console.error("Error deleting task:", err);
        showNotification('Error deleting task: ' + err.message, 'error');
    }
}

// View route for completed task
function viewCompletedTaskRoute(taskId) {
    const task = completedTasks.find(t => t.id === taskId);
    if (!task) {
        showNotification('Task not found', 'error');
        return;
    }

    // Check if task has route data
    const hasSingleRoute = task.origin_lat !== null && task.dest_lat !== null;
    
}

// Logout functionality
function setupLogout() {
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/logout', {
                    method: 'POST',
                    credentials: 'include'
                });
                
                if (response.ok) {
                    window.location.href = '/login';
                }
            } catch (error) {
                console.error('Logout error:', error);
                window.location.href = '/login';
            }
        });
    }
}

// Profile page function (placeholder)
function loadProfile() {
    // Add profile loading logic here
    console.log('Loading profile...');
}

