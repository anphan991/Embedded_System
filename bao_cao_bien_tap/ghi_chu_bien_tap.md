# Ghi chú áp dụng bản biên tập

Bản đầy đủ gồm lời cảm ơn, bảy chương, tài liệu tham khảo và phụ lục. Tệp chuong_4_den_7.md chứa riêng phần viết tiếp. Nội dung được đối chiếu với bản thảo, README và mã nguồn hiện tại; phần tốc độ vận hành sử dụng thông tin bạn cung cấp. Các đề xuất hình vẫn là vị trí chèn, tên và gợi ý xây dựng. Google Docs đã được cập nhật ngày 11/10/2026 trong Thẻ 2 theo đường liên kết bạn cung cấp; bìa và trang nhận xét được giữ nguyên, mục lục tự động được tạo lại. Ngày 13/10/2026, mục 4.6 được hiệu chỉnh theo mã nguồn hiện tại, bổ sung các tình huống SAFE/DANGER, trạng thái kỳ vọng và phân biệt số liệu FPS quan sát với kết quả benchmark. Bản trước và bản sau cập nhật được lưu trong thư mục _work để đối chiếu.

## Cấu trúc và cách viết

Phần lý do chọn đề tài đã được gộp vào đặt vấn đề và mục tiêu để giảm lặp ý. Chương 2 giữ nguyên lý cần để hiểu thiết kế; chương 3 tập trung vào kiến trúc và cơ chế xử lý. Chương 4 trình bày việc hiện thực phần mềm và kiểm thử ở mức dữ liệu, giao tiếp; chương 5 dành cho triển khai và kiểm tra từng phân hệ; chương 6 phân tích bằng chứng hiện có; chương 7 kết luận và xác định hướng cải thiện. Các mục Wokwi, tác vụ FreeRTOS riêng, local caching sự kiện, NTP, trang xác thực và quản lý lớp học của dàn ý tham khảo không được trình bày như chức năng đã triển khai.

## Những nội dung đã chỉnh theo triển khai

Bản mới phân biệt YOLO Pose với bộ phát hiện té ngã, Track ID với danh tính người, thông số radar danh định với vùng hoạt động sau lắp đặt, và góc lệnh servo với góc thực được đo. Các nhận định về độ chính xác tuyệt đối, độ trễ cố định hoặc vận hành 24/7 được thay bằng cơ chế và giới hạn có căn cứ. Những chi tiết bạn xác nhận đã bỏ khỏi dự án cũng đã được lược khỏi nội dung. Giao thức legacy_step chưa hỗ trợ hiệu chuẩn servo qua MQTT; nhật ký giao diện chưa hoàn tất đồng bộ lịch sử bền vững; trang phân tích và cài đặt hiện yêu cầu màn hình máy tính. Mã nguồn dự án không bị sửa trong đợt viết báo cáo.

## Làm sạch phần đầu và tài liệu tham khảo

Khi đưa nội dung vào Google Docs, cần cập nhật lại mục lục và danh mục hình theo cấu trúc mới. Bản gốc còn liên kết, mục và thuật ngữ của đề tài RFID/điểm danh, như Mifare, MFRC522, quản lý lớp học, Supabase và PostgreSQL; chỉ giữ lại nếu những nội dung đó thực sự xuất hiện trong phần còn lại của báo cáo. Các trang phụ lục đang dẫn tới dự án Wokwi và Hugging Face khác cũng cần được thay bằng nguồn đúng của đề tài hiện tại. Lời cảm ơn đã đổi cách gọi giữa kỳ sang nội dung phù hợp với báo cáo cuối kỳ và dùng cách xưng hô trung tính với giảng viên. Thông tin sinh viên, trường, học phần và ngày trên bìa cần giữ theo yêu cầu nộp bài thực tế.

Danh mục [1]–[15] của phần trước được giữ, bổ sung [16] mã nguồn dự án, [17] biên bản kiểm thử và [18] ghi nhận FPS. Với tài liệu trực tuyến, có thể thêm ngày truy cập 11/10/2026 theo mẫu trích dẫn của trường. Trước khi chốt báo cáo, nên thống nhất cách ghi tên tác giả và định dạng tài liệu tham khảo theo mẫu giảng viên yêu cầu.

## Bằng chứng kiểm thử và số liệu cần hoàn thiện

Đã chạy 25/25 ca kiểm thử hiện có và tất cả đạt, gồm năm ca máy trạng thái té ngã, năm ca cấu hình vùng và 15 ca đường điều khiển servo. Biên bản nằm trong bien_ban_kiem_thu_2026-10-11.txt. Các ca dùng đầu vào tổng hợp, SQLite tạm và broker giả; chưa kiểm tra camera, YOLO hoặc servo thật. Hai lượt chạy sử dụng Python khác nhau và bản sao cách ly của các mô-đun, không khởi chạy dịch vụ hoặc đọc cấu hình riêng. Thời gian unittest không được dùng làm độ trễ hệ thống, còn tỷ lệ ca đạt không được dùng làm độ chính xác nhận diện.

Theo thông tin bạn cung cấp, luồng camera RAW có thể đạt tối đa khoảng 30 FPS; AI FPS thường khoảng 15–20 FPS, có thể dao động xấp xỉ ±5 FPS hoặc thấp hơn tùy phần cứng, kết nối và nguồn điện. Chương 6 giữ các giá trị này như ghi nhận vận hành, chưa coi là benchmark theo thời lượng cố định. Giá trị AI_FPS_LIMIT thực tế của phiên quan sát chưa được ghi lại, nên chưa đối chiếu trực tiếp khoảng đó với giới hạn mặc định 15 FPS trong mã.

Bộ số liệu còn cần hoàn thiện gồm cấu hình máy chạy, mô hình/runtime, độ trễ cảnh báo, số sự kiện đúng, báo nhầm và bỏ sót, sai số dẫn hướng, thử tải và thời gian phục hồi. Các phần này được nêu đúng phạm vi, không thêm bảng hoặc số liệu giả. Khi có kết quả, có thể bổ sung vào các mục đánh giá tương ứng của chương 6 mà không phải viết lại kiến trúc và lý thuyết.
