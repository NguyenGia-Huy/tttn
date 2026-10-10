// =================================================================
// 1. LỚP TẠO HIỆU ỨNG MƯA RƠI TRÊN CARD
// =================================================================
class CardRainEffect {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      this.drops = [];
      this.isRaining = false;
      this.resize();
      window.addEventListener("resize", () => this.resize());
    }
  }

  resize() {
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.width = this.canvas.parentElement.clientWidth;
      this.canvas.height = this.canvas.parentElement.clientHeight;
    }
  }

  start() {
    if (this.isRaining || !this.canvas) return;
    this.isRaining = true;
    this.resize();
    this.drops = [];
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
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  animate() {
    if (!this.isRaining || !this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.strokeStyle = "rgba(13, 202, 240, 0.6)";
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

// =================================================================
// 2. QUẢN LÝ DASHBOARD & SỰ KIỆN GIAO DIỆN WEB
// =================================================================
class DashboardApp {
  constructor() {
    this.data = {
      moisture: 50,
      rain: 0,
      valve_status: 0,
      mode: "MANUAL",
      threshold_low: 30,
      threshold_high: 70,
    };

    this.logs = [];
    this.rainEffect = new CardRainEffect("rainCardCanvas");
    this.initChart();

    // Vòng lặp mô phỏng tăng/giảm độ ẩm tự động theo thời gian (mỗi 2 giây)
    setInterval(() => this.simulationTick(), 2000);
  }

  initChart() {
    const chartElem = document.getElementById("moistureChart");
    if (chartElem) {
      const ctx = chartElem.getContext("2d");
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
  }

  simulationTick() {
    let hasChanged = false;

    // Trường hợp CÓ MƯA -> Tăng 3% độ ẩm & Tự động ngắt van
    if (this.data.rain === 1) {
      if (this.data.moisture < 100) {
        this.data.moisture = Math.min(100, this.data.moisture + 3);
        hasChanged = true;
      }
      if (this.data.valve_status === 1) {
        this.data.valve_status = 0;
        this.addLog("Trời mưa -> Tự động khóa van tưới");
        sendWebCommand("valve", 0);
        hasChanged = true;
      }
    }
    // Trường hợp ĐANG TƯỚI -> Tăng 2% độ ẩm
    else if (this.data.valve_status === 1) {
      if (this.data.moisture < 100) {
        this.data.moisture = Math.min(100, this.data.moisture + 2);
        hasChanged = true;
      }
    }
    // Trường hợp TẮT VAN & KHÔNG MƯA -> Đất tự khô (-1% mỗi 2 giây)
    else if (this.data.valve_status === 0 && this.data.rain === 0) {
      if (this.data.moisture > 0) {
        this.data.moisture = Math.max(0, this.data.moisture - 2);
        hasChanged = true;
      }
    }

    // Logic kiểm tra ngưỡng tự động trong chế độ AUTO
    if (this.data.mode === "AUTO" && this.data.rain === 0) {
      if (
        this.data.moisture >= this.data.threshold_high &&
        this.data.valve_status === 1
      ) {
        this.data.valve_status = 0;
        this.addLog(`AUTO: Đạt ngưỡng ngắt -> TẮT VAN`);
        sendWebCommand("valve", 0);
        hasChanged = true;
      } else if (
        this.data.moisture < this.data.threshold_low &&
        this.data.valve_status === 0
      ) {
        this.data.valve_status = 1;
        this.addLog(`AUTO: Đạt ngưỡng bật -> BẬT VAN`);
        sendWebCommand("valve", 1);
        hasChanged = true;
      }
    }

    if (hasChanged) {
      this.updateUI();
      this.updateChart();
      sendTelemetryUpdate({
        moisture: this.data.moisture,
        rain: this.data.rain,
        valve: this.data.valve_status,
        mode: this.data.mode,
      });
    }
  }

  onSliderChange(value) {
    this.data.moisture = parseInt(value);
    this.updateUI();
    this.updateChart();
    sendWebCommand("set_moisture", this.data.moisture);
  }

  toggleRain() {
    this.data.rain = this.data.rain === 1 ? 0 : 1;
    if (this.data.rain === 1) {
      this.rainEffect.start();
      this.addLog("Kích hoạt Mưa (+3% độ ẩm)");
    } else {
      this.rainEffect.stop();
      this.addLog("Tạnh mưa");
    }
    this.updateUI();
    sendWebCommand("rain", this.data.rain);
  }

  updateThresholds() {
    const lowEl = document.getElementById("threshLow");
    const highEl = document.getElementById("threshHigh");
    if (lowEl) this.data.threshold_low = parseInt(lowEl.value);
    if (highEl) this.data.threshold_high = parseInt(highEl.value);

    const lowValEl = document.getElementById("threshLowVal");
    const highValEl = document.getElementById("threshHighVal");
    if (lowValEl) lowValEl.innerText = `${this.data.threshold_low}%`;
    if (highValEl) highValEl.innerText = `${this.data.threshold_high}%`;
  }

  toggleMode() {
    const toggleEl = document.getElementById("modeToggle");
    if (toggleEl) {
      this.data.mode = toggleEl.checked ? "MANUAL" : "AUTO";
      const modeLabel = document.getElementById("modeLabel");
      if (modeLabel) modeLabel.innerText = this.data.mode;

      const manualBtn = document.getElementById("manualBtn");
      if (manualBtn) manualBtn.disabled = this.data.mode === "AUTO";

      this.addLog(`Chuyển chế độ: ${this.data.mode}`);
      sendWebCommand("mode", this.data.mode);
    }
  }

  toggleManualValve() {
    if (this.data.mode === "MANUAL") {
      if (this.data.rain === 1) {
        alert("Không thể bật van do trời đang mưa!");
        return;
      }
      this.data.valve_status = this.data.valve_status === 1 ? 0 : 1;
      this.addLog(
        `Thủ công: ${this.data.valve_status === 1 ? "MỞ VAN" : "ĐÓNG VAN"}`,
      );
      this.updateUI();
      sendWebCommand("valve", this.data.valve_status);
    }
  }

  updateFromMQTT(newData) {
    if (newData.moisture !== undefined)
      this.data.moisture = Math.round(newData.moisture);
    if (newData.rain !== undefined) this.data.rain = newData.rain;
    if (newData.valve !== undefined) this.data.valve_status = newData.valve;
    if (newData.mode !== undefined) {
      this.data.mode = newData.mode;
      const toggleEl = document.getElementById("modeToggle");
      if (toggleEl) toggleEl.checked = this.data.mode === "MANUAL";
      const modeLabel = document.getElementById("modeLabel");
      if (modeLabel) modeLabel.innerText = this.data.mode;
    }

    if (this.data.rain === 1) {
      this.rainEffect.start();
    } else {
      this.rainEffect.stop();
    }

    this.updateUI();
    this.updateChart();
  }

  updateChart() {
    if (this.chart) {
      const timeStr = new Date().toLocaleTimeString();
      if (this.chart.data.labels.length > 12) {
        this.chart.data.labels.shift();
        this.chart.data.datasets[0].data.shift();
      }
      this.chart.data.labels.push(timeStr);
      this.chart.data.datasets[0].data.push(this.data.moisture);
      this.chart.update();
    }
  }

  updateUI() {
    const moistureValEl = document.getElementById("moistureValue");
    if (moistureValEl) moistureValEl.innerText = `${this.data.moisture}%`;

    const sliderEl = document.getElementById("moistureSlider");
    if (sliderEl) sliderEl.value = this.data.moisture;

    const statusEl = document.getElementById("moistureStatus");
    if (statusEl) {
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
    }

    const rainEl = document.getElementById("rainStatus");
    if (rainEl) {
      rainEl.innerText =
        this.data.rain === 1 ? "🌧️ Đang Có Mưa" : "☀️ Không Mưa";
    }

    const valveText = document.getElementById("valveStatusText");
    const manualBtn = document.getElementById("manualBtn");
    if (valveText) {
      if (this.data.valve_status === 1) {
        valveText.innerText = "ĐANG TƯỚI (ON)";
        valveText.className = "display-6 fw-bold my-2 text-success";
        if (manualBtn) {
          manualBtn.innerText = "Tắt Van Thủ Công";
          manualBtn.className = "btn btn-danger mt-2 w-100";
        }
      } else {
        valveText.innerText = "NGỪNG TƯỚI (OFF)";
        valveText.className = "display-6 fw-bold my-2 text-secondary";
        if (manualBtn) {
          manualBtn.innerText = "Bật Van Thủ Công";
          manualBtn.className = "btn btn-primary mt-2 w-100";
        }
      }
    }
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
    if (tbody) {
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
  }
}

// Khởi tạo Dashboard
const app = new DashboardApp();

// =================================================================
// 3. KẾT NỐI WSS QUA CLOUDFLARE TUNNEL DÀNH CHO GITHUB PAGES
// =================================================================

// Tên miền lấy từ ảnh Terminal Cloudflare của bạn
const cloudflareDomain =
  "https://tract-bloggers-paths-linux.trycloudflare.com/";

const client = new Paho.MQTT.Client(
  cloudflareDomain,
  443, // Cổng WSS mã hóa chuẩn
  "/mqtt",
  "web_dashboard_" + Math.random().toString(16).substr(2, 8),
);

client.onMessageArrived = function (message) {
  try {
    const data = JSON.parse(message.payloadString);
    app.updateFromMQTT(data);
  } catch (e) {}
};

client.connect({
  timeout: 5,
  useSSL: true, // Bắt buộc dùng SSL/WSS cho GitHub Pages (HTTPS)
  onSuccess: function () {
    console.log(
      "Đã kết nối WSS thành công tới Mosquitto qua Cloudflare Tunnel!",
    );
    client.subscribe("esp32c6/irrigation/telemetry", { qos: 0 });
  },
  onFailure: function (message) {
    console.error("Kết nối WSS thất bại: " + message.errorMessage);
  },
});

function sendWebCommand(key, value) {
  if (client.isConnected()) {
    const payload = JSON.stringify({ [key]: value });
    const message = new Paho.MQTT.Message(payload);
    message.destinationName = "esp32c6/irrigation/command";
    client.send(message);
  }
}

function sendTelemetryUpdate(dataObj) {
  if (client.isConnected()) {
    const payload = JSON.stringify(dataObj);
    const message = new Paho.MQTT.Message(payload);
    message.destinationName = "esp32c6/irrigation/telemetry";
    client.send(message);
  }
}
