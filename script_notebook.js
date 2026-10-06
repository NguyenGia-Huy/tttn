/**
 * Quản lý trạng thái và giao tiếp Web Dashboard
 * Chuẩn hóa dữ liệu theo Payload JSON của tài liệu chỉ tiêu kỹ thuật
 */
class DashboardApp {
    constructor() {
        // Cấu trúc Payload JSON mặc định
        this.data = {
            moisture: 45,
            rain: 0,
            valve_status: 0,
            mode: "AUTO",
            threshold_low: 30,
            threshold_high: 70,
            wifi_rssi: -65,
            zigbee_lqi: 180
        };

        this.logs = [];
        this.initChart();
        this.updateUI();

        // Chu kỳ mô phỏng cập nhật dữ liệu tự động (2 giây/lần)
        setInterval(() => this.tick(), 2000);
    }

    // Khởi tạo đồ thị Chart.js
    initChart() {
        const ctx = document.getElementById('moistureChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Độ ẩm đất (%)',
                    data: [],
                    borderColor: '#0dcaf0',
                    backgroundColor: 'rgba(13, 202, 240, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { min: 0, max: 100, grid: { color: '#334155' } },
                    x: { grid: { color: '#334155' } }
                },
                plugins: { legend: { labels: { color: '#ffffff' } } }
            }
        });
    }

    // Cập nhật ngưỡng bật/ngắt tưới
    updateThresholds() {
        this.data.threshold_low = parseInt(document.getElementById('threshLow').value);
        this.data.threshold_high = parseInt(document.getElementById('threshHigh').value);

        document.getElementById('threshLowVal').innerText = `${this.data.threshold_low}%`;
        document.getElementById('threshHighVal').innerText = `${this.data.threshold_high}%`;

        this.evaluateControlLogic();
    }

    // Đổi chế độ Auto / Manual
    toggleMode() {
        const isChecked = document.getElementById('modeToggle').checked;
        this.data.mode = isChecked ? "MANUAL" : "AUTO";
        document.getElementById('modeLabel').innerText = this.data.mode;
        document.getElementById('manualBtn').disabled = (this.data.mode === "AUTO");
        
        this.evaluateControlLogic();
    }

    // Công tắc van bằng tay
    toggleManualValve() {
        if (this.data.mode === "MANUAL") {
            // Tự động ngắt nếu có mưa
            if (this.data.rain === 1) {
                alert("Không thể bật van do cảm biến phát hiện trời đang mưa!");
                return;
            }
            this.data.valve_status = this.data.valve_status === 1 ? 0 : 1;
            this.addLog("Thủ công điều khiển van");
            this.updateUI();
        }
    }

    // Giả lập trạng thái mưa
    setRainSimulation(val) {
        this.data.rain = parseInt(val);
        this.evaluateControlLogic();
    }

    // Logic điều khiển trung tâm (Mô phỏng ESP32-C6)
    evaluateControlLogic() {
        if (this.data.rain === 1) {
            // Có mưa -> Khóa van ngay lập tức
            if (this.data.valve_status === 1) {
                this.data.valve_status = 0;
                this.addLog("Tự động ngắt van (Phát hiện mưa)");
            }
        } else if (this.data.mode === "AUTO") {
            // Chế độ tự động dựa trên ngưỡng kép
            if (this.data.moisture < this.data.threshold_low && this.data.valve_status === 0) {
                this.data.valve_status = 1;
                this.addLog("Tự động MỞ van (Độ ẩm < Ngưỡng bật)");
            } else if (this.data.moisture >= this.data.threshold_high && this.data.valve_status === 1) {
                this.data.valve_status = 0;
                this.addLog("Tự động ĐÓNG van (Độ ẩm >= Ngưỡng ngắt)");
            }
        }
        this.updateUI();
    }

    // Cập nhật giao diện Web
    updateUI() {
        // 1. Độ ẩm đất & Mã màu cảnh báo
        const moistEl = document.getElementById('moistureValue');
        const statusEl = document.getElementById('moistureStatus');
        moistEl.innerText = `${Math.round(this.data.moisture)}%`;

        if (this.data.moisture < 15) {
            statusEl.className = "badge status-critical";
            statusEl.innerText = "CRITICAL: ĐỘ ẨM RẤT THẤP";
        } else if (this.data.moisture < 30) {
            statusEl.className = "badge status-warning";
            statusEl.innerText = "WARNING: SẮP CẦN TƯỚI";
        } else {
            statusEl.className = "badge status-normal";
            statusEl.innerText = "NORMAL: TỐI ƯU";
        }

        // 2. Cảm biến mưa
        const rainEl = document.getElementById('rainStatus');
        const lockNotice = document.getElementById('rainLockNotice');
        if (this.data.rain === 1) {
            rainEl.innerText = "🌧️ Đang Có Mưa";
            rainEl.className = "display-6 fw-bold my-3 text-info";
            lockNotice.style.display = "block";
        } else {
            rainEl.innerText = "☀️ Không Mưa";
            rainEl.className = "display-6 fw-bold my-3 text-warning";
            lockNotice.style.display = "none";
        }

        // 3. Van điện từ
        const valveText = document.getElementById('valveStatusText');
        const manualBtn = document.getElementById('manualBtn');
        if (this.data.valve_status === 1) {
            valveText.innerText = "ĐANG TƯỚI (ON)";
            valveText.className = "display-6 fw-bold my-2 text-success";
            manualBtn.innerText = "Tắt Van Thủ Công";
            manualBtn.className = "btn btn-danger mt-2";
        } else {
            valveText.innerText = "NGỪNG TƯỚI (OFF)";
            valveText.className = "display-6 fw-bold my-2 text-secondary";
            manualBtn.innerText = "Bật Van Thủ Công";
            manualBtn.className = "btn btn-primary mt-2";
        }

        // 4. Các thông số tín hiệu
        document.getElementById('wifiBadge').innerText = `Wi-Fi: ${this.data.wifi_rssi} dBm`;
        document.getElementById('zigbeeBadge').innerText = `Zigbee LQI: ${this.data.zigbee_lqi}`;
    }

    // Chu kỳ mô phỏng theo thời gian
    tick() {
        // Tăng độ ẩm nếu van mở
        if (this.data.valve_status === 1 && this.data.moisture < 100) {
            this.data.moisture = Math.min(100, this.data.moisture + 3);
            this.evaluateControlLogic();
        }

        // Cập nhật biểu đồ Chart.js
        const timeStr = new Date().toLocaleTimeString();
        if (this.chart.data.labels.length > 10) {
            this.chart.data.labels.shift();
            this.chart.data.datasets[0].data.shift();
        }
        this.chart.data.labels.push(timeStr);
        this.chart.data.datasets[0].data.push(this.data.moisture);
        this.chart.update();
    }

    // Thêm nhật ký vận hành
    addLog(reason) {
        const logItem = {
            time: new Date().toLocaleTimeString(),
            moisture: `${Math.round(this.data.moisture)}%`,
            rain: this.data.rain === 1 ? "Có Mưa" : "Không Mưa",
            mode: this.data.mode,
            valve: this.data.valve_status === 1 ? "ON" : "OFF",
            reason: reason
        };
        this.logs.unshift(logItem);

        // Hiển thị tối đa 50 dòng log gần nhất
        if (this.logs.length > 50) this.logs.pop();

        const tbody = document.getElementById('logTableBody');
        tbody.innerHTML = this.logs.map(log => `
            <tr>
                <td>${log.time}</td>
                <td>${log.moisture}</td>
                <td>${log.rain}</td>
                <td>${log.mode}</td>
                <td><span class="badge ${log.valve === 'ON' ? 'bg-success' : 'bg-secondary'}">${log.valve}</span></td>
            </tr>
        `).join('');
    }

    // Xuất nhật ký ra file CSV
    exportCSV() {
        if (this.logs.length === 0) {
            alert("Chưa có dữ liệu nhật ký để xuất file!");
            return;
        }
        let csvContent = "data:text/csv;charset=utf-8,Thoi Gian,Do Am,Trang Thai Mua,Che Do,Trang Thai Van\n";
        this.logs.forEach(row => {
            csvContent += `${row.time},${row.moisture},${row.rain},${row.mode},${row.valve}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `System_Log_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Khởi tạo ứng dụng
const app = new DashboardApp();