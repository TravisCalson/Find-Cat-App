'use strict';

// === Cat placement ===
function placeCats(n) {
  for (let attempt = 0; attempt < 100000; attempt++) {
    const perm = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    let valid = true;
    for (let r = 0; r < n - 1; r++) {
      if (Math.abs(perm[r] - perm[r + 1]) <= 1) { valid = false; break; }
    }
    if (valid) {
      const cats = Array.from({length: n}, () => Array(n).fill(false));
      for (let r = 0; r < n; r++) cats[r][perm[r]] = true;
      return cats;
    }
  }
  return null;
}

// === Region generation: BFS from cat positions ===
function generateRegionsFromCats(cats, n) {
  const grid = Array.from({length: n}, () => Array(n).fill(-1));
  const frontier = [];
  let regIdx = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (cats[r][c]) {
        grid[r][c] = regIdx;
        frontier.push([r, c, regIdx]);
        regIdx++;
      }
    }
  }
  while (frontier.length > 0) {
    const idx = Math.floor(Math.random() * frontier.length);
    const [r, c, reg] = frontier[idx];
    frontier[idx] = frontier[frontier.length - 1];
    frontier.pop();
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n && grid[nr][nc] === -1) {
        grid[nr][nc] = reg;
        frontier.push([nr, nc, reg]);
      }
    }
  }
  return grid;
}

// === Solver (returns up to maxCount solutions) ===
function countSolutions(grid, n, maxCount = 2) {
  const solutions = [];
  const available = Array.from({length: n}, () => Array(n).fill(true));
  const rowDone = Array(n).fill(false);
  const regionUsed = Array(n).fill(false);
  const placed = [];

  function mark(r, c, changes) {
    function set(i, j) {
      if (available[i][j]) { available[i][j] = false; changes.push([i, j]); }
    }
    for (let i = 0; i < n; i++) set(r, i);
    for (let i = 0; i < n; i++) set(i, c);
    const reg = grid[r][c];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (grid[i][j] === reg) set(i, j);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n) set(nr, nc);
    }
  }

  function backtrack() {
    if (solutions.length >= maxCount) return;
    if (placed.length === n) { solutions.push([...placed]); return; }
    let bestRow = -1, bestCols = null;
    for (let r = 0; r < n; r++) {
      if (rowDone[r]) continue;
      const cols = [];
      for (let c = 0; c < n; c++) if (available[r][c]) cols.push(c);
      if (cols.length === 0) return;
      if (!bestCols || cols.length < bestCols.length) { bestRow = r; bestCols = cols; }
    }
    rowDone[bestRow] = true;
    for (const c of bestCols) {
      const reg = grid[bestRow][c];
      if (regionUsed[reg]) continue;
      const changes = [];
      mark(bestRow, c, changes);
      regionUsed[reg] = true;
      placed.push([bestRow, c]);
      backtrack();
      placed.pop();
      regionUsed[reg] = false;
      for (const [i, j] of changes) available[i][j] = true;
      if (solutions.length >= maxCount) break;
    }
    rowDone[bestRow] = false;
  }

  backtrack();
  return solutions;
}

// === Contiguity check for a single region ===
function isRegionContiguous(grid, n, reg) {
  let sr = -1, sc = -1, total = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (grid[r][c] === reg) { total++; if (sr < 0) { sr = r; sc = c; } }
  }
  if (total === 0) return true; // empty region is OK during growth
  const visited = Array.from({length: n}, () => Array(n).fill(false));
  const queue = [[sr, sc]];
  visited[sr][sc] = true;
  let count = 1;
  while (queue.length > 0) {
    const [r, c] = queue.shift();
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n && grid[nr][nc] === reg && !visited[nr][nc]) {
        visited[nr][nc] = true;
        count++;
        queue.push([nr, nc]);
      }
    }
  }
  return count === total;
}

// === Full contiguity check ===
function isFullyContiguous(grid, n) {
  for (let reg = 0; reg < n; reg++) {
    if (!isRegionContiguous(grid, n, reg)) return false;
  }
  return true;
}

// === Targeted perturbation: move cells to block alternative solutions ===
function perturbToBlock(grid, cats, n, altSolution, maxMoves = 5) {
  // altSolution: array of [r,c] positions (the alternative cat placement)
  // Find cells where alt has a cat but we want to block it
  // Strategy: move alt cat cells into regions that already have an alt cat
  // This creates 2+ cats in a region for the alt, blocking it.

  const altSet = new Set(altSolution.map(([r,c]) => r * n + c));
  const intendedSet = new Set();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (cats[r][c]) intendedSet.add(r * n + c);

  // Find cells that are in alt but not in intended (these are the "displaced" cells)
  const displaced = [];
  for (const [r, c] of altSolution) {
    if (!intendedSet.has(r * n + c)) displaced.push([r, c]);
  }

  if (displaced.length === 0) return grid; // can't block

  // Try to move displaced cells to regions that already have an alt cat
  // First, find which regions have alt cats
  const regionAltCount = Array(n).fill(0);
  for (const [r, c] of altSolution) {
    regionAltCount[grid[r][c]]++;
  }

  // Find a region with 2+ alt cats (shouldn't exist if alt is a valid solution)
  // Or find a region with 0 alt cats and move a displaced cell there
  // Actually, since alt is a valid solution, each region has exactly 1 alt cat.
  // To block, we need to move a displaced cell to a region that already has an alt cat.

  for (const [r, c] of displaced) {
    const currentReg = grid[r][c];
    // Find adjacent regions that have an alt cat
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n) {
        const adjReg = grid[nr][nc];
        if (adjReg !== currentReg && regionAltCount[adjReg] > 0) {
          // Move (r,c) to adjReg
          // Check contiguity: (r,c) must remain connected to currentReg after removal
          // And (r,c) will be connected to adjReg (since it's adjacent)
          const savedGrid = grid[r][c];
          grid[r][c] = adjReg;
          if (isRegionContiguous(grid, n, currentReg) && isRegionContiguous(grid, n, adjReg)) {
            // Check if this blocks the alt
            const sols = countSolutions(grid, n, 2);
            if (sols.length < 2) return grid; // blocked!
          }
          grid[r][c] = savedGrid; // undo
        }
      }
    }
  }

  return grid; // couldn't block
}

// === Main generation: cats-first + BFS + perturbation ===
function generateWithPerturbation(n, deadline) {
  while (Date.now() < deadline) {
    const cats = placeCats(n);
    if (!cats) return null;
    let grid = generateRegionsFromCats(cats, n);
    const sols = countSolutions(grid, n, 2);
    if (sols.length === 1) return { grid, cats: sols[0] };

    // Try perturbation to block alternative
    if (sols.length === 2) {
      // Find the alternative (the one that's not the intended)
      const intendedKey = cats2Key(cats, n);
      const alt = sols.find(s => cats2Key(s, n) !== intendedKey);
      if (alt) {
        grid = perturbToBlock(grid, cats, n, alt, 5);
        const sols2 = countSolutions(grid, n, 2);
        if (sols2.length === 1) return { grid, cats: sols2[0] };
      }
    }
  }
  return null;
}

function cats2Key(cats, n) {
  if (Array.isArray(cats) && Array.isArray(cats[0]) && typeof cats[0][0] === 'boolean') {
    // boolean grid
    const key = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (cats[r][c]) key.push(r * n + c);
    return key.join(',');
  }
  // array of [r,c]
  return cats.map(([r,c]) => r * n + c).join(',');
}

// === Approach 1: random BFS with retries ===
function generateRegionsRandom(n) {
  const grid = Array.from({length: n}, () => Array(n).fill(-1));
  const cells = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cells.push([i, j]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const frontier = [];
  for (let i = 0; i < n; i++) {
    const [r, c] = cells[i];
    grid[r][c] = i;
    frontier.push([r, c, i]);
  }
  while (frontier.length > 0) {
    const idx = Math.floor(Math.random() * frontier.length);
    const [r, c, reg] = frontier[idx];
    frontier[idx] = frontier[frontier.length - 1];
    frontier.pop();
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n && grid[nr][nc] === -1) {
        grid[nr][nc] = reg;
        frontier.push([nr, nc, reg]);
      }
    }
  }
  return grid;
}

function generateApproach1(n, deadline) {
  while (Date.now() < deadline) {
    const grid = generateRegionsRandom(n);
    const sols = countSolutions(grid, n, 2);
    if (sols.length === 1) return { grid, cats: sols[0] };
  }
  return null;
}

// === Tests ===
const RUNS = 20;
const TIMEOUT = 8000;

console.log('=== Approach 1: Random BFS with retries (8s timeout) ===');
for (let n = 5; n <= 10; n++) {
  let successes = 0, times = [];
  for (let run = 0; run < RUNS; run++) {
    const deadline = Date.now() + TIMEOUT;
    const start = Date.now();
    const result = generateApproach1(n, deadline);
    const elapsed = Date.now() - start;
    if (result) { successes++; times.push(elapsed); }
  }
  const avgTime = times.length > 0 ? Math.round(times.reduce((a,b)=>a+b,0)/times.length) : -1;
  console.log(`n=${n}: ${successes}/${RUNS} success, avgTime=${avgTime}ms`);
}

console.log('\n=== Approach 2+BFS+perturbation (8s timeout) ===');
for (let n = 5; n <= 10; n++) {
  let successes = 0, times = [];
  for (let run = 0; run < RUNS; run++) {
    const deadline = Date.now() + TIMEOUT;
    const start = Date.now();
    const result = generateWithPerturbation(n, deadline);
    const elapsed = Date.now() - start;
    if (result) { successes++; times.push(elapsed); }
  }
  const avgTime = times.length > 0 ? Math.round(times.reduce((a,b)=>a+b,0)/times.length) : -1;
  console.log(`n=${n}: ${successes}/${RUNS} success, avgTime=${avgTime}ms`);
}
