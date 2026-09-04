import { BOQ_CATEGORIES_DATA } from '../frontend/data/boqAssetData.js';

console.log('Total categories in boqAssetData.ts:', BOQ_CATEGORIES_DATA.length);
BOQ_CATEGORIES_DATA.forEach((c, idx) => {
  console.log(`${idx + 1}. [${c.id}] ${c.name} | Group: ${c.group} | Items: ${c.items.length} | Headers: [${c.headers.slice(0, 5).join(', ')}]`);
});
