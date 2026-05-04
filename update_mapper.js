const fs = require('fs');
let content = fs.readFileSync('src/integrations/googleSheets/mapper.ts', 'utf8');

// replace EwA with EwA & BD
content = content.replace(/functionCode: \"EwA\"/g, 'functionCode: \"EwA & BD\"');

// process lines with functionCode: "BD"
let lines = content.split('\n');
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('functionCode: "BD"')) {
    if (lines[i].includes('Conference')) {
      lines[i] = lines[i].replace('"BD"', '"Conference"');
    } else if (lines[i].includes('Overhead') || lines[i].includes('Overhead Costs')) {
      lines[i] = lines[i].replace('"BD"', '"NMF"');
    } else if (lines[i].includes('EwA')) {
      lines[i] = lines[i].replace('"BD"', '"EwA & BD"');
    } else {
      lines[i] = lines[i].replace('"BD"', '"EwA & BD"');
    }
  }
}
fs.writeFileSync('src/integrations/googleSheets/mapper.ts', lines.join('\n'));
console.log('Mapper updated successfully.');
