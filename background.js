// Main background pipeline to pull identity and target day agendas
// Need name, start_time, and end_time saved to currentDaySchedule in chrome storage
async function syncSmartPassSchedule() {
  try {

    // Instantly run calculation update once fresh data drops
    updateVisualBadgeCountdown();
  } catch (error){
    console.error("Automated background sync skipped:", error.message);
    chrome.action.setBadgeText({ text: "ERR" });
    chrome.action.setBadgeBackgroundColor({ color: "#D32F2F" });
  }
}

// Calculates time blocks dynamically and projects numbers onto the extension icon
async function updateVisualBadgeCountdown() {
  const data = await chrome.storage.local.get([
    'currentDaySchedule',
    'lastFetchedDate',
    "hideTimer"
  ]);

  if (data.hideTimer === true) {
    chrome.action.setBadgeText({ text: ""})
    return;
  }

  const todayStr = getLocalDateString();

  if (data.lastFetchedDate !== todayStr) {
    syncSmartPassSchedule();
    return;
  }

  const periods = data.currentDaySchedule || [];
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let activePeriod = null;

  for (let period of periods) {
    const [startH, startM] = period.start.split(':').map(Number);
    const [endH, endM] = period.end.split(':').map(Number);
    
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (currentMinutes >= startTotal && currentMinutes < endTotal) {
      activePeriod = {
        name: period.name,
        remaining: endTotal - currentMinutes
      };
      break;
    }
  }

  if (activePeriod) {
    // Show only the numeric value inside the badge canvas
    chrome.action.setBadgeText({ text: String(activePeriod.remaining) });
    chrome.action.setBadgeBackgroundColor({ color: "#1976D2" }); // Deep Blue while inside an active class window
  } else {
    // Clear or mark passing time
    chrome.action.setBadgeText({ text: "-" });
    chrome.action.setBadgeBackgroundColor({ color: "#757575" }); // Neutral Grey for out-of-bounds or passing periods
  }
}

// Wire up structural listeners and engine tickers
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("clockTicker", { periodInMinutes: 1 });
  chrome.alarms.create("networkSync", { periodInMinutes: 60 });
  syncSmartPassSchedule();
});

chrome.runtime.onStartup.addListener(() => {
  syncSmartPassSchedule();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "clockTicker") {
    updateVisualBadgeCountdown();
  } else if (alarm.name === "networkSync") {
    syncSmartPassSchedule();
  }
});

// Listener to handle forced manual refreshes triggered by the popup interface
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "forceRefresh") {
    syncSmartPassSchedule().then(() => sendResponse({ success: true }));
    return true; 
  }

  if (request.action === "updateTimerVisibility"){
    updateVisualBadgeCountdown();
    sendResponse({ success: true });
    return true;
  }
});