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

// === Region generation: random BFS ===
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

// === Solver ===
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

// === Contiguity check ===
function isContiguous(grid, n) {
  const visited = Array.from({length: n}, () => Array(n).fill(false));
  for (let reg = 0; reg < n; reg++) {
    let found = false;
    let sr = -1, sc = -1;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (grid[r][c] === reg && !found) { found = true; sr = r; sc = c; }
    }
    if (!found) return false;
    // BFS from seed
    const queue = [[sr, sc]];
    visited[sr][sc] = true;
    let count = 1;
    let total = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (grid[r][c] === reg) total++;
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
    if (count !== total) return false;
  }
  return true;
}

// === Tests ===
const ATTEMPTS = 1000;

console.log('=== Approach 1: Random BFS regions ===');
for (let n = 5; n <= 10; n++) {
  let unique = 0, zero = 0, multi = 0;
  const startTime = Date.now();
  for (let t = 0; t < ATTEMPTS; t++) {
    const grid = generateRegionsRandom(n);
    const sols = countSolutions(grid, n, 2);
    if (sols.length === 0) zero++;
    else if (sols.length === 1) unique++;
    else multi++;
  }
  const elapsed = Date.now() - startTime;
  console.log(`n=${n}: unique=${unique}, zero=${zero}, multi=${multi}, rate=${(unique/ATTEMPTS*100).toFixed(1)}%, time=${elapsed}ms`);
}

console.log('\n=== Approach 2: BFS from cat positions ===');
for (let n = 5; n <= 10; n++) {
  let unique = 0, zero = 0, multi = 0;
  const startTime = Date.now();
  for (let t = 0; t < ATTEMPTS; t++) {
    const cats = placeCats(n);
    if (!cats) { console.log(`n=${n}: failed to place cats`); break; }
    const grid = generateRegionsFromCats(cats, n);
    const sols = countSolutions(grid, n, 2);
    if (sols.length === 0) zero++;
    else if (sols.length === 1) unique++;
    else multi++;
  }
  const elapsed = Date.now() - startTime;
  console.log(`n=${n}: unique=${unique}, zero=${zero}, multi=${multi}, rate=${(unique/ATTEMPTS*100).toFixed(1)}%, time=${elapsed}ms`);
}
