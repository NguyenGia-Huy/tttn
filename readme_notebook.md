# Tài Liệu Chỉ Tiêu Kỹ Thuật & Thiết Kế Web Dashboard

## Hệ Thống Tưới Cây Tự Động Qua Zigbee 3.0 và ESP32-C6

---

## 1. Tổng Quan Dự Án (Project Overview)

Tài liệu này quy định các chỉ tiêu kỹ thuật, yêu cầu chức năng, kiến trúc truyền thông và giao diện người dùng cho trang **Web Dashboard** thuộc hệ thống _"Tưới cây tự động bằng van điện từ dùng sóng Zigbee và ESP32-C6"_.

Trang Web Dashboard đóng vai trò là trung tâm giám sát và điều khiển (Monitoring & Control Hub), giúp người dùng theo dõi các chỉ số môi trường theo thời gian thực, điều chỉnh ngưỡng tưới và điều khiển van điện từ từ xa thông qua giao diện web trực quan trên cả máy tính và điện thoại di động.

---

## 2. Chỉ Tiêu Chức Năng (Functional Requirements)

### 2.1. Giám Sát Thời Gian Thực (Real-time Monitoring)

- **Chỉ số Độ ẩm đất (%):**
  - Hiển thị giá trị độ ẩm đất theo thời gian thực dưới dạng **Đồng hồ đo (Gauge)** và **Đồ thị đường (Line Chart)**.
  - Cập nhật liên tục biến thiên độ ẩm khi hệ thống đang trong chu kỳ tưới.
- **Trạng thái Thời tiết (Cảm biến mưa):**
  - Hiển thị biểu tượng và trạng thái trực quan: `Trời nắng / Không mưa` hoặc `Đang có mưa`.
  - Tự động khóa chức năng tưới khi phát hiện có mưa.
- **Trạng thái Van điện từ (Solenoid Valve 12V):**
  - Hiển thị trạng thái đóng/mở của van: `ĐANG TƯỚI (ON)` - Màu Xanh lá / `NGỪNG TƯỚI (OFF)` - Màu Xám.
  - Hiển thị thời gian chạy tưới tích lũy và thời điểm bật/tắt gần nhất.
- **Giám sát Chất lượng Kết nối Mạng:**
  - Hiển thị cường độ tín hiệu Wi-Fi (RSSI) của bộ trung tâm ESP32-C6 Gateway.
  - Hiển thị chỉ số LQI/RSSI của kết nối Zigbee 3.0 giữa Nút cảm biến và ESP32-C6.

### 2.2. Chế Độ Vận Hành & Điều Khiển (Control Modes)

- **Chế độ Tự động (Auto Mode):**
  - Van điện từ tự động **MỞ** khi: `Độ ẩm đất < Ngưỡng bật` và `Không có mưa`.
  - Van điện từ tự động **ĐỐNG** khi: `Độ ẩm đất >= Ngưỡng ngắt` hoặc `Phát hiện có mưa`.
- **Chế độ Bằng tay (Manual Mode):**
  - Cho phép người dùng bật/tắt van điện từ cưỡng chế từ xa qua nút bấm trên Web (**Soft Button**).
  - Chuyển đổi linh hoạt giữa chế độ `AUTO` và `MANUAL` qua công tắc chuyển đổi (Toggle Switch).
- **Cài đặt Ngưỡng Linh hoạt (Threshold Configuration):**
  - Cho phép người dùng nhập và thay đổi **Ngưỡng bật tưới (%)** và **Ngưỡng ngắt tưới (%)** trực tiếp từ Web xuống ESP32-C6.
  - Lưu trữ giá trị ngưỡng vào bộ nhớ EEPROM/NVS của ESP32-C6 để không bị mất khi rớt nguồn.

### 2.3. Cảnh Báo & Nhật Ký Hệ Thống (Alerts & Logging)

- **Mã màu cảnh báo giao diện:**
  - **🟢 Xanh lá (Normal):** Độ ẩm đất đạt mức tối ưu (40% - 80%).
  - **🟡 Vàng (Warning):** Độ ẩm đất thấp (< 30%), hệ thống chuẩn bị hoặc đang tưới.
  - **🔴 Đỏ (Critical):** Độ ẩm đất cực thấp (< 15%), mất kết nối sóng Zigbee hoặc lỗi van.
- **Nhật ký Vận hành (System Logs):**
  - Lưu trữ lịch sử 100 lần bật/tắt van gần nhất (thời gian, chế độ kích hoạt, độ ẩm tại thời điểm tưới).
  - Hỗ trợ xuất nhật ký ra file định dạng **CSV / Excel** để phục vụ thống kê.

---

## 3. Chỉ Tiêu Kỹ Thuật & Kiến Trúc Công Nghệ (Technical Specifications)

### 3.1. Công Nghệ Frontend

- **Ngôn ngữ & Framework:** HTML5, CSS3, JavaScript (ES6+).
- **Thư viện Giao diện:** **Bootstrap 5** (hỗ trợ Responsive UI co giãn theo màn hình mobile, tablet, PC).
- **Thư viện Đồ thị:** **Chart.js** (vẽ đồ thị độ ẩm) và **Gauge.js** (vẽ đồng hồ đo độ ẩm).

### 3.2. Giao Thức Truyền Thông & Backend

- **Giao thức truyền thông:** **WebSockets** (truyền nhận 2 chiều thời gian thực) hoặc **MQTT** (Message Queuing Telemetry Transport qua Broker).
- **Định dạng dữ liệu (Payload):** Chuẩn **JSON** ngắn gọn:
  ```json
  {
    "moisture": 45,
    "rain": 0,
    "valve_status": 1,
    "mode": "AUTO",
    "threshold_low": 30,
    "threshold_high": 70,
    "wifi_rssi": -65,
    "zigbee_lqi": 180
  }
  ```
- **Kiến trúc Triển khai (Deployment Options):**
  - **Option A (Local Web Server):** Lưu trữ mã nguồn Web trong bộ nhớ Flash (SPIFFS / LittleFS) của ESP32-C6, truy cập qua IP nội bộ (`http://192.168.x.x`).
  - **Option B (Cloud Dashboard):** Triển khai qua MQTT Broker (Mosquitto/HiveMQ) kết hợp Dashboard đám mây (Node-RED / ThingsBoard / Blynk) để truy cập từ xa qua Internet.

---

## 4. Chỉ Tiêu Hiệu Năng & Trải Nghiệm Người Dùng (Performance & UX)

| Chỉ Tiêu                              | Mức Yêu Cầu Cụ Thể                                                           |
| :------------------------------------ | :--------------------------------------------------------------------------- |
| **Độ trễ phản hồi (Control Latency)** | **< 1 - 2 giây** từ khi nhấn nút trên Web đến khi Relay ngắt/mở van điện từ. |
| **Tần số cập nhật dữ liệu**           | **2 - 5 giây/lần** khi van đang mở; **1 - 5 phút/lần** ở chế độ đo định kỳ.  |
| **Tính tương thích (Responsive UI)**  | Hiển thị chuẩn xác trên Smartphone (iOS/Android), Tablet và PC/Laptop.       |
| **Tự động khôi phục kết nối**         | Tự động Reconnect WebSocket/MQTT khi rớt mạng mà không cần F5 trang.         |
| **Dung lượng mã nguồn Web**           | Tối ưu mã nguồn HTML/CSS/JS **< 500 KB** để chạy mượt trên ESP32-C6.         |

---

## 5. Bố Cục Layout Giao Diện (Dashboard Wireframe)

Giao diện Web Dashboard được chia thành 4 khối chính:

1. **Header Bar:** Tiêu đề dự án, biểu tượng trạng thái kết nối Wi-Fi/Zigbee và công tắc chọn chế độ `AUTO / MANUAL`.
2. **Khối Giám Sát (Monitoring Cards):**
   - Đồng hồ Gauge hiển thị Độ ẩm đất (%).
   - Card trạng thái Cảm biến mưa (`Không mưa` / `Có mưa`).
   - Card trạng thái Van điện từ (`ON` / `OFF`).
3. **Khối Đồ Thị & Cài Đặt (Chart & Settings):**
   - Đồ thị biến thiên độ ẩm đất theo thời gian (Real-time Line Chart).
   - Form nhập và gửi Ngưỡng bật/ngắt tưới xuống vi điều khiển.
4. **Khối Nhật Ký (History Log Table):**
   - Bảng hiển thị thời gian và trạng thái các lần tưới gần nhất.
   - Nút bấm xuất file `Export CSV`.

---

## 6. Hướng Dẫn Cài Đặt & Sử Dụng (Getting Started)

1. **Nạp code cho ESP32-C6:** Sử dụng Arduino IDE hoặc ESP-IDF nạp mã nguồn chương trình và nạp file web vào SPIFFS/LittleFS.
2. **Kết nối Wi-Fi:** Kết nối ESP32-C6 vào mạng Wi-Fi nội bộ hoặc phát Access Point (AP Mode) để cấu hình.
3. **Truy cập Web Dashboard:** Mở trình duyệt web (Chrome/Safari) và truy cập địa chỉ IP của ESP32-C6 để bắt đầu giám sát và điều khiển.

## 7. Thêm

1. tôi muốn có thanh trượt và hiệu ứng giọt mưa rơi trực quan
2. hiệu ứng mưa rơi chỉ cần bên trong thẻ Cảm biến mưa, khi kéo thanh trượt thì giữ nguyên cơ chế tăng giảm độ ẩm
