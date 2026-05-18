# 🔐 TVT License Server

License server cho **TVT TikTok Studio Captcha v1.0**

## 📋 Yêu cầu

- Node.js 14+ (https://nodejs.org)
- Windows/Linux/Mac

## 🚀 Cài đặt & Chạy

### Bước 1: Cài dependencies

```bash
cd license-server
npm install
```

### Bước 2: Chạy server

```bash
npm start
```

Server sẽ chạy tại: **http://localhost:8008**

## 🎯 Sử dụng

### 1. Mở Dashboard

Truy cập: **http://localhost:8008/dashboard.html**

Dashboard cho phép:
- ✅ Xem danh sách licenses
- ✅ Tạo license mới
- ✅ Gia hạn license
- ✅ Reset hardware binding
- ✅ Vô hiệu hóa license
- ✅ Thống kê tổng quan

### 2. Tạo License

**Cách 1: Qua Dashboard**
1. Mở http://localhost:8008/dashboard.html
2. Click "➕ Tạo License Mới"
3. Nhập số ngày hiệu lực (mặc định 365)
4. Click "Tạo License"
5. Copy license key

**Cách 2: Qua API**

```bash
curl -X POST http://localhost:8008/admin/create-license \
  -H "Content-Type: application/json" \
  -d "{\"daysValid\": 365}"
```

**Cách 3: Tạo hàng loạt**

```bash
# Tạo 100 licenses, mỗi license 365 ngày
node generate-licenses.js 100 365
```

Kết quả sẽ được lưu vào:
- `licenses-[timestamp].json` (JSON format)
- `licenses-[timestamp].csv` (CSV format)

### 3. Kích hoạt License (User)

1. User mở tool TVT TikTok Studio Captcha
2. Mở tab "🔐 License & Update"
3. Copy Hardware ID
4. Gửi Hardware ID cho admin
5. Admin tạo license và gửi license key
6. User nhập license key và click "Kích hoạt"

## 📡 API Endpoints

### License Validation (Public)

```
POST /license/validate

Request:
{
  "licenseKey": "ABCD-1234-EFGH-5678",
  "hardwareId": "abc123...",
  "appVersion": "1.0.0",
  "appId": "vn.loopsoft.treolive"
}

Response:
{
  "valid": true,
  "expiryDate": "2027-05-17T00:00:00Z",
  "features": ["all"],
  "message": "License hợp lệ"
}
```

### Admin APIs

**Tạo License:**
```
POST /admin/create-license
Body: { "daysValid": 365, "notes": "Customer ABC" }
```

**Danh sách Licenses:**
```
GET /admin/licenses
```

**Chi tiết License:**
```
GET /admin/license/:key
```

**Vô hiệu hóa:**
```
POST /admin/deactivate/:key
```

**Reset Hardware:**
```
POST /admin/reset-hardware/:key
```

**Gia hạn:**
```
POST /admin/extend/:key
Body: { "days": 365 }
```

## 🗄️ Database

Server sử dụng SQLite database: `licenses.db`

**Schema:**
```sql
CREATE TABLE licenses (
  id INTEGER PRIMARY KEY,
  license_key TEXT UNIQUE NOT NULL,
  hardware_id TEXT,
  expiry_date TEXT NOT NULL,
  features TEXT DEFAULT '["all"]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  activated_at TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT
);
```

## 🔧 Quản lý Database

### Xem tất cả licenses

```bash
sqlite3 licenses.db "SELECT * FROM licenses;"
```

### Reset hardware binding

```bash
sqlite3 licenses.db "UPDATE licenses SET hardware_id = NULL WHERE license_key = 'XXXX-XXXX-XXXX-XXXX';"
```

### Gia hạn license

```bash
sqlite3 licenses.db "UPDATE licenses SET expiry_date = datetime('now', '+365 days') WHERE license_key = 'XXXX-XXXX-XXXX-XXXX';"
```

### Backup database

```bash
copy licenses.db licenses-backup-[date].db
```

## 🌐 Deploy lên Server

### Option 1: VPS/Cloud Server

1. Upload thư mục `license-server` lên server
2. Cài Node.js trên server
3. Chạy: `npm install && npm start`
4. Mở port 8008 trên firewall
5. (Optional) Dùng PM2 để chạy background:
   ```bash
   npm install -g pm2
   pm2 start server.js --name license-server
   pm2 save
   pm2 startup
   ```

### Option 2: Heroku

1. Tạo file `Procfile`:
   ```
   web: node server.js
   ```
2. Deploy:
   ```bash
   heroku create tvt-license-server
   git push heroku main
   ```

### Option 3: Docker

1. Tạo `Dockerfile`:
   ```dockerfile
   FROM node:14
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   EXPOSE 8008
   CMD ["node", "server.js"]
   ```
2. Build & Run:
   ```bash
   docker build -t license-server .
   docker run -p 8008:8008 -v $(pwd)/licenses.db:/app/licenses.db license-server
   ```

## 🔒 Bảo mật

**Khuyến nghị:**

1. **HTTPS:** Luôn dùng HTTPS cho production
2. **Authentication:** Thêm API key cho admin endpoints
3. **Rate Limiting:** Giới hạn số request
4. **Firewall:** Chỉ mở port cần thiết
5. **Backup:** Backup database thường xuyên

**Thêm authentication đơn giản:**

```javascript
// Thêm vào server.js
const ADMIN_API_KEY = 'your-secret-key-here';

app.use('/admin/*', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

## 📊 Thống kê

Xem thống kê qua Dashboard hoặc query trực tiếp:

```sql
-- Tổng licenses
SELECT COUNT(*) FROM licenses;

-- Đã kích hoạt
SELECT COUNT(*) FROM licenses WHERE hardware_id IS NOT NULL;

-- Còn hiệu lực
SELECT COUNT(*) FROM licenses 
WHERE status = 'active' AND date(expiry_date) > date('now');

-- Sắp hết hạn (30 ngày)
SELECT license_key, expiry_date FROM licenses 
WHERE date(expiry_date) BETWEEN date('now') AND date('now', '+30 days');
```

## 🐛 Troubleshooting

**Server không chạy:**
- Check Node.js đã cài: `node --version`
- Check port 8008 đã bị chiếm: `netstat -ano | findstr :8008`
- Check dependencies: `npm install`

**Database error:**
- Xóa file `licenses.db` và restart server (sẽ tạo mới)
- Check quyền ghi file

**License validation fail:**
- Check server đang chạy
- Check URL trong tool: `http://localhost:8008` hoặc `http://your-server-ip:8008`
- Check firewall

## 📞 Support

- Telegram: @tienbip99999
- Website: loopsoft.vn

## 📝 License

Copyright © 2026 LoopSoft.vn
