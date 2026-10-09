// Lớp quản lý trạng thái và logic vận hành ứng dụng Web Dashboard
class SmartIrrigationApp {
    constructor() {
        // Biến trạng thái khởi tạo
        this.soil = 45;
        this.threshold = 35;
        this.rssi = -68;
        this.isAuto = true;
        this.isValveOpen = false;
        
        // Khởi tạo đồ họa & biểu đồ
        this.initChart();
        this.initCanvas();
        this.log("Hệ thống khởi động thành công. Kết nối ESP32 Gateway OK.");

        // Chu kỳ cập nhật dữ liệu (mỗi 2 giây)
        setInterval(() => this.tick(), 2000);
    }

    // Ghi nhật ký sự kiện vào khung Log
    log(msg) {
        const logBox = document.getElementById('logBox');
        const time = new Date().toLocaleTimeString();
        logBox.innerHTML = `[${time}] ${msg}<br>` + logBox.innerHTML;
    }

    // Cập nhật độ ẩm đất
    setSoil(val) {
        this.soil = parseInt(val);
        document.getElementById('soilTxt').innerText = `${this.soil}%`;
        this.evaluateLogic();
    }

    // Cập nhật ngưỡng bật van
    setThreshold(val) {
        this.threshold = parseInt(val);
        document.getElementById('threshTxt').innerText = `${this.threshold}%`;
        this.evaluateLogic();
    }

    // Cập nhật tín hiệu RSSI Zigbee
    setRSSI(val) {
        this.rssi = parseInt(val);
        const badge = document.getElementById('zigbeeBadge');
        const txt = document.getElementById('rssiTxt');
        txt.innerText = `${this.rssi} dBm`;

        if (this.rssi < -85) {
            badge.className = "status-pill pill-red";
            badge.innerText = `📶 Zigbee: Yếu (${this.rssi} dBm)`;
        } else {
            badge.className = "status-pill pill-green";
            badge.innerText = `📶 Zigbee: Tốt (${this.rssi} dBm)`;
        }
    }

    // Đổi chế độ Tự động / Thủ công
    toggleMode() {
        this.isAuto = !this.isAuto;
        const badge = document.getElementById('modeBadge');
        const manualBtn = document.getElementById('manualValveBtn');

        if (this.isAuto) {
            badge.innerText = "⚙️ Chế độ: TỰ ĐỘNG";
            manualBtn.disabled = true;
            this.log("Chuyển sang chế độ TỰ ĐỘNG");
        } else {
            badge.innerText = "🖐️️ Chế độ: THỦ CÔNG";
            manualBtn.disabled = false;
            this.log("Chuyển sang chế độ THỦ CÔNG");
        }
        this.evaluateLogic();
    }

    // Công tắc van thủ công
    toggleManualValve() {
        if (!this.isAuto) {
            this.isValveOpen = !this.isValveOpen;
            this.log(`Điều khiển thủ công: ${this.isValveOpen ? 'MỞ VAN' : 'ĐÓNG VAN'}`);
            this.updateUI();
        }
    }

    // Logic kiểm tra điều kiện tự động
    evaluateLogic() {
        if (this.isAuto) {
            const newState = this.soil < this.threshold;
            if (newState !== this.isValveOpen) {
                this.isValveOpen = newState;
                this.log(`Tự động kích hoạt: Độ ẩm (${this.soil}%) ${this.isValveOpen ? '<' : '>='} Ngưỡng (${this.threshold}%) -> ${this.isValveOpen ? 'MỞ VAN' : 'ĐÓNG VAN'}`);
            }
        }
        this.updateUI();
    }

    // Cập nhật thẻ trạng thái van
    updateUI() {
        const badge = document.getElementById('valveBadge');
        const btn = document.getElementById('manualValveBtn');

        if (this.isValveOpen) {
            badge.className = "status-pill pill-blue";
            badge.innerText = "🚰 Van: ĐANG MỞ";
            btn.innerText = "Tắt Van Thủ Công";
        } else {
            badge.className = "status-pill pill-red";
            badge.innerText = "🚰 Van: ĐANG ĐÓNG";
            btn.innerText = "Bật Van Thủ Công";
        }
    }

    // Chu kỳ cập nhật dữ liệu tự động
    tick() {
        if (this.isValveOpen && this.soil < 100) {
            this.soil = Math.min(100, this.soil + 2);
            document.getElementById('soilInput').value = this.soil;
            document.getElementById('soilTxt').innerText = `${this.soil}%`;
            this.evaluateLogic();
        }

        // Đưa dữ liệu mới vào biểu đồ Chart.js
        const timeStr = new Date().toLocaleTimeString();
        if (this.chart.data.labels.length > 12) {
            this.chart.data.labels.shift();
            this.chart.data.datasets[0].data.shift();
        }
        this.chart.data.labels.push(timeStr);
        this.chart.data.datasets[0].data.push(this.soil);
        this.chart.update();
    }

    // Khởi tạo Chart.js Real-time
    initChart() {
        const ctx = document.getElementById('chartCanvas').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Độ ẩm đất (%)',
                    data: [],
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
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
                plugins: { legend: { labels: { color: '#f8fafc' } } }
            }
        });
    }

    // Trực quan hóa mô phỏng Canvas
    initCanvas() {
        const canvas = document.getElementById('simCanvas');
        const ctx = canvas.getContext('2d');
        let dropY = 130;

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // A. Khối Cảm biến Zigbee Node
            ctx.fillStyle = '#334155';
            ctx.fillRect(40, 150, 70, 60);
            ctx.fillStyle = '#38bdf8';
            ctx.font = '12px sans-serif';
            ctx.fillText("Zigbee Node", 43, 185);

            // Sóng Zigbee lan truyền
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(75, 150, (Date.now() / 15) % 35, Math.PI, 2 * Math.PI);
            ctx.stroke();

            // B. Bộ trung tâm ESP32 Gateway
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#38bdf8';
            ctx.strokeRect(180, 130, 80, 80);
            ctx.fillStyle = '#f8fafc';
            ctx.fillText("ESP32 Gateway", 183, 175);

            // C. Đường ống nước & Van điện từ
            ctx.fillStyle = '#475569';
            ctx.fillRect(320, 110, 180, 12);

            // Thân van
            ctx.fillStyle = this.isValveOpen ? '#4ade80' : '#f87171';
            ctx.fillRect(390, 95, 35, 42);
            ctx.fillStyle = '#0f172a';
            ctx.fillText("VAN", 396, 120);

            // D. Giọt nước chảy & Chậu cây
            if (this.isValveOpen) {
                ctx.fillStyle = '#38bdf8';
                ctx.beginPath();
                ctx.arc(470, dropY, 4, 0, Math.PI * 2);
                ctx.fill();

                dropY += 6;
                if (dropY > 200) dropY = 122;
            }

            // Chậu cây
            ctx.fillStyle = '#854d0e';
            ctx.fillRect(440, 200, 60, 40);
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(470, 190, 18, 0, Math.PI * 2);
            ctx.fill();

            requestAnimationFrame(render);
        };

        render();
    }
}

// Khởi chạy ứng dụng Web Dashboard
const app = new SmartIrrigationApp();