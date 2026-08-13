const config = window.WEDDING_SUPABASE;
const client = window.supabase.createClient(config.url, config.key);
const params = new URLSearchParams(window.location.search);
const token = params.get("code") || params.get("token") || "";

const statusEl = document.querySelector("[data-rsvp-status]");
const form = document.querySelector("[data-rsvp-form]");
const guestNameEl = document.querySelector("[data-guest-name]");
const guestDetailsEl = document.querySelector("[data-guest-details]");
const guestCountEl = document.querySelector("[data-guest-count]");
const plusOneField = document.querySelector("[data-plus-one-field]");
let currentGuest = null;

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `notice ${type}`.trim();
}

function showForm(guest) {
  currentGuest = guest;
  guestNameEl.textContent = guest.guest_name;
  guestDetailsEl.textContent = `${guest.max_guests} seat${guest.max_guests === 1 ? "" : "s"} reserved${guest.plus_one_allowed ? ", plus-one allowed" : ""}.`;

  guestCountEl.innerHTML = "";
  for (let count = 0; count <= guest.max_guests; count += 1) {
    const option = document.createElement("option");
    option.value = String(count);
    option.textContent = String(count);
    guestCountEl.append(option);
  }
  guestCountEl.value = guest.attending === "declined" ? "0" : String(Math.min(1, guest.max_guests));

  plusOneField.classList.toggle("hidden", !guest.plus_one_allowed);
  form.classList.remove("hidden");
  setStatus("Invitation found.", "success");
}

async function loadInvitation() {
  if (!token) {
    setStatus("This RSVP link is missing its invitation code. Please use the full link from your invitation.", "error");
    return;
  }

  const { data, error } = await client.rpc("get_guest_by_token", { rsvp_token: token });

  if (error) {
    setStatus("We could not load this invitation. Please try again later.", "error");
    return;
  }

  if (!data || data.length === 0) {
    setStatus("This invitation code was not found. Please check that you opened the full RSVP link.", "error");
    return;
  }

  showForm(data[0]);
}

form.addEventListener("change", () => {
  const attending = new FormData(form).get("attending");
  if (attending === "declined") {
    guestCountEl.value = "0";
  } else if (guestCountEl.value === "0") {
    guestCountEl.value = "1";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentGuest) return;

  const formData = new FormData(form);
  const attending = formData.get("attending");
  const guestCount = Number(formData.get("guest_count"));

  if (attending === "accepted" && guestCount < 1) {
    setStatus("Please select at least one guest if you are attending.", "error");
    return;
  }

  if (guestCount > currentGuest.max_guests) {
    setStatus("The guest count is higher than the number reserved on this invitation.", "error");
    return;
  }

  setStatus("Saving your RSVP...");

  const { data, error } = await client.rpc("submit_rsvp", {
    rsvp_token: token,
    new_attending: attending,
    new_guest_count: guestCount,
    new_plus_one_name: String(formData.get("plus_one_name") || "").trim(),
    new_dietary_requirements: String(formData.get("dietary_requirements") || "").trim(),
    new_meal_choice: String(formData.get("meal_choice") || "").trim(),
    new_song_request: String(formData.get("song_request") || "").trim()
  });

  if (error || data !== true) {
    setStatus("We could not save your RSVP. Please try again.", "error");
    return;
  }

  form.classList.add("hidden");
  setStatus("Thank you. Your RSVP has been saved. We cannot wait to celebrate with you.", "success");
});

loadInvitation();
