export async function GET(request) {
  const now = new Date();
  
  // Test various methods of getting Pacific time
  const tests = {
    rawNow: now.toString(),
    nowHour: now.getHours(),
    
    // Method 1: toLocaleString with timezone
    pacificString: now.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles"
    }),
    
    // Method 2: Get just the hour
    pacificHour: now.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "2-digit",
      hour12: false
    }),
    
    // Method 3: Get all parts
    pacificParts: now.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit", 
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }),
    
    // Method 4: Parse the hour
    parsedHour: parseInt(now.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "2-digit",
      hour12: false
    }))
  };
  
  // Test the actual functions
  const { isNotificationTime, isEveningNotificationTime } = await import('@/lib/timezone');
  
  return Response.json({
    success: true,
    tests,
    functions: {
      isNotificationTime: isNotificationTime(),
      isEveningNotificationTime: isEveningNotificationTime()
    }
  });
} 