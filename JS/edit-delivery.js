function qs(k) {
    return new URLSearchParams(window.location.search).get(k);
}

async function fetchMe() {
    const res = await fetch("/API/is_logged_in");
    if (!res.ok) return null;
    return await res.json();
}

function toLocalInputValue(mysqlDateTime) {
    if (!mysqlDateTime) return "";
    const s = String(mysqlDateTime).replace(" ", "T");
    return s.slice(0, 16);
}

function toMySQLDateTimeFromLocal(localVal) {
    if (!localVal) return "";
    return `${localVal.replace("T", " ")}:00`;
}

document.addEventListener("DOMContentLoaded", async () => {
    const me = await fetchMe();
    const canEdit = !!(me && (me.role === "admin" || me.role === "scheduler"));

    if (!canEdit) {
        alert("Forbidden: only admin/scheduler can edit deliveries.");
        window.location.href = "/index.html";
        return;
    }

    // Adding logout functionality
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
        btnLogout.addEventListener("click", async () => {
            try { await fetch("/API/logout", { method: "POST" }); }
            finally { window.location.href = "/login.html"; }
        });
    }

    const delivId = qs("deliv_id");
    const returnTo = qs("returnTo") || "/index.html";

    const btnBack = document.getElementById("btnBack");
    const btnCancel = document.getElementById("btnCancel");
    if (btnBack) btnBack.href = returnTo;
    if (btnCancel) btnCancel.href = returnTo;

    const chipId = document.getElementById("chipId");
    if (chipId) chipId.textContent = delivId || "-";

    if (!delivId) {
        alert("Missing deliv_id on URL");
        window.location.href = returnTo;
        return;
    }

    const statusMsg = document.getElementById("statusMsg");
    const completedAt = document.getElementById("completedAt");
    const form = document.getElementById("editForm");

    // load the drivers from the dropdown
    const driverSelect = document.querySelector('select[name="user_id"][form="editForm"]');
    if (!driverSelect) {
        alert("Driver dropdown not found");
        return;
    }
    async function loadDrivers() {
        const res = await fetch("/API/drivers");
        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    }

    // load the existing delivery
    async function loadDelivery() {
        const res = await fetch(`/API/deliveries/${encodeURIComponent(delivId)}`);
        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    }

    try {
        statusMsg.textContent = "Loading...";
        const [drivers, del] = await Promise.all([loadDrivers(), loadDelivery()]);

        // populate the driver drop down
        driverSelect.innerHTML = `<option value="">Select Driver</option>` + drivers
            .map( d => {
                const name = `${d.first_name} ${d.last_name}`.trim();
                return `<option value="${d.user_id}">${name}</option>`;
            })
            .join("");
        
        // fill the form fields
        form.first_name.value = del.first_name ?? "";
        form.last_name.value = del.last_name ?? "";
        form.cust_email.value = del.cust_email ?? "";
        form.cust_phone.value = del.cust_phone ?? "";
        form.cust_address.value = del.cust_address ?? "";
        form.cust_city.value = del.cust_city ?? "";
        form.cust_zip.value = del.cust_zip ?? "";

        form.del_address.value = del.del_address ?? "";
        form.del_city.value = del.del_city ?? "";
        form.del_zip.value = del.del_zip ?? "";
        form.notes.value = del.notes ?? "";
        form.deliv_status.value = del.deliv_status ?? "pending";
        form.duration_min.value = del.duration_min ?? 60;

        form.scheduled_time_local.value = toLocalInputValue(del.scheduled_time);
        driverSelect.value = String(del.user_id ?? "");

        if (completedAt) completedAt.value = del.completed_at ? String(del.completed_at) : "";

        statusMsg.textContent = "";
    } catch (e) {
        console.error(e);
        statusMsg.textContent = "";
        alert("Failed to load the delivery: " + e.message);
        window.location.href = returnTo;
        return;
    }

    // submit update
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        statusMsg.textContent = "";

        const payload = Object.fromEntries(new FormData(form).entries());

        // convert the local date time into mysql datetime
        payload.scheduled_time = toMySQLDateTimeFromLocal(payload.scheduled_time_local);
        delete payload.scheduled_time_local;

        const res = await fetch(`/API/deliveries/${encodeURIComponent(delivId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const msg = await res.text();
            alert(msg);
            return;
        }
        window.location.href = returnTo;
    });
});