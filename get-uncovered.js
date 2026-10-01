const fs = require('fs');
const file = process.argv[2];
const cov = JSON.parse(fs.readFileSync('coverage/coverage-final.json', 'utf8'));

for (const key of Object.keys(cov)) {
  if (key.includes(file)) {
    const data = cov[key];
    console.log(`Uncovered lines in ${file}:`);
    const s = data.s;
    const sMap = data.statementMap;
    const uncoveredLines = [];
    for (const [id, count] of Object.entries(s)) {
      if (count === 0 && sMap[id]) {
        uncoveredLines.push(sMap[id].start.line);
      }
    }
    console.log([...new Set(uncoveredLines)].sort((a,b)=>a-b).join(', '));
    
    console.log(`Uncovered branches in ${file}:`);
    const b = data.b;
    const bMap = data.branchMap;
    const uncoveredBranches = [];
    for (const [id, counts] of Object.entries(b)) {
      counts.forEach((count, idx) => {
        if (count === 0 && bMap[id]) {
          uncoveredBranches.push(`Line ${bMap[id].line} (branch ${idx})`);
        }
      });
    }
    console.log(uncoveredBranches.join('\n'));
    console.log('---');
  }
}
