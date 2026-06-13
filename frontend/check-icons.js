import fs from 'fs';
import path from 'path';
import * as Lucide from 'lucide-react';

const files = fs.readdirSync('./src/pages/admin-tabs').filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const content = fs.readFileSync(path.join('./src/pages/admin-tabs', file), 'utf8');
  const match = content.match(/import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/);
  if (match) {
    const icons = match[1].split(',').map(s => s.trim()).filter(s => s);
    for (const icon of icons) {
      if (!Lucide[icon]) {
        console.log(`Missing icon ${icon} in ${file}`);
      }
    }
  }
}
