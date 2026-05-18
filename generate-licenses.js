const fetch = require('node-fetch');

const API_BASE = 'http://localhost:8008';

async function generateLicenses(count, daysValid = 365) {
  console.log(`\n🔐 Tạo ${count} licenses (${daysValid} ngày)...\n`);
  
  const licenses = [];
  
  for (let i = 0; i < count; i++) {
    try {
      const response = await fetch(`${API_BASE}/admin/create-license`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysValid })
      });
      
      const result = await response.json();
      
      if (result.success) {
        licenses.push(result);
        console.log(`[${i+1}/${count}] ✅ ${result.licenseKey}`);
      } else {
        console.log(`[${i+1}/${count}] ❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.log(`[${i+1}/${count}] ❌ Error: ${error.message}`);
    }
  }
  
  // Save to file
  const fs = require('fs');
  const filename = `licenses-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(licenses, null, 2));
  
  console.log(`\n✅ Đã tạo ${licenses.length}/${count} licenses!`);
  console.log(`📄 Saved to: ${filename}\n`);
  
  // Also save as CSV
  const csvFilename = `licenses-${Date.now()}.csv`;
  const csv = 'License Key,Expiry Date,Days Valid\n' + 
    licenses.map(l => `${l.licenseKey},${l.expiryDate},${l.daysValid}`).join('\n');
  fs.writeFileSync(csvFilename, csv);
  console.log(`📄 CSV saved to: ${csvFilename}\n`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const count = parseInt(args[0]) || 10;
const days = parseInt(args[1]) || 365;

generateLicenses(count, days);
