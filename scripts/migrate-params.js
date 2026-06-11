// One-time script: migrate Next.js 14 params → Next.js 16 async params
// Updates all route.ts files in dynamic segment dirs
const fs = require('fs');
const path = require('path');

function findRoutesInDynamicDirs(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let hasDynamic = false;
  for (const e of entries) {
    if (e.isDirectory()) {
      if (e.name.startsWith('[') && e.name.endsWith(']')) hasDynamic = true;
      findRoutesInDynamicDirs(path.join(dir, e.name), results);
    }
  }
  // Also check if THIS dir has a route.ts AND is under a dynamic ancestor
  const routeFile = path.join(dir, 'route.ts');
  if (fs.existsSync(routeFile)) results.push(routeFile);
  return results;
}

// Find all route.ts files
const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');
const all = findRoutesInDynamicDirs(apiDir);

// Filter to only those in dynamic segment paths
const dynamic = all.filter(f => f.includes('['));

let fixed = 0;
let skipped = 0;

for (const file of dynamic) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // 1. Update type annotations: params: { X: string } → params: Promise<{ X: string }>
  //    Handles: params: { X: string } and params: { X: string; Y: string }
  content = content.replace(/params:\s*\{\s*([^}]+)\}/g, (match, inner) => {
    // Don't double-wrap if already Promise<>
    if (match.includes('Promise<')) return match;
    return `params: Promise<{ ${inner.trim()} }>`;
  });

  // 2. Replace params.X with (await params).X in function bodies
  //    (params in type annotations never uses dot notation, so this is safe globally)
  content = content.replace(/\bparams\.([a-zA-Z][a-zA-Z0-9]*)/g, '(await params).$1');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('✓', path.relative(path.join(__dirname, '..'), file));
    fixed++;
  } else {
    console.log('–', path.relative(path.join(__dirname, '..'), file), '(no change)');
    skipped++;
  }
}

console.log(`\nDone: ${fixed} fixed, ${skipped} skipped`);
