// Debug endpoint for testing PST timezone logic
// Demonstrates 8 AM PST reset logic and check-in day calculations

import { withAdminAuth } from '@/lib/adminAuth';
import { 
  getCurrentPSTTime, 
  getCurrentCheckInDay, 
  getNext8AMPST, 
  isSameCheckInDay,
  canCheckInTodayPST,
  calculateStreakPST,
  getTimeUntilReset,
  formatPSTTime,
  isNotificationTime
} from '../../../../lib/timezone.js';

export const GET = withAdminAuth(async (request, context) => {
  try {
    const url = new URL(request.url);
    const testDate = url.searchParams.get('testDate'); // YYYY-MM-DD format
    
    // Get current PST time information
    const currentPSTTime = getCurrentPSTTime();
    const currentCheckInDay = getCurrentCheckInDay();
    const next8AM = getNext8AMPST();
    const timeUntilReset = getTimeUntilReset();
    const isNotificationTimeNow = isNotificationTime();

    // Test data
    const testResults = {
      currentPSTTime: formatPSTTime(currentPSTTime),
      currentCheckInDay: currentCheckInDay,
      next8AMPST: formatPSTTime(next8AM),
      timeUntilReset: {
        hours: timeUntilReset.hours,
        minutes: timeUntilReset.minutes,
        seconds: timeUntilReset.seconds,
        formatted: `${timeUntilReset.hours}h ${timeUntilReset.minutes}m ${timeUntilReset.seconds}s`
      },
      isNotificationTime: isNotificationTimeNow,
      hour: currentPSTTime.getHours(),
      minute: currentPSTTime.getMinutes()
    };

    // Test check-in scenarios
    const scenarios = [
      {
        name: "First time user (no previous check-in)",
        lastCheckinDate: null,
        canCheckIn: canCheckInTodayPST(null),
        newStreak: calculateStreakPST(null, 0)
      },
      {
        name: "User checked in yesterday",
        lastCheckinDate: getYesterdayCheckInDay(),
        canCheckIn: canCheckInTodayPST(getYesterdayCheckInDay()),
        newStreak: calculateStreakPST(getYesterdayCheckInDay(), 3)
      },
      {
        name: "User already checked in today",
        lastCheckinDate: currentCheckInDay,
        canCheckIn: canCheckInTodayPST(currentCheckInDay),
        newStreak: calculateStreakPST(currentCheckInDay, 5)
      },
      {
        name: "User checked in 2 days ago (streak broken)",
        lastCheckinDate: getTwoDaysAgoCheckInDay(),
        canCheckIn: canCheckInTodayPST(getTwoDaysAgoCheckInDay()),
        newStreak: calculateStreakPST(getTwoDaysAgoCheckInDay(), 7)
      }
    ];

    // Test custom date if provided
    let customDateTest = null;
    if (testDate) {
      customDateTest = {
        testDate: testDate,
        isSameCheckInDay: isSameCheckInDay(testDate),
        canCheckIn: canCheckInTodayPST(testDate),
        newStreak: calculateStreakPST(testDate, 2)
      };
    }

    // Examples of how check-in day works
    const examples = [
      {
        description: "7:59 AM PST - Still previous day's check-in period",
        hour: 7,
        minute: 59,
        checkInDay: getPreviousCheckInDay()
      },
      {
        description: "8:00 AM PST - New check-in day begins",
        hour: 8,
        minute: 0,
        checkInDay: currentCheckInDay
      },
      {
        description: "11:30 AM PST - Current check-in day",
        hour: 11,
        minute: 30,
        checkInDay: currentCheckInDay
      },
      {
        description: "7:59 AM PST next day - Still current check-in day",
        hour: 7,
        minute: 59,
        checkInDay: currentCheckInDay
      }
    ];

    return Response.json({
      success: true,
      message: 'PST timezone test results',
      currentStatus: testResults,
      checkInScenarios: scenarios,
      customDateTest: customDateTest,
      examples: examples,
      explanation: {
        checkInDay: "A check-in day starts at 8 AM PST and ends at 7:59 AM PST the next day",
        streak: "Users maintain streaks by checking in once per check-in day",
        notifications: "Daily notifications are sent at 8 AM PST when a new check-in day begins"
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in PST timezone test API:', error);
    
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});

// Helper functions for test scenarios
function getYesterdayCheckInDay() {
  const currentCheckInDay = getCurrentCheckInDay();
  const yesterday = new Date(currentCheckInDay);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

function getTwoDaysAgoCheckInDay() {
  const currentCheckInDay = getCurrentCheckInDay();
  const twoDaysAgo = new Date(currentCheckInDay);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  return twoDaysAgo.toISOString().split('T')[0];
}

function getPreviousCheckInDay() {
  const currentCheckInDay = getCurrentCheckInDay();
  const previous = new Date(currentCheckInDay);
  previous.setDate(previous.getDate() - 1);
  return previous.toISOString().split('T')[0];
}

export const POST = withAdminAuth(async (request, context) => {
  try {
    const body = await request.json();
    const { userFid, lastCheckinDate, currentStreak } = body;

    if (!userFid) {
      return Response.json({
        success: false,
        error: 'userFid is required'
      }, { status: 400 });
    }

    const fid = parseInt(userFid);
    if (isNaN(fid) || fid <= 0) {
      return Response.json({
        success: false,
        error: 'Invalid userFid'
      }, { status: 400 });
    }

    // Test check-in logic for specific user scenario
    const canCheckIn = canCheckInTodayPST(lastCheckinDate);
    const newStreak = calculateStreakPST(lastCheckinDate, currentStreak || 0);

    return Response.json({
      success: true,
      userFid: fid,
      input: {
        lastCheckinDate: lastCheckinDate,
        currentStreak: currentStreak || 0
      },
      results: {
        canCheckInToday: canCheckIn,
        newStreak: newStreak,
        currentCheckInDay: getCurrentCheckInDay(),
        currentPSTTime: formatPSTTime()
      },
      explanation: canCheckIn 
        ? "User can check in - they haven't checked in during the current check-in day"
        : "User cannot check in - they already checked in during the current check-in day"
    }, { status: 200 });

  } catch (error) {
    console.error('Error in PST timezone test POST:', error);
    
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});