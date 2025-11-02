// Timezone utilities for PST/PDT daily check-in system
// Handles 8 AM PST/PDT daily reset for check-ins and notifications
// Note: PST is UTC-8 (winter), PDT is UTC-7 (summer)
// 
// DST-PROOF SOLUTION: Run cron at BOTH 15:00 UTC and 16:00 UTC
// - Winter (PST): 15:00 UTC = 7 AM (skip), 16:00 UTC = 8 AM (send) ✅
// - Summer (PDT): 15:00 UTC = 8 AM (send) ✅, 16:00 UTC = 9 AM (skip)
// Time validation ensures notifications only send during the correct hour (8 AM local time)

/**
 * Get Pacific timezone hour (0-23)
 * @returns {number} Current hour in Pacific timezone
 */
function getPacificHour() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    hour12: false
  });
  return parseInt(formatter.format(now));
}

/**
 * Get Pacific timezone date components
 * @returns {object} {year, month, day, hour, minute, second}
 */
function getPacificComponents() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const getValue = (type) => parts.find(part => part.type === type)?.value;
  
  return {
    year: parseInt(getValue('year')),
    month: parseInt(getValue('month')) - 1, // 0-indexed
    day: parseInt(getValue('day')),
    hour: parseInt(getValue('hour')),
    minute: parseInt(getValue('minute')),
    second: parseInt(getValue('second'))
  };
}

/**
 * Get the current time in PST/PDT timezone
 * @returns {Date} Current date/time (always returns actual current time)
 */
export function getCurrentPSTTime() {
  // Just return current time - it's always UTC internally
  // Use getPacificComponents() when you need Pacific timezone parts
  return new Date();
}

/**
 * Get the current check-in day in PST timezone
 * A check-in day starts at 8 AM PST and ends at 7:59 AM PST the next day
 * @returns {string} Check-in day in YYYY-MM-DD format
 */
export function getCurrentCheckInDay() {
  const components = getPacificComponents();
  
  // If it's before 8 AM PST, use the previous day as the check-in day
  if (components.hour < 8) {
    const date = new Date(components.year, components.month, components.day);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }
  
  // If it's 8 AM PST or later, use the current day
  const date = new Date(components.year, components.month, components.day);
  return date.toISOString().split('T')[0];
}

/**
 * Get the next 8 AM PST/PDT reset time
 * @returns {Date} Next 8 AM Pacific as a UTC Date object
 */
export function getNext8AMPST() {
  const now = new Date();
  const components = getPacificComponents();
  
  // Determine which day we need (today or tomorrow)
  let targetDay = components.day;
  let targetMonth = components.month;
  let targetYear = components.year;
  
  if (components.hour >= 8) {
    // Already past 8 AM Pacific, so next reset is tomorrow
    const tomorrow = new Date(targetYear, targetMonth, targetDay + 1);
    targetYear = tomorrow.getFullYear();
    targetMonth = tomorrow.getMonth();
    targetDay = tomorrow.getDate();
  }
  
  // Create a date at midnight on the target day in UTC
  const targetDate = new Date(Date.UTC(targetYear, targetMonth, targetDay, 0, 0, 0));
  
  // Get what "midnight" on that day looks like in Pacific time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  // Calculate the offset between Pacific and UTC for that specific day
  // by checking what hour UTC midnight appears as in Pacific
  const parts = formatter.formatToParts(targetDate);
  const pacificHourAtUTCMidnight = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  
  // If UTC midnight = 4 PM Pacific, then Pacific midnight = 8 AM UTC
  // So 8 AM Pacific = (8 AM + 8) = 4 PM UTC (PST)
  // or 8 AM Pacific = (8 AM + 7) = 3 PM UTC (PDT)
  const hoursToAdd = (24 - pacificHourAtUTCMidnight + 8) % 24;
  
  const next8AM = new Date(targetDate);
  next8AM.setUTCHours(hoursToAdd);
  
  return next8AM;
}

/**
 * Check if a given date is the same check-in day as today
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {boolean} True if the date is the same check-in day
 */
export function isSameCheckInDay(dateString) {
  const currentCheckInDay = getCurrentCheckInDay();
  return dateString === currentCheckInDay;
}

/**
 * Check if a user can check in today based on PST timezone
 * @param {string|null} lastCheckinDate - Last check-in date (YYYY-MM-DD format)
 * @returns {boolean} True if user can check in today
 */
export function canCheckInTodayPST(lastCheckinDate) {
  if (!lastCheckinDate) {
    return true; // New user, can check in
  }
  
  // Check if last check-in was in a different check-in day
  return !isSameCheckInDay(lastCheckinDate);
}

/**
 * Calculate streak with PST timezone logic
 * @param {string|null} lastCheckinDate - Last check-in date (YYYY-MM-DD format)
 * @param {number} currentStreak - Current streak count
 * @returns {number} New streak count
 */
export function calculateStreakPST(lastCheckinDate, currentStreak) {
  if (!lastCheckinDate) {
    return 1; // First check-in ever
  }
  
  const currentCheckInDay = getCurrentCheckInDay();
  const lastCheckInDay = lastCheckinDate;
  
  // Calculate days between check-ins
  const currentDate = new Date(currentCheckInDay);
  const lastDate = new Date(lastCheckInDay);
  const daysDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
  
  if (daysDiff === 1) {
    // Consecutive day, increment streak
    return currentStreak + 1;
  } else {
    // Streak broken, start new streak
    return 1;
  }
}

/**
 * Get time until next 8 AM PST reset
 * @returns {object} Time until reset with hours, minutes, seconds
 */
export function getTimeUntilReset() {
  const now = getCurrentPSTTime();
  const next8AM = getNext8AMPST();
  const msUntilReset = next8AM.getTime() - now.getTime();
  
  const hours = Math.floor(msUntilReset / (1000 * 60 * 60));
  const minutes = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((msUntilReset % (1000 * 60)) / 1000);
  
  return {
    hours,
    minutes,
    seconds,
    totalMs: msUntilReset
  };
}

/**
 * Format PST time for display
 * @param {Date} date - Date to format
 * @returns {string} Formatted time string
 */
export function formatPSTTime(date = getCurrentPSTTime()) {
  return date.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
}

/**
 * Check if it's currently notification time (8 AM PST/PDT)
 * @returns {boolean} True if it's within 8:00-8:59 AM PST/PDT
 */
export function isNotificationTime() {
  const hour = getPacificHour();
  
  // Check if it's between 8:00 AM and 8:59 AM PST/PDT
  // This provides a 1-hour window for the cron job to execute
  const isCorrectHour = hour === 8;
  
  if (!isCorrectHour) {
    console.log(`⏰ Not notification time. Current PST hour: ${hour}, expected: 8`);
  }
  
  return isCorrectHour;
}

/**
 * Check if it's currently evening notification time (8 PM PST/PDT)
 * @returns {boolean} True if it's within 8:00-8:59 PM PST/PDT
 */
export function isEveningNotificationTime() {
  const hour = getPacificHour();
  
  // Check if it's between 8:00 PM and 8:59 PM PST/PDT (20:00-20:59 in 24h format)
  // This provides a 1-hour window for the cron job to execute
  const isCorrectHour = hour === 20;
  
  if (!isCorrectHour) {
    console.log(`⏰ Not evening notification time. Current PST hour: ${hour}, expected: 20`);
  }
  
  return isCorrectHour;
} 