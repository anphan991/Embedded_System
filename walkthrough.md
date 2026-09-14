

## 2. Danh Sách Vật Tư Thiết Bị 

| Phân loại | Tên linh kiện / Thiết bị | Số lượng | Đơn giá dự kiến |   |
| :--- | :--- | :---: | :---: | :--- |
| **Lõi & Camera** | Mạch ESP32-CAM (OV2640) + Đế nạp CH340 | 1 | 120.000đ |  |
| **Cảm biến** | Radar HLK-LD2450 (hoặc LD2410) | 1 | 240.000đ ||
| **Cơ khí** | Động cơ Servo SG90 hoặc MG996R | 2 | 80.000đ |  |
| **Cơ khí** | Khung đế nhựa/nhôm Pan-Tilt | 1 | 50.000đ |  |
| **Cảnh báo** | Module Còi 5V (Buzzer) | 1 | có sẵn | |
| **Nguồn** | Nguồn  / Adapter 5V-3A | 1 | có sẵn ||
|  | Module ESP32 DevKit V1 | 1 | có sẵn ||
|  |  dây điện| 1 | có sẵn ||
|  |  bảng cắm dây điện| 1 | có sẵn ||
|Tổng  |    |**~565**|

## 3. Các Giai Đoạn Thực Hiện 


### Giai đoạn 1: Thiết lập Hệ thống truyền phát Video 
* **Mục tiêu:** Cấu hình ESP32-CAM trở thành một trạm phát hình ảnh không dây độc lập và ổn định.
* **Chuẩn bị:** Mạch ESP32-CAM, Đế nạp CH340, cáp USB, môi trường Arduino IDE.
* **Cách làm:**
  * Lập trình C++ sử dụng thư viện `esp_camera.h`.
  * Cấu hình nén luồng Video chuẩn MJPEG (Độ phân giải VGA 640x480) để giảm thiểu tiêu tốn băng thông Wifi nội bộ.
  * Tắt các thuật toán nhận diện khuôn mặt cục bộ trên vi điều khiển nhằm dồn 100% sức mạnh xử lý (Core 0 và Core 1) cho việc nén và truyền tải gói tin không dây độ trễ thấp.

### Giai đoạn 2: Hệ thống động học và điều khiển cơ cấu 
* **Mục tiêu:** Thu thập dữ liệu không gian từ Radar, tính toán động học và vận hành cơ cấu Pan-Tilt bám sát mục tiêu.
* **Chuẩn bị:** Vi điều khiển trung tâm, Radar đo khoảng cách/góc, Servo Pan-Tilt, Nguồn 5V-3A ổn định. Môi trường PlatformIO hoặc Arduino IDE.
* **Cách làm:**
  * Đọc giao tiếp UART từ Radar để trích xuất tọa độ phẳng (X, Y) của đối tượng.
  * Xây dựng mô hình toán học: Chuyển đổi tọa độ Descartes sang tọa độ góc quay (Pan, Tilt).
  * Triển khai bộ điều khiển PID vòng kín tần số cao nhằm điều chỉnh mượt mà góc Servo, loại bỏ hiện tượng giật cục và vọt lố.
  * Cấu hình giao thức MQTT (Subscriber) để sẵn sàng tiếp nhận lệnh điều hướng đè (override) và tín hiệu Heartbeat (`PING`) từ Máy chủ AI. Đồng thời điều khiển còi hú khi nhận lệnh.

### Giai đoạn 3: AI & Backend Server
* **Mục tiêu:** Tiếp nhận luồng Video, chạy mô hình Deep Learning nhận diện té ngã và điều phối mạng lưới phần cứng.
* **Chuẩn bị:** Máy Host hoặc VPS, Python 3.10+, FastAPI, OpenCV, Ultralytics YOLOv8.
* **Cách làm & Yêu cầu:**
  * Thiết lập môi trường Backend với cấu trúc Multiprocessing. Tách biệt luồng đọc Camera và luồng AI để ngăn ngừa thắt cổ chai vòng lặp.
  * Tích hợp tự động hóa phần cứng: Mã nguồn tự động nhận dạng GPU để biên dịch mô hình YOLO sang chuẩn `TensorRT`, hoặc ép xung CPU thông qua chuẩn `OpenVINO` nhằm tối đa hóa tốc độ suy luận (Inference Speed).
  * Phát triển detector theo trạng thái cho từng `track_id`: không báo động chỉ vì một người đang nằm ngang; phải quan sát được baseline ổn định, chuyển tiếp bất thường và trạng thái ổn định sau sự kiện.
  * Bao phủ ngã từ đứng, ngã từ ghế, gục từ từ và đổ sụp không hoàn toàn nằm ngang bằng trọng tâm, góc thân, khoảng cách đầu–hông, độ dịch chuyển chuẩn hóa theo chiều cao cơ thể và temporal confirmation.
  * Bổ sung chống nhiễu do camera pan-tilt, lọc chất lượng detection/keypoint, cooldown, pruning track cũ và event cảnh báo có `track_id`.
  * Xây dựng bộ nhận diện **Cử chỉ Hủy (X-Gesture)** và lưu bằng chứng theo event đã xác nhận.
  * Triển khai Watchdog Thread để tự động khởi động lại các tiến trình con nếu có sự cố tràn RAM hoặc mất kết nối.

### Giai đoạn 4: UI Dashboard & Networking
* **Mục tiêu:** Xây dựng trung tâm điều khiển web trực quan theo thời gian thực cho người vận hành.
* **Chuẩn bị:** Môi trường Node.js (Next.js 14+), React, Tailwind CSS.
* **Cách làm:**
  * Thiết lập mạng định tuyến ảo hoặc luồng giao tiếp nội bộ đảm bảo bảo mật.
  * Khởi tạo kết nối WebSocket hai chiều giữa Web UI và Backend FastAPI.
  * Xử lý luồng Video Stream dạng MJPEG Multipart và render thẳng lên giao diện theo thời gian thực.
  * Hiển thị bảng điều khiển cảnh báo sự cố Khẩn cấp (Critical Alerts) và Trạng thái cảm biến phần cứng trên màn hình. Lưu giữ lịch sử hệ thống.

## 4. Tiến Độ Thực Hiện Dự Án 

Dự án hiện đang trong giai đoạn phát triển tích cực. Kiến trúc Phần mềm (Software Architecture) hiện đã đạt độ hoàn thiện cao. Chi tiết trạng thái các hạng mục:

- [x] **Xây dựng cấu trúc phân tán Backend (Hoàn thành):** Đã thiết lập xong kiến trúc Multiprocessing với Watchdog. Mã nguồn chạy ổn định và sạch sẽ.
- [x] **Tối ưu hóa Thuật toán AI (Hoàn thành phiên bản nền):** Hoàn thiện mô hình `YOLOv8m-pose` cùng detector state machine theo từng người. Đã bổ sung phân tích góc thân, trọng tâm, khoảng cách đầu–hông, temporal confirmation, cooldown, lọc chất lượng và chống nhiễu pan-tilt. Xử lý queue latest-frame, watchdog và kết thúc tiến trình sạch gọn.
- [x] **Kiểm thử detector (Hoàn thành):** `backend/test_fall_detection.py` kiểm tra 5 nhóm: nằm yên, di chuyển chậm, chuyển tiếp ngã, nhiều người độc lập và gục từ ghế. Tất cả test hiện tại đều pass.
- [x] **Tích hợp các Lớp An Toàn (Hoàn thành):** Hệ thống nhận diện chuẩn xác Cử chỉ hủy báo động, cơ chế gửi ảnh cảnh báo qua API Telegram, cũng như tự động lưu log sự kiện (SQLite + Snapshots local).
- [x] **Giao diện quản trị Frontend (Cơ bản hoàn thiện):** Xây dựng thành công hệ thống lắng nghe WebSocket, đảm bảo đồng bộ hóa luồng video và tín hiệu cảnh báo ngã lên màn hình điều khiển một cách tức thời.
- [ ] **Giai đoạn 1 - Hệ thống Nhìn :**
  - Mua sắm linh kiện và cấp nguồn độc lập 5V (tối thiểu 1A) cho ESP32-CAM.
  - Nạp mã C++ lên ESP32-CAM chỉ để chuyên biệt hóa nhiệm vụ Stream Video phân giải cao qua Wifi (vô hiệu hóa toàn bộ tác vụ khác để chống nóng và giật lag).
- [ ] **Giai đoạn 2 - Hệ thống Điều khiển:**
  - Lắp ráp khung cơ khí Pan-Tilt 2 bậc tự do.
  - Sử dụng mạch **ESP32 thường** để gánh tải điều khiển 2 Servo và đọc Radar.
  - Cấp mạch nguồn 5V-3A cho ESP32 thường và Servo để chống sụt áp khi động cơ kẹt.
  - Kết nối MQTT Local cho ESP32 thường để giao tiếp hai chiều với Backend AI (Nhận tọa độ xoay Servo, kích hoạt còi, báo cáo tình trạng phần cứng).

### 4.1. Ma trận kịch bản kiểm thử Fall Detection

| Kịch bản | Kỳ vọng | Trạng thái |
| :--- | :--- | :---: |
| Đứng yên / đi chậm | Không báo động | Đã có unit test |
| Nằm yên từ đầu video | Không báo động mới | Đã có unit test |
| Đứng → ngã ngang | Xác nhận sau temporal confirmation | Đã có unit test |
| Ngồi ghế → gục từ từ | Xác nhận sau thay đổi thân + đầu–hông + bất động | Đã có unit test |
| Nhiều người | Mỗi người độc lập theo `track_id` | Đã có unit test |
| Vấp rồi tự đứng dậy | Cần video replay để đo false positive | Cần bổ sung |
| Bị che khuất / ID switch | Không suy luận qua khoảng mất track | Đã có logic bảo vệ |
| Ngã ra ngoài khung hình | Cần Radar/vùng giám sát bổ sung | Chưa đủ với RGB |
| Đã nằm sẵn rồi bất tỉnh | Cần radar/cảm biến giường hoặc người kiểm tra | Chưa đủ với RGB |

Chạy test tự động:

```powershell
cd backend
python -m unittest -v test_fall_detection.py
```

## 5. Định Hướng Triển Khai 

> Lưu ý: camera RGB chỉ có thể phát hiện tốt các sự kiện có chuyển tiếp quan sát được. Không nên tuyên bố hệ thống bao phủ 100% mọi tai nạn hoặc kết luận nạn nhân bất tỉnh nếu chưa có sensor fusion và đánh giá bằng dữ liệu thực tế.

1. **ESP32-CAM**
   * **Truyền phát Video:** Cấu hình Web Server phát luồng MJPEG.
   * **Dynamic Quality Control:** Viết thêm một hàm trên ESP32-CAM để liên tục đọc tín hiệu cường độ sóng Wifi (RSSI). Nếu sóng yếu, nó tự giảm độ phân giải/tăng độ nén JPEG để tránh đứt hình. Nếu sóng khỏe, tự động chuyển lên cấu hình nét nhất cho AI dễ làm việc.
2. **ESP32 Thường:**
   * Đấu nối chân PWM điều khiển 2 Servo và gắn Radar HLK-LD2450 (giao tiếp UART).
   * **Dẫn đường bằng Radar:** Radar dò quét toàn bộ căn phòng. Khi có người di chuyển, Radar đo được tọa độ (X, Y) của đối tượng trước tiên. ESP32 lập tức tính toán góc động học và quay Camera thẳng về hướng đó.
   * Lắng nghe MQTT để nhận lệnh Buzzer báo động từ AI.
3. **Sensor Fusion - Tính năng Wake-on-Motion bằng Radar:**
   * Thay vì để Camera stream 24/7 và làm tắc nghẽn Wifi, **Radar sẽ là cảm biến đánh thức hệ thống**. Khi phòng không có người, ESP32 thường sẽ gửi lệnh MQTT báo Camera và AI đi vào chế độ ngủ (Standby - gửi 1 FPS). 
   * Khi Radar phát hiện mục tiêu bước vào vùng quét, nó lập tức "Wake up" toàn bộ hệ thống: Xoay Servo hướng thẳng vào mục tiêu, yêu cầu Camera đẩy tốc độ lên 20-30 FPS để Backend phân tích dáng điệu.
4. **Mở rộng an toàn:** dùng radar để xác nhận người bất động, cảm biến áp lực cho giường/ghế, vùng cấm quanh cầu thang/ban công và cơ chế phát hiện người rời khỏi khung hình sau va chạm.

## 6. Phương Án Dự Phòng & Xử Lý Sự Cố 

### I. Các Tình Huống Phần Cứng 
1. **Mất Điện:**
   * *Tình huống:* Cúp điện, máy chủ và mạng sập.
   * *Phòng ngừa & Xử lý:* Host/VPS nên được đặt ở Data Center có UPS. Tại nhà bệnh nhân, mạch ESP32 và Router Wifi cần gắn pin dự phòng. Máy Host phải cấu hình BIOS "Restore on AC Power Loss" để tự bật máy khi có điện lại.
2. **Mất Kết Nối Internet / Đứt Cáp Quang:**
   * *Tình huống:* Rớt mạng ngoài, không đẩy được Telegram và mất kết nối Cloud MQTT.
   * *Phòng ngừa & Xử lý:* Chạy **Local MQTT Broker** (Mosquitto) ngay trên máy Host. Ngay cả khi mất Internet, sóng Wifi LAN nội bộ vẫn truyền tải lệnh điều khiển từ AI xuống ESP32 với tốc độ dưới 5ms. 
3. **Mù Camera (Hỏng Cáp / Bị Che Khuất):**
   * *Tình huống:* AI báo lỗi mất hình hoặc Camera bị vật cản che khuất tầm nhìn.
   * *Phòng ngừa & Xử lý (Radar Fallback):* ESP32 thường khi không nhận được tín hiệu Ping từ Camera/AI sẽ tự động chuyển sang chế độ **Radar Độc Lập**. Lúc này Radar xuyên vật cản sẽ dò nhịp thở và khối người bất động trên sàn để tự quyết định hú còi.

### II. Các Tình Huống Phần Mềm (Software Failures)
1. **Máy Chủ AI Crash / Tràn RAM:**
   * *Tình huống:* Hệ điều hành chết đứng, thuật toán AI dừng hoạt động.
   * *Phòng ngừa & Xử lý (Deadman's Switch):* Python liên tục gửi gói tin `PING` xuống ESP32 mỗi giây. Mã nguồn ESP32 chứa bộ đếm: Nếu quá 10 giây không nhận được PING, mạch tự hiểu là "Não bộ (Máy tính)" đã chết. Nó lập tức ngắt điện Servo để chống quay loạn, và phát chuỗi tiếng Bíp lỗi kỹ thuật để báo người nhà vào sửa lỗi máy tính.
2. **Lỗi Database / Tràn Ổ Cứng lưu trữ:**
   * *Tình huống:* CSDL SQLite hỏng hoặc ổ cứng đầy 100% không thể lưu hình té ngã.
   * *Phòng ngừa & Xử lý:* Các hàm thao tác CSDL được bao bọc bởi khối `try-except` an toàn. Nếu hỏng ghi log, hệ thống vẫn stream video bình thường. Tích hợp tính năng *Log Rotation* tự động xóa ảnh Snapshots cũ nhất khi dung lượng ổ cứng chạm 95%.
3. **Lỗi Dịch vụ Bên Thứ Ba:**
   * *Tình huống:* Telegram API Error.
   * *Phòng ngừa & Xử lý:* Hàm gửi tin nhắn được đặt `timeout=10` và chạy độc lập trên luồng ngầm (threading). Gửi lỗi chỉ văng warning ra log, luồng AI bắt té ngã hoàn toàn không bị đứng.
