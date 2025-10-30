/**
 * Emergency script to protect all admin routes with JWT authentication
 * Run with: node scripts/protect-all-admin-routes.js
 */

const fs = require('fs');
const path = require('path');

// Routes to exclude (login and auth routes)
const EXCLUDED_ROUTES = ['login/route.js', 'auth/route.js'];

// Find all admin route files
const adminRoutesDir = path.join(__dirname, '..', 'src', 'app', 'api', 'admin');

function getAllRouteFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllRouteFiles(filePath, fileList);
    } else if (file === 'route.js') {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function shouldProtectRoute(filePath) {
  return !EXCLUDED_ROUTES.some(excluded => filePath.includes(excluded));
}

function protectRoute(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if already protected
    if (content.includes('withAdminAuth')) {
      console.log(`⏭️  Already protected: ${filePath}`);
      return false;
    }
    
    // Add import if not present
    if (!content.includes("from '@/lib/adminAuth'")) {
      // Find the last import statement
      const importRegex = /import .+ from .+;/g;
      const imports = content.match(importRegex);
      
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        content = content.replace(
          lastImport,
          lastImport + "\nimport { withAdminAuth } from '@/lib/adminAuth';"
        );
      }
    }
    
    // Wrap GET handler
    content = content.replace(
      /export async function GET\(request(?:,\s*context)?\)\s*{/g,
      'export const GET = withAdminAuth(async (request, context) => {'
    );
    
    // Wrap POST handler
    content = content.replace(
      /export async function POST\(request(?:,\s*context)?\)\s*{/g,
      'export const POST = withAdminAuth(async (request, context) => {'
    );
    
    // Wrap PUT handler
    content = content.replace(
      /export async function PUT\(request(?:,\s*context)?\)\s*{/g,
      'export const PUT = withAdminAuth(async (request, context) => {'
    );
    
    // Wrap DELETE handler
    content = content.replace(
      /export async function DELETE\(request(?:,\s*context)?\)\s*{/g,
      'export const DELETE = withAdminAuth(async (request, context) => {'
    );
    
    // Wrap PATCH handler
    content = content.replace(
      /export async function PATCH\(request(?:,\s*context)?\)\s*{/g,
      'export const PATCH = withAdminAuth(async (request, context) => {'
    );
    
    // Find and close all handler functions with closing parenthesis
    // This is tricky - we need to find the last closing brace of each handler
    // For now, let's use a simpler approach - match the pattern more carefully
    
    // Replace the final closing brace of async functions with });
    // This assumes proper code formatting
    const lines = content.split('\n');
    let inFunction = false;
    let braceCount = 0;
    let functionStart = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this is a wrapped export
      if (line.includes('export const') && line.includes('withAdminAuth')) {
        inFunction = true;
        functionStart = i;
        braceCount = 0;
      }
      
      if (inFunction) {
        // Count braces
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
        
        // If we've closed all braces, this is the end of the function
        if (braceCount === 0 && line.trim() === '}') {
          lines[i] = '});';
          inFunction = false;
        }
      }
    }
    
    content = lines.join('\n');
    
    // Write back
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Protected: ${filePath}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error protecting ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🔒 Starting admin route protection...\n');

const routeFiles = getAllRouteFiles(adminRoutesDir);
console.log(`Found ${routeFiles.length} route files\n`);

let protected = 0;
let skipped = 0;

routeFiles.forEach(file => {
  if (shouldProtectRoute(file)) {
    if (protectRoute(file)) {
      protected++;
    } else {
      skipped++;
    }
  } else {
    console.log(`⏭️  Excluding: ${file}`);
    skipped++;
  }
});

console.log(`\n✅ Protection complete:`);
console.log(`   Protected: ${protected} files`);
console.log(`   Skipped: ${skipped} files`);
console.log(`   Total: ${routeFiles.length} files`);

