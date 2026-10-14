# Xây dựng triển khai và đánh giá hệ thống Pan-Tilt nhận diện té ngã

## Chương 4. Xây dựng phần mềm và thiết lập kiểm thử mô phỏng

### 4.1. Môi trường phát triển

Phần mềm của hệ thống được phát triển theo ba nhóm: firmware trên ESP32, backend xử lý và giao diện web. Máy tính Windows đảm nhận việc phát triển và chạy các dịch vụ trung tâm. Firmware sử dụng Arduino IDE cùng core ESP32 của Espressif; backend sử dụng Python với môi trường riêng để quản lý thư viện; frontend sử dụng Node.js và bộ công cụ của Next.js. Việc tách môi trường giúp kiểm tra từng nhóm chức năng độc lập, đồng thời hạn chế xung đột giữa các thư viện xử lý ảnh, giao tiếp và giao diện [16].

Backend sử dụng FastAPI, Uvicorn, OpenCV, Ultralytics, Paho MQTT và SQLite. Các thư viện được khai báo trong requirements.txt, nhưng phần lớn chưa cố định phiên bản, nên khả năng tái lập môi trường cần được kiểm tra khi chuyển máy hoặc nâng cấp Python. README khuyến nghị Python 3.11 x64 cho triển khai; phiên bản thực tế của mỗi lần chạy phải được ghi cùng cấu hình thử nghiệm. Frontend đã có tệp khóa phụ thuộc, với Next.js 16.3.3 và React 19.2.8 ở phiên bản được đối chiếu. Cài đặt theo tệp khóa giúp giữ nhất quán các gói của giao diện, còn năng lực suy luận AI vẫn phụ thuộc phần cứng và runtime trên máy chủ.

Cấu hình vận hành tập trung vào nguồn video, địa chỉ MQTT broker, giao thức servo, mô hình pose và giới hạn xử lý AI. Với firmware hiện có, backend phải chọn legacy_step để các lệnh điều khiển khớp với ESP32 DevKit. Mô hình mặc định là YOLOv8m-pose; các phương án tăng tốc hoặc mô hình nhẹ hơn chỉ được sử dụng khi môi trường tương ứng đáp ứng yêu cầu. Tách cấu hình khỏi phần xử lý giúp thay đổi địa chỉ mạng và mô hình thuận tiện hơn, nhưng không thay thế việc kiểm tra tính tương thích giữa phần mềm và firmware.

### 4.2. Xây dựng firmware cho hai nút ESP32

#### 4.2.1. Firmware thu nhận và truyền hình ảnh

Firmware ESP32-CAM được hiện thực trong esp32_cam_stream.ino. Phần khởi tạo thiết lập sơ đồ chân theo profile camera, cấu hình driver, kiểm tra PSRAM và kết nối Wi-Fi trước khi mở dịch vụ HTTP. Profile bo mạch và loại cảm biến là hai thông tin cần đối chiếu riêng: nguyên mẫu sử dụng cấu hình AI Thinker ESP32-CAM với cảm biến OV3660. Sau khi khởi động, log cung cấp thông tin nhận cảm biến và địa chỉ stream để xác nhận thiết bị đã sẵn sàng trước khi backend tiếp nhận hình ảnh.

Khối phát MJPEG lấy bộ đệm ảnh từ driver, gửi dữ liệu JPEG theo từng phần của phản hồi HTTP rồi trả bộ đệm cho camera. Cách tổ chức này tránh giữ bộ đệm quá lâu sau khi gửi xong ảnh và cho phép driver tiếp tục thu khung mới. Firmware cũng có dịch vụ đọc trạng thái, điều chỉnh cấu hình ảnh và cơ chế thử kết nối lại Wi-Fi. Khi mất mạng hoặc máy nhận stream ngắt kết nối, khả năng phục hồi cần được xác nhận qua việc xuất hiện khung hình mới, thay vì chỉ dựa vào địa chỉ IP đã in ở lần khởi động trước.

#### 4.2.2. Firmware đọc radar và điều khiển Pan-Tilt

Firmware ESP32 DevKit được hiện thực trong esp32_cam_radar.ino, gồm các phần đọc UART, giải mã khung radar, chọn mục tiêu, tính góc đích, cập nhật servo và giao tiếp MQTT. Các công việc được điều phối trong setup() và loop(); chương trình chưa tạo các tác vụ FreeRTOS riêng cho từng chức năng. Bộ đệm UART và các mốc thời gian thử kết nối giúp hạn chế ảnh hưởng của xử lý mạng tới thu nhận cảm biến, còn ngoại vi PWM duy trì tín hiệu servo theo cấu hình đã thiết lập. Cách triển khai này tương đối gọn, nhưng thời gian thực thi một vòng vẫn thay đổi theo hoạt động mạng.

Callback MQTT phân loại thông điệp theo topic để đổi chế độ, nhận lệnh bước hoặc nhận tọa độ bám theo ảnh. Trong MANUAL, mỗi lệnh hợp lệ cập nhật góc đích một bước; trong AUTO, dữ liệu radar được ưu tiên theo quy tắc đã trình bày ở chương 3. Firmware đưa tọa độ radar về dạng JSON để backend xử lý, đồng thời xuất trạng thái chuyển động ước tính của servo. Các tham số góc, lọc và điểm ngắm vẫn nằm trong sketch đối với giao thức hiện hành; thay đổi chúng cần nạp lại firmware thay vì chỉ sửa biểu mẫu trên dashboard.

### 4.3. Xây dựng backend

#### 4.3.1. Tổ chức các mô-đun và vòng đời dịch vụ

Backend phân chia phần đánh giá té ngã vào fall_detection.py, truy cập SQLite vào database.py và quy tắc đóng gói lệnh servo vào servo_protocol.py. main.py thực hiện điều phối các thành phần này, khởi tạo dịch vụ web, tạo tiến trình camera và AI, tiếp nhận kết quả rồi cung cấp dữ liệu cho giao diện. Tách thuật toán và giao thức thành các mô-đun riêng giúp kiểm tra logic với đầu vào xác định mà không phải vận hành toàn bộ thiết bị, đồng thời làm rõ phần nào xử lý hành vi và phần nào chịu trách nhiệm truyền lệnh.

Vòng đời ứng dụng khởi tạo hàng đợi, vùng nhớ chỉ số và các worker trước khi phục vụ yêu cầu; khi kết thúc, cờ dừng được dùng để thông báo cho các thành phần nền. Trong lúc chạy, tiến trình web thu kết quả mới nhất từ các hàng đợi và xử lý sự kiện qua một tác vụ riêng. Vì vậy, việc ghi nhận sự cố không phụ thuộc vào việc có người đang mở dashboard. Tuy nhiên, tiến trình xử lý cảnh báo vẫn phải hoạt động và tài nguyên lưu trữ phải còn khả dụng để ảnh, metadata được ghi đầy đủ.

#### 4.3.2. Tiếp nhận video và quản lý dữ liệu theo nguồn

Tiến trình camera đọc dòng byte HTTP và tìm ranh giới JPEG để tách ảnh. JPEG được chuyển trực tiếp tới nhánh xem video, còn những khung được chọn cho suy luận được giải mã và đưa vào hàng đợi AI. Chính sách thay khung cũ bằng khung mới được thực hiện tại các hàng đợi ảnh; nhịp giải mã cho AI được điều chỉnh theo thời gian xử lý quan sát được. Như vậy, backend kiểm soát lượng công việc đưa vào suy luận, thay vì cố xử lý mọi khung mà camera phát ra.

Khi người dùng cập nhật IP camera, backend kiểm tra địa chỉ, lưu nguồn mới và tăng mã phiên nguồn video, gọi là generation. Các khung và kết quả đi kèm generation để bộ tiếp nhận nhận biết dữ liệu thuộc nguồn đang sử dụng. Cơ chế này giúp loại bỏ khung hoặc sự kiện cũ còn trong hàng đợi khi chuyển nguồn, tránh hiển thị kết quả của phiên trước lên video mới. Những bộ nhớ đệm liên quan cũng được làm mới; trạng thái kết nối chỉ được khôi phục khi backend nhận lại dữ liệu phù hợp.

#### 4.3.3. Điều khiển, cấu hình và lưu sự kiện

Các API điều khiển kiểm tra chế độ và khả năng giao tiếp trước khi gửi lệnh. Với legacy_step, backend hỗ trợ lệnh quay theo bước, hạn chế các yêu cầu đến quá nhanh và không biến chúng thành một hàng đợi chuyển động kéo dài. Những lệnh dành cho giao thức khác được từ chối khi firmware hiện tại không hỗ trợ. Quy tắc này giúp phản hồi của API phản ánh đúng phạm vi chức năng, nhưng kết quả gửi MQTT thành công vẫn chỉ là bằng chứng ở đường truyền, chưa xác nhận góc cơ khí thực tế.

Đối với danh sách vùng giám sát, backend kiểm tra loại vùng, tính hữu hạn của tọa độ, quan hệ giữa giới hạn nhỏ nhất và lớn nhất, cùng phạm vi nằm trong phòng. Dữ liệu hợp lệ được thay thế trong giao dịch SQLite; trường hợp bị từ chối không được làm mất cấu hình trước đó. API cấu hình phòng lưu kích thước, vị trí và góc radar, nhưng chưa có đầy đủ các ràng buộc kiểm tra tương tự. Các API đọc trả lại dữ liệu đã lưu để giao diện đối chiếu. Khi có sự kiện té ngã, backend lưu ảnh riêng và metadata vào cơ sở dữ liệu, sau đó phát thông báo WebSocket và thực hiện nhánh Telegram theo cấu hình. Các cảnh báo vị trí được xử lý bằng mã sự kiện riêng để không lẫn với kết luận té ngã.

### 4.4. Xây dựng giao diện giám sát

#### 4.4.1. Tổ chức các trang và khả năng sử dụng

Giao diện sử dụng Next.js và React, với TypeScript mô tả dữ liệu và Tailwind CSS tổ chức bố cục. Các trang chính gồm giám sát trực tiếp, phân tích và cấu hình phòng, nhật ký cảnh báo, cùng cài đặt hệ thống. React Context chia sẻ trạng thái cảnh báo và ngôn ngữ giữa các trang. Bản đồ radar được dựng bằng SVG để biểu diễn hệ tọa độ, mục tiêu và vùng chữ nhật có thể điều chỉnh. Cấu trúc này đặt các thao tác theo nhóm công việc của người vận hành, thay vì phân chia theo tên thư viện hoặc giao thức bên dưới.

Màn hình giám sát thích ứng với màn hình máy tính và điện thoại: video, nút điều khiển và thông báo được bố trí lại khi chiều rộng thay đổi. Với firmware legacy_step, mỗi lần nhấn gửi một bước điều khiển; giao diện tránh tự lặp hoặc tự thử lại lệnh đã hết thời gian chờ để hạn chế chuyển động ngoài ý muốn. Trang phân tích và trang cài đặt hiện yêu cầu chiều rộng từ 1.024 pixel, nên hỗ trợ trên điện thoại chủ yếu dành cho xem video, điều khiển và theo dõi cảnh báo. Phạm vi này cần được phân biệt với khả năng cấu hình đầy đủ trên máy tính.

[Vị trí chèn Hình 4.1 tại đây]

Hình 4.1. Bố cục giám sát và điều khiển trên máy tính và điện thoại.

Nguồn: Ảnh chụp màn hình hệ thống của tác giả. Gợi ý đặt hai ảnh của cùng màn hình giám sát cạnh nhau để thể hiện sự thay đổi bố cục theo kích thước thiết bị.

#### 4.4.2. Hiển thị hình ảnh và cập nhật trạng thái

Dashboard có thể hiển thị luồng JPEG trực tiếp và vẽ lớp phủ từ dữ liệu khung bao, điểm mốc do backend trả về. Luồng ảnh và dữ liệu nhận diện được cập nhật riêng, giúp video tiếp tục hiển thị khi nhịp suy luận thay đổi. Đổi lại, lớp phủ thể hiện kết quả gần nhất còn đủ mới, chưa bảo đảm khớp tuyệt đối với từng khung đang hiển thị. Giao diện kiểm tra độ mới của kết quả và trạng thái AI để ngừng vẽ dữ liệu cũ; đây là điều kiện cần để tránh hiển thị một khung xương đã lỗi thời như kết quả hiện tại.

Cảnh báo được nhận qua WebSocket, còn dữ liệu radar và các chỉ số video được truy vấn định kỳ. Bản đồ radar cập nhật khoảng mỗi 500 ms, phân biệt mục tiêu đang được quan sát với dữ liệu đã cũ và ẩn điểm không còn đủ mới. Trang nhật ký hỗ trợ tìm kiếm, lọc và đánh dấu đã xem trong phiên trình duyệt. Phần xác nhận này hiện chưa được ghi ngược vào SQLite, nên danh sách trên giao diện chưa cung cấp đầy đủ khả năng truy xuất và quản lý lịch sử bền vững của backend.

#### 4.4.3. Cấu hình và kết nối tới máy chủ

Trang phân tích cho phép nhập kích thước phòng, vị trí radar và giới hạn vùng. Các trường kích thước trên giao diện sử dụng milimét rồi đổi sang mét trước khi gửi, phù hợp với hệ dữ liệu của backend. Trang cài đặt có API cập nhật nguồn ESP32-CAM, trong khi một số trường khác mới được lưu tại trình duyệt và chưa tác động tới thuật toán. Riêng cấu hình Telegram đang được backend đọc từ biến môi trường. Vì vậy, kết quả lưu biểu mẫu cần được đối chiếu với API và trạng thái xử lý để xác định thay đổi nào đã thực sự được áp dụng.

Frontend mặc định suy ra địa chỉ backend từ hostname đang mở, giúp trình duyệt trên thiết bị khác truy cập đúng máy chủ thay vì dùng localhost của chính thiết bị đó. Trong mạng nội bộ, người dùng mở địa chỉ máy tính chạy dashboard; truy cập từ xa được tổ chức qua mạng riêng Tailscale theo hướng dẫn triển khai của dự án. Ứng dụng hiện chưa có đăng nhập và phân quyền riêng, nên việc cho phép xem video, gửi lệnh vẫn dựa vào chính sách truy cập ở lớp mạng. Quyền truy cập máy chủ vì vậy cần được giới hạn theo nhóm thiết bị và người chăm sóc được phép sử dụng.

### 4.5. Thiết lập kiểm thử bằng dữ liệu mô phỏng

Mô phỏng trong dự án được thực hiện ở mức dữ liệu và giao tiếp. Công cụ mock_hardware.py kết nối tới Mosquitto để phát JSON tọa độ radar và gửi trạng thái MOVING, STOPPED. Các chế độ tạo mục tiêu đứng yên, tọa độ biến đổi hoặc một quỹ đạo chữ nhật giúp quan sát cách backend nhận dữ liệu và cập nhật bản đồ. Công cụ này sử dụng broker thật nhưng thay nguồn cảm biến bằng dữ liệu tổng hợp; nó không tái hiện mạch điện, quá trình thu UART, chất lượng ảnh hoặc chuyển động cơ khí của servo.

Tọa độ mô phỏng thuộc hệ radar và phải đi qua phép đổi hệ phòng trước khi xét vùng. Vì vậy, tên một chế độ như “vùng an toàn” hoặc “vùng nguy hiểm” chưa đủ để bảo đảm điểm phát ra nằm trong vùng đã cấu hình. Khi thiết lập thử nghiệm, cần tính vị trí sau phép quay, tịnh tiến và chọn giới hạn SAFE, DANGER tương ứng. Công cụ hiện phát dữ liệu khoảng một lần mỗi giây, nên phù hợp kiểm tra dòng dữ liệu và ngữ cảnh vùng hơn là mô phỏng chính xác tốc độ cập nhật của radar vật lý.

Các kiểm thử tự động bổ sung đầu vào xác định để đánh giá những quy tắc khó quan sát chỉ qua giao diện. test_fall_detection.py cấp chuỗi đặc trưng cho máy trạng thái; test_zone_config.py dùng cơ sở dữ liệu tạm để kiểm tra cấu hình; test_servo_control.py thay broker bằng đối tượng giả để kiểm tra lệnh phát ra. Những bộ kiểm thử này giúp tái lập tình huống và kiểm tra phản hồi mong đợi, nhưng không chạy toàn bộ chuỗi camera–mô hình pose–servo. Phạm vi và kết quả chạy được phân tích riêng ở chương 6.

[Vị trí chèn Hình 4.2 tại đây]

Hình 4.2. Kiểm thử tọa độ radar mô phỏng qua MQTT và bản đồ phòng.

Nguồn: Tác giả xây dựng và chụp từ quá trình kiểm thử. Gợi ý thể hiện cùng một tọa độ ở bản tin radar, kết quả chuyển sang hệ phòng và vị trí trên bản đồ; ghi rõ đây là dữ liệu mô phỏng.

### 4.6. Thiết kế các kịch bản kiểm thử

Nhóm kịch bản nhận diện cần đánh giá diễn tiến của từng track theo thời gian. Với một track đủ chất lượng (độ tin cậy bounding box từ 0,55 và độ tin cậy trung bình của các keypoint vùng thân từ 0,35), người đã nằm ngay từ đầu chuỗi phải ở trạng thái observed_horizontal và không phát cảnh báo. Tiếp đó, giữ người đứng yên ít nhất 0,45 giây để xác lập trạng thái upright làm baseline, rồi kiểm tra riêng cú ngã nhanh từ đứng sang nằm ngang và tình huống gục dần khi ngồi. Cả hai trường hợp phải đi qua candidate và chỉ chuyển sang confirmed khi dấu hiệu sụp đổ còn hiện diện, tư thế đã ổn định; cấu hình hiện tại yêu cầu thời gian ứng viên tối thiểu 0,70 giây ở nhánh thông thường hoặc 1,20 giây ở nhánh gục dần. Đây là ngưỡng của máy trạng thái, không phải độ trễ toàn hệ thống. Cần bổ sung chuỗi mất quan sát quá 0,90 giây, camera đang quay và xuất hiện từ hai người có pose thân hợp lệ: sau gián đoạn, bộ nhận diện không được nối suy luận qua khoảng mất dấu; chuyển động toàn khung không được tự tạo biến cố té ngã; trường hợp nhiều người phải hiện MUTED và không xác nhận té ngã. Các tình huống này cần được kiểm tra cùng luồng video và backend.

Nhóm kịch bản cấu hình vùng dùng tọa độ radar sau khi chuyển sang hệ tọa độ phòng. API chỉ chấp nhận vùng SAFE hoặc DANGER có tọa độ hữu hạn, thỏa mãn x_min < x_max và y_min < y_max, đồng thời nằm trong kích thước phòng; cần xác nhận API từ chối tọa độ NaN/Inf, giới hạn đảo ngược hoặc vượt biên; điểm đúng trên biên được tính là nằm trong vùng, còn vùng chồng lấn phải cho DANGER ưu tiên. Khi radar vừa cập nhật trong vòng 2 giây và mục tiêu nằm trong SAFE mà không đồng thời thuộc DANGER, video phải hiện SAFE ZONE và bộ nhận diện phải xóa lịch sử té ngã của track, tránh biến tư thế nghỉ hoặc ứng viên cũ thành cảnh báo. Sau khi rời SAFE, track cần tạo baseline mới; dữ liệu radar quá 2 giây không còn được dùng để duy trì trạng thái SAFE. Khi mục tiêu đi vào DANGER, backend phát sự kiện DANGER_ZONE một lần cho lần chuyển trạng thái đó; việc ở lại trong vùng không được tạo cảnh báo lặp liên tục. DANGER không tắt bộ nhận diện té ngã, vì vậy hai sự kiện xâm nhập vùng và té ngã cần được kiểm tra độc lập; nếu SAFE và DANGER chồng lấn, trạng thái hiệu lực là DANGER. Nhóm điều khiển kiểm tra lệnh theo giao thức thực tế, chế độ MANUAL, mất kết nối broker và giới hạn tần suất gửi. Các nhánh sequenced_hold chỉ đánh giá logic hỗ trợ giao thức đó trong backend, không đại diện cho firmware legacy_step đang dùng.

Nhóm kịch bản tích hợp lần lượt ngắt luồng video, dừng bản tin radar, mất broker và mất Internet trong khi mạng nội bộ còn hoạt động để ghi nhận chức năng nào tiếp tục, trạng thái nào trở nên cũ và điều kiện phục hồi. Cần kiểm tra thêm việc thay đổi vùng SAFE/DANGER khi hệ thống đang chạy, đồng thời tăng số phiên xem và ghi riêng RAW FPS, AI FPS, độ mới của kết quả nhận diện cùng số khung bị bỏ. Theo số liệu quan sát hiện có, luồng camera RAW đạt tối đa khoảng 30 FPS; AI thường đạt khoảng 15–20 FPS, có thể dao động thêm xấp xỉ ±5 FPS hoặc thấp hơn tùy năng lực phần cứng, kết nối và nguồn điện. Đây là mốc quan sát để thiết kế phép đo, chưa phải kết quả kiểm thử tải có kiểm soát. Các kịch bản trên chỉ được xem là hoàn thành sau khi đã chạy và ghi nhận kết quả. Sau khi kiểm tra phần mềm theo phạm vi này, hệ thống được lắp ráp và xác nhận trên thiết bị thật.

## Chương 5. Thiết lập và triển khai phần cứng

### 5.1. Chuẩn bị thiết bị và môi trường triển khai

Nguyên mẫu sử dụng ESP32-CAM, ESP32 DevKit, radar HLK-LD2450, hai servo MG996R, giá Pan-Tilt và khối nguồn gồm adapter cùng XL4015 theo thiết kế ở chương 3. Camera được gắn lên cơ cấu quay, còn radar giữ vị trí cố định để hệ quy chiếu không đổi khi camera chuyển động. Vị trí lắp phải cho phép nhìn được phần thân và vùng sàn cần giám sát, đồng thời tránh để dây kéo căng hoặc vướng vào hai trục quay. Độ cao camera và hướng radar cần được ghi lại vì chúng ảnh hưởng tới ánh xạ góc và cấu hình bản đồ.

Trước khi ghép tải, cần kiểm tra đầu ra bộ hạ áp theo điện áp sử dụng, sau đó mới nối nguồn cho từng cụm. Nhánh servo cần có dây và đầu nối phù hợp với dòng khi chuyển động, còn GND được nối chung với khối logic. Bước chuẩn bị này nhằm hạn chế sai lệch do cấp nguồn và cơ khí trước khi điều chỉnh thuật toán. Việc servo không chuyển động hoặc ESP32 bị reset phải được phân biệt với lỗi điều khiển phần mềm; chỉ thay tham số khi đường nguồn, chân tín hiệu và giới hạn cơ khí đã được xác nhận.

Máy tính triển khai cần có môi trường backend, frontend, Mosquitto và mô hình pose đã chọn. Hai firmware được nạp đúng bo với cấu hình Wi-Fi và địa chỉ broker phù hợp. Serial Monitor được dùng để kiểm tra phiên bản sketch, cảm biến camera và địa chỉ thiết bị sau khởi động. Ba quan hệ cấu hình phải thống nhất: backend với ESP32 DevKit dùng cùng broker, backend mở đúng stream ESP32-CAM, và giao thức điều khiển phù hợp với firmware. Sai lệch ở một trong ba quan hệ có thể khiến giao diện vẫn mở nhưng một nhánh giám sát không hoạt động.

### 5.2. Lắp ráp và kiểm tra từng phân hệ

#### 5.2.1. Nguồn, cơ khí và điều khiển thủ công

Quy trình kiểm tra bắt đầu từ từng trục servo trước khi chạy tự động. Trong MANUAL, người vận hành thử các hướng quay và RESET để đối chiếu chiều chuyển động, vị trí tâm và khoảng hành trình thực tế. Quan sát phải xác nhận camera quay theo lệnh, không chạm cữ và không gây kéo dây ở các vị trí sử dụng. Đồng thời, cần đo điện áp tại tải khi cả hai trục hoạt động để đánh giá sụt áp và khả năng duy trì nguồn. Giới hạn phần mềm hỗ trợ bảo vệ hành trình nhưng không thay thế bước kiểm tra cơ cấu sau lắp ráp.

Đường lệnh được đối chiếu từ thao tác trên dashboard, phản hồi API, bản tin MQTT đến log nhận lệnh ở ESP32. Với legacy_step, thiết bị chưa cung cấp xác nhận góc thực cho từng yêu cầu, nên việc broker nhận lệnh không đủ để kết luận servo đã thực hiện. Phương pháp kiểm tra từng điểm giúp khoanh vùng: nếu lệnh chưa tới firmware thì xem lại giao tiếp; nếu firmware đã nhận mà cơ cấu không đáp ứng thì kiểm tra tín hiệu PWM, nguồn, dây và tải cơ khí.

#### 5.2.2. Camera và luồng video

ESP32-CAM được kiểm tra độc lập bằng thông tin cảm biến, PSRAM và việc nhận được stream trong cùng mạng. Khi chuyển sang tích hợp, backend giữ kết nối trực tiếp tới camera để phân phối hình ảnh cho dashboard. Do firmware chỉ phục vụ một stream trực tiếp đồng thời, phiên kiểm tra mở riêng tới ESP32-CAM cần được đóng trước khi backend tiếp nhận. Sau đó, luồng trực tiếp và luồng có kết quả AI được kiểm tra riêng để xác định lỗi nằm ở thu hình hay suy luận.

Trạng thái video được đối chiếu với thời điểm khung gần nhất, RAW FPS, AI FPS và độ mới của lớp phủ. Nếu luồng trực tiếp vẫn chạy nhưng AI ngừng tạo kết quả, việc giảm chất lượng camera chưa chắc giải quyết được nguyên nhân; cần xem worker, mô hình và thời gian xử lý. Ngược lại, nếu khung thô bị gián đoạn, cần kiểm tra Wi-Fi, địa chỉ camera, trạng thái stream và nguồn thiết bị trước khi điều chỉnh ngưỡng phát hiện té ngã. Cách tách hai nhánh này giúp tránh dùng cùng một biện pháp cho các lỗi có bản chất khác nhau.

#### 5.2.3. Radar và hệ tọa độ phòng

Radar được kiểm tra từ dữ liệu UART trước khi dùng để dẫn hướng. Các chỉ số chẩn đoán trong firmware cho biết có byte mới, có khung hợp lệ, có mục tiêu phù hợp và có dữ liệu đã được gửi lên MQTT hay không. Nếu không có byte, kiểm tra đường TX–RX, nguồn và baud; nếu có byte nhưng khung không hợp lệ, xem lại định dạng và cấu hình xuất dữ liệu của mô-đun. Phân biệt các trạng thái này giúp xác định lỗi thu nhận thay vì coi mọi trường hợp không có chấm trên bản đồ là radar không phát hiện người.

Sau khi nhận tọa độ, người thử di chuyển sang trái, phải, gần và xa để xác nhận dấu trục. Vị trí và góc radar được nhập theo mặt bằng thực, rồi đối chiếu điểm đứng với chấm sau chuyển đổi tọa độ. Vùng SAFE chỉ bao phủ nơi nghỉ có chủ đích, còn DANGER được đặt ở khu vực cần cảnh báo. Bước hiệu chuẩn phải được hoàn tất trước khi dùng ngữ cảnh vùng để đánh giá té ngã, vì một cấu hình SAFE quá rộng có thể làm hệ thống bỏ qua sự cố trên sàn hoặc lối đi.

[Vị trí chèn Hình 5.1 tại đây]

Hình 5.1. Các vị trí đối chiếu tọa độ radar và hướng camera trong phòng thử nghiệm.

Nguồn: Tác giả xây dựng từ mặt bằng và ảnh nguyên mẫu. Gợi ý đánh dấu vị trí radar, camera, điểm đứng kiểm tra và vùng nghỉ; ghi các kích thước đã đo thực tế khi bổ sung hình.

### 5.3. Tích hợp và xử lý các tình huống vận hành

#### 5.3.1. Khởi chạy dịch vụ và xác nhận luồng hoạt động

Trình tự tích hợp bắt đầu từ nguồn và hai nút ESP32, sau đó khởi chạy Mosquitto, backend và frontend. Backend cần hoàn tất khởi tạo mô hình, worker và kết nối camera trước khi đánh giá khả năng nhận diện. MANUAL được kiểm tra trước AUTO để xác nhận đường điều khiển và chiều quay. Khi chuyển sang AUTO, đối tượng được thử ở nhiều vị trí trong vùng phòng đã hiệu chuẩn để quan sát camera hướng theo radar, kết quả pose còn đủ rõ và trạng thái chuyển động được chuyển tới backend.

Việc xác nhận một sự kiện phải đi xuyên các khối: máy trạng thái tạo quyết định, backend lưu ảnh và metadata, dashboard nhận thông báo, còn Telegram được kiểm tra riêng nếu đã cấu hình. Thời điểm gửi hoặc tiếp nhận ở mỗi kênh cần được phân biệt để xác định nơi phát sinh chậm trễ. Một sự kiện đã lưu nhưng chưa có tin nhắn không nhất thiết là lỗi nhận diện; nguyên nhân có thể nằm ở thời gian giãn cách gửi, kết nối Internet hoặc cấu hình Telegram. Các tình huống dưới đây được dùng để định hướng chẩn đoán, không mặc nhiên được coi là những lỗi đã xảy ra và đã được xử lý thành công trong mọi lần chạy.

#### 5.3.2. Sai địa chỉ mạng hoặc giao thức điều khiển

Địa chỉ máy chạy broker thay đổi sẽ ảnh hưởng cả backend và ESP32 DevKit, vì địa chỉ MQTT trong firmware được biên dịch vào sketch. Cần cập nhật đồng thời hai phía và nạp lại DevKit khi thông tin broker thay đổi. Đối với ESP32-CAM sử dụng địa chỉ động, backend có thể cập nhật IP camera qua giao diện mà không cần nạp lại firmware nếu Wi-Fi không đổi. Khi dashboard được mở từ máy khác, địa chỉ backend phải trỏ tới máy chủ thực, không phải localhost của thiết bị đang xem.

Sai giao thức servo tạo ra một dạng lỗi khác: backend có thể gửi được bản tin nhưng payload không nằm trong tập lệnh firmware nhận. Vì vậy, legacy_step phải được chọn cho sketch hiện hành, đồng thời kiểm tra chế độ MANUAL trước khi thử lệnh bước. Khi dịch vụ không khởi động được, cần xác nhận không có một broker hoặc backend khác đang giữ cùng cổng. Cách kiểm tra này bám vào các quan hệ kết nối thực tế của dự án, thay vì quy mọi lỗi vận hành về một mã HTTP chung.

#### 5.3.3. Nguồn không ổn định, mất dữ liệu và cảnh báo ngoài dự kiến

Servo rung, chuyển động ngắt quãng hoặc ESP32 reset có thể liên quan đến nguồn, GND, tải cơ khí hoặc chân tín hiệu chưa khớp với firmware. Các yếu tố này cần được kiểm tra trước khi thay hệ số làm mượt. Với radar, dữ liệu có thể đã tới broker nhưng không hiện trên bản đồ nếu backend không còn nhận điểm mới hoặc cấu hình hệ tọa độ không phù hợp. Với camera, việc liên tục thử mở stream từ nhiều nơi có thể gây tranh chấp kết nối trực tiếp. Mỗi tình huống cần được đối chiếu bằng chỉ số và log của đúng phân hệ, tránh suy luận nguyên nhân chỉ từ biểu hiện trên giao diện.

Khi không có cảnh báo té ngã, trước hết cần đọc trạng thái phân tích. OBSERVED_HORIZONTAL cho biết thiếu lịch sử tư thế ban đầu; SAFE ZONE là nhánh dùng ngữ cảnh nghỉ; MUTED thể hiện điều kiện nhiều người; còn dữ liệu pose cũ hoặc camera đang quay có thể làm chậm việc hình thành ứng viên. Đây là các điều kiện của phương pháp, không phải lúc nào cũng là lỗi phần mềm. Ngược lại, cảnh báo ngoài dự kiến cần được xem lại chuỗi ảnh và vị trí vùng để xác định nguyên nhân từ đặc trưng tư thế, theo dõi ID hay cấu hình không gian. Việc thử nghiệm phải ghi nhận cả trường hợp báo nhầm và trường hợp bị bỏ qua để đánh giá đúng mức đáp ứng của nguyên mẫu.

## Chương 6. Kết quả kiểm thử và đánh giá nguyên mẫu

### 6.1. Phạm vi và căn cứ đánh giá

Kết quả được xem xét ở hai cấp: kiểm thử các quy tắc phần mềm với đầu vào xác định và quan sát vận hành nguyên mẫu. Cấp thứ nhất cho phép kiểm tra quyết định của máy trạng thái, tính hợp lệ của cấu hình và cách phát lệnh mà không phụ thuộc thiết bị. Cấp thứ hai phản ánh tốc độ luồng camera, tốc độ xử lý AI và biểu hiện khi hệ thống hoạt động với hình ảnh thực. Hai cấp bổ sung cho nhau nhưng đo các thuộc tính khác nhau; kiểm thử logic đạt không tự chứng minh chất lượng điểm mốc hoặc khả năng bám của servo trong phòng.

Trong đợt kiểm tra ngày 11/10/2026, 25 ca kiểm thử hiện có đã được chạy trên bản sao cách ly của các mô-đun, giữ nguyên nội dung mã nguồn [17]. Số liệu vận hành được người thực hiện cung cấp gồm RAW FPS có thể đạt khoảng 30 FPS và AI FPS thường khoảng 15–20 FPS, có dao động tùy điều kiện [18]. Các ghi nhận tốc độ chưa đi kèm thời lượng đo, cấu hình máy tính, thống kê theo phiên hoặc tập video gán nhãn đầy đủ. Vì vậy, chương này sử dụng chúng để phân tích khả năng vận hành và các giới hạn quan sát được, chưa tính độ chính xác nhận diện hoặc khẳng định độ trễ toàn hệ thống.

### 6.2. Kết quả kiểm thử phần mềm

#### 6.2.1. Máy trạng thái phát hiện té ngã

Năm ca trong test_fall_detection.py đều đạt. Các chuỗi nằm sẵn và dịch chuyển rất chậm không tạo sự kiện mới được xác nhận; chuỗi chuyển từ tư thế thẳng sang ngang và chuỗi gục khi ngồi có thể được xác nhận theo điều kiện thuật toán. Ca có hai ID kiểm tra việc giữ trạng thái của hai chuỗi trong tình huống đã xây dựng, không ghi nhận cảnh báo sai ở các assertion của ca đó. Các kết quả cho thấy máy trạng thái phản hồi đúng với những đặc trưng tổng hợp và trình tự thời gian mà bộ kiểm thử cung cấp.

Đầu vào của bộ này là FallObservation, nên không kiểm tra chất lượng phát hiện người, độ tin cậy điểm mốc hoặc thay đổi Track ID do YOLO và BoT-SORT tạo ra. Những tình huống như camera quay, SAFE, MUTED, mất dấu và chuỗi cảnh báo toàn tuyến cũng chưa được bao phủ đầy đủ bởi năm ca hiện có. Do đó, kết quả 5/5 được hiểu là các điều kiện kiểm thử đã đạt, không phải tỷ lệ nhận diện đúng trên năm người hoặc năm video thực. Đây là cơ sở kiểm tra logic trước khi mở rộng đánh giá bằng dữ liệu hình ảnh.

#### 6.2.2. Cấu hình vùng và tính nhất quán dữ liệu

Năm ca trong test_zone_config.py đều đạt trên SQLite tạm. Danh sách vùng hợp lệ được thay thế và chuẩn hóa; vùng có giới hạn đảo ngược, tọa độ NaN hoặc vượt biên phòng bị từ chối. Khi cập nhật không hợp lệ, cấu hình trước đó được giữ lại. Phép kiểm tra điểm thuộc vùng xử lý đúng các điểm ở biên trong các trường hợp được thử. Những kết quả này xác nhận một số ràng buộc quan trọng của dữ liệu cấu hình, hạn chế việc một thao tác nhập sai làm thay đổi không gian giám sát ngoài dự kiến.

Bộ kiểm thử chưa đánh giá sai số của radar, phép hiệu chuẩn vị trí lắp hoặc tác động của SAFE tới quyết định té ngã khi chạy cùng ảnh thực. Một vùng hợp lệ về số học vẫn có thể sai về vị trí ứng dụng, chẳng hạn bao phủ cả lối đi thay vì chỉ mặt giường. Vì vậy, kiểm tra cơ sở dữ liệu và đối chiếu mặt bằng thực là hai bước cần thực hiện cùng nhau. Độ nhất quán khi lưu cấu hình không đồng nghĩa với tính đúng đắn của cách phân vùng phòng.

#### 6.2.3. Đường điều khiển servo

Mười lăm ca trong test_servo_control.py đều đạt, gồm bảy ca ở nhóm legacy_step và tám ca ở nhóm sequenced_hold. Nhóm legacy_step kiểm tra lệnh bước, giới hạn yêu cầu lặp, điều kiện broker và chế độ, từ chối khả năng không hỗ trợ, phân biệt xác nhận broker với xác nhận thiết bị và quy đổi tọa độ bám về VGA. Nhóm sequenced_hold kiểm tra các quy tắc của nhánh giao thức nâng cao, trong đó có thứ tự lệnh, lệnh dừng và cách xử lý thông tin chẩn đoán. Việc hai nhóm cùng có trong backend giúp kiểm tra sự phân biệt giữa các profile, nhưng nguyên mẫu hiện sử dụng firmware legacy_step.

Các ca gọi trực tiếp hàm backend và dùng Broker giả ghi lại bản tin phát ra; không khởi chạy broker thật, REST qua mạng hoặc servo. Kết quả vì vậy chứng minh các assertion về logic điều khiển hiện có đã đạt, chưa đo thời gian truyền lệnh hay góc quay thực. Tổng cộng 25/25 ca đạt trên ba bộ kiểm thử. Hai lượt chạy sử dụng Python 3.12.14 cho bộ té ngã, vùng và Python 3.14.5 trong môi trường dự án cho bộ servo; thông tin này được lưu trong biên bản để tái lập, không được dùng làm cấu hình của phép đo FPS vận hành.

### 6.3. Tốc độ hình ảnh và khả năng đáp ứng

#### 6.3.1. Ghi nhận RAW FPS và AI FPS

RAW FPS của backend là số khung JPEG được tiếp nhận trong một giây, còn AI FPS là số khung hoàn thành nhánh xử lý AI, bao gồm các công việc đi kèm suy luận. Theo quan sát của người thực hiện, RAW FPS có thể đạt khoảng 30 FPS ở điều kiện phù hợp. AI FPS thường ở khoảng 15–20 FPS khi khung hình trống và có thể cao hơn; khi có người cùng lớp phủ nhận diện, nhịp xử lý cũng thường ở khoảng 15–20 FPS nhưng có lúc thấp hơn, với mức biến động khoảng vài FPS, có thể xấp xỉ 5 FPS quanh mức đang quan sát [18]. Những giá trị này mô tả khoảng vận hành đã ghi nhận, không phải tốc độ cố định, FPS của trình duyệt hay tốc độ riêng phép suy luận mô hình.

Kiến trúc tách nhánh xem trực tiếp khỏi AI cho phép luồng ảnh được cập nhật ở nhịp khác với kết quả nhận diện. Khi RAW FPS cao hơn AI FPS, backend chỉ chọn một phần khung để phân tích và bỏ các khung chờ đã cũ. Điều này phù hợp với quan sát video vẫn có thể liên tục trong khi lớp phủ thay đổi chậm hơn. Tuy nhiên, phần hình ảnh giữa hai lần suy luận không được máy trạng thái phân tích đầy đủ; một chuyển tiếp ngắn có thể chỉ tạo ra ít quan sát, nên việc tăng độ mượt khi xem chưa chắc làm tăng khả năng phát hiện sự cố.

Trần AI_FPS_LIMIT mặc định là 15 FPS, có thể thay đổi qua cấu hình; nhịp cấp ảnh còn được điều chỉnh theo thời gian xử lý. Các phiên quan sát chưa ghi lại giá trị giới hạn thực tế, nên khoảng 15–20 FPS chưa được đối chiếu trực tiếp với cấu hình mặc định. Phép đo lặp lại cần ghi tham số này cùng mô hình, runtime, độ phân giải và phần cứng. Sự có mặt của người làm phát sinh thêm công việc theo dõi, tính đặc trưng và vẽ lớp phủ, trong khi Wi-Fi và lượng dữ liệu JPEG ảnh hưởng tới nhánh thu hình. Nguồn điện không ổn định cũng có thể gây gián đoạn thiết bị. Mức ảnh hưởng riêng của các yếu tố cần được xác định bằng log và phép đo thay vì suy ra chỉ từ khoảng FPS.

[Vị trí chèn Hình 6.1 tại đây]

Hình 6.1. Chỉ số RAW FPS và AI FPS trong một phiên vận hành nguyên mẫu.

Nguồn: Ảnh chụp màn hình hệ thống của tác giả. Gợi ý dùng ảnh có đồng thời hai chỉ số, thời điểm chụp và cấu hình mô hình; số tại một thời điểm chỉ minh họa trạng thái của phiên, không thay thế thống kê theo thời gian.

#### 6.3.2. Độ trễ hiển thị và cảnh báo

FPS biểu diễn số khung hoàn thành trong một đơn vị thời gian, còn độ trễ biểu diễn thời gian từ một tình huống đến kết quả người dùng nhận được. Backend có các chỉ số giải mã, suy luận, mã hóa và pipeline để hỗ trợ xác định khâu xử lý chậm. Chỉ số pipeline được tính trong luồng xử lý của backend, không bao gồm đầy đủ mọi thành phần từ cảm biến đến màn hình người chăm sóc. Một luồng có FPS cao vẫn có thể trễ nếu dữ liệu đã tồn đọng trước khi được tiếp nhận hoặc nếu trình duyệt cập nhật chậm.

Với té ngã, thời gian phản hồi còn gồm giai đoạn xác lập tư thế, hình thành ứng viên và chờ điều kiện xác nhận. Việc camera quay, mất dấu hoặc thay đổi ID có thể kéo dài quá trình này. Sau xác nhận, thông báo dashboard và Telegram đi theo hai kênh có đặc điểm khác nhau; Telegram còn chịu điều kiện kết nối ngoài và thời gian giãn cách gửi. Hiện chưa có phép đo đồng bộ từ mốc bắt đầu tình huống tới thời điểm nhận cảnh báo, nên không chuyển khoảng 15–20 AI FPS thành một con số độ trễ phát hiện. Phép đo sau này cần ghi riêng thời điểm xác nhận tại backend và thời điểm thông báo xuất hiện ở từng kênh.

### 6.4. Mức bao phủ chức năng và các điều kiện gián đoạn

#### 6.4.1. Nhận diện tư thế và điều hướng

Mã nguồn đã hiện thực chuỗi thu ảnh, ước lượng pose, theo dõi và đánh giá té ngã, đồng thời hỗ trợ dẫn hướng ưu tiên radar trong AUTO. Các kiểm thử tổng hợp xác nhận một số quy tắc phát hiện, còn quan sát FPS cho thấy hệ thống có thể duy trì nhịp xử lý liên tục trong các điều kiện đã chạy thử. Tuy nhiên, tỷ lệ phát hiện, báo nhầm và sai số bám chưa được xác lập do chưa có tập tình huống thực được gán nhãn và thống kê đủ số lần thử.

Đánh giá nhận diện cần tính theo sự kiện thay vì chỉ đếm các khung có nhãn ngã. Một lần ngã kéo dài trên nhiều khung vẫn là một sự kiện; hoạt động sinh hoạt bị cảnh báo được ghi là báo nhầm, còn sự cố không tạo cảnh báo trong khoảng đánh giá được ghi là bỏ sót. Kết quả cần tách theo các điều kiện có ảnh hưởng như nằm nghỉ, ngồi xuống, cúi người, gục khi ngồi, che khuất và camera đang quay. Với điều hướng, cần đối chiếu vị trí người trong khung, thời gian đưa vào vùng quan sát và các điểm camera không bám được, vì radar có tọa độ không đồng nghĩa camera đã thu được pose đủ rõ.

#### 6.4.2. Tải xử lý và phục hồi

Hàng đợi ảnh hữu hạn và cơ chế ưu tiên khung mới giúp hạn chế phần tồn đọng trong backend. Luồng xem trực tiếp cũng giảm phụ thuộc vào thời gian suy luận, còn watchdog khởi động lại worker đã dừng. Đây là các biện pháp hỗ trợ vận hành, nhưng chưa có kết quả thử tải theo số phiên xem, mức CPU, bộ nhớ hoặc thời gian chạy dài. Không thể suy từ dung lượng hàng đợi một phần tử rằng toàn hệ thống không tăng bộ nhớ, vì snapshot, nhật ký và dữ liệu lưu trữ còn phát sinh theo thời gian.

Số khung bị bỏ cần được đọc cùng FPS và tuổi dữ liệu, vì việc loại khung cũ là một phần của thiết kế chứ không tự biểu thị lỗi. Một nhịp xử lý thấp nhưng luôn dùng ảnh mới khác với một nhịp xử lý tương tự trên ảnh đã tồn đọng lâu. Khi worker còn sống nhưng không tạo kết quả, trạng thái tiến trình cũng chưa phản ánh đầy đủ khả năng giám sát. Trong phạm vi đã kiểm chứng, bộ test điều khiển xác nhận cách xử lý một số yêu cầu dồn và trùng, chưa xác nhận năng lực chịu tải của dịch vụ web hoặc khả năng phục hồi sau mọi kiểu lỗi.

#### 6.4.3. Hoạt động khi mất kết nối

Cần phân biệt mất Internet với mất mạng nội bộ hoặc dừng máy chủ. Nếu Internet bị gián đoạn nhưng Wi-Fi LAN, broker và máy tính vẫn hoạt động, các thành phần thu hình, AI và dashboard nội bộ không nhất thiết bị dừng. Kênh Telegram và việc truy cập từ bên ngoài có thể bị ảnh hưởng. Đây là khả năng suy ra từ cách bố trí xử lý cục bộ, chưa phải kết quả đo thời gian hoạt động ngoại tuyến hoặc bảo đảm tự gửi lại toàn bộ thông báo khi mạng trở lại.

Khi DevKit mất Wi-Fi hoặc MQTT, vòng đọc radar và cập nhật góc trong AUTO đã thiết lập có thể tiếp tục cục bộ, nhưng tọa độ không còn được gửi đều tới backend. Firmware bỏ các lần publish không thực hiện được, chưa lưu dữ liệu để phát bù. Nếu camera mất kết nối, backend không có khung mới để đánh giá té ngã; nếu máy chủ dừng, nhánh AI và cảnh báo cũng dừng theo. Các cơ chế thử kết nối lại hỗ trợ phục hồi đường truyền, nhưng thời gian phục hồi và mức mất dữ liệu cần được ghi bằng thử nghiệm riêng. Khả năng bám cục bộ của servo không được xem là khả năng duy trì đầy đủ chức năng giám sát khi toàn hệ thống mất mạng.

Những kết quả hiện có xác nhận một phần logic và nhịp vận hành của nguyên mẫu, đồng thời xác định các phép đo còn thiếu để đánh giá toàn tuyến. Đây là cơ sở cho kết luận ở chương 7: mức đạt được cần gắn với bằng chứng kiểm thử và quan sát, còn hướng phát triển phải tập trung vào các giới hạn ảnh hưởng trực tiếp đến độ tin cậy giám sát.

## Chương 7. Kết luận và hướng phát triển

### 7.1. Kết quả đạt được

Đề tài đã xây dựng nguyên mẫu kết hợp hai nút ESP32, radar 24 GHz, cơ cấu Pan-Tilt và khối xử lý trên máy tính. ESP32-CAM đảm nhận thu, truyền hình ảnh; ESP32 DevKit khai thác tọa độ radar và phát góc lệnh cho servo; backend phân tích pose, tổ chức quyết định theo thời gian và cung cấp dữ liệu cho dashboard. Cách phân vai này thể hiện việc phối hợp cảm biến, truyền thông và chấp hành trong một hệ thống nhúng có xử lý hình ảnh ở máy tính cục bộ, thay vì đặt toàn bộ yêu cầu tính toán lên vi điều khiển.

Ở phần nhận diện, YOLO Pose cung cấp điểm mốc, còn máy trạng thái đánh giá diễn biến trước khi xác nhận sự cố. Radar hỗ trợ hướng nhìn và ngữ cảnh vùng phòng, không trực tiếp phân loại té ngã. Ở phần vận hành, hệ thống có luồng xem trực tiếp, dữ liệu nhận diện, điều khiển MANUAL, AUTO, bản đồ phòng, lưu sự kiện và thông báo qua dashboard, Telegram theo cấu hình. Các cơ chế hàng đợi ảnh hữu hạn, quản lý phiên nguồn video và khởi động lại worker hỗ trợ hạn chế dữ liệu cũ và phục hồi một số tình huống gián đoạn.

Kết quả chạy 25 ca kiểm thử đã xác nhận các quy tắc phần mềm được thử trên đầu vào hiện có. Quan sát vận hành ghi nhận RAW FPS có thể đạt khoảng 30 FPS và AI FPS thường khoảng 15–20 FPS, có biến động theo điều kiện sử dụng. Những kết quả này cho thấy tính khả thi của kiến trúc và việc triển khai các chức năng chính trong phạm vi nguyên mẫu. Đóng góp của đề tài nằm ở tích hợp và kiểm tra hệ thống, chưa phải một thuật toán học sâu mới hoặc một kết quả xác nhận độ tin cậy đầy đủ cho mọi tình huống giám sát.

### 7.2. Giới hạn của hệ thống

Độ tin cậy nhận diện còn phụ thuộc chất lượng ảnh, khả năng thấy các điểm thân, tính liên tục của Track ID và trạng thái chuyển động camera. Phương pháp cần có quan sát trước sự cố, nên có thể bỏ qua người đã nằm từ trước hoặc pha ngã xảy ra trong lúc bị che khuất. Vùng SAFE giảm báo nhầm khi nghỉ nhưng cũng làm việc đánh giá bị ngừng tại khu vực đó. Hệ thống chưa ghép định danh mục tiêu radar với người trong ảnh và tạm ngừng nhận diện té ngã khi có nhiều người đủ pose, nên phạm vi phù hợp hiện tại vẫn là kịch bản một người trong phòng.

Ở mức vận hành, tín hiệu servo chỉ phản ánh góc lệnh và chưa đo góc cơ khí thực; watchdog chưa xử lý mọi trường hợp worker còn sống nhưng không tạo kết quả. Nhật ký giao diện chưa hoàn tất luồng truy xuất và xác nhận lịch sử SQLite, còn quyền truy cập phụ thuộc lớp mạng. Các kết quả định lượng về độ trễ toàn tuyến, báo nhầm, bỏ sót, sai số dẫn hướng và vận hành dài hạn chưa được xác lập bằng một bộ thử nghiệm đầy đủ. Vì vậy, nguyên mẫu cần tiếp tục được đánh giá có kiểm soát trước khi mở rộng phạm vi sử dụng.

### 7.3. Hướng phát triển

Ưu tiên trước hết là xây dựng quy trình đánh giá có thể tái lập với video và tình huống đa dạng. Dữ liệu cần bao gồm hoạt động sinh hoạt có hình dạng gần với ngã, các mức che khuất, khoảng cách, ánh sáng và chuyển động camera, kèm nhãn sự kiện và mốc thời gian. Trên cơ sở đó, có thể điều chỉnh ngưỡng hoặc lựa chọn phương pháp phân loại chuỗi phù hợp, đồng thời đo riêng chất lượng pose và chất lượng quyết định. Việc mở rộng kiểm thử tự động nên tập trung vào mất dấu, đổi ID, camera quay, ngữ cảnh SAFE và xử lý sự kiện toàn tuyến.

Về dẫn hướng, cần hiệu chuẩn quan hệ vị trí radar–camera, góc trung tâm và điểm ngắm theo cách lắp thực tế; bổ sung phản hồi thị giác hoặc cảm biến góc khi cần đo sai lệch cơ khí. Ghép mục tiêu giữa radar và ảnh là bước quan trọng nếu mở rộng sang nhiều người, vì lựa chọn một tọa độ radar và một Track ID độc lập chưa đủ để bảo đảm cùng đối tượng. Khả năng phát hiện sự cố trong lúc camera quay cũng cần được cải thiện bằng cách ước lượng hoặc bù chuyển động ảnh, giảm đánh đổi giữa theo dõi mục tiêu và duy trì quan sát hành vi.

Ở phần mềm vận hành, có thể hoàn thiện API tải lịch sử và lưu trạng thái xác nhận, quản lý thời gian giữ snapshot, giám sát worker theo độ mới kết quả và xây dựng cơ chế phục hồi sự kiện rõ ràng. Đăng nhập, phân quyền và khả năng cấu hình trên thiết bị di động cần được phát triển theo nhu cầu người chăm sóc. Mỗi hướng bổ sung phải đi kèm kiểm thử và chỉ số đánh giá tương ứng để chứng minh lợi ích đối với giám sát, thay vì chỉ làm tăng số tính năng trên giao diện.

## Tài liệu tham khảo bổ sung

[16] Nhóm thực hiện. FallGuard: README và mã nguồn các thư mục hardware, backend, frontend. Phiên bản đối chiếu ngày 11/10/2026.

[17] Biên bản kiểm thử phần mềm dự án FallGuard ngày 11/10/2026. Các bộ test_fall_detection, test_zone_config và test_servo_control; tổng cộng 25 ca đạt. Tệp kèm báo cáo: bien_ban_kiem_thu_2026-10-11.txt.

[18] Ghi nhận vận hành nguyên mẫu do người thực hiện cung cấp ngày 11/10/2026. RAW FPS có thể đạt khoảng 30 FPS; AI FPS thường khoảng 15–20 FPS và dao động theo điều kiện kết nối, nguồn, phần cứng. Số liệu quan sát, chưa phải thống kê benchmark theo thời lượng cố định.

## Phụ lục

### Phụ lục A. Mã nguồn và cấu hình tái lập

Hai firmware tương ứng với hai bo là hardware/esp32_cam_stream.ino và hardware/esp32_cam_radar.ino. Backend sử dụng main.py để điều phối, fall_detection.py cho máy trạng thái, database.py cho SQLite và servo_protocol.py cho giao thức servo. Frontend gồm các trang giám sát, phân tích, nhật ký và cài đặt, cùng thành phần bản đồ radar và các React Context. Khi lưu phiên bản phục vụ báo cáo, cần giữ đồng thời firmware, backend, frontend và các tệp phụ thuộc để việc đối chiếu không dựa vào những bản sketch hoặc mã giao diện khác nhau.

Cấu hình tái lập cần ghi tên mô hình pose, runtime, giới hạn AI FPS, độ phân giải camera, vị trí lắp, hệ tọa độ phòng và profile legacy_step của firmware hiện hành. requirements.txt và package-lock.json giúp xác định các phụ thuộc phần mềm; thông tin CPU, GPU, RAM và phiên bản Python cần được ghi từ máy chạy phép đo thực tế. Các tham số này là điều kiện của kết quả, không thể suy ra đầy đủ chỉ từ tên bo ESP32 hoặc mô hình YOLO đang sử dụng.

### Phụ lục B. Kênh giao tiếp và chỉ số chẩn đoán

Camera cung cấp stream ở cổng 81 và trạng thái, cấu hình ảnh ở cổng 82; broker MQTT dùng cổng 1883; backend và dashboard lần lượt dùng cổng 8000, 3000 trong cấu hình triển khai. Các topic chính gồm embedded/radar/data, embedded/servo/mode, embedded/servo/manual, embedded/servo/tracking và embedded/servo/status. Nhóm giao tiếp HTTP cung cấp video, kết quả phát hiện, chẩn đoán, điều khiển và cấu hình phòng; WebSocket tại /api/v1/ws/alerts chuyển sự kiện tới trình duyệt.

Các chỉ số phục vụ đánh giá gồm RAW FPS, AI FPS, thời gian giải mã, suy luận, mã hóa, pipeline, tuổi dữ liệu, số khung bị bỏ và số lần kết nối lại. Khi chụp minh chứng, cần giữ tên chỉ số và thời điểm để phân biệt dữ liệu nguồn với dữ liệu xử lý. Log radar phân biệt có byte, có khung, có mục tiêu và có publish; log video phân biệt thu hình với AI. Chỉ số của từng khối được dùng để khoanh vùng vấn đề, còn kết luận toàn tuyến phải dựa trên phép đo nối các mốc của cùng một tình huống.

### Phụ lục C. Bằng chứng kiểm thử và ghi nhận thực nghiệm

Biên bản ngày 11/10/2026 lưu lệnh chạy, tên từng ca, kết quả và môi trường của hai lượt kiểm thử. Các mô-đun được sao chép nguyên trạng vào thư mục cách ly và đối chiếu mã băm với nguồn; kiểm thử cấu hình dùng SQLite tạm, kiểm thử điều khiển dùng Broker giả. Việc nạp cấu hình dotenv được vô hiệu trong lượt thử servo để không sử dụng thông tin vận hành riêng. Không khởi chạy camera, worker AI hoặc phần cứng trong các phép kiểm thử này. Các thời gian do unittest in ra chỉ là thời gian chạy kiểm thử và không được đưa vào cột độ trễ vận hành.

Đối với thử nghiệm hình ảnh và phần cứng bổ sung, mỗi bản ghi cần gắn tình huống, cấu hình, mốc bắt đầu, thời điểm xác nhận, thời điểm nhận thông báo và kết quả quan sát. Nếu dùng snapshot hoặc ảnh dashboard làm minh chứng, cần liên kết chúng với đúng lần thử, thay vì chọn những ảnh rời không có ngữ cảnh. Ghi nhận FPS hiện có được giữ như số liệu quan sát của nguyên mẫu; khi có dữ liệu theo thời gian, có thể bổ sung thống kê trung bình, thấp nhất và mức dao động để đánh giá ổn định rõ hơn.
