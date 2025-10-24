/**
 * Script to protect all debug endpoints with JWT authentication
 * Run with: node scripts/protect-debug-routes.js
 */

const fs = require('fs');
const path = require('path');

// Find all debug route files
const debugRoutesDir = path.join(__dirname, '..', 'src', 'app', 'api', 'debug');

function getAllRouteFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    console.error('❌ Debug directory not found:', dir);
    return fileList;
  }

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
      } else {
        // No imports found, add at the beginning after any comments
        const firstLine = content.split('\n')[0];
        if (firstLine.startsWith('import')) {
          content = "import { withAdminAuth } from '@/lib/adminAuth';\n" + content;
        } else {
          // Skip initial comments
          const lines = content.split('\n');
          let insertIndex = 0;
          for (let i = 0; i < lines.length; i++) {
            if (!lines[i].trim().startsWith('//') && !lines[i].trim().startsWith('/*') && lines[i].trim() !== '') {
              insertIndex = i;
              break;
            }
          }
          lines.splice(insertIndex, 0, "import { withAdminAuth } from '@/lib/adminAuth';");
          content = lines.join('\n');
        }
      }
    }
    
    // Wrap all HTTP method handlers
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    
    methods.forEach(method => {
      // Match: export async function METHOD(request, context) {
      const asyncPattern = new RegExp(`export async function ${method}\\(request(?:,\\s*(?:context|\\{[^}]+\\}))?\\)\\s*{`, 'g');
      content = content.replace(asyncPattern, `export const ${method} = withAdminAuth(async (request, context) => {`);
      
      // Match: export function METHOD(request, context) {
      const syncPattern = new RegExp(`export function ${method}\\(request(?:,\\s*(?:context|\\{[^}]+\\}))?\\)\\s*{`, 'g');
      content = content.replace(syncPattern, `export const ${method} = withAdminAuth(async (request, context) => {`);
    });
    
    // Close all wrapped handlers by finding the last closing brace of each function
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
    console.log(`✅ Protected: ${path.relative(process.cwd(), filePath)}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error protecting ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🔒 Starting debug route protection...\n');

const routeFiles = getAllRouteFiles(debugRoutesDir);
console.log(`Found ${routeFiles.length} debug route files\n`);

let protected = 0;
let skipped = 0;
let errors = 0;

routeFiles.forEach(file => {
  try {
    if (protectRoute(file)) {
      protected++;
    } else {
      skipped++;
    }
  } catch (error) {
    console.error(`❌ Failed to process ${file}:`, error.message);
    errors++;
  }
});

console.log(`\n✅ Protection complete:`);
console.log(`   Protected: ${protected} files`);
console.log(`   Skipped: ${skipped} files`);
console.log(`   Errors: ${errors} files`);
console.log(`   Total: ${routeFiles.length} files`);

if (protected > 0) {
  console.log(`\n🎉 All debug endpoints are now protected with JWT authentication!`);
  console.log(`   They can only be accessed by authenticated admin users.`);
}

