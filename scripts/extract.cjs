const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'do-not-touch', 'index.html'), 'utf8');

// 1. Extract CSS
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (styleMatch) {
  fs.mkdirSync(path.join(__dirname, '..', 'src', 'styles'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'styles', 'main.css'), styleMatch[1].trim() + '\n', 'utf8');
  console.log('Extracted src/styles/main.css, size:', styleMatch[1].length, 'bytes');
} else {
  console.error('Could not find style tag');
}
