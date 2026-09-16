# Hướng dẫn Khởi chạy Dự án: Hệ thống Giám sát & Bám sát Mục tiêu


## 1. Yêu cầu Nền tảng 
- **Python:** Phiên bản 3.10 trở lên.
- **Node.js:** Phiên bản LTS (v20.x trở lên).

## 2. Thiết lập Đặc quyền Thực thi (Dành riêng cho Windows PowerShell)
Nếu gặp lỗi `cannot be loaded because running scripts is disabled`, hãy chạy lệnh sau (chỉ cần làm 1 lần):
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

## 3. Cài đặt và Khởi chạy MQTT Broker (Mosquitto) 
Hệ thống sử dụng MQTT để giao tiếp giữa Backend và phần cứng (ESP32).
1. Tải và cài đặt Mosquitto: [Link tải Windows](https://mosquitto.org/files/binary/win64/mosquitto-2.0.18-install-windows-x64.exe)
2. Mở một cửa sổ PowerShell mới tại thư mục `backend`, chạy lệnh khởi động Mosquitto cùng file cấu hình (để cho phép ESP32 kết nối):
```powershell
& "C:\Program Files\mosquitto\mosquitto.exe" -c mosquitto_local.conf -v
```
> Khởi động MQTT trước khi khởi động backend

## 4. Khởi chạy Backend & AI
Mở Terminal mới ở thư mục `backend` và cấu hình Python:
```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python main.py
```
*Ghi chú: Máy chủ AI lắng nghe tại: `http://localhost:8000`. Khi chạy, AI sẽ kết nối tới MQTT Broker ở localhost.*

## 5. Khởi chạy Giao diện Web
Mở một cửa sổ Terminal mới:
```powershell
cd frontend
npm install
npm run dev
```
*Ghi chú: Giao diện hoạt động tại: `http://localhost:3000`.*

## 6. Kiểm thử Tích hợp Phần cứng Giả lập (Mock Hardware)
Để kiểm tra thuật toán giao tiếp Servo mà không cần phần cứng thực tế, mở một Terminal mới tại thư mục `backend`:
```powershell
python mock_hardware.py
```
- **Test Deadband:** Đứng trước camera và di chuyển ra mép ảnh. Cửa sổ mock sẽ in log lệnh quay Servo. Đứng ở giữa ảnh, lệnh quay sẽ ngắt.
- **Test Saccadic Masking:** Nhấn phím `1` (MOVING) trên cửa sổ giả lập để mô phỏng Servo đang quay nhanh. Cúi gập người ngã. Thuật toán té ngã sẽ bị đóng băng (không báo động). Nhấn phím `2` (STOPPED) để mở khóa thuật toán.

## 7. Các Tính Năng An Toàn
Hệ thống được thiết kế với cơ chế Fault-tolerance:
- **Cử chỉ Hủy báo động (Gesture Cancellation):** Khi còi hú, giơ 2 tay bắt chéo chữ X để AI tự động hủy còi. Lịch sử đứng thẳng vẫn được AI ghi nhớ để bắt cú ngã kế tiếp.
- **Lưu trữ (Database & Snapshots):** Khi phát hiện té ngã, hệ thống tự động chụp ảnh hiện trường lưu vào thư mục `backend/snapshots/`.
- **Gửi Cảnh báo Telegram:** Đọc tệp `backend/.env` và cấu hình Token Bot.
- **Watchdog & Heartbeat:** Máy chủ liên tục phát nhịp tim (Heartbeat `PING`) qua MQTT cho ESP32. Nếu đứt kết nối, AI tự phục hồi.

## 8. Các Bản Cập Nhật Gần Đây 
Dự án đã được tối ưu hóa toàn diện cho việc triển khai trên máy chủ đám mây hoặc máy tính Host:
- **Tự động cấu hình Phần cứng (Hardware Auto-tuning):** Hệ thống tự động quét phần cứng. Nếu có Card rời NVIDIA (GPU), AI sẽ biên dịch sang `TensorRT` (FP16). Nếu chạy thuần CPU, AI tự động dùng `OpenVINO` để ép xung tập lệnh, giúp tăng gấp ba tốc độ xử lý mà không cần cấu hình tay.
- **Thuật toán Ngã theo trạng thái (Per-track Temporal State Machine):** Mỗi người được xử lý độc lập theo `track_id`. Hệ thống yêu cầu quan sát được baseline ổn định rồi mới xác nhận chuyển tiếp bất thường; tư thế nằm ngang đơn lẻ không đủ để báo động.
- **Bao phủ nhiều kịch bản:** phát hiện chuyển tiếp đứng → nằm, ngã từ ghế, gục từ từ và đổ sụp không hoàn toàn nằm ngang bằng sự kết hợp của trọng tâm, góc thân, khoảng cách đầu–hông, dịch chuyển chuẩn hóa theo chiều cao cơ thể và bất động sau sự kiện.
- **Chống báo động giả:** người nằm sẵn, người đứng yên, di chuyển chậm và chuyển động do pan-tilt được lọc. Không khẳng định “bất tỉnh” chỉ từ RGB camera; cảnh báo được diễn đạt là sự kiện cần kiểm tra.
- **Kiểm thử tự động:** `backend/test_fall_detection.py` bao phủ các tình huống tĩnh, chuyển tiếp, gục từ ghế và multi-person.
- **Sửa lỗi Lật hình Camera:** Tích hợp lật ngang (Mirror) tự động bằng `cv2.flip` để Web hiển thị hình ảnh thuận mắt.
- **Tối ưu Băng thông:** 
  - Nén luồng Stream MJPEG bằng thuật toán nén chất lượng (`JPEG_QUALITY = 65`) giảm một nửa gánh nặng cho mạng. 
  - Thay đổi hệ thống Multiprocessing sang chuẩn `daemon=True` và xử lý triệt để lỗi kẹt hàng đợi (Queue Deadlock), giúp ứng dụng tắt nhanh, sạch gọn khi bấm `Ctrl + C`.
  - Cải tiến cử chỉ Hủy báo động (X-Gesture) với dung sai tay mở rộng, thân thiện hơn với người bệnh khi thao tác.

## Update Mới Nhất
### 1. Amnesia Bug
- **Vấn đề:** Trước đây, khi giơ tay chữ X để tắt báo động giả, AI sẽ xóa sạch lịch sử theo dõi. Nếu nạn nhân lúc này đang ngồi trên ghế và tiếp tục ngã xuống đất, AI sẽ bỏ qua vì không thấy họ "đứng thẳng" trước đó.
- **Giải pháp:** Sửa đổi `main.py` để cử chỉ chữ X chỉ Reset trạng thái còi và làm nguội cảnh báo (Cooldown), nhưng **giữ lại (preserve)** toàn bộ lịch sử tư thế. Nhờ đó, các cú ngã liên hoàn hoặc ngã sau khi hủy báo động giả đều được bắt chính xác.

### 2. Bắt lỗi "Ngã từ từ / Trôi từ trên ghế" 
- **Vấn đề:** 
  - Khung thời gian so sánh (History Window) 2.5s quá ngắn. Nếu ngã mất 5-8 giây, tốc độ quá chậm để kích hoạt.
  - Khi gục trên ghế, phần Hông không rơi xuống đất, dẫn đến logic kiểm tra `drop` (Tụt trọng tâm) bị đánh trượt.
- **Giải pháp:**
  - Tăng `history_seconds` lên `5.0s` và dùng hàm `max_spine` / `min_com_y` để quét toàn bộ lịch sử, lấy mốc đứng cao nhất làm chuẩn để so sánh. Dù ngã chậm đến đâu cũng bị phát hiện.
  - Cập nhật hàm `gradual_collapse` trong `fall_detection.py`: Hủy bỏ yêu cầu "tụt Hông" đối với trường hợp gục trên ghế. Thay vào đó, nếu Tỉ lệ khoảng cách Đầu - Hông bị tụt mạnh (`head_hip_drop >= 0.15`), AI sẽ lập tức báo động!

### 3. Khử nhiễu "Nằm nghiêng / Cuộn tròn" 
- **Vấn đề:** Khi nằm nghiêng, khung xương bị che khuất một phần khiến AI nội suy sai, làm các khớp xương nhảy múa liên tục trên màn hình. AI thấy rung lắc mạnh nên đánh giá nạn nhân "chưa nằm im" và từ chối báo động.
- **Giải pháp:**
  - Viết thêm bộ lọc **Exponential Moving Average (EMA)** vào `main.py` để làm mượt tuyệt đối Góc lưng và Trọng tâm.
  - Nới lỏng ngưỡng chịu nhiễu `max_post_impact_speed` từ `0.45` lên `0.90`. Nạn nhân nằm nghiêng hoặc cuộn tròn sẽ được nhận diện là đã nằm im ổn định.

### 4. Thiết lập MQTT 
- Tích hợp file cấu hình `mosquitto_local.conf` để mở Port 1883 `0.0.0.0` và tắt xác thực `allow_anonymous true`, sẵn sàng cho mạch ESP32 kết nối vào mạng WiFi.
- Bổ sung tín hiệu Heartbeat vào `mock_hardware.py` để liên tục kiểm chứng đường truyền MQTT.


## 9 TO DO

### 1. Vấn đề Trượt bối cảnh do Camera Panning 
**Phân tích sự cố:** 
Mặc dù thuật toán trong `fall_detection.py` đã rất tốt khi dùng `posture_change` (góc cột sống thay đổi) để tránh việc mọi Bounding Box dịch chuyển bị tính là ngã. Tuy nhiên, khi Servo MG996R quay nhanh:
- Dẫn đến hiện tượng **Motion Blur** (mờ nhòe hình ảnh). Bounding Box của MediaPipe có thể bị mất chớp nhoáng, khiến `track_id` bị đứt gãy.
- Vận tốc tương đối (`downward_speed`) theo trục Y trên khung hình có thể vô tình vọt lên cao do cả người và nền cùng bị kéo giật xuống.

**Đề xuất nâng cấp:**
- **Saccadic Masking (Mù tạm thời):** Giống như mắt người khi liếc nhanh sẽ không xử lý hình ảnh. Backend AI cần một trạng thái `is_panning`. Khi ESP32 chuẩn bị kích hoạt Servo quay ở góc lớn, nó sẽ gửi cờ (flag) qua UDP/MQTT cho Backend để AI "Bỏ qua (Skip)" các khung hình trong khoảng 200-500ms cho đến khi Servo dừng lại và hình ảnh ổn định.
- **Global Motion Compensation (Bù trừ chuyển động):** ESP32 liên tục gửi góc Pan/Tilt hiện tại lên Backend. Bạn dùng thông số góc này (hoặc hàm tính quang lưu Optical Flow của OpenCV trên nền video) để trừ đi lượng vận tốc dịch chuyển tương đối của khung hình trước khi tính toán `downward_speed` cho người.

### 2. Sự cố Sụt áp mạch và Nhiễu điện (Power Brownout)
**Phân tích sự cố:** 
Động cơ Servo MG996R khi tải nặng hoặc lúc bắt đầu khởi động có dòng đỉnh (Stall Current) cực lớn (lên tới 1.5A - 2.5A mỗi động cơ). Nếu bạn cấp nguồn chung hoặc nguồn không đủ khỏe:
- Vi điều khiển ESP32 / ESP32-CAM sẽ bị sụt điện áp đột ngột dẫn đến lỗi **Brownout Detector was triggered** và reset liên tục.
- Tín hiệu I2C/UART của Radar HLK-LD2450 bị nhiễu.

**Đề xuất nâng cấp:**
- **Phân tách nguồn triệt để:** Sử dụng mạch hạ áp (như XL4015 5A) để cấp nguồn riêng rẽ cho Servo. Nguồn 5V của ESP và cảm biến phải đi đường riêng. Chỉ nối chung Ground (GND).
- **Thêm tụ bù (Decoupling Capacitor):** Bắt buộc hàn thêm các tụ điện hóa dung lượng lớn (khoảng 470µF đến 1000µF) vào sát hai cực VCC và GND của mỗi Servo để gánh dòng khởi động.

### 3. Jittering (Rung lắc khung hình) do vòng lặp PID 
**Phân tích sự cố:**
Thuật toán AI (MediaPipe) cung cấp tọa độ liên tục, nhưng các điểm khớp xương luôn có độ rung nội tại (noise) ngay cả khi người đứng yên. Khi bạn nạp tọa độ này xuống bộ điều khiển PID của ESP32, Servo sẽ liên tục nhích qua nhích lại từng milimet gây ra hiện tượng rung bần bật video (Jittering).

**Đề xuất nâng cấp:**
- **Áp dụng Vùng chết (Deadband Threshold):** Không nên yêu cầu Servo căn người vào chính giữa 100%. Hãy đặt một vùng biên (ví dụ: ±20% ở vùng trung tâm khung hình). Chỉ khi người đi ra khỏi vùng an toàn này, ESP32 mới bắt đầu tính toán và nội suy PID để xoay Servo bám theo.
- **Bộ lọc Kalman/Low-pass:** Xử lý tọa độ `(com_y, com_x)` của AI qua một bộ lọc làm mượt tĩnh trước khi gửi qua MQTT/UDP, tránh việc Servo phản ứng thái quá với các tọa độ bị nhiễu.

### 4. Bất đồng bộ thời gian thực (Latency Mismatch & Sensor Fusion)
**Phân tích sự cố:**
Thiết kế kiến trúc phân tán giữa ESP32 (Radar, Servo) và Máy tính Host (Xử lý Ảnh). 
- Ảnh tải qua luồng MJPEG.
- Lệnh tọa độ và trạng thái gửi qua MQTT hoặc UDP.
Hai đường truyền mạng này có độ trễ khác nhau. Khi máy tính nhận được 1 Frame ảnh của quá khứ (ví dụ trễ 200ms) và ra lệnh quay, lúc này Radar đã đo được đối tượng ở vị trí mới, dẫn đến sự "so le" về không gian và thời gian.

**Đề xuất nâng cấp:**
- **Timestamp Tagging:** Mọi khung hình MJPEG phát từ ESP32-CAM và dữ liệu Radar phải được đính kèm một nhãn thời gian (Timestamp) tại phần cứng trước khi phát đi. Backend Python sẽ có một bộ đệm (Buffer) nhỏ để khớp đúng luồng thông tin của Radar với đúng Frame ảnh của Camera tại cùng một thời điểm.

### 5. Sự xung đột Hệ Quy Chiếu (Camera vs Radar)
**Phân tích sự cố:**
- HLK-LD2450 trả về tọa độ Đứng/Ngồi/Nằm trong không gian vật lý tĩnh.
- AI nhận diện tọa độ trên mặt phẳng ảnh (Pixels).
Khi Pan/Tilt di chuyển camera, góc nhìn thay đổi, hệ tọa độ của Radar (nếu cố định) sẽ không còn khớp với những gì camera nhìn thấy. 

**Đề xuất nâng cấp:**
- Phải tính toán ma trận xoay (Rotation Matrix). Nghĩa là, tọa độ X, Y mà Radar báo về phải được cộng/trừ bù trừ với góc quay Pan/Tilt hiện tại của Servo để đưa về cùng một hệ tọa độ chuẩn hóa trước khi đưa ra quyết định cảnh báo té ngã phối hợp (Sensor Fusion).

Trước khi nạp code xuống phần cứng, nên xây dựng một **Script test giả lập (Mock Hardware)** trên Python để gửi nhận các gói tin MQTT ảo, kết hợp cùng 1 video được thu sẵn, từ đó tinh chỉnh hệ số `Deadband` và xem hệ thống xử lý `Saccadic Masking` (mù tạm thời lúc quay) ra sao.