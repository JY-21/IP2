const task = {
    title: document.getElemenetById("taskTitle").value,
    location: document.getElementById("taskLocation").value,
    duration: document.getElementById("taskDuration").value,
    date: document.getElementById("taskDate").value,
    priority: document.getElementById("taskPriority").value,
    complete: document.getElementById("taskComplete").checked ? 1:0
};

// Example rendering tasks
const tasks = [
  {id: 1, title: "Buy Groceries", location: "Tesco", duration: 1, date: "2025-09-02", priority: "High"},
  {id: 2, title: "Doctor Appointment", location: "Clinic", duration: 0.5, date: "2025-09-03", priority: "Medium"}
];

function renderTasks() {
  const taskList = document.getElementById("taskList");
  taskList.innerHTML = "";
  
  tasks.forEach(t => {
    const div = document.createElement("div");
    div.className = `task-bar ${t.priority.toLowerCase()}`;
    div.innerHTML = `
      <span class="task-info">
        <strong>${t.title}</strong> | Location: ${t.location} | ${t.duration}hr | Due: ${t.date}
      </span>
      <div class="task-actions">
        <button onclick="editTask(${t.id})">✏️</button>
        <button onclick="deleteTask(${t.id})">❌</button>
        <button onclick="completeTask(${t.id})">✔️</button>
      </div>
    `;
    taskList.appendChild(div);
  });
}

renderTasks();

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("taskModal");
  const newTaskBtn = document.getElementById("newTaskBtn");
  const closeModal = document.getElementById("closeModal");

  //open modal
  newTaskBtn.addEventListener("click", () => {
    modal.classList.add("show");
  });

  //close modal
  closeModal.addEventListener("click", () => {
    modal.classList.remove("show");
  });

  //close modal when clicking outside content
  window.addEventListener("click", (e) =>{
    if(e.target === modal) {
      modal.classList.remove("show");
    }
  });
});
