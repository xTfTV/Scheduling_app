// Creating the helper functions
let me = null;

function esc(str) {
    return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function fmtDate(dt) {
    if (!dt) return "";
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return String(dt);
    return d.toLocaleString();
}

function setStatus(msg, type = "info") {
    // Temp error in consoles
    if (type === "error") {
        console.error(msg);
        alert(msg);
    } else {
        console.log(msg);
    }
}

// Adding Authorization
async function fetchMe() {
    const res = await fetch("/API/is_logged_in");
    if (!res.ok) return null;
    return await res.json();
}

async function requireAdminOrRedirect() {
    me = await fetchMe();
    if (!me) {
        window.location.href = "/login.html";
        return false;
    }
    if (me.role !== "admin") {
        alert("Admin only");
        window.location.href = "/index.html";
        return false;
    }
    return true;
}

// Implementing the APIs
async function apiListUsers() {
    // Admin only endpoint
    const res = await fetch("/API/admin/users");
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to load users");
    }
    return await res.json();
}

async function apiCreateUser(payload) {
    const res = await fetch("/API/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to create the user");
    }
    return await res.json();
}

async function apiDeleteUser(userId) {
    const res = await fetch(`/API/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
    });

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to delete the user");
    }
    return await res.json();
}

// Some UI functionality
async function refreshTable() {
    const tbody = document.getElementById("usersTbody");
    if(!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="padding:12px">Loading...</td></tr>`;

    const users = await apiListUsers();

    if(!Array.isArray(users) || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:12px">No user found</td></tr>`;
        return;
    }

    tbody.innerHTML = users
        .map((u) => {
            const fullName = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
            const role = u.role ?? "";
            const created = fmtDate(u.created_at);

            // Disabling self deletion for the admin
            const disableDelete = me && String(u.user_id) === String(me.user_id);

            return `
                <tr>
                    <td style="padding: 10px 12px">${esc(fullName)}</td>
                    <td style="padding: 10px 12px">${esc(u.user_email)}</td>
                    <td style="padding: 10px 12px">${esc(role)}</td>
                    <td style="padding: 10px 12px">${esc(created)}</td>
                    <td style="padding: 10px 12px; white-space: nowrap">
                        <button class="pill small" data-action="delete" data-user-id="${esc(u.user_id)}" ${
                            disableDelete ? "disabled" : ""
                        }>
                        Delete
                        </button>
                    </td>
                </tr>
            `;
        })
    .join("");
}

function readForm() {
    const first_name = document.getElementById("first_name")?.value.trim();
    const last_name = document.getElementById("last_name")?.value.trim();
    const user_email = document.getElementById("user_email")?.value.trim();
    const password = document.getElementById("password")?.value;
    const role = document.getElementById("role")?.value;

    if (!first_name || !last_name || !user_email || !password || !role) {
        throw new Error("Please fill out all of the fields");
    }

    // Only driver/scheduler creation right now, manager to come soon
    if (role !== "scheduler" && role !== "driver") {
        throw new Error(msg || "Role must be scheduler or driver.");
    }

    return { first_name, last_name, user_email, password, role };
}

function clearForm() {
    document.getElementById("first_name").value = "";
    document.getElementById("last_name").value = "";
    document.getElementById("user_email").value = "";
    document.getElementById("password").value = "";
    document.getElementById("role").value = "";
}

// Adding events for submit
async function onSubmitCreate(e) {
    e.preventDefault();

    try {
        const payload = readForm();
        await apiCreateUser(payload);
        clearForm();
        await refreshTable();
        setStatus("User created.");
    } catch (e) {
        setStatus(e.message || String(e), "error");
    }
}

async function onTableClick(e) {
    const btn = e.target.closest("button[data-action]");
    if(!btn) return;

    const action = btn.getAttribute("data-action");
    const userId = btn.getAttribute("data-user-id");

    if(action === "delete") {
        if (!userId) return;

        const ok = confirm("Delete this user? This cannot be undone.");
        if (!ok) return;

        try {
            await apiDeleteUser(userId);
            await refreshTable();
        } catch (err) {
            setStatus(err.message || String(err), "error");
        }
    }
}

async function init() {
    const ok = await requireAdminOrRedirect();
    if(!ok) return;

    const form = document.getElementById("createUserForm");
    if (form) form.addEventListener("submit", onSubmitCreate);

    const btnRefresh = document.getElementById("btnRefreshUsers");
    if (btnRefresh) btnRefresh.addEventListener("click", () => refreshTable().catch((e) => setStatus(e.message, "error")));

    const tbody = document.getElementById("usersTbody");
    if (tbody) tbody.addEventListener("click", onTableClick);

    await refreshTable();
}

document.addEventListener("DOMContentLoaded", init);