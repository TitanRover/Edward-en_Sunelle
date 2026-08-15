const config = window.WEDDING_SUPABASE;
const client = window.supabase.createClient(config.url, config.key);

const loginPanel = document.querySelector("[data-login-panel]");
const dashboard = document.querySelector("[data-dashboard]");
const loginForm = document.querySelector("[data-login-form]");
const loginStatus = document.querySelector("[data-login-status]");
const signOutButton = document.querySelector("[data-sign-out]");
const refreshButton = document.querySelector("[data-refresh]");
const guestForm = document.querySelector("[data-guest-form]");
const adminStatus = document.querySelector("[data-admin-status]");
const statsEl = document.querySelector("[data-stats]");
const rowsEl = document.querySelector("[data-guest-rows]");
const exportLinksButton = document.querySelector("[data-export-links]");
const exportRsvpsButton = document.querySelector("[data-export-rsvps]");

let guests = [];

function setLoginStatus(message, type = "") {
  loginStatus.textContent = message;
  loginStatus.className = `notice ${type}`.trim();
}

function setAdminStatus(message, type = "") {
  adminStatus.textContent = message;
  adminStatus.className = `notice ${type}`.trim();
}

function createToken() {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").toUpperCase();
}

function rsvpLink(token) {
  return `${config.siteUrl}/rsvp.html?code=${encodeURIComponent(token)}`;
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function renderStats() {
  const total = guests.length;
  const accepted = guests.filter((guest) => guest.attending === "accepted").length;
  const declined = guests.filter((guest) => guest.attending === "declined").length;
  const pending = total - accepted - declined;
  const attendingCount = guests.reduce((sum, guest) => sum + (guest.attending === "accepted" ? Number(guest.guest_count || 0) : 0), 0);

  statsEl.innerHTML = [
    ["Invited", total],
    ["Accepted", accepted],
    ["Declined", declined],
    ["Pending", pending],
    ["Attending guests", attendingCount]
  ]
    .map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`)
    .join("");
}

function renderRows() {
  rowsEl.innerHTML = guests
    .map((guest) => {
      const link = rsvpLink(guest.token);
      return `
        <tr>
          <td>${guest.guest_name || ""}</td>
          <td>${guest.group_name || ""}</td>
          <td>${guest.attending || "pending"}</td>
          <td>${guest.guest_count || ""} / ${guest.max_guests || 1}</td>
          <td>${guest.plus_one_name || (guest.plus_one_allowed ? "Allowed" : "No")}</td>
          <td><button class="link-button" type="button" data-copy-link="${link}">Copy link</button></td>
        </tr>
      `;
    })
    .join("");
}

async function loadGuests() {
  setAdminStatus("Loading guests...");
  const { data, error } = await client.rpc("admin_get_guests");

  if (error) {
    setAdminStatus("Could not load guests. Make sure the admin SQL has been run and your email is allowed.", "error");
    return;
  }

  guests = data || [];
  renderStats();
  renderRows();
  setAdminStatus(`${guests.length} guest records loaded.`, "success");
}

async function showDashboard() {
  loginPanel.classList.add("hidden");
  dashboard.classList.remove("hidden");
  signOutButton.classList.remove("hidden");
  await loadGuests();
}

async function checkSession() {
  const { data } = await client.auth.getSession();
  if (data.session) await showDashboard();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginStatus("Signing in...");
  const formData = new FormData(loginForm);
  const { error } = await client.auth.signInWithPassword({
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || "")
  });

  if (error) {
    setLoginStatus(error.message, "error");
    return;
  }

  setLoginStatus("Signed in.", "success");
  await showDashboard();
});

signOutButton.addEventListener("click", async () => {
  await client.auth.signOut();
  window.location.reload();
});

refreshButton.addEventListener("click", loadGuests);

guestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(guestForm);
  const guest = {
    p_token: createToken(),
    p_guest_name: String(formData.get("guest_name") || "").trim(),
    p_group_name: String(formData.get("group_name") || "").trim(),
    p_max_guests: Number(formData.get("max_guests") || 1),
    p_plus_one_allowed: formData.get("plus_one_allowed") === "on",
    p_email: String(formData.get("email") || "").trim(),
    p_phone: String(formData.get("phone") || "").trim(),
    p_notes: String(formData.get("notes") || "").trim()
  };

  setAdminStatus("Creating guest link...");
  const { error } = await client.rpc("admin_create_guest", guest);

  if (error) {
    setAdminStatus(error.message, "error");
    return;
  }

  guestForm.reset();
  setAdminStatus(`Guest created. Link: ${rsvpLink(guest.p_token)}`, "success");
  await loadGuests();
});

rowsEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-link]");
  if (!button) return;
  await navigator.clipboard.writeText(button.dataset.copyLink);
  setAdminStatus("RSVP link copied.", "success");
});

exportLinksButton.addEventListener("click", () => {
  downloadCsv(
    "edward-sunelle-rsvp-links.csv",
    ["guest_name", "group_name", "max_guests", "plus_one_allowed", "rsvp_link"],
    guests.map((guest) => [guest.guest_name, guest.group_name, guest.max_guests, guest.plus_one_allowed ? "yes" : "no", rsvpLink(guest.token)])
  );
});

exportRsvpsButton.addEventListener("click", () => {
  downloadCsv(
    "edward-sunelle-rsvps.csv",
    ["guest_name", "group_name", "attending", "guest_count", "plus_one_name", "dietary_requirements", "meal_choice", "song_request", "responded_at", "notes"],
    guests.map((guest) => [
      guest.guest_name,
      guest.group_name,
      guest.attending,
      guest.guest_count,
      guest.plus_one_name,
      guest.dietary_requirements,
      guest.meal_choice,
      guest.song_request,
      guest.responded_at,
      guest.notes
    ])
  );
});

checkSession();
