(function () {
  var clock = document.getElementById('clock');
  function updateClock() {
    try {
      clock.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {}
  }
  updateClock();
  setInterval(updateClock, 1000);
})();