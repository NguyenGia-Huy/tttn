import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';

void main() {
  runApp(const IrrigationApp());
}

class IrrigationApp extends StatelessWidget {
  const IrrigationApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Tưới Cây ESP32',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        cardColor: const Color(0xFF1E293B),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF0DCAF0),
          secondary: Color(0xFF198754),
        ),
      ),
      home: const DashboardScreen(),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  // 1. Biến lưu dữ liệu cảm biến & trạng thái van
  double moisture = 70.0;
  bool isRaining = false;
  bool isValveOn = false;
  bool isAutoMode = true;

  MqttServerClient? client;
  bool isConnected = false;

  // 2. Địa chỉ IP máy Mosquitto Broker riêng trên Ubuntu
  final String localMosquittoIp = '192.168.1.9';

  @override
  void initState() {
    super.initState();
    _setupMqttClient();
  }

  // 3. Khởi tạo kết nối MQTT TCP (Cổng 1883)
  Future<void> _setupMqttClient() async {
    final clientId = 'Flutter_Xiaomi_${DateTime.now().millisecondsSinceEpoch}';

    client = MqttServerClient(localMosquittoIp, clientId);
    client!.port = 1883; // Cổng TCP chuẩn của Mosquitto
    client!.logging(on: false);
    client!.keepAlivePeriod = 20;
    client!.autoReconnect = true;

    client!.onConnected = () {
      if (mounted) {
        setState(() { isConnected = true; });
      }
    };

    client!.onDisconnected = () {
      if (mounted) {
        setState(() { isConnected = false; });
      }
    };

    final connMessage = MqttConnectMessage()
        .withClientIdentifier(clientId)
        .startClean()
        .withWillQos(MqttQos.atLeastOnce);
    client!.connectionMessage = connMessage;

    try {
      await client!.connect();
      if (mounted) {
        setState(() { isConnected = true; });
      }

      // Đăng ký kênh nhận dữ liệu cảm biến
      client!.subscribe('esp32c6/irrigation/telemetry', MqttQos.atLeastOnce);

      client!.updates!.listen((List<MqttReceivedMessage<MqttMessage>> c) {
        final recMess = c[0].payload as MqttPublishMessage;
        final pt = MqttPublishPayload.bytesToStringAsString(recMess.payload.message);

        try {
          final data = jsonDecode(pt);
          if (mounted) {
            setState(() {
              if (data['moisture'] != null) moisture = (data['moisture']).toDouble();
              if (data['rain'] != null) isRaining = data['rain'] == 1;
              if (data['valve'] != null) isValveOn = data['valve'] == 1;
              if (data['mode'] != null) isAutoMode = data['mode'] == 'AUTO';
            });
          }
        } catch (_) {}
      });
    } catch (e) {
      if (mounted) {
        setState(() { isConnected = false; });
      }
    }
  }

  // 4. Gửi lệnh điều khiển xuống Mosquitto Broker
  void _sendCommand(String key, dynamic value) {
    if (client != null && isConnected) {
      final builder = MqttClientPayloadBuilder();
      final message = jsonEncode({key: value});
      builder.addString(message);

      client!.publishMessage('esp32c6/irrigation/command', MqttQos.atLeastOnce, builder.payload!);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tưới Cây ESP32-C6', style: TextStyle(color: Color(0xFF0DCAF0))),
        backgroundColor: const Color(0xFF1E293B),
        actions: [
          Padding(
            padding: const EdgeInsets.all(12.0),
            child: Chip(
              backgroundColor: isConnected ? Colors.green : Colors.red,
              label: Text(isConnected ? 'Local Broker Online' : 'Offline', style: const TextStyle(fontSize: 12)),
            ),
          )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // Thẻ Độ Ẩm Đất
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    const Text('ĐỘ ẨM ĐẤT HIỆN TẠI', style: TextStyle(color: Colors.grey)),
                    const SizedBox(height: 10),
                    Text('${moisture.round()}%', style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold, color: Color(0xFF0DCAF0))),
                    Slider(
                      value: moisture,
                      min: 0,
                      max: 100,
                      onChanged: (val) {
                        setState(() { moisture = val; });
                        _sendCommand('set_moisture', val.round());
                      },
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Thẻ Cảm Biến Mưa
            Card(
              child: ListTile(
                leading: Icon(
                  isRaining ? Icons.water_drop : Icons.wb_sunny,
                  color: isRaining ? Colors.blue : Colors.orange,
                  size: 36,
                ),
                title: const Text('Cảm Biến Mưa'),
                subtitle: Text(isRaining ? '🌧️ Đang mưa (Khóa van)' : '☀️ Không mưa'),
              ),
            ),
            const SizedBox(height: 12),

            // Thẻ Điều Khiển Van
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Chế độ AUTO', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        Switch(
                          value: isAutoMode,
                          onChanged: (val) {
                            setState(() { isAutoMode = val; });
                            _sendCommand('mode', isAutoMode ? 'AUTO' : 'MANUAL');
                          },
                        ),
                      ],
                    ),
                    const Divider(),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isValveOn ? Colors.red : Colors.green,
                        minimumSize: const Size.fromHeight(45),
                      ),
                      onPressed: isAutoMode ? null : () {
                        setState(() { isValveOn = !isValveOn; });
                        _sendCommand('valve', isValveOn ? 1 : 0);
                      },
                      child: Text(isValveOn ? 'TẮT VAN TƯỚI' : 'BẬT VAN TƯỚI', style: const TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    client?.disconnect();
    super.dispose();
  }
}