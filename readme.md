Step 1: Hiểu Yêu Cầu & Thu Thập Thông Tin (Clarification)

Để đảm bảo hệ thống MQTT Broker hoạt động chính xác với mô hình tổng thể dự án của bạn:
Mục đích: Dựng một Mosquitto MQTT Broker riêng (Private Broker) trên Ubuntu nhằm truyền tải dữ liệu giữa các thiết bị vi điều khiển ESP32-C6, App Flutter di động (trên điện thoại Xiaomi) và Web Dashboard.  
 Cổng kết nối cần thiết:Cổng 1883 (TCP): Dành cho App Flutter Android và phần cứng vi điều khiển ESP32-C6 kết nối truyền nhận dữ liệu trực tiếp. Cổng 9001 (WebSockets): Dành cho Web Dashboard chạy trên trình duyệt web (paho-mqtt library).
Môi trường: Ubuntu 24.04 (hoặc 22.04 LTS), chạy local trong cùng mạng Wi-Fi/LAN.

Step 2: Thông Tin Tổng Quan Giải Pháp (Solution Overview)
Giải pháp thiết lập bao gồm 4 công đoạn chính:

Cài đặt gói phần mềm: Cài mosquitto (Server Broker) và mosquitto-clients (công cụ test dòng lệnh) qua trình quản lý gói apt.
Cấu hình Listening Ports & Cấp quyền: Tạo tệp cấu hình tùy chỉnh (/etc/mosquitto/conf.d/default.conf) để lắng nghe đồng thời giao thức TCP (cổng 1883) và WebSocket (cổng 9001), đồng thời cho phép kết nối ẩn danh (allow_anonymous true).
Cấu hình Tường lửa (UFW): Mở hai cổng 1883 và 9001 để hệ điều hành không chặn các kết nối đi vào từ mạng LAN.
Quản lý & Kiểm tra trạng thái dịch vụ: Khởi chạy Mosquitto dưới dạng một Service ngầm (systemctl) và sử dụng các công cụ dòng lệnh (ss, mosquitto_sub, mosquitto_pub) để xác nhận kết nối.

Step 3: Mã Lệnh & Hướng Dẫn Triển Khai Chi TiếtBước 1: Cài đặt Mosquitto trên UbuntuMở Terminal (Ctrl + Alt + T) trên máy Ubuntu và thực hiện các lệnh sau:

1. Cập nhật danh sách gói hệ thống
   sudo apt update
1. Cài đặt Mosquitto Broker và công cụ Mosquitto Clients
   sudo apt install -y mosquitto mosquitto-clients

Bước 2: Tạo tệp cấu hình tùy chỉnh (default.conf)
Mặc định, Mosquitto từ phiên bản 2.0 trở đi chỉ cho phép kết nối nội bộ (localhost). Ta cần tạo cấu hình mới để mở cổng kết nối cho các thiết bị ngoài.

1. Chạy lệnh mở trình biên soạn nano:
   sudo nano /etc/mosquitto/conf.d/default.conf
1. Sao chép và dán toàn bộ đoạn cấu hình sau vào tệp:

# Cho phép thiết bị trong mạng LAN kết nối không cần User/Password (dùng cho phát triển)

allow_anonymous true

# Lắng nghe giao thức MQTT TCP chuẩn trên cổng 1883 (Dành cho App Android & ESP32-C6)

listener 1883
protocol mqtt

# Lắng nghe giao thức MQTT WebSockets trên cổng 9001 (Dành cho Web Dashboard)

listener 9001
protocol websockets

Nhấn Ctrl + O -> Nhấn Enter để lưu tệp. Nhấn Ctrl + X để thoát khỏi nano.

Bước 3: Khởi động lại dịch vụ MosquittoChạy các lệnh sau để áp dụng tệp cấu hình vừa tạo:

1. Khởi động lại dịch vụ Mosquitto
   sudo systemctl restart mosquitto

2. Cho phép Mosquitto tự động chạy cùng hệ thống khi khởi động lại Ubuntu
   sudo systemctl enable mosquitto

Bước 4: Mở cổng Tường lửa hệ thống (UFW)
Để các thiết bị khác trong mạng LAN (điện thoại Xiaomi, ESP32) có thể truy cập vào Ubuntu, bạn cần mở cổng trên UFW:

1. Mở cổng 1883 (TCP) và cổng 9001 (WebSocket)
   sudo ufw allow 1883/tcp
   sudo ufw allow 9001/tcp

Bước 5: Kiểm tra trạng thái cổng & Lấy địa chỉ IP

1. Kiểm tra xem Mosquitto đã chạy thành công trên 2 cổng chưa:
   sudo ss -tulpn | grep mosquitto

Kết quả xuất ra có chứa hai dòng :1883 và :9001 chứng tỏ Broker đã hoạt động đúng cấu hình.

1. Lấy địa chỉ IP mạng LAN của máy Ubuntu:
   hostname -I

Ghi lại địa chỉ IP xuất ra (ví dụ: 192.168.1.9). Đây là địa chỉ IP bạn sẽ điền vào mã nguồn Flutter và Web Dashboard.

Bước 6: Kiểm tra truyền nhận dữ liệu (Testing)
Mở 2 cửa sổ Terminal trên Ubuntu để thử nghiệm:

1. Terminal 1 (Đóng vai trò Subscriber - Lắng nghe):
   mosquitto_sub -h localhost -t "esp32c6/irrigation/telemetry"

2. Terminal 2 (Đóng vai trò Publisher - Gửi tin nhắn):
   Bashmosquitto_pub -h localhost -t "esp32c6/irrigation/telemetry" -m '{"moisture": 75, "rain": 0, "valve": 1, "mode": "AUTO"}'

Ngay khi gõ lệnh ở Terminal 2, dữ liệu JSON sẽ lập tức xuất hiện ở Terminal 1.
Step 4: Tài Liệu Tích Hợp Vào Mã Nguồn

# Mã Flutter App (lib/main.dart): Kết nối đến 192.168.1.9 qua cổng 1883 (giao thức TCP).

# Mã Web Dashboard (script_notebook1.js): Kết nối đến ws://192.168.1.9:9001/mqtt (giao thức WebSocket).
