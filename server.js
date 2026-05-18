const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database
const db = new sqlite3.Database('./licenses.db', (err) => {
  if (err) {
    console.error('❌ Database error:', err);
  } else {
    console.log('✅ Connected to licenses database');
    initDatabase();
  }
});

// Initialize database
function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT UNIQUE NOT NULL,
      hardware_id TEXT,
      expiry_date TEXT NOT NULL,
      features TEXT DEFAULT '["all"]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      activated_at TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT
    )
  `, (err) => {
    if (err) {
      console.error('❌ Table creation error:', err);
    } else {
      console.log('✅ Licenses table ready');
    }
  });
}

// ============================================================================
// LICENSE VALIDATION API
// ============================================================================

app.post('/license/validate', (req, res) => {
  const { licenseKey, hardwareId, appVersion, appId } = req.body;

  console.log(`📝 Validation request: ${licenseKey} | HW: ${hardwareId?.substring(0, 8)}...`);

  if (!licenseKey || !hardwareId) {
    return res.json({ valid: false, message: 'Missing parameters' });
  }

  db.get(
    'SELECT * FROM licenses WHERE license_key = ?',
    [licenseKey],
    (err, row) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.json({ valid: false, message: 'Database error' });
      }

      if (!row) {
        console.log('❌ License not found');
        return res.json({ valid: false, message: 'License key không tồn tại' });
      }

      // Check status
      if (row.status !== 'active') {
        console.log('❌ License inactive');
        return res.json({ valid: false, message: 'License đã bị vô hiệu hóa' });
      }

      // Check expiry
      const now = new Date();
      const expiry = new Date(row.expiry_date);
      if (now > expiry) {
        console.log('❌ License expired');
        return res.json({ valid: false, message: 'License đã hết hạn' });
      }

      // Check hardware binding
      if (row.hardware_id) {
        if (row.hardware_id !== hardwareId) {
          console.log('❌ Hardware mismatch');
          return res.json({ 
            valid: false, 
            message: 'License đã được kích hoạt trên máy khác' 
          });
        }
      } else {
        // First activation - bind hardware ID
        db.run(
          'UPDATE licenses SET hardware_id = ?, activated_at = CURRENT_TIMESTAMP WHERE license_key = ?',
          [hardwareId, licenseKey],
          (err) => {
            if (err) console.error('❌ Binding error:', err);
            else console.log('✅ Hardware bound');
          }
        );
      }

      // Valid license
      console.log('✅ License valid');
      res.json({
        valid: true,
        expiryDate: row.expiry_date,
        features: JSON.parse(row.features || '["all"]'),
        message: 'License hợp lệ'
      });
    }
  );
});

// ============================================================================
// ADMIN APIs
// ============================================================================

// Create license
app.post('/admin/create-license', (req, res) => {
  const { daysValid = 365, features = ['all'], notes = '' } = req.body;

  const licenseKey = generateLicenseKey();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + daysValid);

  db.run(
    'INSERT INTO licenses (license_key, expiry_date, features, notes) VALUES (?, ?, ?, ?)',
    [licenseKey, expiryDate.toISOString(), JSON.stringify(features), notes],
    function(err) {
      if (err) {
        console.error('❌ Create error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log(`✅ Created license: ${licenseKey}`);
      res.json({
        success: true,
        licenseKey,
        expiryDate: expiryDate.toISOString(),
        daysValid
      });
    }
  );
});

// List all licenses
app.get('/admin/licenses', (req, res) => {
  db.all('SELECT * FROM licenses ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ licenses: rows });
  });
});

// Get license details
app.get('/admin/license/:key', (req, res) => {
  db.get('SELECT * FROM licenses WHERE license_key = ?', [req.params.key], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'License not found' });
    }
    res.json(row);
  });
});

// Deactivate license
app.post('/admin/deactivate/:key', (req, res) => {
  db.run(
    'UPDATE licenses SET status = ? WHERE license_key = ?',
    ['inactive', req.params.key],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, message: 'License deactivated' });
    }
  );
});

// Reset hardware binding
app.post('/admin/reset-hardware/:key', (req, res) => {
  db.run(
    'UPDATE licenses SET hardware_id = NULL, activated_at = NULL WHERE license_key = ?',
    [req.params.key],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, message: 'Hardware binding reset' });
    }
  );
});

// Extend license
app.post('/admin/extend/:key', (req, res) => {
  const { days = 365 } = req.body;
  
  db.get('SELECT expiry_date FROM licenses WHERE license_key = ?', [req.params.key], (err, row) => {
    if (err || !row) {
      return res.status(500).json({ error: 'License not found' });
    }
    
    const newExpiry = new Date(row.expiry_date);
    newExpiry.setDate(newExpiry.getDate() + days);
    
    db.run(
      'UPDATE licenses SET expiry_date = ? WHERE license_key = ?',
      [newExpiry.toISOString(), req.params.key],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ 
          success: true, 
          newExpiryDate: newExpiry.toISOString(),
          message: `Extended by ${days} days`
        });
      }
    );
  });
});

// ============================================================================
// UTILITIES
// ============================================================================

function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) key += '-';
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 8008;
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║   🔐 TVT LICENSE SERVER                                    ║');
  console.log('║                                                            ║');
  console.log('║   Server running on: http://localhost:' + PORT + '              ║');
  console.log('║   Dashboard: http://localhost:' + PORT + '/dashboard.html      ║');
  console.log('║                                                            ║');
  console.log('║   API Endpoints:                                           ║');
  console.log('║   POST /license/validate                                   ║');
  console.log('║   POST /admin/create-license                               ║');
  console.log('║   GET  /admin/licenses                                     ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  db.close((err) => {
    if (err) console.error(err);
    else console.log('✅ Database closed');
    process.exit(0);
  });
});
