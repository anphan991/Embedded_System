## TÊN ĐỀ TÀI
**Hệ thống điều khiển vị trí Servo Camera Pan-Tilt theo dõi đối tượng kết hợp thuật toán phản hồi thị giác và cảnh báo hành vi.**

---

## 1. MỤC TIÊU DỰ ÁN
Nghiên cứu và chế tạo một hệ thống điều khiển vòng kín (closed-loop control system) cho cơ cấu Camera Pan-Tilt hai bậc tự do. Hệ thống có khả năng tự động bám sát mục tiêu dựa trên dữ liệu tọa độ không gian từ cảm biến Radar. Đồng thời, tích hợp mô hình điện toán biên (Edge Computing) để xử lý thị giác máy tính, nhằm phát hiện và cảnh báo các hành vi bất thường (như té ngã) theo thời gian thực.

Dự án đặt trọng tâm vào việc thiết kế thuật toán điều khiển vị trí động cơ, giải bài toán động học, và xử lý độ trễ tín hiệu trong kiến trúc mạng phân tán.

---

## 2. KIẾN TRÚC HỆ THỐNG
Hệ thống được thiết kế theo mô hình phân tán (Decoupled Architecture) nhằm cô lập thời gian lấy mẫu của hệ thống cơ điện tử khỏi độ trễ của quá trình xử lý hình ảnh.

Kiến trúc bao gồm 3 phân lớp (Layers):
*   **Lớp Chấp hành & Cảm biến (Sensing & Actuation):** Bao gồm vi điều khiển trung tâm (ESP32) kết nối trực tiếp với Radar và cơ cấu Servo. Phân lớp này đảm nhiệm vòng lặp điều khiển PID tần số cao.
*   **Lớp Điện toán biên (Edge Computing):** Sử dụng máy tính nội bộ (Local Host) thu thập luồng dữ liệu Video qua mạng không dây (từ ESP32-S3 CAM). Đóng vai trò là trung tâm xử lý AI và điều phối mạng.
*   **Lớp Giao diện & Đám mây (Cloud & UI):** Ứng dụng web được lưu trữ trên nền tảng đám mây, kết nối với Lớp Điện toán biên thông qua mạng riêng ảo, cung cấp giao diện giám sát cho người dùng cuối.

---

## 3. DANH SÁCH THIẾT BỊ VẬT TƯ (BILL OF MATERIALS)

**3.1. Khối Vi điều khiển và Thu thập dữ liệu**
*   **Vi điều khiển điều khiển cơ khí:** Module ESP32 DevKit V1 (30 chân). Yêu cầu hoạt động ổn định, cung cấp xung PWM chính xác.
*   **Vi điều khiển thu thập hình ảnh:** Module ESP32-S3 WROOM CAM kèm cảm biến OV5640 (5 Megapixel). Yêu cầu hỗ trợ PSRAM dung lượng cao và tích hợp ngàm cắm Anten ngoài.
*   **Cảm biến không gian:** Module Radar mmWave HLK-LD2450 (giao tiếp UART).
*   **Phụ kiện mạng:** 02 Anten rời IPEX 2.4Ghz 3dBi nhằm tăng cường chất lượng truyền dẫn gói tin.

**3.2. Khối Cơ cấu chấp hành**
*   **Động cơ:** 02 Động cơ Servo MG996R loại Digital (Kỹ thuật số), hành trình 180 độ, sử dụng bánh răng kim loại.
*   **Cơ khí:** Bộ khung Pan-Tilt hợp kim nhôm chuyên dụng cho Servo chuẩn MG996R, hoặc bản vẽ in 3D (vật liệu PETG/ABS) với độ cứng vững tương đương.

**3.3. Khối Quản lý năng lượng**
*   **Nguồn cấp chính:** Adapter nguồn DC 12V - 5A.
*   **Mạch hạ áp (Buck Converter):** Module XL4015 (chịu tải tối đa 5A). Sử dụng để chuyển đổi điện áp 12V xuống 5V, cấp nguồn song song và độc lập cho cụm Servo và cụm Vi điều khiển.

**3.4. Khối Máy chủ nội bộ (Local Host)**

---

## 4. KẾ HOẠCH TRIỂN KHAI VÀ KHUNG CÔNG NGHỆ (IMPLEMENTATION PLAN)

Dự án được chia thành 4 phân hệ chính, triển khai tuần tự theo danh sách dưới đây.

### Phân hệ 1: Hệ thống truyền phát Video (Video Streaming Node)
*   **Nhiệm vụ:** Thiết lập ESP32-S3 CAM trở thành một điểm phát hình ảnh không dây độc lập.
*   **Môi trường & Ngôn ngữ:** Arduino IDE, C++.
*   **Chi tiết thực hiện:**
    *   Sử dụng thư viện `esp_camera.h`.
    *   Cấu hình thông số hình ảnh tối ưu cho mạng không dây: Định dạng MJPEG, độ phân giải VGA (640x480), thông số nén JPEG Quality điều chỉnh ở mức 12-15.
    *   Tối ưu hóa tài nguyên bằng cách vô hiệu hóa các thuật toán nhận diện khuôn mặt cục bộ trên chip, dồn toàn bộ năng lực xử lý (Core 0 và Core 1) cho quá trình nén và phát luồng (streaming).

### Phân hệ 2: Hệ thống Động học và Điều khiển (Motion Control Node)
*   **Nhiệm vụ:** Thu thập dữ liệu không gian, tính toán động học và vận hành cơ cấu Pan-Tilt.
*   **Môi trường & Ngôn ngữ:** Visual Studio Code với PlatformIO, C++.
*   **Khung công nghệ:** Framework Arduino, thư viện `ESP32Servo`, thư viện `AsyncUDP`.
*   **Chi tiết thực hiện:**
    *   Thiết lập chuẩn giao tiếp UART để đọc mảng byte dữ liệu từ Radar HLK-LD2450, trích xuất tọa độ phẳng (X, Y).
    *   Xây dựng mô hình toán học: Chuyển đổi tọa độ Descartes (X, Y) sang tọa độ góc cầu (Pan, Tilt) bằng hàm lượng giác nghịch đảo.
    *   **Thiết kế bộ điều khiển PID:** Đưa góc sai lệch (Error) vào bộ điều khiển PID rời rạc. Tinh chỉnh các hệ số Kp, Ki, Kd để đạt đáp ứng bước tối ưu (thời gian xác lập nhanh, không vọt lố).
    *   Xây dựng luồng lắng nghe gói tin UDP không đồng bộ (Asynchronous UDP) để sẵn sàng nhận tín hiệu ghi đè (override) từ máy chủ.

### Phân hệ 3: Máy chủ Trí tuệ nhân tạo và Phân tích logic (AI & Backend Server)
*   **Nhiệm vụ:** Tiếp nhận hình ảnh, chạy mô hình học sâu (Deep Learning), xử lý logic cảnh báo và cung cấp API.
*   **Môi trường & Ngôn ngữ:** Python 3.10+, Visual Studio Code.
*   **Khung công nghệ:** FastAPI, OpenCV (`opencv-python`), MediaPipe, Uvicorn, Thư viện `threading` và `socket`.
*   **Chi tiết thực hiện:**
    *   **Xử lý luồng Video:** Sử dụng luồng (Thread) độc lập chạy nền để liên tục lấy khung hình mới nhất từ OpenCV `VideoCapture`, nhằm loại bỏ hoàn toàn độ trễ tích lũy do hàng đợi (buffer) gây ra.
    *   **Triển khai AI:** Đưa khung hình vào mô hình MediaPipe Pose để trích xuất mảng tọa độ 33 điểm khớp xương người.
    *   **Thiết kế thuật toán nhận diện té ngã:** Xây dựng thuật toán theo chuỗi thời gian dựa trên các tham số động lực học: Đạo hàm bậc nhất theo thời gian của tọa độ trục Y (vận tốc rơi) tại điểm tham chiếu (mũi/vai), kết hợp so sánh tương quan vị trí không gian với điểm đầu gối và thời gian duy trì trạng thái.
    *   **Phản hồi thị giác (Sensor Fusion):** Đo lường mức độ lệch tâm của đối tượng trên khung hình. Gửi tín hiệu bù trừ dạng gói tin UDP xuống Phân hệ 2 để tinh chỉnh quỹ đạo Servo.

### Phân hệ 4: Giao diện giám sát và Hệ thống mạng (UI Dashboard & Networking)
*   **Nhiệm vụ:** Xây dựng trung tâm điều khiển trực quan và thiết lập đường truyền bảo mật xuyên mạng.
*   **Khung công nghệ:** Next.js 14 (App Router), Tailwind CSS, shadcn/ui, WebSocket, Tailscale (VPN).
*   **Chi tiết thực hiện:**
    *   Cài đặt mạng định tuyến ảo (Tailscale) trên Máy chủ nội bộ để cấp phát IP tĩnh, loại bỏ rủi ro cấu hình Port Forwarding trên Router vật lý.
    *   Lập trình giao diện Frontend (Next.js) với các chức năng chính: Khung hiển thị Video trực tiếp độ trễ thấp, Bảng lịch sử cảnh báo sự cố, và Bảng điều khiển trạng thái kết nối phần cứng.
    *   Tạo luồng kết nối WebSocket hai chiều giữa Frontend và Backend FastAPI để cập nhật trạng thái cảnh báo theo thời gian thực (Real-time).
    *   Triển khai mã nguồn Frontend lên nền tảng đám mây Vercel.

---

## 5. TÍNH KHẢ THI VÀ PHƯƠNG PHÁP ĐÁNH GIÁ (EVALUATION METHODOLOGY)
Thành quả của dự án sẽ được đo lường thông qua các tiêu chí kỹ thuật:
1.  **Độ ổn định của hệ thống điều khiển:** Đánh giá thông qua biểu đồ đáp ứng theo thời gian thực của cơ cấu Servo, độ gợn sóng và sai số tĩnh khi bám sát đối tượng di chuyển.
2.  **Độ trễ truyền tải:** Tổng thời gian từ khi Radar nhận diện đối tượng đến khi Servo hoàn tất hành trình quay phải đạt mức tối thiểu.
3.  **Độ chính xác của thuật toán cảnh báo:** Đánh giá qua ma trận nhầm lẫn (Confusion Matrix) với các kịch bản thực tế (té ngã thật, ngồi xuống nhanh, vấp ngã) nhằm giảm thiểu tỷ lệ báo động giả (False Positive). Hệ thống đảm bảo tính toàn vẹn dữ liệu trong vận hành liên tục 24/7.

## 5. Các Tính Năng An Toàn (Mission-Critical Features)
Hệ thống được thiết kế với cơ chế chống chịu lỗi (Fault-tolerance) cấp cao:
- **Cử chỉ Hủy báo động (Gesture Cancellation):** Khi còi hú, người dùng giơ 2 tay bắt chéo chữ X để AI tự động hủy báo động.
- **Lưu trữ Bằng chứng (Database & Snapshots):** Khi phát hiện té ngã, hệ thống tự động chụp ảnh hiện trường lưu vào thư mục `backend/snapshots/` và ghi nhật ký vào SQLite (`local_alerts.db`).
- **Gửi Cảnh báo Telegram:** Đọc tệp `backend/.env` và cấu hình Token Bot để hệ thống tự động gửi ảnh qua điện thoại.
- **Watchdog Tự phục hồi:** Máy chủ liên tục giám sát Camera. Nếu rớt cáp, tự động Restart lại tiến trình. Đồng thời phát nhịp tim (Heartbeat `PING`) qua MQTT cho ESP32.

I. CÁC TÌNH HUỐNG PHẦN CỨNG (HARDWARE FAILURES)
1. Sự cố Cúp điện / Mất nguồn (Power Outage)

Tình huống: Tòa nhà bị mất điện, toàn bộ máy chủ và thiết bị tắt .
Phương án dự phòng:
Phần cứng: Cắm máy chủ (Server/Laptop) và Router Wifi vào bộ lưu điện UPS. Mạch ESP32 phải được cấp nguồn qua một mạch chuyển mạch có Pin Lithium dự phòng (ví dụ: dùng Module TP4056 + Pin 18650).
Phần mềm: Cấu hình BIOS của máy chủ để bật tính năng “Restore on AC Power Loss” (Tự động bật máy khi có điện). Cài đặt script Python chạy tự động (Auto-start) ngay khi Windows vừa khởi động.


2. Mất kết nối Mạng Internet (Internet Disconnection)

Tình huống: Nhà mạng rớt kết nối, hệ thống không thể đẩy cảnh báo qua Telegram và broker emqx.io (Cloud MQTT) bị ngắt.
Phương án dự phòng:
Chuyển sang Local MQTT Broker: Cài đặt phần mềm Mosquitto MQTT trực tiếp lên Máy chủ. Khi rớt mạng Internet, hệ thống mạng nội bộ (LAN) vẫn chạy. Máy chủ và ESP32 vẫn giao tiếp được, Servo vẫn quay, Còi hú tại chỗ vẫn hoạt động.
Sóng GSM (Module SIM): Tích hợp thêm Module SIM (SIM800L hoặc A7670C 4G) vào ESP32. Nếu Python báo mất Internet, ESP32 sẽ dùng mạng di động để gửi thẳng tin nhắn SMS truyền thống (SMS Text) tới số điện thoại người nhà.

3. Mù cảm biến (Camera chết nấm mốc / Lỗi cáp)

Tình huống: Camera bị hỏng phần cứng hoặc bị lấy đồ che lại.
Phương án dự phòng:
Tích hợp Radar LD2450 / LD2410 hoạt động độc lập trên ESP32. Trạng thái bình thường, Camera là "Boss" ra quyết định. Nhưng khi máy chủ báo lỗi Camera, ESP32 sẽ tự đưa Radar lên làm "Chỉ huy". Radar dùng sóng xuyên vật cản để dò nhịp thở và khối người bất động, tiếp tục bảo vệ bệnh nhân.


II. CÁC TÌNH HUỐNG PHẦN MỀM (SOFTWARE FAILURES)
1. Máy chủ treo hoàn toàn / Màn hình xanh (OS Crash / Blue Screen)

Tình huống: Windows bị tràn RAM hoặc hệ điều hành sập (Lúc này Watchdog của Python cũng chết theo).
Phương án dự phòng (Công tắc Tử thần - Deadman's Switch):
Như đã code ở Phase 4, Python liên tục PING cho ESP32 mỗi 1 giây.
Bên phía code C++ của ESP32, lập trình một bộ đếm: Nếu quá 15 giây không nhận được PING nào, mạch ESP tự hiểu Máy chủ đã "Chết".
Lúc này, ESP32 sẽ hú còi theo nhịp Cảnh báo phần cứng (Ví dụ: 3 tiếng bíp dài) để người nhà đang ở phòng khác biết rằng hệ thống giám sát đã bị sập và phải tự vào kiểm tra bệnh nhân.


2. Database lỗi (Database Corruption) hoặc Đầy ổ cứng

Tình huống: Ổ cứng đầy khiến SQLite không thể ghi thêm log, hoặc file DB bị hỏng.
Phương án dự phòng:
Log xoay vòng (Log Rotation): Không chỉ lưu vào SQLite, mà xuất thêm log song song ra file .csv thuần túy.
Code hệ thống tự động kiểm tra ổ cứng. Nếu dung lượng lưu trữ đầy 95%, hệ thống tự động xóa các ảnh snapshots cũ nhất (từ 1 tháng trước) để nhường chỗ cho ảnh khẩn cấp mới.


3. Lỗi dịch vụ từ bên thứ ba (Telegram API Crash)

Tình huống: Máy chủ của Telegram bị sập toàn cầu (Dù rất hiếm nhưng vẫn có thể xảy ra).
Phương án dự phòng (Multi-Channel Fallback):
Trong hàm gửi Telegram, sử dụng cơ chế try...except. Nếu gửi Telegram thất bại quá 3 lần, hệ thống sẽ tự động đổi sang kênh liên lạc số 2.
Ví dụ Kênh 2: Gửi Email qua SMTP (Gmail API) hoặc gửi SMS qua nền tảng Twilio API/Zalo ZNS.


1. Tại sao phải dùng Mosquitto MQTT (Máy chủ Cục bộ)?
Hiện tại, trong mã nguồn main.py, hệ thống đang kết nối tới broker.emqx.io. Đây là một Cloud MQTT (Máy chủ đám mây nằm trên Internet).

Điểm yếu hiện tại: Nếu nhà mạng cắt Internet hoặc đứt cáp quang biển, Python và ESP32 sẽ không thể nói chuyện với nhau. Camera thấy người ngã, nhưng không truyền được lệnh hú còi xuống ESP32.
Giải pháp Mosquitto: Mosquitto là một phần mềm siêu nhẹ (chỉ vài MB) được cài đặt trực tiếp lên Máy tính/Laptop của bạn. Lúc này, Laptop của bạn vừa chạy AI, vừa đóng vai trò làm Trạm phát sóng MQTT luôn.
Cơ chế: Khi rớt mạng Internet ngoài đường, cục Router Wifi trong nhà vẫn phát sóng nội bộ (Local LAN). Python sẽ gửi lệnh cho ESP32 thông qua sóng Wifi nội bộ này. Hệ thống của bạn sẽ chạy 100% Offline, độ trễ giảm từ 100ms xuống chỉ còn dưới 5ms, và dữ liệu hoàn toàn không bị rò rỉ ra ngoài Internet.

Báo động trên Web (Frontend): Watchdog trong mã nguồn Python phát hiện Camera trả về lỗi False. Nó lập tức đẩy lệnh báo lỗi phần cứng. Giao diện Web (Next.js) sẽ chớp nháy đỏ toàn màn hình kèm dòng chữ SENSOR DISCONNECTED.
Cắt nhịp tim (Ping): Vì AI chết, Python ngừng gửi tín hiệu PING (Heartbeat) xuống ESP32.
Phản xạ của ESP32: Mạch ESP32 đếm 10 giây không thấy PING. Nó tự hiểu là "Não bộ (Máy tính)" hoặc "Mắt (Camera)" đã mù.
Khóa Servo & Gọi hỗ trợ: ESP32 ngay lập tức ngắt điện động cơ Servo để camera không quay loạn xạ làm rối dây cáp. Đồng thời, nó phát ra tiếng còi Bíp lỗi phần cứng (ví dụ: 3 tiếng bíp ngắn liên tục, khác với còi hú té ngã dài) để báo cho người nhà đang ở phòng khách biết rằng: "Hệ thống giám sát ở phòng ông bà đã hỏng, xin hãy vào kiểm tra ngay!"