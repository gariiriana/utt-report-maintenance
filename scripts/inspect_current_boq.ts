import { BOQ_CATEGORIES_DATA } from '../frontend/data/boqAssetData';

console.log('Total categories in boqAssetData.ts:', BOQ_CATEGORIES_DATA.length);
BOQ_CATEGORIES_DATA.forEach((c, idx) => {
  const sample = c.items[0] || {};
  const hasRoom = 'Room' in sample || 'Room Location' in sample;
  const hasFloor = 'Floor' in sample;
  const hasLoc = 'Location' in sample;
  
  // Count how many items in this category lack room/location
  let emptyCount = 0;
  c.items.forEach(it => {
    const r = it['Room'] || it['Room Location'] || '';
    const f = it['Floor'] || '';
    const l = it['Location'] || '';
    if (!r && !l) emptyCount++;
  });

  console.log(`${idx + 1}. [${c.id}] ${c.name} | Items: ${c.items.length} | Missing Room/Loc: ${emptyCount}/${c.items.length} | Keys: [${Object.keys(sample).slice(0, 6).join(', ')}]`);
});
