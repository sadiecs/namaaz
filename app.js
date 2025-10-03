const appData = {
    prayerNames: ["Fazr", "Zohar", "Asar", "Magrib", "Esha"],
    statusTypes: {
        unmarked: { label: "Not Marked", color: "#6c757d" },
        ontime: { label: "On Time", color: "#28a745" },
        missed: { label: "Missed/Qaza Pending", color: "#dc3545" },
        qaza: { label: "Qaza Completed", color: "#007bff" }
    },
    startYear: 2025,
    endYear: 2084,
    months: [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
};

let currentYear = appData.startYear;
let currentMonth = 0; // January (0 based)
let prayerData = {};
let selectedDate = null;

// === LocalStorage Functions ===
function saveToLocalStorage() {
    localStorage.setItem('prayerData', JSON.stringify(prayerData));
}
function loadFromLocalStorage() {
    const stored = localStorage.getItem('prayerData');
    if (stored) {
        prayerData = JSON.parse(stored);
    }
}

// === Calendar and App Logic ===
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    updateCurrentDate();
    renderCalendar();
    updateStatistics();
});

function updateCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
}

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function daysInMonth(year, month) {
    if (month === 1) return isLeapYear(year) ? 29 : 28;
    const month31 = [0, 2, 4, 6, 7, 9, 11];
    return month31.includes(month) ? 31 : 30;
}

function renderCalendar() {
    const monthAndYear = document.getElementById("monthAndYear");
    monthAndYear.textContent = `${appData.months[currentMonth]} ${currentYear}`;
    const calendar = document.getElementById("calendar");
    calendar.innerHTML = "";

    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let headerRow = calendar.insertRow();
    for (const day of daysOfWeek) {
        const th = document.createElement("th");
        th.textContent = day;
        headerRow.appendChild(th);
    }

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const dim = daysInMonth(currentYear, currentMonth);

    let date = 1;
    for (let i = 0; i < 6; i++) {
        const row = calendar.insertRow();
        for (let j = 0; j < 7; j++) {
            const cell = row.insertCell();
            if (i === 0 && j < firstDay) {
                cell.classList.add("inactive");
                cell.textContent = "";
            } else if (date > dim) {
                cell.classList.add("inactive");
                cell.textContent = "";
            } else {
                const monthStr = String(currentMonth + 1).padStart(2, '0');
                const dateStr = String(date).padStart(2, '0');
                const dateString = `${currentYear}-${monthStr}-${dateStr}`;
                cell.textContent = date;

                const today = new Date();
                if (currentYear === today.getFullYear() && currentMonth === today.getMonth() && date === today.getDate()) {
                    cell.classList.add("today");
                }

                const dotContainer = document.createElement("div");
                dotContainer.classList.add("dot-container");
                for (const prayerName of appData.prayerNames) {
                    const key = prayerName.toLowerCase();
                    const status = (prayerData[dateString] && prayerData[dateString][key]) || "unmarked";
                    const dot = document.createElement("span");
                    dot.classList.add("dot");
                    dot.style.backgroundColor = appData.statusTypes[status].color;
                    dot.title = `${prayerName}: ${appData.statusTypes[status].label}`;
                    dotContainer.appendChild(dot);
                }
                cell.appendChild(dotContainer);

                cell.onclick = () => openModal(dateString);
                date++;
            }
        }
    }
}

function openModal(dateString) {
    selectedDate = dateString;
    const modal = document.getElementById("dailyModal");
    modal.style.display = "flex";
    document.getElementById("modalDate").textContent = formatDate(dateString);

    const prayerList = document.getElementById("prayerList");
    prayerList.innerHTML = "";

    for (const prayer of appData.prayerNames) {
        const key = prayer.toLowerCase();

        const div = document.createElement("div");
        div.classList.add("prayer-status");

        const label = document.createElement("div");
        label.textContent = prayer;
        div.appendChild(label);

        for (const [status, meta] of Object.entries(appData.statusTypes)) {
            const btn = document.createElement("button");
            btn.textContent = meta.label;
            btn.classList.add("status-btn", `status-${status}`);

            if (
                (prayerData[selectedDate] && prayerData[selectedDate][key] === status) ||
                (!prayerData[selectedDate] && status === "unmarked")
            ) {
                btn.classList.add("active");
            }
            btn.onclick = () => {
                const siblings = div.querySelectorAll("button");
                siblings.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");

                if (!prayerData[selectedDate]) prayerData[selectedDate] = {};
                prayerData[selectedDate][key] = status;
                saveToLocalStorage();
                updateStatistics();
            };
            div.appendChild(btn);
        }

        prayerList.appendChild(div);
    }
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toDateString();
}

function closeModal() {
    const modal = document.getElementById("dailyModal");
    modal.style.display = "none";
    renderCalendar();
}

function saveModal() {
    closeModal();
}

function markAll(status) {
    if (!selectedDate) return;
    if (!prayerData[selectedDate]) prayerData[selectedDate] = {};
    for (const prayer of appData.prayerNames) {
        prayerData[selectedDate][prayer.toLowerCase()] = status;
    }
    saveToLocalStorage();
    openModal(selectedDate);
}

function prevMonth() {
    if (currentMonth === 0) {
        currentMonth = 11;
        prevYear();
    } else {
        currentMonth--;
        renderCalendar();
    }
}

function nextMonth() {
    if (currentMonth === 11) {
        currentMonth = 0;
        nextYear();
    } else {
        currentMonth++;
        renderCalendar();
    }
}

function prevYear() {
    if (currentYear > appData.startYear) {
        currentYear--;
        renderCalendar();
        updateStatistics();
    }
}

function nextYear() {
    if (currentYear < appData.endYear) {
        currentYear++;
        renderCalendar();
        updateStatistics();
    }
}

function updateStatistics() {
    let ontime = 0, missed = 0, qaza = 0;

    for (const date in prayerData) {
        if (!date.startsWith(currentYear)) continue;
        for (const prayer of appData.prayerNames) {
            const key = prayer.toLowerCase();
            const status = prayerData[date][key] || "unmarked";
            if (status === "ontime") ontime++;
            else if (status === "missed") missed++;
            else if (status === "qaza") qaza++;
        }
    }
    const dim = isLeapYear(currentYear) ? 366 : 365;
    const totalPrayers = dim * appData.prayerNames.length;

    document.getElementById("totalPrayers").textContent = totalPrayers;
    document.getElementById("ontimeCount").textContent = ontime;
    document.getElementById("missedCount").textContent = missed;
    document.getElementById("qazaCount").textContent = qaza;
    const completion = totalPrayers === 0 ? 0 : Math.round(((ontime + qaza) / totalPrayers) * 100);
    document.getElementById("completionPercent").textContent = `${completion} %`;
}

function exportData() {
    const dataStr = JSON.stringify(prayerData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qaza_namaz_backup_2025_2084.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData(input) {
    if (input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            prayerData = JSON.parse(event.target.result);
            saveToLocalStorage();
            alert("Backup imported successfully!");
            renderCalendar();
            updateStatistics();
        } catch (e) {
            alert("Invalid file format!");
        }
        input.value = "";
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (confirm("Are you sure you want to clear all data? This action cannot be undone.")) {
        prayerData = {};
        saveToLocalStorage();
        renderCalendar();
        updateStatistics();
    }
}