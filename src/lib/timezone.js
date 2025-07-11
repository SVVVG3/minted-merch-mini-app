// Timezone utilities for PST/PDT daily check-in system
// Handles 8 AM PST daily reset for check-ins and notifications

/**
 * Get the current time in PST/PDT timezone
 * @returns {Date} Current date/time in PST timezone
 */
export function getCurrentPSTTime() {
  // PST is UTC-8, PDT is UTC-7
  // JavaScript automatically handles DST transitions
  const now = new Date();
  const pstOffset = -8 * 60; // PST is UTC-8 (in minutes)
  const pdtOffset = -7 * 60; // PDT is UTC-7 (in minutes)
  
  // Create a date in PST/PDT timezone
  const pstTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  return pstTime;
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
 * @returns {boolean} True if it's within 8:00-8:15 AM PST/PDT
 */
export function isNotificationTime() {
  const pstTime = getCurrentPSTTime();
  const hour = pstTime.getHours();
  const minute = pstTime.getMinutes();
  
  // Return true if it's between 8:00 AM and 8:15 AM PST/PDT
  // This gives a 15-minute window for cron job execution reliability
  return hour === 8 && minute >= 0 && minute <= 15;
}

/**
 * Check if it's currently evening notification time (8 PM PST/PDT)
 * @returns {boolean} True if it's within 8:00-8:15 PM PST/PDT
 */
export function isEveningNotificationTime() {
  const pstTime = getCurrentPSTTime();
  const hour = pstTime.getHours();
  const minute = pstTime.getMinutes();
  
  // Return true if it's between 8:00 PM and 8:15 PM PST/PDT
  // This gives a 15-minute window for cron job execution reliability
  return hour === 20 && minute >= 0 && minute <= 15;
} 