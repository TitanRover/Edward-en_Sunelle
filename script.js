const countdown = document.querySelector("[data-countdown]");

if (countdown) {
  const target = new Date(countdown.dataset.countdown).getTime();
  const daysEl = countdown.querySelector("[data-days]");
  const hoursEl = countdown.querySelector("[data-hours]");
  const minutesEl = countdown.querySelector("[data-minutes]");
  const secondsEl = countdown.querySelector("[data-seconds]");

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function tick() {
    const remaining = Math.max(0, target - Date.now());
    const seconds = Math.floor(remaining / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    daysEl.textContent = days;
    hoursEl.textContent = pad(hours);
    minutesEl.textContent = pad(minutes);
    secondsEl.textContent = pad(secs);
  }

  tick();
  window.setInterval(tick, 1000);
}
