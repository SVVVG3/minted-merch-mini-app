// Timezone utilities for PST/PDT daily check-in system
// Handles 8 AM PST/PDT daily reset for check-ins and notifications
// Note: PST is UTC-8 (winter), PDT is UTC-7 (summer)
// 
// DST-PROOF SOLUTION: Run cron at BOTH 15:00 UTC and 16:00 UTC
// - Winter (PST): 15:00 UTC = 7 AM (skip), 16:00 UTC = 8 AM (send) ✅
// - Summer (PDT): 15:00 UTC = 8 AM (send) ✅, 16:00 UTC = 9 AM (skip)
// Time validation ensures notifications only send during the correct hour (8 AM local time)

/**
 * Get the current time in PST/PDT timezone
 * @returns {Date} Current date/time in PST timezone
 */
export function getCurrentPSTTime() {
  // Get current UTC time
  const now = new Date();
  
  // Use Intl.DateTimeFormat to get the time in Pacific timezone
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
  
  // Create a new Date object in UTC that represents the Pacific time
  // We use Date.UTC to create a timestamp, treating Pacific components as if they were UTC
  const pacificTime = new Date(Date.UTC(
    parseInt(getValue('year')),
    parseInt(getValue('month')) - 1, // Month is 0-indexed
    parseInt(getValue('day')),
    parseInt(getValue('hour')),
    parseInt(getValue('minute')),
    parseInt(getValue('second'))
  ));
  
  return pacificTime;
}

/**
 * Get the current check-in day in PST timezone
 * A check-in day starts at 8 AM PST and ends at 7:59 AM PST the next day
 * @returns {string} Check-in day in YYYY-MM-DD format
 */
export function getCurrentCheckInDay() {
  const pstTime = getCurrentPSTTime();
  const hour = pstTime.getHours();
  
  // If it's before 8 AM PST, use the previous day as the check-in day
  if (hour < 8) {
    const yesterday = new Date(pstTime);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  
  // If it's 8 AM PST or later, use the current day
  return pstTime.toISOString().split('T')[0];
}

/**
 * Get the next 8 AM PST reset time
 * @returns {Date} Next 8 AM PST as a Date object
 */
export function getNext8AMPST() {
  const pstTime = getCurrentPSTTime();
  const hour = pstTime.getHours();
  
  // Create next 8 AM PST
  const next8AM = new Date(pstTime);
  next8AM.setHours(8, 0, 0, 0);
  
  // If it's already past 8 AM today, move to tomorrow
  if (hour >= 8) {
    next8AM.setDate(next8AM.getDate() + 1);
  }
  
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
 * @returns {boolean} True if it's within 8:00-9:00 AM PST/PDT
 */
export function isNotificationTime() {
  const pstTime = getCurrentPSTTime();
  const hour = pstTime.getHours();
  
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
 * @returns {boolean} True if it's within 8:00-9:00 PM PST/PDT
 */
export function isEveningNotificationTime() {
  const pstTime = getCurrentPSTTime();
  const hour = pstTime.getHours();
  
  // Check if it's between 8:00 PM and 8:59 PM PST/PDT (20:00-20:59 in 24h format)
  // This provides a 1-hour window for the cron job to execute
  const isCorrectHour = hour === 20;
  
  if (!isCorrectHour) {
    console.log(`⏰ Not evening notification time. Current PST hour: ${hour}, expected: 20`);
  }
  
  return isCorrectHour;
} 