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

// Default calendar to current date (clamped to startYear..endYear)
const _initToday = new Date();
let currentYear = Math.min(Math.max(_initToday.getFullYear(), appData.startYear), appData.endYear);
let currentMonth = _initToday.getMonth(); // Current month (0-based)
let prayerData = {};
let selectedDate = null;

// === Cloud Sync State & Constants ===
const STORAGE_PWD_KEY = "qaza_namaz_sync_pwd_v5";
const CLOUD_SYNC_RELAY = "https://ntfy.sh";
let syncPassword = localStorage.getItem(STORAGE_PWD_KEY) || "";
let autoPushTimer = null;
let pullingFromCloud = false;

// === LocalStorage Functions ===
function saveToLocalStorage() {
    localStorage.setItem('prayerData', JSON.stringify(prayerData));
    if (!pullingFromCloud && syncPassword && syncPassword.trim().length >= 4) {
        clearTimeout(autoPushTimer);
        autoPushTimer = setTimeout(() => {
            syncWithPasswordCloud("push", false);
        }, 1200);
    }
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
    refreshSyncButton();
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
    if (confirm("Are you sure you sure you want to clear all data? This action cannot be undone.")) {
        prayerData = {};
        saveToLocalStorage();
        renderCalendar();
        updateStatistics();
    }
}

// =========================================================================
// COMPACT CLOUD SYNC v5 (packTransactions / unpackTransactions + >4KB
// Attachment Reader + Case-Insensitive & Legacy Password Channel Fallback
// + Prefix-Aware SHA-256 Duplicate Detection)
// =========================================================================
const STATUS_TO_CODE = { unmarked: "u", ontime: "o", missed: "m", qaza: "q" };
const CODE_TO_STATUS = { u: "unmarked", o: "ontime", m: "missed", q: "qaza" };

function refreshSyncButton() {
    const lbl = document.getElementById("syncOpenBtnLabel");
    if (lbl) lbl.textContent = syncPassword ? "Password Synced" : "Set Sync Password";
}

function openSyncModal() {
    const input = document.getElementById("syncPasswordInput");
    if (input) input.value = syncPassword;
    const modal = document.getElementById("syncModal");
    if (modal) modal.style.display = "flex";
}

function closeSyncModal() {
    const modal = document.getElementById("syncModal");
    if (modal) modal.style.display = "none";
}

function onSyncPasswordInput(val) {
    syncPassword = val;
    localStorage.setItem(STORAGE_PWD_KEY, syncPassword);
    refreshSyncButton();
}

function setSyncStatus(status, msg) {
    const el = document.getElementById("syncStatusMsg");
    if (!el) return;
    if (status === "idle" || !msg) {
        el.style.display = "none";
        el.textContent = "";
        return;
    }
    el.style.display = "block";
    el.style.color = status === "error" ? "#dc3545" : status === "success" ? "#28a745" : "#007bff";
    el.textContent = msg;
}

// Case-Insensitive + Legacy Password Channel Fallback
async function getPasswordHash(password, normalizeCase = false) {
    const cleanPwd = normalizeCase ? password.trim().toLowerCase() : password.trim();
    const msgUint8 = new TextEncoder().encode("qaza-namaz-salt-v5-" + cleanPwd);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// Prefix-Aware SHA-256 Duplicate Detection: matches both full 64-char hashes and compact 16-char synced hashes
function checkDuplicate(candidate, hash = null, existingList = []) {
    for (const tx of existingList) {
        if (hash && tx.fileHash && (tx.fileHash === hash || hash.startsWith(tx.fileHash) || tx.fileHash.startsWith(hash))) {
            return { isDup: true, reason: "Already in Portfolio (Exact Hash Match)" };
        }
        if (candidate && candidate.date && tx.date === candidate.date) {
            return { isDup: true, reason: `Duplicate Date Entry (${candidate.date})` };
        }
    }
    return { isDup: false, reason: null };
}

// Compact Cloud Sync Serializer: Compresses prayer records into tiny [date, "oomqu", 16-char-hash] tuples
// so 60+ records stay well under ntfy.sh's 4 KB inline message limit
function packTransactions(dataObj) {
    if (!dataObj || typeof dataObj !== "object") return [];
    const packed = [];
    for (const [dateStr, prayers] of Object.entries(dataObj)) {
        if (!prayers || typeof prayers !== "object") continue;
        const codes = appData.prayerNames.map(p => {
            const st = prayers[p.toLowerCase()] || "unmarked";
            return STATUS_TO_CODE[st] || "u";
        }).join("");
        if (codes === "uuuuu") continue; // Skip completely unmarked days to save space
        const row = [dateStr, codes];
        if (prayers.fileHash) row.push(String(prayers.fileHash).slice(0, 16));
        packed.push(row);
    }
    return packed;
}

function unpackTransactions(packed) {
    if (!packed) return {};
    // If already an object map of dates -> prayer statuses
    if (!Array.isArray(packed) && typeof packed === "object") {
        return packed;
    }
    const restored = {};
    for (const row of packed) {
        if (!Array.isArray(row) || row.length < 2) continue;
        const [dateStr, codes, shortHash] = row;
        const dayObj = {};
        appData.prayerNames.forEach((p, idx) => {
            const ch = (codes || "")[idx] || "u";
            dayObj[p.toLowerCase()] = CODE_TO_STATUS[ch] || "unmarked";
        });
        if (shortHash) dayObj.fileHash = shortHash;
        restored[dateStr] = dayObj;
    }
    return restored;
}

// Cloud Push & Pull with Automatic >4 KB Attachment Reader & Dual Channel Fallback
async function syncWithPasswordCloud(mode = "push", showAlert = true) {
    if (!syncPassword || syncPassword.trim().length < 4) {
        if (showAlert) {
            setSyncStatus("error", "Please enter a password of at least 4 characters.");
        }
        return;
    }

    setSyncStatus("syncing", mode === "push" ? "Uploading prayer records to cloud..." : "Downloading prayer records from cloud...");

    try {
        const normKey = await getPasswordHash(syncPassword, true);
        const exactKey = await getPasswordHash(syncPassword, false);
        const primaryTopic = `qaza_sync_bin_${normKey}`;
        const legacyTopic = `qaza_sync_bin_${exactKey}`;

        if (mode === "push") {
            const packedRows = packTransactions(prayerData);
            const compactPacket = JSON.stringify({
                u: new Date().toISOString(),
                p: packedRows
            });

            const res = await fetch(`${CLOUD_SYNC_RELAY}/${primaryTopic}`, {
                method: "POST",
                headers: { "Title": "Qaza Namaz Tracker Sync" },
                body: compactPacket
            });

            if (primaryTopic !== legacyTopic) {
                fetch(`${CLOUD_SYNC_RELAY}/${legacyTopic}`, { method: "POST", body: compactPacket }).catch(() => {});
            }

            if (!res.ok) throw new Error(`Cloud Push Failed (HTTP ${res.status})`);

            setSyncStatus("success", `✓ Pushed ${packedRows.length} tracked days to Cloud! Now click "Pull from Cloud" on your other device.`);
        } else {
            // Automatic >4 KB Attachment Reader + Inline Message Reader
            const fetchFromTopic = async (topic) => {
                const res = await fetch(`${CLOUD_SYNC_RELAY}/${topic}/json?poll=1&since=all`, {
                    method: "GET",
                    cache: "no-store"
                });
                if (!res.ok) return null;
                const rawLines = (await res.text()).trim();
                if (!rawLines) return null;

                const lines = rawLines.split("\n").filter(Boolean);
                for (let i = lines.length - 1; i >= 0; i--) {
                    try {
                        const event = JSON.parse(lines[i]);
                        if (event.event !== "message") continue;

                        let parsedMsg = null;
                        // Case A: Standard inline message (<4 KB)
                        if (event.message && event.message.trim().startsWith("{")) {
                            parsedMsg = JSON.parse(event.message);
                        }
                        // Case B: Payload >4 KB converted by ntfy.sh into an attachment
                        else if (event.attachment && event.attachment.url) {
                            const attRes = await fetch(event.attachment.url, { cache: "no-store" });
                            if (attRes.ok) parsedMsg = await attRes.json();
                        }

                        if (parsedMsg) {
                            if (Array.isArray(parsedMsg.p)) return unpackTransactions(parsedMsg.p);
                            if (parsedMsg.prayerData && typeof parsedMsg.prayerData === "object") return parsedMsg.prayerData;
                            if (parsedMsg.blobUrl) {
                                const blobRes = await fetch(parsedMsg.blobUrl, { headers: { "Accept": "application/json" } });
                                if (blobRes.ok) {
                                    const blobJson = await blobRes.json();
                                    if (blobJson && blobJson.prayerData) return blobJson.prayerData;
                                }
                            }
                        }
                    } catch (_) {}
                }
                return null;
            };

            let pulledData = await fetchFromTopic(primaryTopic);
            if (!pulledData && primaryTopic !== legacyTopic) {
                pulledData = await fetchFromTopic(legacyTopic);
            }

            if (!pulledData || typeof pulledData !== "object") {
                throw new Error("No cloud data found for this password yet. Click 'Save & Push Sync' on your primary device first!");
            }

            prayerData = pulledData;
            pullingFromCloud = true;
            try {
                saveToLocalStorage();
            } finally {
                pullingFromCloud = false;
            }
            renderCalendar();
            updateStatistics();

            const countDays = Object.keys(prayerData).length;
            setSyncStatus("success", `✓ Pulled ${countDays} tracked days from Cloud!`);
        }
    } catch (err) {
        setSyncStatus("error", err.message);
    }
}
