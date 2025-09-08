const task = {
    title: document.getElemenetById("taskTitle").value,
    location: document.getElementById("taskLocation").value,
    duration: document.getElementById("taskDuration").value,
    date: document.getElementById("taskDate").value,
    priority: document.getElementById("taskPriority").value,
    complete: document.getElementById("taskComplete").checked ? 1:0
};