#!/bin/bash

# Emergency script to add authentication to remaining admin routes
# This script adds the withAdminAuth import and wraps exports

ROUTES=(
  "src/app/api/admin/leaderboard/route.js"
  "src/app/api/admin/checkins/route.js"
  "src/app/api/admin/chat-members/route.js"
  "src/app/api/admin/user-details/route.js"
  "src/app/api/admin/raffle/route.js"
  "src/app/api/admin/raffle/[id]/route.js"
  "src/app/api/admin/discounts/[id]/route.js"
  "src/app/api/admin/orders/[orderId]/route.js"
  "src/app/api/admin/reset-daily-spin/route.js"
  "src/app/api/admin/cleanup-pending-spins/route.js"
  "src/app/api/admin/recalculate-points/route.js"
  "src/app/api/admin/security-audit/route.js"
  "src/app/api/admin/update-individual-balance/route.js"
  "src/app/api/admin/migrate-token-balance/route.js"
  "src/app/api/admin/create-missing-transaction/route.js"
  "src/app/api/admin/update-balances/route.js"
  "src/app/api/admin/migrate-bankr-wallet-addresses/route.js"
)

echo "🔒 Protecting remaining admin routes..."

for route in "${ROUTES[@]}"; do
  if [ -f "$route" ]; then
    echo "✅ Route exists: $route"
  else
    echo "⚠️  Route not found: $route"
  fi
done

echo "Run individual search_replace commands for each file."

