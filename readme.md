// =================================================================
// 1. CẤU HÌNH KẾT NỐI MOSQUITTO BROKER (WEBSOCKETS)
// =================================================================
const brokerHost = "192.168.1.9"; // IP máy Ubuntu của bạn
const brokerPort = 9001; // Cổng WebSocket của Mosquitto

// Khởi tạo MQTT Client qua WebSocket
const client = new Paho.MQTT.Client(
brokerHost,
Number(brokerPort),
"web*dashboard*" + Math.random().toString(16).substr(2, 8),
);

// Bổ sung đường dẫn WebSocket chuẩn cho Mosquitto (nếu cần)
client.path = "/mqtt";

// =================================================================
// 2. LẮNG NGHE SỰ CỐ & NHẬN TIN NHẮN TỪ APP/ESP32
// =================================================================

// Xử lý khi kết nối bị ngắt
client.onConnectionLost = function (responseObject) {
if (responseObject.errorCode !== 0) {
console.log("Mất kết nối Web Dashboard: " + responseObject.errorMessage);
}
};

// Xử lý khi nhận dữ liệu mới từ Mosquitto Broker
client.onMessageArrived = function (message) {
console.log("Nhận dữ liệu từ Broker:", message.payloadString);

try {
const data = JSON.parse(message.payloadString);

    // Cập nhật Độ ẩm đất lên giao diện Web
    if (data.moisture !== undefined) {
      const moistureTextElement = document.querySelector(
        ".card h1, .moisture-value, #moistureValue",
      );
      if (moistureTextElement) {
        moistureTextElement.innerText = data.moisture + "%";
      }
    }

    // Cập nhật trạng thái Cảm biến mưa
    if (data.rain !== undefined) {
      const rainStatusElement = document.getElementById("rainStatus");
      if (rainStatusElement) {
        rainStatusElement.innerText =
          data.rain === 1 ? "🌧️ Đang mưa (Khóa van)" : "☀️ Không mưa";
      }
    }

    // Cập nhật trạng thái Van tưới
    if (data.valve !== undefined) {
      const valveStatusElement = document.getElementById("valveStatus");
      if (valveStatusElement) {
        valveStatusElement.innerText =
          data.valve === 1 ? "ĐANG TƯỚI (ON)" : "NGỪNG TƯỚI (OFF)";
      }
    }

} catch (e) {
console.error("Lỗi trích xuất dữ liệu JSON:", e);
}
};

// =================================================================
// 3. THỰC THI KẾT NỐI VÀ ĐĂNG KÝ TOPIC
// =================================================================
const options = {
timeout: 3,
onSuccess: function () {
console.log("Web Dashboard đã kết nối thành công tới Mosquitto!");

    // Đăng ký kênh nhận dữ liệu cảm biến
    client.subscribe("esp32c6/irrigation/telemetry", { qos: 0 });

},
onFailure: function (message) {
console.error("Kết nối Web thất bại: " + message.errorMessage);
},
};

// Gọi lệnh kết nối
client.connect(options);

// =================================================================
// 4. HÀM GỬI LỆNH ĐIỀU KHIỂN TỪ WEB SANG APP / ESP32
// =================================================================
function sendWebCommand(key, value) {
if (client.isConnected()) {
const payload = JSON.stringify({ [key]: value });
const message = new Paho.MQTT.Message(payload);
message.destinationName = "esp32c6/irrigation/command";
client.send(message);
console.log("Web đã gửi lệnh:", payload);
}
}

/\*\*

- Lớp tạo hiệu ứng hạt mưa rơi giới hạn trong thẻ Card
  \*/
  class CardRainEffect {
  constructor(canvasId) {
  this.canvas = document.getElementById(canvasId);
  this.ctx = this.canvas.getContext("2d");
  this.drops = [];
  this.isRaining = false;

      this.resize();
      window.addEventListener("resize", () => this.resize());

  }

// Tự động điều chỉnh kích thước Canvas theo kích thước thực của thẻ Card
resize() {
if (this.canvas && this.canvas.parentElement) {
this.canvas.width = this.canvas.parentElement.clientWidth;
this.canvas.height = this.canvas.parentElement.clientHeight;
}
}

start() {
if (this.isRaining) return;
this.isRaining = true;
this.resize();
this.drops = [];

    // Tạo 40 hạt mưa nhỏ trong khung Card
    for (let i = 0; i < 40; i++) {
      this.drops.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        length: Math.random() * 12 + 8,
        speed: Math.random() * 6 + 8,
        opacity: Math.random() * 0.5 + 0.3,
      });
    }
    this.animate();

}

stop() {
this.isRaining = false;
this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
}

animate() {
if (!this.isRaining) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.strokeStyle = "rgba(13, 202, 240, 0.6)"; // Màu xanh lơ dịu
    this.ctx.lineWidth = 1.5;
    this.ctx.lineCap = "round";

    for (let drop of this.drops) {
      this.ctx.beginPath();
      this.ctx.moveTo(drop.x, drop.y);
      this.ctx.lineTo(drop.x, drop.y + drop.length);
      this.ctx.stroke();

      drop.y += drop.speed;
      if (drop.y > this.canvas.height) {
        drop.y = -drop.length;
        drop.x = Math.random() * this.canvas.width;
      }
    }

    requestAnimationFrame(() => this.animate());

}
}

/\*\*

- Quản lý Dashboard chính
  \*/
  class DashboardApp {
  constructor() {
  this.data = {
  moisture: 45,
  rain: 0,
  valve_status: 0,
  mode: "AUTO",
  threshold_low: 30,
  threshold_high: 70,
  wifi_rssi: -65,
  zigbee_lqi: 180,
  };

      this.logs = [];
      this.rainEffect = new CardRainEffect("rainCardCanvas");
      this.initChart();
      this.updateUI();

      // Chu kỳ cập nhật tự động (Mỗi 1 giây)
      setInterval(() => this.tick(), 1000);

  }

initChart() {
const ctx = document.getElementById("moistureChart").getContext("2d");
this.chart = new Chart(ctx, {
type: "line",
data: {
labels: [],
datasets: [
{
label: "Độ ẩm đất (%)",
data: [],
borderColor: "#0dcaf0",
backgroundColor: "rgba(13, 202, 240, 0.1)",
fill: true,
tension: 0.3,
},
],
},
options: {
responsive: true,
scales: {
y: { min: 0, max: 100, grid: { color: "#334155" } },
x: { grid: { color: "#334155" } },
},
plugins: { legend: { labels: { color: "#ffffff" } } },
},
});
}

// Khi người dùng kéo thanh trượt: Đặt độ ẩm mới và tiếp tục chạy mô phỏng
onSliderChange(value) {
this.data.moisture = parseInt(value);
this.evaluateControlLogic();
}

toggleRain() {
this.data.rain = this.data.rain === 1 ? 0 : 1;

    if (this.data.rain === 1) {
      this.rainEffect.start();
      this.addLog("Mô phỏng: Bắt đầu có mưa -> Khóa van tưới");
    } else {
      this.rainEffect.stop();
      this.addLog("Mô phỏng: Tạnh mưa");
    }

    this.evaluateControlLogic();

}

updateThresholds() {
this.data.threshold_low = parseInt(
document.getElementById("threshLow").value,
);
this.data.threshold_high = parseInt(
document.getElementById("threshHigh").value,
);
document.getElementById("threshLowVal").innerText =
`${this.data.threshold_low}%`;
document.getElementById("threshHighVal").innerText =
`${this.data.threshold_high}%`;
this.evaluateControlLogic();
}

toggleMode() {
const isChecked = document.getElementById("modeToggle").checked;
this.data.mode = isChecked ? "MANUAL" : "AUTO";
document.getElementById("modeLabel").innerText = this.data.mode;
document.getElementById("manualBtn").disabled = this.data.mode === "AUTO";
this.evaluateControlLogic();
}

toggleManualValve() {
if (this.data.mode === "MANUAL") {
if (this.data.rain === 1) {
alert("Không thể bật van do cảm biến phát hiện trời đang mưa!");
return;
}
this.data.valve_status = this.data.valve_status === 1 ? 0 : 1;
this.addLog(
`Thủ công: ${this.data.valve_status === 1 ? "MỞ VAN" : "ĐÓNG VAN"}`,
);
this.updateUI();
}
}

evaluateControlLogic() {
if (this.data.rain === 1) {
if (this.data.valve_status === 1) {
this.data.valve_status = 0;
this.addLog("Tự động ngắt van (Có mưa)");
}
} else if (this.data.mode === "AUTO") {
if (
this.data.moisture < this.data.threshold_low &&
this.data.valve_status === 0
) {
this.data.valve_status = 1;
this.addLog(
`Tự động MỞ van (Độ ẩm ${this.data.moisture}% < ${this.data.threshold_low}%)`,
);
} else if (
this.data.moisture >= this.data.threshold_high &&
this.data.valve_status === 1
) {
this.data.valve_status = 0;
this.addLog(
`Tự động ĐÓNG van (Độ ẩm ${this.data.moisture}% >= ${this.data.threshold_high}%)`,
);
}
}
this.updateUI();
}

// Tiến trình mô phỏng tăng/giảm độ ẩm tự động theo thời gian
tick() {
// 1. Trường hợp TRỜI MƯA: Độ ẩm đất tự động tăng (+3%/giây) kể cả khi van đóng
if (this.data.rain === 1 && this.data.moisture < 100) {
this.data.moisture = Math.min(100, this.data.moisture + 3);
document.getElementById("moistureSlider").value = this.data.moisture;
this.evaluateControlLogic();
}
// 2. Trường hợp KHÔNG MƯA & VAN MỞ: Độ ẩm đất tăng (+2%/giây) do tưới cây
else if (this.data.valve_status === 1 && this.data.moisture < 100) {
this.data.moisture = Math.min(100, this.data.moisture + 2);
document.getElementById("moistureSlider").value = this.data.moisture;
this.evaluateControlLogic();
}
// 3. Trường hợp KHÔNG MƯA & VAN ĐÓNG: Đất khô tự nhiên (-1% mỗi 3 giây)
else if (
this.data.valve_status === 0 &&
this.data.rain === 0 &&
this.data.moisture > 0
) {
if (Math.random() < 0.33) {
this.data.moisture = Math.max(0, this.data.moisture - 1);
document.getElementById("moistureSlider").value = this.data.moisture;
this.evaluateControlLogic();
}
}

    // Cập nhật đường biểu đồ Chart.js theo thời gian
    const timeStr = new Date().toLocaleTimeString();
    if (this.chart.data.labels.length > 12) {
      this.chart.data.labels.shift();
      this.chart.data.datasets[0].data.shift();
    }
    this.chart.data.labels.push(timeStr);
    this.chart.data.datasets[0].data.push(this.data.moisture);
    this.chart.update();

}

updateUI() {
document.getElementById("moistureValue").innerText =
`${Math.round(this.data.moisture)}%`;
const statusEl = document.getElementById("moistureStatus");

    if (this.data.moisture < 15) {
      statusEl.className = "badge status-critical";
      statusEl.innerText = "CRITICAL: CỰC THẤP";
    } else if (this.data.moisture < 30) {
      statusEl.className = "badge status-warning";
      statusEl.innerText = "WARNING: CẦN TƯỚI";
    } else {
      statusEl.className = "badge status-normal";
      statusEl.innerText = "NORMAL: TỐI ƯU";
    }

    const rainEl = document.getElementById("rainStatus");
    const rainBtn = document.getElementById("rainBtn");
    const lockNotice = document.getElementById("rainLockNotice");

    if (this.data.rain === 1) {
      rainEl.innerText = "🌧️ Đang Có Mưa";
      rainEl.className = "display-6 fw-bold my-2 text-info";
      rainBtn.className = "btn btn-info w-100 fw-bold";
      rainBtn.innerText = "☀️ Dừng Mô Phỏng Mưa";
      lockNotice.style.display = "block";
    } else {
      rainEl.innerText = "☀️ Không Mưa";
      rainEl.className = "display-6 fw-bold my-2 text-warning";
      rainBtn.className = "btn btn-outline-info w-100 fw-bold";
      rainBtn.innerText = "🌧️ Kích Hoạt Mô Phỏng Mưa";
      lockNotice.style.display = "none";
    }

    const valveText = document.getElementById("valveStatusText");
    const manualBtn = document.getElementById("manualBtn");
    if (this.data.valve_status === 1) {
      valveText.innerText = "ĐANG TƯỚI (ON)";
      valveText.className = "display-6 fw-bold my-2 text-success";
      manualBtn.innerText = "Tắt Van Thủ Công";
      manualBtn.className = "btn btn-danger mt-2 w-100";
    } else {
      valveText.innerText = "NGỪNG TƯỚI (OFF)";
      valveText.className = "display-6 fw-bold my-2 text-secondary";
      manualBtn.innerText = "Bật Van Thủ Công";
      manualBtn.className = "btn btn-primary mt-2 w-100";
    }

    document.getElementById("wifiBadge").innerText =
      `Wi-Fi: ${this.data.wifi_rssi} dBm`;
    document.getElementById("zigbeeBadge").innerText =
      `Zigbee LQI: ${this.data.zigbee_lqi}`;

}

addLog(reason) {
const logItem = {
time: new Date().toLocaleTimeString(),
moisture: `${Math.round(this.data.moisture)}%`,
rain: this.data.rain === 1 ? "Có Mưa" : "Không Mưa",
mode: this.data.mode,
valve: this.data.valve_status === 1 ? "ON" : "OFF",
};
this.logs.unshift(logItem);
if (this.logs.length > 50) this.logs.pop();

    const tbody = document.getElementById("logTableBody");
    tbody.innerHTML = this.logs
      .map(
        (log) => `
            <tr>
                <td>${log.time}</td>
                <td>${log.moisture}</td>
                <td>${log.rain}</td>
                <td>${log.mode}</td>
                <td><span class="badge ${log.valve === "ON" ? "bg-success" : "bg-secondary"}">${log.valve}</span></td>
            </tr>
        `,
      )
      .join("");

}

exportCSV() {
if (this.logs.length === 0) return alert("Chưa có dữ liệu!");
let csvContent =
"data:text/csv;charset=utf-8,Thoi Gian,Do Am,Trang Thai Mua,Che Do,Trang Thai Van\n";
this.logs.forEach((row) => {
csvContent += `${row.time},${row.moisture},${row.rain},${row.mode},${row.valve}\n`;
});
const link = document.createElement("a");
link.setAttribute("href", encodeURI(csvContent));
link.setAttribute(
"download",
`Log_${new Date().toISOString().slice(0, 10)}.csv`,
);
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
}
}

const app = new DashboardApp();
