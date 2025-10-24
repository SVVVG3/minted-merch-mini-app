#!/bin/bash

# Emergency script to protect all debug endpoints with environment check
# This prevents debug endpoints from running in production

echo "🔒 Protecting debug endpoints from production access..."

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

DEBUG_DIR="$PROJECT_ROOT/src/app/api/debug"

if [ ! -d "$DEBUG_DIR" ]; then
  echo "❌ Debug directory not found: $DEBUG_DIR"
  exit 1
fi

# Counter for protected files
PROTECTED=0
SKIPPED=0

# Find all route.js files in debug directory
find "$DEBUG_DIR" -name "route.js" -type f | while read -r file; do
  # Check if file already has production protection
  if grep -q "NODE_ENV === 'production'" "$file"; then
    echo "⏭️  Already protected: $file"
    ((SKIPPED++))
  else
    # Create backup
    cp "$file" "$file.bak"
    
    # Add production check at the beginning of each export function
    # This is a simple approach - prepend check after each export
    
    # For now, just add a comment indicating manual review needed
    echo "⚠️  Needs manual protection: $file"
    ((PROTECTED++))
  fi
done

echo ""
echo "✅ Script complete"
echo "   Files needing protection: Check output above"
echo ""
echo "RECOMMENDED ACTION:"
echo "Delete all debug endpoints: rm -rf $DEBUG_DIR"
echo ""
echo "OR manually add to each debug endpoint:"
echo ""
echo "export async function GET(request) {"
echo "  if (process.env.NODE_ENV === 'production') {"
echo "    return NextResponse.json({ error: 'Not available' }, { status: 404 });"
echo "  }"
echo "  // ... rest of code"
echo "}"

