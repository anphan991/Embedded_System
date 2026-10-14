**TRƯỜNG ĐẠI HỌC CÔNG NGHỆ KỸ THUẬT TP. HỒ CHÍ MINH**

**KHOA CÔNG NGHỆ THÔNG TIN**

**BỘ MÔN HỆ THỐNG NHÚNG**

![Auth platform][image1]

**BÁO CÁO CUỐI KỲ**

**THIẾT KẾ HỆ THỐNG SERVO PAN-TILT ĐIỀU HƯỚNG CAMERA CHỦ ĐỘNG VÀ NHẬN DIỆN TÉ NGÃ THỜI GIAN THỰC**

**Giảng viên hướng dẫn:** 	ThS. Võ Lê Phúc Hậu 

**Sinh viên thực hiện:** 	Phan Khánh An             24162004

					Trần Công Khánh          24162061

					Nguyễn Bá Nam            24162077 

*TP. HCM, ngày 1 tháng 4 năm 2026*  
NHẬN XÉT CỦA GIẢNG VIÊN

	

	

	

	

	

	

	

	

	

	

	

Điểm: ……………………………..

KÝ TÊN

# **Lời cảm ơn** {#lời-cảm-ơn}

Nhóm thực hiện xin chân thành cảm ơn quý thầy cô Khoa Công nghệ Thông tin, Trường Đại học Công nghệ Kỹ thuật TP. Hồ Chí Minh đã trang bị kiến thức nền tảng và tạo điều kiện để nhóm thực hiện đề tài trong học phần hệ thống nhúng. Nhóm đặc biệt cảm ơn ThS. Võ Lê Phúc Hậu đã hướng dẫn, góp ý về chuyên môn và hỗ trợ nhóm trong quá trình xây dựng hệ thống, giúp nhóm vận dụng kiến thức đã học vào một nguyên mẫu có sự kết hợp giữa phần cứng, điều khiển và phần mềm giám sát.

Quá trình thực hiện đề tài giúp nhóm hiểu rõ hơn những yêu cầu của việc tích hợp thiết bị nhúng với truyền thông và xử lý hình ảnh, cũng như các giới hạn cần xem xét khi thử nghiệm trong môi trường thực tế. Do thời gian và kinh nghiệm còn hạn chế, báo cáo và nguyên mẫu vẫn có những nội dung cần hoàn thiện. Nhóm mong nhận được ý kiến góp ý của giảng viên để nâng cao chất lượng bài viết và tiếp tục cải thiện hệ thống.

**MỤC LỤC**

[**Lời cảm ơn	2**](#lời-cảm-ơn)

[**Chương 1\. Tổng quan đề tài	5**](#chương-1.-tổng-quan-đề-tài)

[1.1. Đặt vấn đề	5](#1.1.-đặt-vấn-đề)

[1.2. Tình hình nghiên cứu	6](#1.2.-tình-hình-nghiên-cứu)

[1.2.1. Các nghiên cứu trong nước	6](#1.2.1.-các-nghiên-cứu-trong-nước)

[1.2.2. Các nghiên cứu nước ngoài	7](#1.2.2.-các-nghiên-cứu-nước-ngoài)

[1.3. Mục tiêu và phạm vi đề tài	7](#1.3.-mục-tiêu-và-phạm-vi-đề-tài)

[**Chương 2\. Cơ sở lý thuyết	8**](#chương-2.-cơ-sở-lý-thuyết)

[2.1. Vi điều khiển ESP32 và mô-đun ESP32-CAM	8](#2.1.-vi-điều-khiển-esp32-và-mô-đun-esp32-cam)

[2.2. Radar HLK-LD2450 và dữ liệu định vị	9](#2.2.-radar-hlk-ld2450-và-dữ-liệu-định-vị)

[2.2.1. Nguyên lý radar FMCW	9](#2.2.1.-nguyên-lý-radar-fmcw)

[2.2.2. Đặc điểm và hệ tọa độ của HLK-LD2450	10](#2.2.2.-đặc-điểm-và-hệ-tọa-độ-của-hlk-ld2450)

[2.3. Cơ cấu Pan-Tilt và điều khiển servo	11](#2.3.-cơ-cấu-pan-tilt-và-điều-khiển-servo)

[2.3.1. Nguyên lý điều khiển servo RC	11](#2.3.1.-nguyên-lý-điều-khiển-servo-rc)

[2.3.2. Dẫn hướng và ổn định chuyển động	11](#2.3.2.-dẫn-hướng-và-ổn-định-chuyển-động)

[2.4. Ước lượng tư thế và nhận diện té ngã	12](#2.4.-ước-lượng-tư-thế-và-nhận-diện-té-ngã)

[2.4.1. YOLO Pose và theo dõi đối tượng	12](#2.4.1.-yolo-pose-và-theo-dõi-đối-tượng)

[2.4.2. Đặc trưng hình học và phân tích theo thời gian	13](#2.4.2.-đặc-trưng-hình-học-và-phân-tích-theo-thời-gian)

[2.5. Truyền thông MQTT và mạng cục bộ	14](#2.5.-truyền-thông-mqtt-và-mạng-cục-bộ)

[2.6. Tổ chức xử lý trên máy chủ và giao diện web	15](#2.6.-tổ-chức-xử-lý-trên-máy-chủ-và-giao-diện-web)

[**Chương 3\. Thiết kế hệ thống	15**](#chương-3.-thiết-kế-hệ-thống)

[3.1. Yêu cầu và kiến trúc tổng thể	15](#3.1.-yêu-cầu-và-kiến-trúc-tổng-thể)

[3.1.1. Yêu cầu thiết kế	15](#3.1.1.-yêu-cầu-thiết-kế)

[3.1.2. Phân chia các khối chức năng	16](#3.1.2.-phân-chia-các-khối-chức-năng)

[3.2. Thiết kế phần cứng	17](#3.2.-thiết-kế-phần-cứng)

[3.3. Thiết kế giải thuật và logic điều khiển	18](#3.3.-thiết-kế-giải-thuật-và-logic-điều-khiển)

[3.3.1. Đọc radar và điều hướng camera	18](#3.3.1.-đọc-radar-và-điều-hướng-camera)

[3.3.2. Phát hiện té ngã theo chuỗi tư thế	19](#3.3.2.-phát-hiện-té-ngã-theo-chuỗi-tư-thế)

[3.3.3. Xử lý camera quay, mất dấu và nhiều người	21](#3.3.3.-xử-lý-camera-quay,-mất-dấu-và-nhiều-người)

[3.3.4. Ngữ cảnh vùng phòng và xử lý cảnh báo	21](#3.3.4.-ngữ-cảnh-vùng-phòng-và-xử-lý-cảnh-báo)

[3.4. Tổ chức phần mềm, giao tiếp và lưu trữ	23](#3.4.-tổ-chức-phần-mềm,-giao-tiếp-và-lưu-trữ)

[3.4.1. Luồng xử lý đa tiến trình	23](#3.4.1.-luồng-xử-lý-đa-tiến-trình)

[3.4.2. Giao tiếp giữa thiết bị, backend và dashboard	24](#3.4.2.-giao-tiếp-giữa-thiết-bị,-backend-và-dashboard)

[3.4.3. Lưu trữ và phạm vi truy cập	25](#3.4.3.-lưu-trữ-và-phạm-vi-truy-cập)

[3.5. Thiết kế giao diện giám sát	26](#3.5.-thiết-kế-giao-diện-giám-sát)

[**Chương 4\. Xây dựng phần mềm và thiết lập kiểm thử mô phỏng	27**](#chương-4.-xây-dựng-phần-mềm-và-thiết-lập-kiểm-thử-mô-phỏng)

[4.1. Môi trường phát triển	27](#4.1.-môi-trường-phát-triển)

[4.2. Xây dựng firmware cho hai nút ESP32	28](#4.2.-xây-dựng-firmware-cho-hai-nút-esp32)

[4.2.1. Firmware thu nhận và truyền hình ảnh	28](#4.2.1.-firmware-thu-nhận-và-truyền-hình-ảnh)

[4.2.2. Firmware đọc radar và điều khiển Pan-Tilt	28](#4.2.2.-firmware-đọc-radar-và-điều-khiển-pan-tilt)

[4.3. Xây dựng backend	29](#4.3.-xây-dựng-backend)

[4.3.1. Tổ chức các mô-đun và vòng đời dịch vụ	29](#4.3.1.-tổ-chức-các-mô-đun-và-vòng-đời-dịch-vụ)

[4.3.2. Tiếp nhận video và quản lý dữ liệu theo nguồn	29](#4.3.2.-tiếp-nhận-video-và-quản-lý-dữ-liệu-theo-nguồn)

[4.3.3. Điều khiển, cấu hình và lưu sự kiện	30](#4.3.3.-điều-khiển,-cấu-hình-và-lưu-sự-kiện)

[4.4. Xây dựng giao diện giám sát	31](#4.4.-xây-dựng-giao-diện-giám-sát)

[4.4.1. Tổ chức các trang và khả năng sử dụng	31](#4.4.1.-tổ-chức-các-trang-và-khả-năng-sử-dụng)

[4.4.2. Hiển thị hình ảnh và cập nhật trạng thái	31](#4.4.2.-hiển-thị-hình-ảnh-và-cập-nhật-trạng-thái)

[4.4.3. Cấu hình và kết nối tới máy chủ	32](#4.4.3.-cấu-hình-và-kết-nối-tới-máy-chủ)

[4.5. Thiết lập kiểm thử bằng dữ liệu mô phỏng	32](#4.5.-thiết-lập-kiểm-thử-bằng-dữ-liệu-mô-phỏng)

[4.6. Thiết kế các kịch bản kiểm thử	33](#4.6.-thiết-kế-các-kịch-bản-kiểm-thử)

[**Chương 5\. Thiết lập và triển khai phần cứng	34**](#chương-5.-thiết-lập-và-triển-khai-phần-cứng)

[5.1. Chuẩn bị thiết bị và môi trường triển khai	34](#5.1.-chuẩn-bị-thiết-bị-và-môi-trường-triển-khai)

[5.2. Lắp ráp và kiểm tra từng phân hệ	35](#5.2.-lắp-ráp-và-kiểm-tra-từng-phân-hệ)

[5.2.1. Nguồn, cơ khí và điều khiển thủ công	35](#5.2.1.-nguồn,-cơ-khí-và-điều-khiển-thủ-công)

[5.2.2. Camera và luồng video	36](#5.2.2.-camera-và-luồng-video)

[5.2.3. Radar và hệ tọa độ phòng	36](#5.2.3.-radar-và-hệ-tọa-độ-phòng)

[5.3. Tích hợp và xử lý các tình huống vận hành	37](#5.3.-tích-hợp-và-xử-lý-các-tình-huống-vận-hành)

[5.3.1. Khởi chạy dịch vụ và xác nhận luồng hoạt động	37](#5.3.1.-khởi-chạy-dịch-vụ-và-xác-nhận-luồng-hoạt-động)

[5.3.2. Sai địa chỉ mạng hoặc giao thức điều khiển	37](#5.3.2.-sai-địa-chỉ-mạng-hoặc-giao-thức-điều-khiển)

[5.3.3. Nguồn không ổn định, mất dữ liệu và cảnh báo ngoài dự kiến	38](#5.3.3.-nguồn-không-ổn-định,-mất-dữ-liệu-và-cảnh-báo-ngoài-dự-kiến)

[**Chương 6\. Kết quả kiểm thử và đánh giá nguyên mẫu	39**](#chương-6.-kết-quả-kiểm-thử-và-đánh-giá-nguyên-mẫu)

[6.1. Phạm vi và căn cứ đánh giá	39](#6.1.-phạm-vi-và-căn-cứ-đánh-giá)

[6.2. Kết quả kiểm thử phần mềm	39](#6.2.-kết-quả-kiểm-thử-phần-mềm)

[6.2.1. Máy trạng thái phát hiện té ngã	39](#6.2.1.-máy-trạng-thái-phát-hiện-té-ngã)

[6.2.2. Cấu hình vùng và tính nhất quán dữ liệu	40](#6.2.2.-cấu-hình-vùng-và-tính-nhất-quán-dữ-liệu)

[6.2.3. Đường điều khiển servo	40](#6.2.3.-đường-điều-khiển-servo)

[6.3. Tốc độ hình ảnh và khả năng đáp ứng	41](#6.3.-tốc-độ-hình-ảnh-và-khả-năng-đáp-ứng)

[6.3.1. Ghi nhận RAW FPS và AI FPS	41](#6.3.1.-ghi-nhận-raw-fps-và-ai-fps)

[6.3.2. Độ trễ hiển thị và cảnh báo	42](#6.3.2.-độ-trễ-hiển-thị-và-cảnh-báo)

[6.4. Mức bao phủ chức năng và các điều kiện gián đoạn	43](#6.4.-mức-bao-phủ-chức-năng-và-các-điều-kiện-gián-đoạn)

[6.4.1. Nhận diện tư thế và điều hướng	43](#6.4.1.-nhận-diện-tư-thế-và-điều-hướng)

[6.4.2. Tải xử lý và phục hồi	43](#6.4.2.-tải-xử-lý-và-phục-hồi)

[6.4.3. Hoạt động khi mất kết nối	44](#6.4.3.-hoạt-động-khi-mất-kết-nối)

[**Chương 7\. Kết luận và hướng phát triển	45**](#chương-7.-kết-luận-và-hướng-phát-triển)

[7.1. Kết quả đạt được	45](#7.1.-kết-quả-đạt-được)

[7.2. Giới hạn của hệ thống	45](#7.2.-giới-hạn-của-hệ-thống)

[7.3. Hướng phát triển	46](#7.3.-hướng-phát-triển)

[**Tài liệu tham khảo	47**](#tài-liệu-tham-khảo)

[**Phụ lục	49**](#phụ-lục)

[Phụ lục A. Mã nguồn và cấu hình tái lập	49](#phụ-lục-a.-mã-nguồn-và-cấu-hình-tái-lập)

[Phụ lục B. Kênh giao tiếp và chỉ số chẩn đoán	49](#phụ-lục-b.-kênh-giao-tiếp-và-chỉ-số-chẩn-đoán)

[Phụ lục C. Bằng chứng kiểm thử và ghi nhận thực nghiệm	50](#phụ-lục-c.-bằng-chứng-kiểm-thử-và-ghi-nhận-thực-nghiệm)

# **Chương 1\. Tổng quan đề tài** {#chương-1.-tổng-quan-đề-tài}

## **1.1. Đặt vấn đề** {#1.1.-đặt-vấn-đề}

Té ngã có thể gây chấn thương nghiêm trọng và làm suy giảm khả năng sinh hoạt độc lập của người cao tuổi. Theo báo cáo của Tổ chức Y tế Thế giới công bố năm 2021, mỗi năm trên thế giới có khoảng 684.000 trường hợp tử vong do té ngã và 37,3 triệu trường hợp cần chăm sóc y tế; người trên 60 tuổi là nhóm chịu số ca tử vong nhiều nhất \[1\]. Tại Việt Nam, báo cáo của Tổng cục Thống kê và Quỹ Dân số Liên Hợp Quốc dựa trên các cuộc Tổng điều tra dân số năm 2009 và 2019 ghi nhận tỷ lệ người cao tuổi sống một mình hoặc chỉ sống cùng vợ, chồng có xu hướng tăng \[2\]. Trong bối cảnh đó, việc phát hiện sự cố và thông báo sớm cho người chăm sóc là một nhu cầu thiết thực, đặc biệt khi người được giám sát không thể tự gọi trợ giúp.

Các phương thức giám sát hiện có đáp ứng nhu cầu này ở những mức độ khác nhau. Thiết bị đeo cung cấp thông tin chuyển động trực tiếp nhưng phụ thuộc vào việc người dùng mang và duy trì nguồn điện cho thiết bị. Camera cho phép quan sát tư thế mà không cần tiếp xúc với cơ thể, song hiệu quả phụ thuộc vào góc nhìn, ánh sáng và mức độ che khuất. Với camera cố định, người cần giám sát còn có thể di chuyển ra ngoài khung hình. Vì vậy, bài toán không chỉ là nhận diện tư thế ngã, mà còn là duy trì khả năng quan sát và tổ chức luồng cảnh báo đủ rõ ràng để người chăm sóc có thể phản hồi.

Đề tài “Hệ thống servo Pan-Tilt điều hướng camera chủ động và nhận diện té ngã thời gian thực” xây dựng một nguyên mẫu giám sát trong nhà theo hướng kết hợp radar định vị với camera phân tích tư thế. Radar HLK-LD2450 cung cấp tọa độ mục tiêu để dẫn hướng cơ cấu Pan-Tilt; ESP32-CAM thu nhận hình ảnh; máy tính cục bộ sử dụng YOLO Pose và thuật toán phân tích theo thời gian để đánh giá dấu hiệu té ngã. Khi phát hiện sự cố, hệ thống ghi nhận sự kiện, lưu ảnh và gửi cảnh báo tới giao diện web, đồng thời hỗ trợ thông báo qua Telegram. Trọng tâm của đề tài là tích hợp các khối cảm biến, điều khiển nhúng, truyền thông và xử lý hình ảnh thành một hệ thống có thể vận hành và kiểm chứng trên nguyên mẫu.

## **1.2. Tình hình nghiên cứu** {#1.2.-tình-hình-nghiên-cứu}

### **1.2.1. Các nghiên cứu trong nước** {#1.2.1.-các-nghiên-cứu-trong-nước}

Các nghiên cứu trong nước đã tiếp cận bài toán té ngã thông qua phân tích tư thế và chuyển động từ video. Trong công trình “Vision Based Fall Detection for the Elderly People”, Bùi Ngọc Dũng và các cộng sự kết hợp phát hiện người, ước lượng khớp cơ thể, phân loại tư thế bằng XGBoost và phân tích chuỗi tọa độ khớp bằng LSTM \[3\]. Việc sử dụng thông tin theo thời gian có ý nghĩa vì tư thế nằm sau một cú ngã có thể gần giống tư thế nằm nghỉ; chỉ quan sát một khung hình thường chưa đủ để xác định quá trình dẫn đến trạng thái đó. Theo hướng tích hợp ứng dụng, Ng, Mai và Nguyen sử dụng YOLOv8 trong một hệ thống phát hiện té ngã kết hợp phần mềm và IoT \[4\]. Đỗ Trí Nhựt và Lê Thị Thủy cũng nghiên cứu kết hợp nhận diện điểm mốc cơ thể với học sâu, báo cáo tỷ lệ phát hiện 95% trên phạm vi thử nghiệm của công trình \[5\].

Những kết quả này cho thấy khả năng sử dụng mô hình thị giác để hỗ trợ giám sát, nhưng không thể chuyển trực tiếp các chỉ số của từng nghiên cứu thành độ chính xác của hệ thống trong đề tài. Chẳng hạn, công trình của Đỗ Trí Nhựt và cộng sự thử nghiệm với người từ 8 đến 50 tuổi, nên chưa phản ánh đầy đủ đặc điểm vận động của người cao tuổi \[5\]. Ngoài thuật toán nhận diện, một hệ thống triển khai trong phòng còn phải xử lý việc đối tượng rời khỏi khung hình, dữ liệu bị gián đoạn và sự khác biệt giữa môi trường thử nghiệm với không gian sinh hoạt thực tế. Đây là các vấn đề mà đề tài xem xét ở cấp độ tích hợp hệ thống.

### **1.2.2. Các nghiên cứu nước ngoài** {#1.2.2.-các-nghiên-cứu-nước-ngoài}

Các hướng nghiên cứu quốc tế thường khai thác cảm biến đeo, thị giác máy tính hoặc radar. Thiết bị đeo đo trực tiếp gia tốc và chuyển động của cơ thể, thuận lợi khi người dùng di chuyển giữa nhiều không gian nhưng đòi hỏi duy trì việc sử dụng thiết bị. Với thị giác máy tính, Lu và cộng sự kết hợp mạng tích chập 3D với LSTM có cơ chế attention để khai thác thông tin chuyển động trong video \[6\]. Cách tiếp cận này làm rõ vai trò của chuỗi thời gian trong phân biệt hành động, đồng thời vẫn chịu các giới hạn của dữ liệu hình ảnh như thiếu sáng, che khuất và góc quan sát.

Radar cung cấp một nguồn dữ liệu khác, ít phụ thuộc vào ánh sáng và không thu ảnh RGB. Công trình mmFall của Jin, Sengupta và Cao sử dụng đám mây điểm radar cùng mô hình học theo chuỗi để phát hiện té ngã \[7\]. Tuy nhiên, dữ liệu radar của công trình này phong phú hơn dữ liệu tọa độ hai chiều do HLK-LD2450 cung cấp; không thể suy ra rằng mô-đun trong đề tài có cùng khả năng nhận diện. Vì vậy, hệ thống lựa chọn cách phối hợp theo chức năng: radar hỗ trợ định vị và dẫn hướng, còn camera cung cấp đặc trưng tư thế để đánh giá sự cố. Sự phối hợp này mở rộng khả năng quan sát, nhưng không loại bỏ hoàn toàn che khuất hoặc các yêu cầu bảo vệ dữ liệu hình ảnh.

## **1.3. Mục tiêu và phạm vi đề tài** {#1.3.-mục-tiêu-và-phạm-vi-đề-tài}

Mục tiêu của đề tài là thiết kế và tích hợp một nguyên mẫu có khả năng điều hướng camera hai trục theo mục tiêu, phân tích sự thay đổi tư thế để phát hiện dấu hiệu té ngã và thông báo cho người chăm sóc. Về mặt hệ thống nhúng, đề tài tập trung vào thu nhận dữ liệu radar qua UART, điều khiển servo bằng PWM, trao đổi dữ liệu qua MQTT và phối hợp với khối xử lý trên máy tính. Về mặt nhận diện, mô hình YOLO Pose được sử dụng để trích xuất điểm mốc cơ thể; quyết định té ngã được xây dựng bằng các đặc trưng hình học và máy trạng thái theo thời gian, thay vì huấn luyện một mô hình phân loại té ngã mới.

Hệ thống hướng tới kịch bản giám sát một người trong phòng có sàn tương đối phẳng và ánh sáng phù hợp cho camera. Vùng hoạt động phải được xác lập sau khi lắp đặt, căn cứ vào phạm vi danh định của radar, góc nhìn camera, hành trình cơ khí và vật cản trong phòng. HLK-LD2450 có phạm vi danh định tối đa 6 m và góc phương vị ±60°, nhưng các thông số này không đồng nghĩa với vùng nhận diện té ngã được bảo đảm trong mọi điều kiện \[8\]. Radar hiện được khai thác để chọn một mục tiêu dẫn hướng; hệ thống chưa thực hiện ghép định danh mục tiêu radar với từng Track ID trong ảnh và chưa giải quyết đầy đủ bài toán giám sát nhiều người.

Nguyên mẫu gồm một ESP32-CAM thu hình, một ESP32 DevKit kết nối radar và hai servo MG996R, cùng máy tính Windows vận hành Mosquitto, backend và giao diện web. Suy luận AI và lưu trữ được thực hiện cục bộ; truy cập từ xa có thể tổ chức qua mạng riêng Tailscale theo cấu hình triển khai. Đề tài đánh giá tính khả thi của kiến trúc và các cơ chế xử lý, còn độ chính xác, độ trễ và độ ổn định dài hạn cần được xác định bằng thực nghiệm. Việc nhận diện tư thế trong phạm vi này không cung cấp kết luận về nguyên nhân y khoa như ngất xỉu hoặc đột quỵ. Các giới hạn trên là cơ sở để lựa chọn phần cứng và phương pháp xử lý ở những chương tiếp theo.

# **Chương 2\. Cơ sở lý thuyết** {#chương-2.-cơ-sở-lý-thuyết}

## **2.1. Vi điều khiển ESP32 và mô-đun ESP32-CAM** {#2.1.-vi-điều-khiển-esp32-và-mô-đun-esp32-cam}

ESP32 là hệ thống trên chip tích hợp bộ xử lý, bộ nhớ, kết nối Wi-Fi và các ngoại vi phục vụ điều khiển nhúng. Biến thể ESP32 cổ điển được sử dụng trong đề tài có bộ xử lý Xtensa LX6, xung nhịp tối đa 240 MHz và 520 KB SRAM. Hai ngoại vi quan trọng đối với thiết kế là UART để nhận dữ liệu cảm biến và LEDC để tạo xung điều khiển servo \[9\]. Việc tạo PWM bằng phần cứng giúp duy trì tín hiệu điều khiển mà không phải phát từng xung bằng phần mềm. Tuy nhiên, khả năng đáp ứng của chương trình vẫn phụ thuộc vào cách tổ chức vòng lặp, xử lý mạng và phân bổ tài nguyên; cấu trúc hai nhân không tự bảo đảm mọi tác vụ diễn ra đúng hạn.

ESP32-CAM bổ sung giao tiếp camera và bộ nhớ PSRAM để hỗ trợ bộ đệm ảnh. Driver camera của Espressif hỗ trợ nhiều cảm biến, trong đó có OV2640 và OV3660, cùng chế độ thu ảnh JPEG \[10\]. Trong nguyên mẫu, mô-đun được sử dụng với cảm biến OV3660 theo cấu hình của dự án. Bộ nhớ PSRAM cho phép duy trì nhiều bộ đệm và độ phân giải cao hơn; khi không có PSRAM, firmware có thể giảm độ phân giải để phù hợp tài nguyên còn lại. Việc tách ESP32-CAM khỏi ESP32 điều khiển radar và servo giúp phân định trách nhiệm giữa thu hình và chấp hành, thuận lợi cho việc kiểm tra từng khối trước khi tích hợp.

Luồng MJPEG truyền liên tiếp các ảnh JPEG độc lập qua một kết nối HTTP, thường sử dụng kiểu nội dung multipart/x-mixed-replace. Cách truyền này phù hợp với cấu hình camera hiện có vì không đòi hỏi mã hóa liên khung hình phức tạp. Máy chủ có thể tách từng ảnh từ luồng byte rồi giải mã khung cần xử lý, trong khi luồng xem trực tiếp vẫn dùng dữ liệu JPEG. Đổi lại, MJPEG có thể tiêu thụ băng thông đáng kể do mỗi ảnh được nén riêng; tăng độ phân giải hoặc chất lượng ảnh sẽ làm tăng lượng dữ liệu truyền và có thể giảm tốc độ khung hình. Vì vậy, cấu hình camera cần cân bằng giữa độ rõ của điểm mốc cơ thể, băng thông Wi-Fi và năng lực suy luận của máy tính.

## **2.2. Radar HLK-LD2450 và dữ liệu định vị** {#2.2.-radar-hlk-ld2450-và-dữ-liệu-định-vị}

### **2.2.1. Nguyên lý radar FMCW** {#2.2.1.-nguyên-lý-radar-fmcw}

Radar FMCW phát tín hiệu có tần số thay đổi theo thời gian, thường dưới dạng các chirp. Sóng phản xạ từ mục tiêu trở về trễ hơn tín hiệu phát; khi trộn hai tín hiệu, radar thu được tín hiệu phách có tần số liên quan đến khoảng cách. Với mô hình mục tiêu đứng yên, độ trễ truyền hai chiều là τ \= 2R/c và tần số phách xấp xỉ f\_b \= Sτ, trong đó R là khoảng cách, c là tốc độ ánh sáng và S là độ dốc biến thiên tần số. Radar có thể suy ra vận tốc từ sự thay đổi pha giữa các chirp, còn thông tin góc được khai thác từ chênh lệch tín hiệu giữa các anten thu \[11\].

HLK-LD2450 thực hiện xử lý tín hiệu bên trong mô-đun và xuất kết quả qua cổng nối tiếp, nên vi điều khiển không phải tự thực hiện các phép biến đổi phổ của radar. Đề tài chỉ khai thác dữ liệu tọa độ và vận tốc đầu ra. Cách sử dụng này giảm yêu cầu tính toán tại thiết bị nhúng, đồng thời giới hạn mức thông tin có thể phân tích: dữ liệu vị trí hai chiều không cung cấp trực tiếp tư thế cơ thể hoặc độ cao để xác nhận một cú ngã.

### **2.2.2. Đặc điểm và hệ tọa độ của HLK-LD2450** {#2.2.2.-đặc-điểm-và-hệ-tọa-độ-của-hlk-ld2450}

Theo nhà sản xuất, HLK-LD2450 là radar theo dõi mục tiêu chuyển động ở băng tần 24 GHz, sử dụng cấu hình một anten phát và hai anten thu; phạm vi danh định tối đa 6 m và góc phương vị ±60° \[8\]. Mô-đun thường được giới thiệu trong nhóm radar mmWave thương mại; trong bài này, thuật ngữ radar 24 GHz được dùng để mô tả rõ băng tần thực tế. Dữ liệu gồm tọa độ ngang X, tọa độ theo hướng phía trước Y và vận tốc trong hệ quy chiếu gắn với cảm biến. Vị trí này biểu diễn quan hệ giữa mục tiêu và radar, chưa phải vị trí trên mặt bằng phòng.

Để đưa mục tiêu lên bản đồ phòng, cần biết vị trí lắp radar và góc xoay của nó, sau đó áp dụng phép quay và tịnh tiến. Độ chính xác của bản đồ vì thế phụ thuộc cả dữ liệu cảm biến lẫn việc hiệu chuẩn vị trí lắp đặt. Trong hệ thống Pan-Tilt, tọa độ radar còn được dùng để suy ra hướng nhìn camera. Do radar không cung cấp độ cao mục tiêu, góc nghiêng camera phải dựa trên một điểm ngắm giả định hoặc phản hồi từ hình ảnh. Đây là giới hạn cần xem xét khi người thay đổi tư thế hoặc di chuyển gần thiết bị.

*\[Vị trí chèn Hình 2.1 tại đây\]*

**Hình 2.1. Hệ tọa độ radar và quan hệ hình học với hướng quan sát của camera Pan-Tilt.**

Nguồn: Tác giả xây dựng dựa trên đặc tả HLK-LD2450 \[8\]. Gợi ý thể hiện trục X, Y, góc phương vị, vị trí camera và điểm ngắm giả định; ghi rõ vùng quét là phạm vi danh định.

## **2.3. Cơ cấu Pan-Tilt và điều khiển servo** {#2.3.-cơ-cấu-pan-tilt-và-điều-khiển-servo}

### **2.3.1. Nguyên lý điều khiển servo RC** {#2.3.1.-nguyên-lý-điều-khiển-servo-rc}

Servo RC là cơ cấu chấp hành gồm động cơ, bộ truyền cơ khí, mạch điều khiển và phần tử phản hồi vị trí. Mạch bên trong điều chỉnh động cơ để trục ra tiến tới góc tương ứng với tín hiệu điều khiển. Với servo vị trí thông dụng, tín hiệu là một chuỗi xung lặp theo chu kỳ; góc đặt được biểu diễn bằng độ rộng xung mức cao. Trong đề tài, PWM được cấu hình ở tần số 50 Hz bằng thư viện ESP32Servo. Dải xung và hành trình sử dụng phải phù hợp với servo thực tế và cơ cấu lắp ráp, vì cùng một độ rộng xung không nhất thiết cho cùng góc quay trên mọi sản phẩm.

Cơ cấu Pan-Tilt bố trí hai trục quay để thay đổi hướng ngang và góc ngẩng, cúi của camera. Servo có vòng điều khiển vị trí bên trong, nhưng ESP32 trong nguyên mẫu chỉ gửi góc lệnh, không đo độc lập góc thực của cơ cấu. Vì vậy, sai số lắp ráp, độ rơ bánh răng, tải camera và giới hạn hành trình vẫn ảnh hưởng đến hướng quan sát. Việc giới hạn góc bằng phần mềm và kiểm tra chuyển động thực tế là cần thiết để tránh camera chạm cữ hoặc servo duy trì tải tại điểm cuối hành trình.

### **2.3.2. Dẫn hướng và ổn định chuyển động** {#2.3.2.-dẫn-hướng-và-ổn-định-chuyển-động}

Với tọa độ mục tiêu trên mặt phẳng ngang, góc phương vị được tính bằng atan2(X, Y), sau đó ánh xạ về góc servo theo vị trí trung tâm và chiều quay thực tế. Hàm atan2 thể hiện hướng của vector mục tiêu rõ hơn phép tính arctan(X/Y), đồng thời tránh phép chia trực tiếp cho Y. Góc Tilt được ước lượng từ khoảng cách ngang và chênh lệch giữa độ cao camera với điểm ngắm giả định. Mô hình này phù hợp khi radar và camera được bố trí theo cùng hướng tham chiếu; nếu hai thiết bị có độ lệch vị trí đáng kể, cần bổ sung hiệu chuẩn thay vì coi ánh xạ góc là chính xác trong mọi khoảng cách.

Dữ liệu vị trí luôn có nhiễu, nên điều khiển phản ứng với mọi dao động nhỏ có thể khiến camera quay liên tục. Bộ lọc trung bình động hàm mũ, hay EMA, làm mượt dữ liệu theo quan hệ S\_t \= αY\_t \+ (1 − α)S\_(t−1), với Y\_t là giá trị mới và S\_t là giá trị đã lọc. Hệ số α lớn cho phản ứng nhanh hơn nhưng giữ nhiều nhiễu hơn; hệ số nhỏ làm tín hiệu êm hơn nhưng tăng độ trễ. Ngoài lọc tọa độ, có thể làm mượt góc lệnh để giảm thay đổi đột ngột giữa hai lần cập nhật.

Khi dẫn hướng bằng hình ảnh, vùng chết được đặt quanh tâm khung hình để cơ cấu giữ nguyên hướng nếu đối tượng vẫn nằm trong phạm vi cho phép. Chỉ khi sai lệch vượt ngưỡng, bộ điều khiển mới phát lệnh hiệu chỉnh. Vùng chết và EMA giải quyết hai vấn đề khác nhau: vùng chết hạn chế các chuyển động không cần thiết, còn EMA giảm nhiễu trong tín hiệu đầu vào hoặc góc lệnh. Việc lựa chọn các tham số phải cân bằng độ ổn định hình ảnh với khả năng theo kịp người di chuyển, thay vì ưu tiên độ êm đến mức làm camera phản ứng quá chậm.

## **2.4. Ước lượng tư thế và nhận diện té ngã** {#2.4.-ước-lượng-tư-thế-và-nhận-diện-té-ngã}

### **2.4.1. YOLO Pose và theo dõi đối tượng** {#2.4.1.-yolo-pose-và-theo-dõi-đối-tượng}

YOLO Pose kết hợp phát hiện người với ước lượng các điểm mốc cơ thể trong một mô hình. Với cấu hình pose theo COCO, đầu ra gồm khung bao và 17 điểm mốc, bao gồm các điểm ở mặt, vai, khuỷu tay, cổ tay, hông, đầu gối và cổ chân; mỗi điểm có thông tin độ tin cậy \[12\]. Các điểm mốc cung cấp biểu diễn hình học gọn hơn ảnh RGB, giúp phân tích hướng thân và sự thay đổi tương quan giữa các phần cơ thể. Tuy nhiên, mô hình pose huấn luyện sẵn chỉ ước lượng vị trí điểm mốc, không tự đưa ra kết luận rằng một người vừa té ngã.

Để phân tích diễn biến theo thời gian, hệ thống cần liên kết các quan sát của cùng đối tượng giữa nhiều khung hình. BoT-SORT là bộ theo dõi được sử dụng cùng YOLO để duy trì Track ID trong video \[13\]. Track ID phục vụ quản lý lịch sử chuyển động, không phải danh tính đã được xác thực của người trong phòng. Khi bị che khuất, thay đổi góc nhìn hoặc mất phát hiện, đối tượng có thể nhận ID mới; việc sử dụng lịch sử cần có điều kiện kiểm tra tính liên tục để tránh nối nhầm chuyển động của hai đối tượng hoặc hai giai đoạn quan sát không liên quan.

*\[Vị trí chèn Hình 2.2 tại đây\]*

**Hình 2.2. Các điểm mốc cơ thể và đặc trưng hình học dùng trong phân tích tư thế.**

Nguồn: Tác giả tổng hợp từ đầu ra YOLO Pose và tài liệu Ultralytics \[12\]. Gợi ý đánh dấu trung điểm vai, trung điểm hông, hướng thân và khung bao; không cần minh họa cấu trúc mạng nơ-ron chi tiết.

### **2.4.2. Đặc trưng hình học và phân tích theo thời gian** {#2.4.2.-đặc-trưng-hình-học-và-phân-tích-theo-thời-gian}

Một dấu hiệu của tư thế nằm là tỷ lệ chiều rộng trên chiều cao của khung bao tăng, đồng thời đoạn nối trung điểm vai với trung điểm hông trở nên gần phương ngang. Tuy nhiên, các đặc trưng này chỉ mô tả hình dáng trong ảnh. Người nằm nghỉ có thể tạo đặc trưng tương tự người sau một cú ngã, còn người khuỵu xuống hoặc gục khi ngồi có thể không tạo khung bao nằm ngang. Vì vậy, thuật toán cần kết hợp tư thế hiện tại với lịch sử tư thế trước đó và mức thay đổi vị trí thân trong một khoảng thời gian.

Trong đề tài, tọa độ trung điểm hai hông được dùng làm đại diện cho chuyển động của phần thân; khi không có đủ điểm mốc phù hợp, chương trình sử dụng tâm khung bao làm giá trị dự phòng. Đại lượng này là đặc trưng ảnh, không phải phép đo trọng tâm cơ học chính xác của toàn cơ thể. Độ dịch chuyển được chuẩn hóa theo chiều cao khung bao để giảm ảnh hưởng của kích thước người trong ảnh; tốc độ tương ứng có đơn vị chiều cao khung bao trên giây, không phải m/s. Các quan hệ đầu–vai và đầu–hông bổ sung thông tin cho tình huống gục phần thân trên. Chuẩn hóa giúp so sánh các quan sát thuận tiện hơn nhưng không loại bỏ sai số phối cảnh, thay đổi khung bao hoặc chuyển động camera.

Máy trạng thái hữu hạn tổ chức quyết định theo trình tự: xác lập tư thế ban đầu, nhận diện dấu hiệu chuyển tiếp, chờ tư thế suy sụp duy trì và xác nhận sự kiện. Cửa sổ trượt lưu các quan sát gần nhất để so sánh trạng thái hiện tại với tư thế trước đó, còn EMA giảm dao động của đặc trưng giữa các khung hình. Cách kết hợp này hạn chế việc kết luận chỉ từ một tư thế nằm hoặc một điểm mốc sai. Đổi lại, yêu cầu quan sát liên tục và thời gian xác nhận làm tăng độ trễ, đồng thời có thể bỏ sót sự cố nếu quá trình ngã xảy ra khi đối tượng bị che khuất hoặc camera đang quay.

## **2.5. Truyền thông MQTT và mạng cục bộ** {#2.5.-truyền-thông-mqtt-và-mạng-cục-bộ}

MQTT là giao thức truyền thông điệp theo mô hình publish–subscribe. Thiết bị gửi thông điệp tới một topic trên broker, còn các thiết bị quan tâm đăng ký nhận dữ liệu từ topic đó. Broker chuyển tiếp thông điệp đến các bên đăng ký, giúp bên gửi và bên nhận không cần thiết lập kết nối trực tiếp với nhau. Các mức QoS xác định cơ chế giao nhận: QoS 0 không có xác nhận ở tầng MQTT, QoS 1 cho phép truyền lại và có thể tạo thông điệp trùng, còn QoS 2 bổ sung thủ tục để giao một lần ở tầng giao thức \[14\]. Lựa chọn QoS cần xét tính chất dữ liệu, thay vì áp dụng cùng một mức cho mọi thông điệp.

Trong hệ thống, Mosquitto chuyển tiếp dữ liệu radar và các lệnh điều khiển giữa ESP32 với backend. Dữ liệu vị trí được cập nhật liên tục có thể ưu tiên giá trị mới nhất, trong khi lệnh chuyển chế độ cần được quản lý khác với một lệnh quay từng bước. Đặc biệt, lệnh bước không nên được giữ lại để phát lại cho thiết bị sau khi kết nối lại, vì có thể gây chuyển động ngoài thời điểm người dùng yêu cầu. Cấu hình broker hiện phục vụ mạng thử nghiệm cục bộ và cho phép kết nối không xác thực; phạm vi truy cập vì vậy phải được giới hạn ở lớp mạng khi vận hành. MQTT là kênh điều khiển và dữ liệu cảm biến, còn video được truyền riêng qua HTTP để phù hợp đặc điểm và dung lượng của từng loại dữ liệu.

## **2.6. Tổ chức xử lý trên máy chủ và giao diện web** {#2.6.-tổ-chức-xử-lý-trên-máy-chủ-và-giao-diện-web}

Máy chủ tiếp nhận đồng thời video, dữ liệu radar và thao tác từ người dùng, trong khi suy luận pose là tác vụ có chi phí tính toán lớn. Kiến trúc đa tiến trình cho phép tách thu nhận hình ảnh, suy luận và phục vụ web vào các tiến trình riêng. Trong CPython có GIL, nhiều luồng không đồng thời thực thi bytecode Python; multiprocessing sử dụng các tiến trình riêng để hỗ trợ xử lý song song \[15\]. Tuy nhiên, các thư viện tính toán như PyTorch có thể giải phóng GIL trong một số tác vụ, nên không thể quy toàn bộ độ trễ AI cho cơ chế này. Giá trị chính của việc tách tiến trình trong đề tài là giảm mức phụ thuộc giữa các khối xử lý và thuận lợi cho việc khởi động lại khối bị dừng.

Khi suy luận chậm hơn tốc độ camera, hàng đợi không giới hạn sẽ tích lũy khung hình cũ. Với giám sát và điều hướng, một kết quả chính xác trên ảnh quá cũ vẫn có thể không hữu ích. Do đó, hệ thống ưu tiên khung hình mới nhất bằng hàng đợi ảnh có dung lượng nhỏ, chấp nhận bỏ qua một số khung để hạn chế phần độ trễ do tồn đọng dữ liệu. Chính sách này không thay thế việc đo độ trễ toàn tuyến, vì thời gian thu ảnh, truyền mạng, giải mã, suy luận và hiển thị vẫn đóng góp vào thời gian phản hồi.

FastAPI cung cấp các giao tiếp của backend, còn Next.js và React tổ chức giao diện giám sát. REST API phục vụ thao tác cấu hình, điều khiển và truy vấn; WebSocket đẩy sự kiện cảnh báo và thông báo trạng thái tới các phiên đang kết nối. Một số dữ liệu như vị trí radar và kết quả nhận diện vẫn được giao diện lấy định kỳ qua HTTP. Sự kết hợp này cho phép chọn cách cập nhật phù hợp với từng nội dung, đồng thời yêu cầu giao diện hiển thị rõ dữ liệu còn mới hay đã gián đoạn. Các nền tảng trên được áp dụng vào kiến trúc cụ thể ở chương 3\.

# **Chương 3\. Thiết kế hệ thống** {#chương-3.-thiết-kế-hệ-thống}

## **3.1. Yêu cầu và kiến trúc tổng thể** {#3.1.-yêu-cầu-và-kiến-trúc-tổng-thể}

### **3.1.1. Yêu cầu thiết kế** {#3.1.1.-yêu-cầu-thiết-kế}

Hệ thống được thiết kế cho kịch bản một người sinh hoạt trong phòng. Các chức năng chính gồm thu nhận video, tự động điều hướng camera, phân tích tư thế theo thời gian, ghi nhận sự cố và hỗ trợ người chăm sóc theo dõi qua giao diện web. Người vận hành có thể chuyển giữa AUTO và MANUAL, quay camera từng bước hoặc đưa về vị trí trung tâm. Bản đồ phòng cho phép cấu hình vị trí radar và vùng SAFE, DANGER để cung cấp ngữ cảnh không gian cho quá trình giám sát. Các cảnh báo vào vùng nguy hiểm hoặc đi lại ban đêm là chức năng bổ trợ, cần được phân biệt với sự kiện té ngã.

Các ràng buộc thiết kế tập trung vào độ trễ, khả năng phục hồi và an toàn cơ điện. Luồng xem trực tiếp phải hoạt động độc lập với tốc độ suy luận; hàng đợi ảnh cần tránh tích lũy dữ liệu cũ. Chương trình phải thể hiện được tình trạng camera, radar, MQTT và tiến trình AI để người dùng nhận biết khi hệ thống không còn đủ dữ liệu giám sát. Ở phần chấp hành, góc quay được giới hạn và nguồn servo phải đáp ứng tải chuyển động mà không gây sụt áp nghiêm trọng ở khối logic. Những yêu cầu này định hướng cách phân chia thiết bị và phần mềm, nhưng mức đáp ứng thực tế vẫn cần được đo trên nguyên mẫu.

### **3.1.2. Phân chia các khối chức năng** {#3.1.2.-phân-chia-các-khối-chức-năng}

Hệ thống gồm hai nhánh dữ liệu phối hợp tại máy chủ. Ở nhánh hình ảnh, ESP32-CAM phát MJPEG qua Wi-Fi; backend thu nhận khung hình, đưa vào YOLOv8m-pose và BoT-SORT, sau đó chuyển đặc trưng tư thế tới bộ phát hiện té ngã. Ở nhánh định vị và điều khiển, radar HLK-LD2450 gửi tọa độ qua UART tới ESP32 DevKit. Vi điều khiển chọn mục tiêu, lọc dữ liệu và tính góc servo trong chế độ AUTO, đồng thời gửi dữ liệu radar về máy chủ qua Mosquitto. Dashboard nhận hình ảnh và trạng thái từ backend, còn thao tác điều khiển được chuyển qua API và MQTT tới ESP32.

Phân chia này đưa các tác vụ thu cảm biến và tạo tín hiệu chấp hành xuống thiết bị nhúng, còn suy luận và quản lý sự kiện lên máy tính cục bộ. Radar có thể tiếp tục dẫn hướng tại ESP32 khi khối AI giảm tốc độ, nhưng chế độ tự động vẫn phụ thuộc trạng thái đã được thiết lập và chương trình điều khiển đang hoạt động. Việc phối hợp radar với camera ở đây diễn ra qua các quy tắc ưu tiên điều khiển và ngữ cảnh vùng phòng, chưa phải mô hình hợp nhất đặc trưng hoặc ghép định danh giữa hai cảm biến.

*\[Vị trí chèn Hình 3.1 tại đây\]*

**Hình 3.1. Sơ đồ khối hệ thống giám sát và các kênh trao đổi dữ liệu.**

Nguồn: Tác giả xây dựng. Gợi ý phân biệt hai nhánh camera–AI và radar–servo; ghi UART, PWM, MQTT, HTTP, REST API và WebSocket trên đúng đường kết nối, đồng thời thể hiện Telegram ở phía backend.

## **3.2. Thiết kế phần cứng** {#3.2.-thiết-kế-phần-cứng}

Cụm thu hình gồm ESP32-CAM với cảm biến OV3660 được gắn trên giá Pan-Tilt, còn radar cần được cố định theo hướng đã hiệu chuẩn để hệ quy chiếu của nó không thay đổi khi camera quay. Cụm điều khiển sử dụng ESP32 DevKit kết nối radar và hai servo MG996R. Theo firmware hiện tại, tín hiệu Pan nối GPIO13, Tilt nối GPIO27, còn chân TX của radar nối GPIO32 để ESP32 nhận dữ liệu qua UART2 ở 256.000 baud, định dạng 8N1. GPIO17 được khởi tạo làm đường TX của UART; firmware hiện chưa thực hiện gửi lệnh cấu hình radar qua đường này. Việc chọn GPIO27 cho Tilt cũng tránh sử dụng GPIO12, một chân có liên quan đến cấu hình khởi động của ESP32 \[9\].

Hai servo được cấp qua nhánh nguồn 5 V từ adapter 12 V/5 A và bộ hạ áp XL4015 theo cấu hình dự án. Dòng tải tăng khi servo khởi động, đổi hướng hoặc chịu lực cản, nên không cấp nguồn động cơ từ GPIO hay rail 3,3 V của ESP32. Nhánh nguồn servo và khối logic cần có GND chung để tín hiệu PWM sử dụng cùng mốc điện áp. Khả năng cấp dòng phải được đánh giá tại tải, vì thông số adapter không phản ánh đầy đủ sụt áp trên bộ hạ áp, dây dẫn và đầu nối. Khi kiểm tra nguyên mẫu, cần theo dõi điện áp lúc hai servo cùng chuyển động và xác nhận cơ cấu không bị kẹt tại giới hạn quay.

Firmware camera phát luồng tại cổng 81 và cung cấp trạng thái, điều chỉnh cấu hình ảnh tại cổng 82\. Cấu hình mặc định dùng JPEG ở VGA 640 × 480, xung XCLK 20 MHz và hai bộ đệm khi có PSRAM; nếu thiếu PSRAM, firmware chuyển sang QVGA với một bộ đệm. Camera chỉ phục vụ một kết nối stream trực tiếp đồng thời, nên backend giữ vai trò tiếp nhận và phân phối hình ảnh cho dashboard. Thiết kế này giúp các phiên xem không phải cùng mở kết nối riêng tới ESP32-CAM, nhưng băng thông và tải phục vụ nhiều người xem vẫn cần được kiểm chứng tại máy chủ.

*\[Vị trí chèn Hình 3.2 tại đây\]*

**Hình 3.2. Bố trí cụm camera Pan-Tilt, radar cố định và kết nối nguồn, tín hiệu.**

Nguồn: Ảnh chụp và sơ đồ do tác giả xây dựng. Gợi ý dùng một ảnh nguyên mẫu kèm sơ đồ nối dây có nhãn GPIO13, GPIO27, GPIO32 và GND chung.

## **3.3. Thiết kế giải thuật và logic điều khiển** {#3.3.-thiết-kế-giải-thuật-và-logic-điều-khiển}

### **3.3.1. Đọc radar và điều hướng camera** {#3.3.1.-đọc-radar-và-điều-hướng-camera}

Firmware ESP32 DevKit tổ chức công việc trong vòng lặp Arduino, chưa tạo các tác vụ FreeRTOS riêng cho từng chức năng. Dữ liệu UART được xử lý bằng bộ đệm trượt 30 byte; khung chỉ được chấp nhận khi có đúng tiêu đề và chuỗi kết thúc. Khi giải mã tọa độ, bit cao nhất biểu diễn dấu theo định dạng của radar, còn các bit còn lại biểu diễn độ lớn; dữ liệu này không được đọc như số nguyên bù hai thông thường. Trong ba vị trí mục tiêu được báo về, firmware chọn mục tiêu đầu tiên có tọa độ Y hợp lệ để dẫn hướng. Cách chọn đơn giản phù hợp với phạm vi một người, nhưng không cung cấp cơ chế bám một cá thể đã định danh khi nhiều mục tiêu cùng xuất hiện.

Tọa độ được lọc EMA với hệ số 0,25 trước khi tính góc đích. Theo chiều lắp cơ cấu hiện tại, góc Pan là 90° trừ góc phương vị atan2(X, Y) sau khi đổi sang độ. Góc Tilt được tính tương tự từ chênh lệch độ cao và khoảng cách ngang; firmware đặt độ cao camera là 1.500 mm và điểm ngắm là 900 mm. Hai giá trị này là giả định của mô hình dẫn hướng, không phải kết quả radar đo độ cao người. Các góc đích được kẹp trong khoảng 10°–170°. Mỗi lần cập nhật, góc lệnh tiến 12% khoảng cách còn lại tới góc đích, nhờ đó chuyển động được làm mượt thay vì đổi góc ngay lập tức.

MANUAL là chế độ khởi tạo; các lệnh LEFT, RIGHT, UP, DOWN dịch góc theo bước 12° ở Pan và 7° ở Tilt, còn RESET đưa cơ cấu về tâm. Trong AUTO, dữ liệu radar mới được ưu tiên dẫn hướng; firmware bỏ qua lệnh bám bằng hình ảnh khi radar vừa cung cấp mục tiêu trong vòng 1,2 giây. Khi radar mất mục tiêu, backend có thể gửi tâm khung bao để hiệu chỉnh theo ảnh. Nhánh thị giác chỉ gửi lệnh nếu độ lệch vượt 15% chiều rộng hoặc chiều cao toàn khung hình, tương ứng ±96 pixel và ±72 pixel ở VGA. Backend quy đổi tọa độ về hệ VGA cho giao thức hiện hành, còn firmware hiệu chỉnh theo sai lệch với hệ số 0,02°/pixel. Khi mục tiêu radar đã có bị mất hơn 3 giây, firmware xóa cờ mục tiêu và đặt góc đích về 90°/90° một lần; các lệnh bám theo ảnh nhận sau đó có thể tiếp tục thay đổi góc đích.

Chương trình tăng bộ đệm UART lên 2.048 byte và đọc dữ liệu trước, sau phần xử lý mạng để giảm nguy cơ bỏ sót khung. Các lần thử kết nối lại được giãn cách, nhưng lời gọi kết nối MQTT vẫn đồng bộ và có thể làm chậm vòng lặp. Khoảng nghỉ 15 ms ở cuối loop không đồng nghĩa với một chu kỳ điều khiển cố định 15 ms. Trạng thái MOVING hoặc STOPPED được suy ra từ quá trình cập nhật góc lệnh và gửi về backend; do không có cảm biến đo góc ngoài, đây là trạng thái chuyển động ước tính, cần phân biệt với phản hồi xác nhận cơ khí đã dừng.

### **3.3.2. Phát hiện té ngã theo chuỗi tư thế** {#3.3.2.-phát-hiện-té-ngã-theo-chuỗi-tư-thế}

Backend sử dụng YOLOv8m-pose để phát hiện người và điểm mốc, kết hợp BoT-SORT để theo dõi. Từ khung bao và các điểm ở vai, hông, đầu, chương trình tính tỷ lệ khung bao, góc thân, vị trí đại diện của thân và các quan hệ đầu–vai, đầu–hông. Góc thân và vị trí thân được làm mượt với hệ số EMA lần lượt 0,6 và 0,7. Mô-đun FallDetector duy trì lịch sử tối đa 5 giây cho từng Track ID; quan sát được sử dụng khi độ tin cậy khung bao đạt ít nhất 0,55 và độ tin cậy trung bình của hai vai, hai hông đạt ít nhất 0,35. Nếu khoảng cách giữa hai quan sát hợp lệ vượt 0,9 giây, lịch sử được đặt lại để tránh suy luận xuyên qua một khoảng mất dấu dài.

Máy trạng thái bắt đầu từ unknown và chỉ xác lập upright khi quan sát được tư thế đứng hoặc ngồi thẳng ổn định ít nhất 0,45 giây. Người đã nằm ngay khi xuất hiện không được tự động coi là vừa té ngã. Sau khi có trạng thái ban đầu, thuật toán tìm dấu hiệu chuyển tiếp sang tư thế suy sụp. Ngã ngang được đánh giá bằng sự kết hợp giữa khung bao rộng, thân nghiêng về phương ngang và mức tụt hoặc tốc độ dịch chuyển của thân. Khuỵu xuống được xem xét khi thân dịch xuống rõ rệt dù vẫn tương đối thẳng. Với gục khi ngồi, thuật toán theo dõi sự thay đổi quan hệ đầu–vai, đầu–hông cùng biến động tư thế. Những nhánh này bổ sung cho nhau để không giới hạn phát hiện vào hình dáng nằm ngang.

Khi đủ dấu hiệu, trạng thái chuyển sang candidate thay vì phát cảnh báo ngay. Ứng viên phải tồn tại ít nhất 0,70 giây ở nhánh thông thường hoặc 1,20 giây ở nhánh gục từ từ, đồng thời còn thỏa điều kiện tư thế suy sụp và giới hạn biến động tại thời điểm xác nhận. Cách xử lý hiện tại không đo một khoảng bất động liên tục kéo dài toàn bộ thời gian chờ. Ứng viên không còn thỏa điều kiện sẽ hết hạn; sau xác nhận, cơ chế cooldown 4 giây và trạng thái recovery hạn chế cảnh báo lặp, đồng thời cho phép tiếp tục đánh giá khi người tự phục hồi. Các ngưỡng chuyển động đều phải được hiểu theo đại lượng chuẩn hóa của thuật toán, không được diễn giải thành vận tốc rơi đo bằng m/s.

Trình tự trên giúp phân biệt một biến cố quan sát được với tư thế nằm đơn thuần, nhưng tạo ra một đánh đổi: người đã ngã trước khi vào khung hình hoặc bị che khuất trong pha chuyển tiếp có thể không được xác nhận. Tương tự, các dấu hiệu gục được suy ra từ hình ảnh không đủ để xác định nguyên nhân sức khỏe. Các ngưỡng hiện tại là quy tắc heuristic của nguyên mẫu; độ phù hợp phải được đánh giá bằng những tình huống sinh hoạt và mô phỏng té ngã trong không gian sử dụng, thay vì lấy độ chính xác của YOLO làm độ chính xác của bộ phát hiện sự cố.

*\[Vị trí chèn Hình 3.3 tại đây\]*

**Hình 3.3. Máy trạng thái phát hiện té ngã từ chuỗi quan sát tư thế.**

Nguồn: Tác giả xây dựng từ mô-đun FallDetector. Gợi ý thể hiện unknown, upright, observed\_horizontal, candidate, confirmed và recovery; ghi điều kiện chuyển chính và thời gian xác nhận, tránh đưa toàn bộ ngưỡng nhỏ lên sơ đồ.

### **3.3.3. Xử lý camera quay, mất dấu và nhiều người** {#3.3.3.-xử-lý-camera-quay,-mất-dấu-và-nhiều-người}

Camera quay làm tọa độ điểm mốc dịch chuyển ngay cả khi người đứng yên, nên biến động trong ảnh không thể luôn được quy cho chuyển động cơ thể. Backend sử dụng trạng thái servo để tạm chặn việc hình thành ứng viên té ngã mới trong lúc camera di chuyển. Nếu đang có ứng viên, thời điểm bắt đầu chờ được đặt lại theo quan sát khi camera còn quay, tránh tính thời gian quay vào thời gian xác nhận. Cơ chế này giảm khả năng báo nhầm do dịch chuyển toàn khung hình, nhưng có thể làm chậm hoặc bỏ qua sự cố xảy ra đúng lúc camera điều hướng. Chất lượng tín hiệu MOVING, STOPPED vì vậy ảnh hưởng trực tiếp tới bộ phát hiện.

Khi Track ID thay đổi trong một khoảng ngắn, backend có thể tiếp nối lịch sử nếu chỉ có một người, camera không quay, nguồn video không thay đổi và hai khung bao có quan hệ không gian phù hợp. Đây là quy tắc duy trì vết trong tình huống giới hạn, không phải cơ chế tái định danh người bằng đặc trưng sinh trắc học. Nếu không đủ điều kiện, đối tượng phải được đánh giá lại từ lịch sử mới. Khi có từ hai người với điểm mốc thân đủ tin cậy, backend tạm ngừng đánh giá té ngã và hiển thị MUTED. Tuy nhiên, firmware vẫn có thể bám mục tiêu radar trong AUTO; không thể coi cơ chế này là khóa toàn bộ điều hướng hoặc là giải pháp đầy đủ cho giám sát nhiều người.

### **3.3.4. Ngữ cảnh vùng phòng và xử lý cảnh báo** {#3.3.4.-ngữ-cảnh-vùng-phòng-và-xử-lý-cảnh-báo}

Backend chuyển tọa độ radar sang hệ phòng theo vị trí lắp đặt (x\_r, y\_r) và góc xoay θ. Theo quy ước chiều quay đang dùng trong mã, phép đổi là x\_phòng \= x\_r \+ Xcosθ \+ Ysinθ và y\_phòng \= y\_r − Xsinθ \+ Ycosθ. Kết quả được đối chiếu với các vùng chữ nhật SAFE và DANGER do người vận hành cấu hình. Việc phân vùng phải dựa trên vị trí thực tế và dấu trục đã kiểm tra; cấu hình sai có thể khiến một vị trí trên sàn bị coi là vùng nghỉ hoặc khiến cảnh báo xuất hiện ở sai khu vực.

SAFE biểu diễn khu vực nghỉ có chủ đích, chẳng hạn mặt giường. Khi mục tiêu radar thuộc SAFE, dữ liệu còn mới trong vòng 2 giây và không đồng thời thuộc DANGER, backend xóa lịch sử phát hiện té ngã của đối tượng đang đánh giá và hiển thị SAFE ZONE. Đây là cách dùng vị trí để hạn chế báo nhầm khi nằm nghỉ, nhưng cũng làm hệ thống không đánh giá té ngã trong vùng đó. Do chưa ghép định danh giữa radar và ảnh, ngữ cảnh SAFE không bảo đảm gắn đúng người trong tình huống nhiều mục tiêu. Vùng nghỉ cần được giới hạn đúng diện tích thực, tránh bao phủ sàn hoặc lối đi chỉ để giảm báo động giả.

Khi mục tiêu vào DANGER, backend tạo sự kiện cảnh báo vùng nguy hiểm; đây là cảnh báo vị trí, không phải xác nhận té ngã. Chức năng đi lại ban đêm theo dõi mục tiêu di chuyển liên tục ngoài SAFE hơn 5 phút trong khung 23:00–05:00, sử dụng thời gian của máy chủ triển khai. Các sự kiện này cung cấp thêm ngữ cảnh cho người chăm sóc nhưng cần được hiển thị bằng tên riêng để tránh nhầm mức độ và nguyên nhân cảnh báo.

Với sự kiện té ngã mới được xác nhận, backend chuyển ảnh và thông tin liên quan tới khối xử lý cảnh báo để lưu snapshot, ghi metadata vào SQLite và đẩy thông báo qua WebSocket. Nếu đã cấu hình Telegram, máy chủ gửi thông điệp kèm ảnh; thời gian giãn cách tối thiểu giữa các lần gửi là 60 giây. Giới hạn này giảm thông báo lặp nhưng có thể khiến một sự kiện tiếp theo không tạo tin nhắn ngay. Các kênh cảnh báo cần được đánh giá riêng để phân biệt thời điểm backend xác nhận sự kiện với thời điểm người chăm sóc nhận được thông báo.

Người dùng có thể thực hiện cử chỉ đưa hai cổ tay lên trên vai và gần nhau theo phương ngang để đặt lại trạng thái phát hiện khi nghi ngờ báo động giả. Khi nhận cử chỉ, backend đặt lại các biến trạng thái và hiển thị ALARM CANCELED trên hình ảnh. Thao tác này không xóa sự kiện đã lưu và không thu hồi tin nhắn Telegram đã gửi. Việc xác nhận đã xem cảnh báo trên dashboard cũng là một thao tác riêng. Phân biệt các hành vi này giúp nhật ký phản ánh sự cố đã được phát hiện, ngay cả khi người dùng sau đó cho rằng đó là báo động giả.

*\[Vị trí chèn Hình 3.4 tại đây\]*

**Hình 3.4. Chuyển đổi tọa độ radar và vai trò của vùng SAFE, DANGER trong xử lý sự kiện.**

Nguồn: Tác giả xây dựng. Gợi ý thể hiện radar lệch góc so với trục phòng, một vùng giường SAFE và một vùng nguy hiểm DANGER; nối ngữ cảnh SAFE với nhánh tạm ngừng đánh giá té ngã.

## **3.4. Tổ chức phần mềm, giao tiếp và lưu trữ** {#3.4.-tổ-chức-phần-mềm,-giao-tiếp-và-lưu-trữ}

### **3.4.1. Luồng xử lý đa tiến trình** {#3.4.1.-luồng-xử-lý-đa-tiến-trình}

Backend gồm tiến trình web và hai tiến trình con camera\_process, ai\_process. Tiến trình camera duy trì kết nối HTTP tới ESP32-CAM, tách ảnh JPEG từ luồng và gửi JPEG thô cho nhánh xem trực tiếp. Những khung được chọn cho AI được giải mã bằng OpenCV rồi chuyển sang tiến trình suy luận. Các hàng đợi ảnh có dung lượng một phần tử và ưu tiên thay ảnh cũ bằng ảnh mới. Tiến trình AI chạy mô hình pose, theo dõi, đánh giá té ngã và trao đổi MQTT, sau đó trả ảnh có chú giải, dữ liệu khung bao, điểm mốc và sự kiện cho tiến trình web. Một số cờ và chỉ số nhỏ được chia sẻ qua vùng nhớ multiprocessing để các tiến trình cập nhật trạng thái vận hành.

Luồng xem trực tiếp và luồng suy luận được tách để tốc độ hiển thị không phụ thuộc hoàn toàn vào AI. Tốc độ đưa khung vào nhánh suy luận được điều chỉnh theo thời gian xử lý quan sát được và không vượt trần AI\_FPS\_LIMIT, mặc định 15 FPS. Đây là giới hạn cấu hình, không phải tốc độ đầu ra được bảo đảm. Mã cũng có lựa chọn runtime tăng tốc theo phần cứng và phương án dự phòng; lợi ích thực tế cần đo với mô hình, bộ xử lý và độ phân giải đang dùng. Việc giảm tồn đọng hàng đợi có thể làm hình ảnh mới hơn, nhưng số khung được phân tích ít đi cũng có thể ảnh hưởng việc quan sát các chuyển tiếp ngắn.

Một luồng watchdog trong tiến trình web kiểm tra các tiến trình con khoảng mỗi 3 giây và khởi tạo lại tiến trình đã dừng. Cơ chế này hỗ trợ phục hồi khi worker kết thúc bất thường, nhưng không tự phát hiện mọi trường hợp tiến trình vẫn còn sống mà không tạo kết quả. Vì vậy, các chỉ số về thời điểm khung hình gần nhất, hoạt động AI và độ mới của radar cần được theo dõi cùng trạng thái tiến trình. Tách tiến trình và giới hạn hàng đợi là các biện pháp tăng khả năng vận hành, chưa đủ để kết luận hệ thống đã đạt độ ổn định liên tục 24/7.

*\[Vị trí chèn Hình 3.5 tại đây\]*

**Hình 3.5. Luồng video trực tiếp, luồng suy luận và giao tiếp giữa các tiến trình backend.**

Nguồn: Tác giả xây dựng từ kiến trúc phần mềm. Gợi ý thể hiện JPEG thô đi vào nhánh xem trực tiếp, ảnh giải mã đi vào AI, hàng đợi ảnh dung lượng một phần tử và hàng đợi sự kiện riêng; đặt watchdog trong tiến trình web.

### **3.4.2. Giao tiếp giữa thiết bị, backend và dashboard** {#3.4.2.-giao-tiếp-giữa-thiết-bị,-backend-và-dashboard}

MQTT được tổ chức theo nhóm chức năng: embedded/radar/data mang tọa độ và vận tốc; embedded/servo/mode chọn chế độ; embedded/servo/manual mang lệnh bước; embedded/servo/tracking mang tọa độ tâm ảnh; embedded/servo/status mang trạng thái chuyển động ước tính. Với firmware hiện tại, backend dùng giao thức legacy\_step để gửi đúng các lệnh mà thiết bị hỗ trợ. Các bản tin vị trí và lệnh bước chủ yếu dùng QoS 0, còn bản tin chế độ do backend phát dùng QoS 1 và retained để thiết bị có thể nhận lại chế độ khi kết nối. Việc lựa chọn này không đồng nghĩa mọi lệnh đều được xác nhận đã thực thi, vì firmware hiện chưa cung cấp phản hồi đầy đủ cho từng thao tác.

Các giao tiếp HTTP cung cấp luồng xem trực tiếp, luồng có chú giải và các API truy vấn dữ liệu phát hiện, tình trạng video, radar, cấu hình. Lệnh chuyển chế độ hoặc quay camera được backend kiểm tra trước khi chuyển xuống thiết bị. Các lệnh bước được giới hạn tần suất và không xếp thành chuỗi chuyển động chờ lâu, nhằm giảm nguy cơ camera tiếp tục quay sau khi ý định điều khiển đã thay đổi. WebSocket tại /api/v1/ws/alerts đẩy các sự kiện và thông báo tình trạng hệ thống; radar và một số chỉ số video vẫn được dashboard truy vấn định kỳ. Do đó, độ mới của dữ liệu phải được xác định theo thời điểm cập nhật của từng kênh, không chỉ dựa vào việc trình duyệt còn mở.

### **3.4.3. Lưu trữ và phạm vi truy cập** {#3.4.3.-lưu-trữ-và-phạm-vi-truy-cập}

SQLite lưu metadata sự kiện, các bản ghi radar và cấu hình phòng, vùng giám sát. Bảng alerts hiện chứa thời điểm, mã sự kiện, nội dung và đường dẫn ảnh; bảng radar\_logs chứa tọa độ và vận tốc; room\_config chứa kích thước phòng, vị trí và góc radar; zones\_config biểu diễn vùng chữ nhật bằng các giới hạn tọa độ. Snapshot được lưu thành tệp riêng, còn cơ sở dữ liệu giữ đường dẫn để truy xuất khi cần. Việc tách ảnh khỏi metadata giúp cấu trúc dữ liệu sự kiện gọn hơn và thuận lợi khi quản lý tệp ảnh theo thời gian.

Giao diện nhật ký hiện nhận các cảnh báo qua WebSocket và giữ danh sách trong trạng thái React. Thao tác đánh dấu đã xem hoặc xóa danh sách trên giao diện chưa tương đương với việc cập nhật, xóa lịch sử SQLite. Cơ sở dữ liệu có thể lưu sự kiện bền vững, nhưng giao diện hiện chưa hoàn tất luồng tải lại và xác nhận lịch sử đó sau khi mở một phiên mới. Đây là giới hạn của chức năng quản lý sự kiện cần phân biệt với cơ chế lưu snapshot và metadata ở backend.

Xử lý cục bộ hạn chế việc phải gửi toàn bộ video tới dịch vụ suy luận bên ngoài. Tuy nhiên, hình ảnh vẫn được thu, lưu và có thể gửi qua Telegram, nên quyền riêng tư phụ thuộc cách cấp quyền và quản lý dữ liệu. Theo phương án triển khai của dự án, Tailscale hỗ trợ truy cập qua mạng riêng; ứng dụng hiện chưa có đăng nhập và phân quyền riêng, do đó quyền truy cập chủ yếu được kiểm soát ở lớp mạng. Việc mở dashboard cho thiết bị từ xa cần đi kèm giới hạn đối tượng được phép xem và điều khiển. Đây là phần quản lý vận hành cần thiết để hệ thống giám sát không trở thành một nguồn truy cập hình ảnh ngoài ý muốn.

## **3.5. Thiết kế giao diện giám sát** {#3.5.-thiết-kế-giao-diện-giám-sát}

Màn hình chính đặt video và trạng thái nhận diện cạnh các nút điều khiển Pan-Tilt. Người vận hành có thể chọn AUTO, MANUAL, quay theo bốn hướng hoặc đưa camera về tâm. Các thông tin về tốc độ camera, tốc độ AI và kết nối giúp phân biệt tình trạng video đang chạy với tình trạng thuật toán đang thực sự phân tích. Đặc biệt, việc hiển thị MUTED, SAFE ZONE hoặc dữ liệu cũ cần được hiểu là điều kiện hạn chế giám sát, tránh tạo cảm giác hệ thống đang bảo vệ đầy đủ chỉ vì vẫn có hình ảnh trên màn hình.

Bản đồ radar ở trang phân tích sử dụng SVG để biểu diễn mặt bằng phòng, vị trí radar, tọa độ mục tiêu và các vùng cấu hình. Người dùng có thể điều chỉnh vùng chữ nhật và đối chiếu vị trí trên bản đồ với vị trí thực tế để kiểm tra hiệu chuẩn. Vùng quét hiển thị là minh họa theo cấu hình, không phải bản đồ đo thực nghiệm về khả năng phát hiện tại từng điểm. Vết di chuyển trên giao diện hỗ trợ quan sát lịch sử gần trong phiên, nhưng không nên được xem là quỹ đạo đã xác định chính xác danh tính một người.

Trang cài đặt cho phép chọn địa chỉ backend và cập nhật nguồn ESP32-CAM; cấu hình phòng, vùng được lưu qua các API tương ứng. Khả năng hiệu chuẩn servo qua giao diện còn phụ thuộc giao thức firmware: bản legacy\_step hiện tại không hỗ trợ áp dụng cấu hình servo qua MQTT, nên các tham số này phải được sửa trong sketch và nạp lại. Một số lựa chọn giao diện mới chỉ được lưu trong trình duyệt, chưa đồng bộ với khối xử lý. Mô tả giao diện vì vậy cần căn cứ vào luồng chức năng đã hoạt động, thay vì xem mọi trường nhập là một tính năng đã hoàn chỉnh.

*\[Vị trí chèn Hình 3.6 tại đây\]*

**Hình 3.6. Giao diện giám sát video và cấu hình bản đồ phòng trên nguyên mẫu.**

Nguồn: Ảnh chụp màn hình hệ thống của tác giả. Gợi ý dùng hai ảnh cùng một hình, gồm màn hình video–điều khiển và bản đồ radar–vùng giám sát, với dữ liệu của cùng một tình huống thử nghiệm.

Thiết kế trên tạo cơ sở cho việc triển khai và đánh giá nguyên mẫu theo từng khối. Phần thực nghiệm tiếp theo cần làm rõ khả năng điều hướng tại các vị trí trong phòng, phân biệt các tình huống sinh hoạt với té ngã, độ trễ cảnh báo và hành vi khi mất dữ liệu hoặc có nhiều người. Kết quả đo sẽ cho phép xác định mức đáp ứng của hệ thống và những giới hạn còn phải cải thiện, thay vì suy ra hiệu quả vận hành chỉ từ việc tích hợp đủ các thành phần.

# **Chương 4\. Xây dựng phần mềm và thiết lập kiểm thử mô phỏng** {#chương-4.-xây-dựng-phần-mềm-và-thiết-lập-kiểm-thử-mô-phỏng}

## **4.1. Môi trường phát triển** {#4.1.-môi-trường-phát-triển}

Phần mềm của hệ thống được phát triển theo ba nhóm: firmware trên ESP32, backend xử lý và giao diện web. Máy tính Windows đảm nhận việc phát triển và chạy các dịch vụ trung tâm. Firmware sử dụng Arduino IDE cùng core ESP32 của Espressif; backend sử dụng Python với môi trường riêng để quản lý thư viện; frontend sử dụng Node.js và bộ công cụ của Next.js. Việc tách môi trường giúp kiểm tra từng nhóm chức năng độc lập, đồng thời hạn chế xung đột giữa các thư viện xử lý ảnh, giao tiếp và giao diện \[16\].

Backend sử dụng FastAPI, Uvicorn, OpenCV, Ultralytics, Paho MQTT và SQLite. Các thư viện được khai báo trong requirements.txt, nhưng phần lớn chưa cố định phiên bản, nên khả năng tái lập môi trường cần được kiểm tra khi chuyển máy hoặc nâng cấp Python. README khuyến nghị Python 3.11 x64 cho triển khai; phiên bản thực tế của mỗi lần chạy phải được ghi cùng cấu hình thử nghiệm. Frontend đã có tệp khóa phụ thuộc, với Next.js 16.3.3 và React 19.2.8 ở phiên bản được đối chiếu. Cài đặt theo tệp khóa giúp giữ nhất quán các gói của giao diện, còn năng lực suy luận AI vẫn phụ thuộc phần cứng và runtime trên máy chủ.

Cấu hình vận hành tập trung vào nguồn video, địa chỉ MQTT broker, giao thức servo, mô hình pose và giới hạn xử lý AI. Với firmware hiện có, backend phải chọn legacy\_step để các lệnh điều khiển khớp với ESP32 DevKit. Mô hình mặc định là YOLOv8m-pose; các phương án tăng tốc hoặc mô hình nhẹ hơn chỉ được sử dụng khi môi trường tương ứng đáp ứng yêu cầu. Tách cấu hình khỏi phần xử lý giúp thay đổi địa chỉ mạng và mô hình thuận tiện hơn, nhưng không thay thế việc kiểm tra tính tương thích giữa phần mềm và firmware.

## **4.2. Xây dựng firmware cho hai nút ESP32** {#4.2.-xây-dựng-firmware-cho-hai-nút-esp32}

### **4.2.1. Firmware thu nhận và truyền hình ảnh** {#4.2.1.-firmware-thu-nhận-và-truyền-hình-ảnh}

Firmware ESP32-CAM được hiện thực trong esp32\_cam\_stream.ino. Phần khởi tạo thiết lập sơ đồ chân theo profile camera, cấu hình driver, kiểm tra PSRAM và kết nối Wi-Fi trước khi mở dịch vụ HTTP. Profile bo mạch và loại cảm biến là hai thông tin cần đối chiếu riêng: nguyên mẫu sử dụng cấu hình AI Thinker ESP32-CAM với cảm biến OV3660. Sau khi khởi động, log cung cấp thông tin nhận cảm biến và địa chỉ stream để xác nhận thiết bị đã sẵn sàng trước khi backend tiếp nhận hình ảnh.

Khối phát MJPEG lấy bộ đệm ảnh từ driver, gửi dữ liệu JPEG theo từng phần của phản hồi HTTP rồi trả bộ đệm cho camera. Cách tổ chức này tránh giữ bộ đệm quá lâu sau khi gửi xong ảnh và cho phép driver tiếp tục thu khung mới. Firmware cũng có dịch vụ đọc trạng thái, điều chỉnh cấu hình ảnh và cơ chế thử kết nối lại Wi-Fi. Khi mất mạng hoặc máy nhận stream ngắt kết nối, khả năng phục hồi cần được xác nhận qua việc xuất hiện khung hình mới, thay vì chỉ dựa vào địa chỉ IP đã in ở lần khởi động trước.

### **4.2.2. Firmware đọc radar và điều khiển Pan-Tilt** {#4.2.2.-firmware-đọc-radar-và-điều-khiển-pan-tilt}

Firmware ESP32 DevKit được hiện thực trong esp32\_cam\_radar.ino, gồm các phần đọc UART, giải mã khung radar, chọn mục tiêu, tính góc đích, cập nhật servo và giao tiếp MQTT. Các công việc được điều phối trong setup() và loop(); chương trình chưa tạo các tác vụ FreeRTOS riêng cho từng chức năng. Bộ đệm UART và các mốc thời gian thử kết nối giúp hạn chế ảnh hưởng của xử lý mạng tới thu nhận cảm biến, còn ngoại vi PWM duy trì tín hiệu servo theo cấu hình đã thiết lập. Cách triển khai này tương đối gọn, nhưng thời gian thực thi một vòng vẫn thay đổi theo hoạt động mạng.

Callback MQTT phân loại thông điệp theo topic để đổi chế độ, nhận lệnh bước hoặc nhận tọa độ bám theo ảnh. Trong MANUAL, mỗi lệnh hợp lệ cập nhật góc đích một bước; trong AUTO, dữ liệu radar được ưu tiên theo quy tắc đã trình bày ở chương 3\. Firmware đưa tọa độ radar về dạng JSON để backend xử lý, đồng thời xuất trạng thái chuyển động ước tính của servo. Các tham số góc, lọc và điểm ngắm vẫn nằm trong sketch đối với giao thức hiện hành; thay đổi chúng cần nạp lại firmware thay vì chỉ sửa biểu mẫu trên dashboard.

## **4.3. Xây dựng backend** {#4.3.-xây-dựng-backend}

### **4.3.1. Tổ chức các mô-đun và vòng đời dịch vụ** {#4.3.1.-tổ-chức-các-mô-đun-và-vòng-đời-dịch-vụ}

Backend phân chia phần đánh giá té ngã vào fall\_detection.py, truy cập SQLite vào database.py và quy tắc đóng gói lệnh servo vào servo\_protocol.py. main.py thực hiện điều phối các thành phần này, khởi tạo dịch vụ web, tạo tiến trình camera và AI, tiếp nhận kết quả rồi cung cấp dữ liệu cho giao diện. Tách thuật toán và giao thức thành các mô-đun riêng giúp kiểm tra logic với đầu vào xác định mà không phải vận hành toàn bộ thiết bị, đồng thời làm rõ phần nào xử lý hành vi và phần nào chịu trách nhiệm truyền lệnh.

Vòng đời ứng dụng khởi tạo hàng đợi, vùng nhớ chỉ số và các worker trước khi phục vụ yêu cầu; khi kết thúc, cờ dừng được dùng để thông báo cho các thành phần nền. Trong lúc chạy, tiến trình web thu kết quả mới nhất từ các hàng đợi và xử lý sự kiện qua một tác vụ riêng. Vì vậy, việc ghi nhận sự cố không phụ thuộc vào việc có người đang mở dashboard. Tuy nhiên, tiến trình xử lý cảnh báo vẫn phải hoạt động và tài nguyên lưu trữ phải còn khả dụng để ảnh, metadata được ghi đầy đủ.

### **4.3.2. Tiếp nhận video và quản lý dữ liệu theo nguồn** {#4.3.2.-tiếp-nhận-video-và-quản-lý-dữ-liệu-theo-nguồn}

Tiến trình camera đọc dòng byte HTTP và tìm ranh giới JPEG để tách ảnh. JPEG được chuyển trực tiếp tới nhánh xem video, còn những khung được chọn cho suy luận được giải mã và đưa vào hàng đợi AI. Chính sách thay khung cũ bằng khung mới được thực hiện tại các hàng đợi ảnh; nhịp giải mã cho AI được điều chỉnh theo thời gian xử lý quan sát được. Như vậy, backend kiểm soát lượng công việc đưa vào suy luận, thay vì cố xử lý mọi khung mà camera phát ra.

Khi người dùng cập nhật IP camera, backend kiểm tra địa chỉ, lưu nguồn mới và tăng mã phiên nguồn video, gọi là generation. Các khung và kết quả đi kèm generation để bộ tiếp nhận nhận biết dữ liệu thuộc nguồn đang sử dụng. Cơ chế này giúp loại bỏ khung hoặc sự kiện cũ còn trong hàng đợi khi chuyển nguồn, tránh hiển thị kết quả của phiên trước lên video mới. Những bộ nhớ đệm liên quan cũng được làm mới; trạng thái kết nối chỉ được khôi phục khi backend nhận lại dữ liệu phù hợp.

### **4.3.3. Điều khiển, cấu hình và lưu sự kiện** {#4.3.3.-điều-khiển,-cấu-hình-và-lưu-sự-kiện}

Các API điều khiển kiểm tra chế độ và khả năng giao tiếp trước khi gửi lệnh. Với legacy\_step, backend hỗ trợ lệnh quay theo bước, hạn chế các yêu cầu đến quá nhanh và không biến chúng thành một hàng đợi chuyển động kéo dài. Những lệnh dành cho giao thức khác được từ chối khi firmware hiện tại không hỗ trợ. Quy tắc này giúp phản hồi của API phản ánh đúng phạm vi chức năng, nhưng kết quả gửi MQTT thành công vẫn chỉ là bằng chứng ở đường truyền, chưa xác nhận góc cơ khí thực tế.

Đối với danh sách vùng giám sát, backend kiểm tra loại vùng, tính hữu hạn của tọa độ, quan hệ giữa giới hạn nhỏ nhất và lớn nhất, cùng phạm vi nằm trong phòng. Dữ liệu hợp lệ được thay thế trong giao dịch SQLite; trường hợp bị từ chối không được làm mất cấu hình trước đó. API cấu hình phòng lưu kích thước, vị trí và góc radar, nhưng chưa có đầy đủ các ràng buộc kiểm tra tương tự. Các API đọc trả lại dữ liệu đã lưu để giao diện đối chiếu. Khi có sự kiện té ngã, backend lưu ảnh riêng và metadata vào cơ sở dữ liệu, sau đó phát thông báo WebSocket và thực hiện nhánh Telegram theo cấu hình. Các cảnh báo vị trí được xử lý bằng mã sự kiện riêng để không lẫn với kết luận té ngã.

## **4.4. Xây dựng giao diện giám sát** {#4.4.-xây-dựng-giao-diện-giám-sát}

### **4.4.1. Tổ chức các trang và khả năng sử dụng** {#4.4.1.-tổ-chức-các-trang-và-khả-năng-sử-dụng}

Giao diện sử dụng Next.js và React, với TypeScript mô tả dữ liệu và Tailwind CSS tổ chức bố cục. Các trang chính gồm giám sát trực tiếp, phân tích và cấu hình phòng, nhật ký cảnh báo, cùng cài đặt hệ thống. React Context chia sẻ trạng thái cảnh báo và ngôn ngữ giữa các trang. Bản đồ radar được dựng bằng SVG để biểu diễn hệ tọa độ, mục tiêu và vùng chữ nhật có thể điều chỉnh. Cấu trúc này đặt các thao tác theo nhóm công việc của người vận hành, thay vì phân chia theo tên thư viện hoặc giao thức bên dưới.

Màn hình giám sát thích ứng với màn hình máy tính và điện thoại: video, nút điều khiển và thông báo được bố trí lại khi chiều rộng thay đổi. Với firmware legacy\_step, mỗi lần nhấn gửi một bước điều khiển; giao diện tránh tự lặp hoặc tự thử lại lệnh đã hết thời gian chờ để hạn chế chuyển động ngoài ý muốn. Trang phân tích và trang cài đặt hiện yêu cầu chiều rộng từ 1.024 pixel, nên hỗ trợ trên điện thoại chủ yếu dành cho xem video, điều khiển và theo dõi cảnh báo. Phạm vi này cần được phân biệt với khả năng cấu hình đầy đủ trên máy tính.

*\[Vị trí chèn Hình 4.1 tại đây\]*

**Hình 4.1. Bố cục giám sát và điều khiển trên máy tính và điện thoại.**

Nguồn: Ảnh chụp màn hình hệ thống của tác giả. Gợi ý đặt hai ảnh của cùng màn hình giám sát cạnh nhau để thể hiện sự thay đổi bố cục theo kích thước thiết bị.

### **4.4.2. Hiển thị hình ảnh và cập nhật trạng thái** {#4.4.2.-hiển-thị-hình-ảnh-và-cập-nhật-trạng-thái}

Dashboard có thể hiển thị luồng JPEG trực tiếp và vẽ lớp phủ từ dữ liệu khung bao, điểm mốc do backend trả về. Luồng ảnh và dữ liệu nhận diện được cập nhật riêng, giúp video tiếp tục hiển thị khi nhịp suy luận thay đổi. Đổi lại, lớp phủ thể hiện kết quả gần nhất còn đủ mới, chưa bảo đảm khớp tuyệt đối với từng khung đang hiển thị. Giao diện kiểm tra độ mới của kết quả và trạng thái AI để ngừng vẽ dữ liệu cũ; đây là điều kiện cần để tránh hiển thị một khung xương đã lỗi thời như kết quả hiện tại.

Cảnh báo được nhận qua WebSocket, còn dữ liệu radar và các chỉ số video được truy vấn định kỳ. Bản đồ radar cập nhật khoảng mỗi 500 ms, phân biệt mục tiêu đang được quan sát với dữ liệu đã cũ và ẩn điểm không còn đủ mới. Trang nhật ký hỗ trợ tìm kiếm, lọc và đánh dấu đã xem trong phiên trình duyệt. Phần xác nhận này hiện chưa được ghi ngược vào SQLite, nên danh sách trên giao diện chưa cung cấp đầy đủ khả năng truy xuất và quản lý lịch sử bền vững của backend.

### **4.4.3. Cấu hình và kết nối tới máy chủ** {#4.4.3.-cấu-hình-và-kết-nối-tới-máy-chủ}

Trang phân tích cho phép nhập kích thước phòng, vị trí radar và giới hạn vùng. Các trường kích thước trên giao diện sử dụng milimét rồi đổi sang mét trước khi gửi, phù hợp với hệ dữ liệu của backend. Trang cài đặt có API cập nhật nguồn ESP32-CAM, trong khi một số trường khác mới được lưu tại trình duyệt và chưa tác động tới thuật toán. Riêng cấu hình Telegram đang được backend đọc từ biến môi trường. Vì vậy, kết quả lưu biểu mẫu cần được đối chiếu với API và trạng thái xử lý để xác định thay đổi nào đã thực sự được áp dụng.

Frontend mặc định suy ra địa chỉ backend từ hostname đang mở, giúp trình duyệt trên thiết bị khác truy cập đúng máy chủ thay vì dùng localhost của chính thiết bị đó. Trong mạng nội bộ, người dùng mở địa chỉ máy tính chạy dashboard; truy cập từ xa được tổ chức qua mạng riêng Tailscale theo hướng dẫn triển khai của dự án. Ứng dụng hiện chưa có đăng nhập và phân quyền riêng, nên việc cho phép xem video, gửi lệnh vẫn dựa vào chính sách truy cập ở lớp mạng. Quyền truy cập máy chủ vì vậy cần được giới hạn theo nhóm thiết bị và người chăm sóc được phép sử dụng.

## **4.5. Thiết lập kiểm thử bằng dữ liệu mô phỏng** {#4.5.-thiết-lập-kiểm-thử-bằng-dữ-liệu-mô-phỏng}

Mô phỏng trong dự án được thực hiện ở mức dữ liệu và giao tiếp. Công cụ mock\_hardware.py kết nối tới Mosquitto để phát JSON tọa độ radar và gửi trạng thái MOVING, STOPPED. Các chế độ tạo mục tiêu đứng yên, tọa độ biến đổi hoặc một quỹ đạo chữ nhật giúp quan sát cách backend nhận dữ liệu và cập nhật bản đồ. Công cụ này sử dụng broker thật nhưng thay nguồn cảm biến bằng dữ liệu tổng hợp; nó không tái hiện mạch điện, quá trình thu UART, chất lượng ảnh hoặc chuyển động cơ khí của servo.

Tọa độ mô phỏng thuộc hệ radar và phải đi qua phép đổi hệ phòng trước khi xét vùng. Vì vậy, tên một chế độ như “vùng an toàn” hoặc “vùng nguy hiểm” chưa đủ để bảo đảm điểm phát ra nằm trong vùng đã cấu hình. Khi thiết lập thử nghiệm, cần tính vị trí sau phép quay, tịnh tiến và chọn giới hạn SAFE, DANGER tương ứng. Công cụ hiện phát dữ liệu khoảng một lần mỗi giây, nên phù hợp kiểm tra dòng dữ liệu và ngữ cảnh vùng hơn là mô phỏng chính xác tốc độ cập nhật của radar vật lý.

Các kiểm thử tự động bổ sung đầu vào xác định để đánh giá những quy tắc khó quan sát chỉ qua giao diện. test\_fall\_detection.py cấp chuỗi đặc trưng cho máy trạng thái; test\_zone\_config.py dùng cơ sở dữ liệu tạm để kiểm tra cấu hình; test\_servo\_control.py thay broker bằng đối tượng giả để kiểm tra lệnh phát ra. Những bộ kiểm thử này giúp tái lập tình huống và kiểm tra phản hồi mong đợi, nhưng không chạy toàn bộ chuỗi camera–mô hình pose–servo. Phạm vi và kết quả chạy được phân tích riêng ở chương 6\.

*\[Vị trí chèn Hình 4.2 tại đây\]*

**Hình 4.2. Kiểm thử tọa độ radar mô phỏng qua MQTT và bản đồ phòng.**

Nguồn: Tác giả xây dựng và chụp từ quá trình kiểm thử. Gợi ý thể hiện cùng một tọa độ ở bản tin radar, kết quả chuyển sang hệ phòng và vị trí trên bản đồ; ghi rõ đây là dữ liệu mô phỏng.

## **4.6. Thiết kế các kịch bản kiểm thử** {#4.6.-thiết-kế-các-kịch-bản-kiểm-thử}

Nhóm kịch bản nhận diện tập trung vào sự khác nhau giữa tư thế và biến cố: người nằm sẵn, người đứng tương đối ổn định, chuyển từ thẳng sang ngang và gục khi ngồi. Mỗi chuỗi cần có mốc thời gian và trạng thái mong đợi để kiểm tra việc xác lập baseline, tạo ứng viên và xác nhận. Trường hợp mất quan sát, camera quay hoặc nhiều người phải được đánh giá thêm khi tích hợp với backend, vì kiểm thử độc lập của máy trạng thái chưa bao phủ toàn bộ điều kiện xuất hiện trong video thực.

Nhóm kịch bản cấu hình kiểm tra vùng hợp lệ, giới hạn đảo ngược, tọa độ không hữu hạn, vùng vượt biên phòng và điểm nằm đúng ranh giới. Nhóm điều khiển kiểm tra lệnh phù hợp với giao thức, chế độ MANUAL, broker mất kết nối và yêu cầu lặp quá nhanh. Với các nhánh sequenced\_hold có trong backend, kết quả chỉ phản ánh logic hỗ trợ giao thức đó; chúng không được dùng để bổ sung khả năng HOLD, STOP hoặc telemetry cho firmware legacy\_step của nguyên mẫu.

Nhóm kịch bản tích hợp được tổ chức theo điểm gián đoạn của hệ thống: ngắt nguồn video, dừng phát radar, mất broker hoặc mất Internet trong khi mạng nội bộ còn hoạt động. Khi tăng số phiên xem, cần theo dõi riêng tốc độ camera, AI, độ mới kết quả và số khung bị bỏ. Các tình huống này xác định nơi cần đo và điều kiện phục hồi, chưa được xem là thử nghiệm đã hoàn thành chỉ vì chương trình có nhánh xử lý tương ứng. Sau khi phần mềm được kiểm tra theo phạm vi trên, hệ thống chuyển sang lắp ráp và xác nhận hoạt động trên thiết bị thật.

# **Chương 5\. Thiết lập và triển khai phần cứng** {#chương-5.-thiết-lập-và-triển-khai-phần-cứng}

## **5.1. Chuẩn bị thiết bị và môi trường triển khai** {#5.1.-chuẩn-bị-thiết-bị-và-môi-trường-triển-khai}

Nguyên mẫu sử dụng ESP32-CAM, ESP32 DevKit, radar HLK-LD2450, hai servo MG996R, giá Pan-Tilt và khối nguồn gồm adapter cùng XL4015 theo thiết kế ở chương 3\. Camera được gắn lên cơ cấu quay, còn radar giữ vị trí cố định để hệ quy chiếu không đổi khi camera chuyển động. Vị trí lắp phải cho phép nhìn được phần thân và vùng sàn cần giám sát, đồng thời tránh để dây kéo căng hoặc vướng vào hai trục quay. Độ cao camera và hướng radar cần được ghi lại vì chúng ảnh hưởng tới ánh xạ góc và cấu hình bản đồ.

Trước khi ghép tải, cần kiểm tra đầu ra bộ hạ áp theo điện áp sử dụng, sau đó mới nối nguồn cho từng cụm. Nhánh servo cần có dây và đầu nối phù hợp với dòng khi chuyển động, còn GND được nối chung với khối logic. Bước chuẩn bị này nhằm hạn chế sai lệch do cấp nguồn và cơ khí trước khi điều chỉnh thuật toán. Việc servo không chuyển động hoặc ESP32 bị reset phải được phân biệt với lỗi điều khiển phần mềm; chỉ thay tham số khi đường nguồn, chân tín hiệu và giới hạn cơ khí đã được xác nhận.

Máy tính triển khai cần có môi trường backend, frontend, Mosquitto và mô hình pose đã chọn. Hai firmware được nạp đúng bo với cấu hình Wi-Fi và địa chỉ broker phù hợp. Serial Monitor được dùng để kiểm tra phiên bản sketch, cảm biến camera và địa chỉ thiết bị sau khởi động. Ba quan hệ cấu hình phải thống nhất: backend với ESP32 DevKit dùng cùng broker, backend mở đúng stream ESP32-CAM, và giao thức điều khiển phù hợp với firmware. Sai lệch ở một trong ba quan hệ có thể khiến giao diện vẫn mở nhưng một nhánh giám sát không hoạt động.

## **5.2. Lắp ráp và kiểm tra từng phân hệ** {#5.2.-lắp-ráp-và-kiểm-tra-từng-phân-hệ}

### **5.2.1. Nguồn, cơ khí và điều khiển thủ công** {#5.2.1.-nguồn,-cơ-khí-và-điều-khiển-thủ-công}

Quy trình kiểm tra bắt đầu từ từng trục servo trước khi chạy tự động. Trong MANUAL, người vận hành thử các hướng quay và RESET để đối chiếu chiều chuyển động, vị trí tâm và khoảng hành trình thực tế. Quan sát phải xác nhận camera quay theo lệnh, không chạm cữ và không gây kéo dây ở các vị trí sử dụng. Đồng thời, cần đo điện áp tại tải khi cả hai trục hoạt động để đánh giá sụt áp và khả năng duy trì nguồn. Giới hạn phần mềm hỗ trợ bảo vệ hành trình nhưng không thay thế bước kiểm tra cơ cấu sau lắp ráp.

Đường lệnh được đối chiếu từ thao tác trên dashboard, phản hồi API, bản tin MQTT đến log nhận lệnh ở ESP32. Với legacy\_step, thiết bị chưa cung cấp xác nhận góc thực cho từng yêu cầu, nên việc broker nhận lệnh không đủ để kết luận servo đã thực hiện. Phương pháp kiểm tra từng điểm giúp khoanh vùng: nếu lệnh chưa tới firmware thì xem lại giao tiếp; nếu firmware đã nhận mà cơ cấu không đáp ứng thì kiểm tra tín hiệu PWM, nguồn, dây và tải cơ khí.

### **5.2.2. Camera và luồng video** {#5.2.2.-camera-và-luồng-video}

ESP32-CAM được kiểm tra độc lập bằng thông tin cảm biến, PSRAM và việc nhận được stream trong cùng mạng. Khi chuyển sang tích hợp, backend giữ kết nối trực tiếp tới camera để phân phối hình ảnh cho dashboard. Do firmware chỉ phục vụ một stream trực tiếp đồng thời, phiên kiểm tra mở riêng tới ESP32-CAM cần được đóng trước khi backend tiếp nhận. Sau đó, luồng trực tiếp và luồng có kết quả AI được kiểm tra riêng để xác định lỗi nằm ở thu hình hay suy luận.

Trạng thái video được đối chiếu với thời điểm khung gần nhất, RAW FPS, AI FPS và độ mới của lớp phủ. Nếu luồng trực tiếp vẫn chạy nhưng AI ngừng tạo kết quả, việc giảm chất lượng camera chưa chắc giải quyết được nguyên nhân; cần xem worker, mô hình và thời gian xử lý. Ngược lại, nếu khung thô bị gián đoạn, cần kiểm tra Wi-Fi, địa chỉ camera, trạng thái stream và nguồn thiết bị trước khi điều chỉnh ngưỡng phát hiện té ngã. Cách tách hai nhánh này giúp tránh dùng cùng một biện pháp cho các lỗi có bản chất khác nhau.

### **5.2.3. Radar và hệ tọa độ phòng** {#5.2.3.-radar-và-hệ-tọa-độ-phòng}

Radar được kiểm tra từ dữ liệu UART trước khi dùng để dẫn hướng. Các chỉ số chẩn đoán trong firmware cho biết có byte mới, có khung hợp lệ, có mục tiêu phù hợp và có dữ liệu đã được gửi lên MQTT hay không. Nếu không có byte, kiểm tra đường TX–RX, nguồn và baud; nếu có byte nhưng khung không hợp lệ, xem lại định dạng và cấu hình xuất dữ liệu của mô-đun. Phân biệt các trạng thái này giúp xác định lỗi thu nhận thay vì coi mọi trường hợp không có chấm trên bản đồ là radar không phát hiện người.

Sau khi nhận tọa độ, người thử di chuyển sang trái, phải, gần và xa để xác nhận dấu trục. Vị trí và góc radar được nhập theo mặt bằng thực, rồi đối chiếu điểm đứng với chấm sau chuyển đổi tọa độ. Vùng SAFE chỉ bao phủ nơi nghỉ có chủ đích, còn DANGER được đặt ở khu vực cần cảnh báo. Bước hiệu chuẩn phải được hoàn tất trước khi dùng ngữ cảnh vùng để đánh giá té ngã, vì một cấu hình SAFE quá rộng có thể làm hệ thống bỏ qua sự cố trên sàn hoặc lối đi.

*\[Vị trí chèn Hình 5.1 tại đây\]*

**Hình 5.1. Các vị trí đối chiếu tọa độ radar và hướng camera trong phòng thử nghiệm.**

Nguồn: Tác giả xây dựng từ mặt bằng và ảnh nguyên mẫu. Gợi ý đánh dấu vị trí radar, camera, điểm đứng kiểm tra và vùng nghỉ; ghi các kích thước đã đo thực tế khi bổ sung hình.

## **5.3. Tích hợp và xử lý các tình huống vận hành** {#5.3.-tích-hợp-và-xử-lý-các-tình-huống-vận-hành}

### **5.3.1. Khởi chạy dịch vụ và xác nhận luồng hoạt động** {#5.3.1.-khởi-chạy-dịch-vụ-và-xác-nhận-luồng-hoạt-động}

Trình tự tích hợp bắt đầu từ nguồn và hai nút ESP32, sau đó khởi chạy Mosquitto, backend và frontend. Backend cần hoàn tất khởi tạo mô hình, worker và kết nối camera trước khi đánh giá khả năng nhận diện. MANUAL được kiểm tra trước AUTO để xác nhận đường điều khiển và chiều quay. Khi chuyển sang AUTO, đối tượng được thử ở nhiều vị trí trong vùng phòng đã hiệu chuẩn để quan sát camera hướng theo radar, kết quả pose còn đủ rõ và trạng thái chuyển động được chuyển tới backend.

Việc xác nhận một sự kiện phải đi xuyên các khối: máy trạng thái tạo quyết định, backend lưu ảnh và metadata, dashboard nhận thông báo, còn Telegram được kiểm tra riêng nếu đã cấu hình. Thời điểm gửi hoặc tiếp nhận ở mỗi kênh cần được phân biệt để xác định nơi phát sinh chậm trễ. Một sự kiện đã lưu nhưng chưa có tin nhắn không nhất thiết là lỗi nhận diện; nguyên nhân có thể nằm ở thời gian giãn cách gửi, kết nối Internet hoặc cấu hình Telegram. Các tình huống dưới đây được dùng để định hướng chẩn đoán, không mặc nhiên được coi là những lỗi đã xảy ra và đã được xử lý thành công trong mọi lần chạy.

### **5.3.2. Sai địa chỉ mạng hoặc giao thức điều khiển** {#5.3.2.-sai-địa-chỉ-mạng-hoặc-giao-thức-điều-khiển}

Địa chỉ máy chạy broker thay đổi sẽ ảnh hưởng cả backend và ESP32 DevKit, vì địa chỉ MQTT trong firmware được biên dịch vào sketch. Cần cập nhật đồng thời hai phía và nạp lại DevKit khi thông tin broker thay đổi. Đối với ESP32-CAM sử dụng địa chỉ động, backend có thể cập nhật IP camera qua giao diện mà không cần nạp lại firmware nếu Wi-Fi không đổi. Khi dashboard được mở từ máy khác, địa chỉ backend phải trỏ tới máy chủ thực, không phải localhost của thiết bị đang xem.

Sai giao thức servo tạo ra một dạng lỗi khác: backend có thể gửi được bản tin nhưng payload không nằm trong tập lệnh firmware nhận. Vì vậy, legacy\_step phải được chọn cho sketch hiện hành, đồng thời kiểm tra chế độ MANUAL trước khi thử lệnh bước. Khi dịch vụ không khởi động được, cần xác nhận không có một broker hoặc backend khác đang giữ cùng cổng. Cách kiểm tra này bám vào các quan hệ kết nối thực tế của dự án, thay vì quy mọi lỗi vận hành về một mã HTTP chung.

### **5.3.3. Nguồn không ổn định, mất dữ liệu và cảnh báo ngoài dự kiến** {#5.3.3.-nguồn-không-ổn-định,-mất-dữ-liệu-và-cảnh-báo-ngoài-dự-kiến}

Servo rung, chuyển động ngắt quãng hoặc ESP32 reset có thể liên quan đến nguồn, GND, tải cơ khí hoặc chân tín hiệu chưa khớp với firmware. Các yếu tố này cần được kiểm tra trước khi thay hệ số làm mượt. Với radar, dữ liệu có thể đã tới broker nhưng không hiện trên bản đồ nếu backend không còn nhận điểm mới hoặc cấu hình hệ tọa độ không phù hợp. Với camera, việc liên tục thử mở stream từ nhiều nơi có thể gây tranh chấp kết nối trực tiếp. Mỗi tình huống cần được đối chiếu bằng chỉ số và log của đúng phân hệ, tránh suy luận nguyên nhân chỉ từ biểu hiện trên giao diện.

Khi không có cảnh báo té ngã, trước hết cần đọc trạng thái phân tích. OBSERVED\_HORIZONTAL cho biết thiếu lịch sử tư thế ban đầu; SAFE ZONE là nhánh dùng ngữ cảnh nghỉ; MUTED thể hiện điều kiện nhiều người; còn dữ liệu pose cũ hoặc camera đang quay có thể làm chậm việc hình thành ứng viên. Đây là các điều kiện của phương pháp, không phải lúc nào cũng là lỗi phần mềm. Ngược lại, cảnh báo ngoài dự kiến cần được xem lại chuỗi ảnh và vị trí vùng để xác định nguyên nhân từ đặc trưng tư thế, theo dõi ID hay cấu hình không gian. Việc thử nghiệm phải ghi nhận cả trường hợp báo nhầm và trường hợp bị bỏ qua để đánh giá đúng mức đáp ứng của nguyên mẫu.

# **Chương 6\. Kết quả kiểm thử và đánh giá nguyên mẫu** {#chương-6.-kết-quả-kiểm-thử-và-đánh-giá-nguyên-mẫu}

## **6.1. Phạm vi và căn cứ đánh giá** {#6.1.-phạm-vi-và-căn-cứ-đánh-giá}

Kết quả được xem xét ở hai cấp: kiểm thử các quy tắc phần mềm với đầu vào xác định và quan sát vận hành nguyên mẫu. Cấp thứ nhất cho phép kiểm tra quyết định của máy trạng thái, tính hợp lệ của cấu hình và cách phát lệnh mà không phụ thuộc thiết bị. Cấp thứ hai phản ánh tốc độ luồng camera, tốc độ xử lý AI và biểu hiện khi hệ thống hoạt động với hình ảnh thực. Hai cấp bổ sung cho nhau nhưng đo các thuộc tính khác nhau; kiểm thử logic đạt không tự chứng minh chất lượng điểm mốc hoặc khả năng bám của servo trong phòng.

Trong đợt kiểm tra ngày 11/10/2026, 25 ca kiểm thử hiện có đã được chạy trên bản sao cách ly của các mô-đun, giữ nguyên nội dung mã nguồn \[17\]. Số liệu vận hành được người thực hiện cung cấp gồm RAW FPS có thể đạt khoảng 30 FPS và AI FPS thường khoảng 15–20 FPS, có dao động tùy điều kiện \[18\]. Các ghi nhận tốc độ chưa đi kèm thời lượng đo, cấu hình máy tính, thống kê theo phiên hoặc tập video gán nhãn đầy đủ. Vì vậy, chương này sử dụng chúng để phân tích khả năng vận hành và các giới hạn quan sát được, chưa tính độ chính xác nhận diện hoặc khẳng định độ trễ toàn hệ thống.

## **6.2. Kết quả kiểm thử phần mềm** {#6.2.-kết-quả-kiểm-thử-phần-mềm}

### **6.2.1. Máy trạng thái phát hiện té ngã** {#6.2.1.-máy-trạng-thái-phát-hiện-té-ngã}

Năm ca trong test\_fall\_detection.py đều đạt. Các chuỗi nằm sẵn và dịch chuyển rất chậm không tạo sự kiện mới được xác nhận; chuỗi chuyển từ tư thế thẳng sang ngang và chuỗi gục khi ngồi có thể được xác nhận theo điều kiện thuật toán. Ca có hai ID kiểm tra việc giữ trạng thái của hai chuỗi trong tình huống đã xây dựng, không ghi nhận cảnh báo sai ở các assertion của ca đó. Các kết quả cho thấy máy trạng thái phản hồi đúng với những đặc trưng tổng hợp và trình tự thời gian mà bộ kiểm thử cung cấp.

Đầu vào của bộ này là FallObservation, nên không kiểm tra chất lượng phát hiện người, độ tin cậy điểm mốc hoặc thay đổi Track ID do YOLO và BoT-SORT tạo ra. Những tình huống như camera quay, SAFE, MUTED, mất dấu và chuỗi cảnh báo toàn tuyến cũng chưa được bao phủ đầy đủ bởi năm ca hiện có. Do đó, kết quả 5/5 được hiểu là các điều kiện kiểm thử đã đạt, không phải tỷ lệ nhận diện đúng trên năm người hoặc năm video thực. Đây là cơ sở kiểm tra logic trước khi mở rộng đánh giá bằng dữ liệu hình ảnh.

### **6.2.2. Cấu hình vùng và tính nhất quán dữ liệu** {#6.2.2.-cấu-hình-vùng-và-tính-nhất-quán-dữ-liệu}

Năm ca trong test\_zone\_config.py đều đạt trên SQLite tạm. Danh sách vùng hợp lệ được thay thế và chuẩn hóa; vùng có giới hạn đảo ngược, tọa độ NaN hoặc vượt biên phòng bị từ chối. Khi cập nhật không hợp lệ, cấu hình trước đó được giữ lại. Phép kiểm tra điểm thuộc vùng xử lý đúng các điểm ở biên trong các trường hợp được thử. Những kết quả này xác nhận một số ràng buộc quan trọng của dữ liệu cấu hình, hạn chế việc một thao tác nhập sai làm thay đổi không gian giám sát ngoài dự kiến.

Bộ kiểm thử chưa đánh giá sai số của radar, phép hiệu chuẩn vị trí lắp hoặc tác động của SAFE tới quyết định té ngã khi chạy cùng ảnh thực. Một vùng hợp lệ về số học vẫn có thể sai về vị trí ứng dụng, chẳng hạn bao phủ cả lối đi thay vì chỉ mặt giường. Vì vậy, kiểm tra cơ sở dữ liệu và đối chiếu mặt bằng thực là hai bước cần thực hiện cùng nhau. Độ nhất quán khi lưu cấu hình không đồng nghĩa với tính đúng đắn của cách phân vùng phòng.

### **6.2.3. Đường điều khiển servo** {#6.2.3.-đường-điều-khiển-servo}

Mười lăm ca trong test\_servo\_control.py đều đạt, gồm bảy ca ở nhóm legacy\_step và tám ca ở nhóm sequenced\_hold. Nhóm legacy\_step kiểm tra lệnh bước, giới hạn yêu cầu lặp, điều kiện broker và chế độ, từ chối khả năng không hỗ trợ, phân biệt xác nhận broker với xác nhận thiết bị và quy đổi tọa độ bám về VGA. Nhóm sequenced\_hold kiểm tra các quy tắc của nhánh giao thức nâng cao, trong đó có thứ tự lệnh, lệnh dừng và cách xử lý thông tin chẩn đoán. Việc hai nhóm cùng có trong backend giúp kiểm tra sự phân biệt giữa các profile, nhưng nguyên mẫu hiện sử dụng firmware legacy\_step.

Các ca gọi trực tiếp hàm backend và dùng Broker giả ghi lại bản tin phát ra; không khởi chạy broker thật, REST qua mạng hoặc servo. Kết quả vì vậy chứng minh các assertion về logic điều khiển hiện có đã đạt, chưa đo thời gian truyền lệnh hay góc quay thực. Tổng cộng 25/25 ca đạt trên ba bộ kiểm thử. Hai lượt chạy sử dụng Python 3.12.14 cho bộ té ngã, vùng và Python 3.14.5 trong môi trường dự án cho bộ servo; thông tin này được lưu trong biên bản để tái lập, không được dùng làm cấu hình của phép đo FPS vận hành.

## **6.3. Tốc độ hình ảnh và khả năng đáp ứng** {#6.3.-tốc-độ-hình-ảnh-và-khả-năng-đáp-ứng}

### **6.3.1. Ghi nhận RAW FPS và AI FPS** {#6.3.1.-ghi-nhận-raw-fps-và-ai-fps}

RAW FPS của backend là số khung JPEG được tiếp nhận trong một giây, còn AI FPS là số khung hoàn thành nhánh xử lý AI, bao gồm các công việc đi kèm suy luận. Theo quan sát của người thực hiện, RAW FPS có thể đạt khoảng 30 FPS ở điều kiện phù hợp. AI FPS thường ở khoảng 15–20 FPS khi khung hình trống và có thể cao hơn; khi có người cùng lớp phủ nhận diện, nhịp xử lý cũng thường ở khoảng 15–20 FPS nhưng có lúc thấp hơn, với mức biến động khoảng vài FPS, có thể xấp xỉ 5 FPS quanh mức đang quan sát \[18\]. Những giá trị này mô tả khoảng vận hành đã ghi nhận, không phải tốc độ cố định, FPS của trình duyệt hay tốc độ riêng phép suy luận mô hình.

Kiến trúc tách nhánh xem trực tiếp khỏi AI cho phép luồng ảnh được cập nhật ở nhịp khác với kết quả nhận diện. Khi RAW FPS cao hơn AI FPS, backend chỉ chọn một phần khung để phân tích và bỏ các khung chờ đã cũ. Điều này phù hợp với quan sát video vẫn có thể liên tục trong khi lớp phủ thay đổi chậm hơn. Tuy nhiên, phần hình ảnh giữa hai lần suy luận không được máy trạng thái phân tích đầy đủ; một chuyển tiếp ngắn có thể chỉ tạo ra ít quan sát, nên việc tăng độ mượt khi xem chưa chắc làm tăng khả năng phát hiện sự cố.

Trần AI\_FPS\_LIMIT mặc định là 15 FPS, có thể thay đổi qua cấu hình; nhịp cấp ảnh còn được điều chỉnh theo thời gian xử lý. Các phiên quan sát chưa ghi lại giá trị giới hạn thực tế, nên khoảng 15–20 FPS chưa được đối chiếu trực tiếp với cấu hình mặc định. Phép đo lặp lại cần ghi tham số này cùng mô hình, runtime, độ phân giải và phần cứng. Sự có mặt của người làm phát sinh thêm công việc theo dõi, tính đặc trưng và vẽ lớp phủ, trong khi Wi-Fi và lượng dữ liệu JPEG ảnh hưởng tới nhánh thu hình. Nguồn điện không ổn định cũng có thể gây gián đoạn thiết bị. Mức ảnh hưởng riêng của các yếu tố cần được xác định bằng log và phép đo thay vì suy ra chỉ từ khoảng FPS.

*\[Vị trí chèn Hình 6.1 tại đây\]*

**Hình 6.1. Chỉ số RAW FPS và AI FPS trong một phiên vận hành nguyên mẫu.**

Nguồn: Ảnh chụp màn hình hệ thống của tác giả. Gợi ý dùng ảnh có đồng thời hai chỉ số, thời điểm chụp và cấu hình mô hình; số tại một thời điểm chỉ minh họa trạng thái của phiên, không thay thế thống kê theo thời gian.

### **6.3.2. Độ trễ hiển thị và cảnh báo** {#6.3.2.-độ-trễ-hiển-thị-và-cảnh-báo}

FPS biểu diễn số khung hoàn thành trong một đơn vị thời gian, còn độ trễ biểu diễn thời gian từ một tình huống đến kết quả người dùng nhận được. Backend có các chỉ số giải mã, suy luận, mã hóa và pipeline để hỗ trợ xác định khâu xử lý chậm. Chỉ số pipeline được tính trong luồng xử lý của backend, không bao gồm đầy đủ mọi thành phần từ cảm biến đến màn hình người chăm sóc. Một luồng có FPS cao vẫn có thể trễ nếu dữ liệu đã tồn đọng trước khi được tiếp nhận hoặc nếu trình duyệt cập nhật chậm.

Với té ngã, thời gian phản hồi còn gồm giai đoạn xác lập tư thế, hình thành ứng viên và chờ điều kiện xác nhận. Việc camera quay, mất dấu hoặc thay đổi ID có thể kéo dài quá trình này. Sau xác nhận, thông báo dashboard và Telegram đi theo hai kênh có đặc điểm khác nhau; Telegram còn chịu điều kiện kết nối ngoài và thời gian giãn cách gửi. Hiện chưa có phép đo đồng bộ từ mốc bắt đầu tình huống tới thời điểm nhận cảnh báo, nên không chuyển khoảng 15–20 AI FPS thành một con số độ trễ phát hiện. Phép đo sau này cần ghi riêng thời điểm xác nhận tại backend và thời điểm thông báo xuất hiện ở từng kênh.

## **6.4. Mức bao phủ chức năng và các điều kiện gián đoạn** {#6.4.-mức-bao-phủ-chức-năng-và-các-điều-kiện-gián-đoạn}

### **6.4.1. Nhận diện tư thế và điều hướng** {#6.4.1.-nhận-diện-tư-thế-và-điều-hướng}

Mã nguồn đã hiện thực chuỗi thu ảnh, ước lượng pose, theo dõi và đánh giá té ngã, đồng thời hỗ trợ dẫn hướng ưu tiên radar trong AUTO. Các kiểm thử tổng hợp xác nhận một số quy tắc phát hiện, còn quan sát FPS cho thấy hệ thống có thể duy trì nhịp xử lý liên tục trong các điều kiện đã chạy thử. Tuy nhiên, tỷ lệ phát hiện, báo nhầm và sai số bám chưa được xác lập do chưa có tập tình huống thực được gán nhãn và thống kê đủ số lần thử.

Đánh giá nhận diện cần tính theo sự kiện thay vì chỉ đếm các khung có nhãn ngã. Một lần ngã kéo dài trên nhiều khung vẫn là một sự kiện; hoạt động sinh hoạt bị cảnh báo được ghi là báo nhầm, còn sự cố không tạo cảnh báo trong khoảng đánh giá được ghi là bỏ sót. Kết quả cần tách theo các điều kiện có ảnh hưởng như nằm nghỉ, ngồi xuống, cúi người, gục khi ngồi, che khuất và camera đang quay. Với điều hướng, cần đối chiếu vị trí người trong khung, thời gian đưa vào vùng quan sát và các điểm camera không bám được, vì radar có tọa độ không đồng nghĩa camera đã thu được pose đủ rõ.

### **6.4.2. Tải xử lý và phục hồi** {#6.4.2.-tải-xử-lý-và-phục-hồi}

Hàng đợi ảnh hữu hạn và cơ chế ưu tiên khung mới giúp hạn chế phần tồn đọng trong backend. Luồng xem trực tiếp cũng giảm phụ thuộc vào thời gian suy luận, còn watchdog khởi động lại worker đã dừng. Đây là các biện pháp hỗ trợ vận hành, nhưng chưa có kết quả thử tải theo số phiên xem, mức CPU, bộ nhớ hoặc thời gian chạy dài. Không thể suy từ dung lượng hàng đợi một phần tử rằng toàn hệ thống không tăng bộ nhớ, vì snapshot, nhật ký và dữ liệu lưu trữ còn phát sinh theo thời gian.

Số khung bị bỏ cần được đọc cùng FPS và tuổi dữ liệu, vì việc loại khung cũ là một phần của thiết kế chứ không tự biểu thị lỗi. Một nhịp xử lý thấp nhưng luôn dùng ảnh mới khác với một nhịp xử lý tương tự trên ảnh đã tồn đọng lâu. Khi worker còn sống nhưng không tạo kết quả, trạng thái tiến trình cũng chưa phản ánh đầy đủ khả năng giám sát. Trong phạm vi đã kiểm chứng, bộ test điều khiển xác nhận cách xử lý một số yêu cầu dồn và trùng, chưa xác nhận năng lực chịu tải của dịch vụ web hoặc khả năng phục hồi sau mọi kiểu lỗi.

### **6.4.3. Hoạt động khi mất kết nối** {#6.4.3.-hoạt-động-khi-mất-kết-nối}

Cần phân biệt mất Internet với mất mạng nội bộ hoặc dừng máy chủ. Nếu Internet bị gián đoạn nhưng Wi-Fi LAN, broker và máy tính vẫn hoạt động, các thành phần thu hình, AI và dashboard nội bộ không nhất thiết bị dừng. Kênh Telegram và việc truy cập từ bên ngoài có thể bị ảnh hưởng. Đây là khả năng suy ra từ cách bố trí xử lý cục bộ, chưa phải kết quả đo thời gian hoạt động ngoại tuyến hoặc bảo đảm tự gửi lại toàn bộ thông báo khi mạng trở lại.

Khi DevKit mất Wi-Fi hoặc MQTT, vòng đọc radar và cập nhật góc trong AUTO đã thiết lập có thể tiếp tục cục bộ, nhưng tọa độ không còn được gửi đều tới backend. Firmware bỏ các lần publish không thực hiện được, chưa lưu dữ liệu để phát bù. Nếu camera mất kết nối, backend không có khung mới để đánh giá té ngã; nếu máy chủ dừng, nhánh AI và cảnh báo cũng dừng theo. Các cơ chế thử kết nối lại hỗ trợ phục hồi đường truyền, nhưng thời gian phục hồi và mức mất dữ liệu cần được ghi bằng thử nghiệm riêng. Khả năng bám cục bộ của servo không được xem là khả năng duy trì đầy đủ chức năng giám sát khi toàn hệ thống mất mạng.

Những kết quả hiện có xác nhận một phần logic và nhịp vận hành của nguyên mẫu, đồng thời xác định các phép đo còn thiếu để đánh giá toàn tuyến. Đây là cơ sở cho kết luận ở chương 7: mức đạt được cần gắn với bằng chứng kiểm thử và quan sát, còn hướng phát triển phải tập trung vào các giới hạn ảnh hưởng trực tiếp đến độ tin cậy giám sát.

# **Chương 7\. Kết luận và hướng phát triển** {#chương-7.-kết-luận-và-hướng-phát-triển}

## **7.1. Kết quả đạt được** {#7.1.-kết-quả-đạt-được}

Đề tài đã xây dựng nguyên mẫu kết hợp hai nút ESP32, radar 24 GHz, cơ cấu Pan-Tilt và khối xử lý trên máy tính. ESP32-CAM đảm nhận thu, truyền hình ảnh; ESP32 DevKit khai thác tọa độ radar và phát góc lệnh cho servo; backend phân tích pose, tổ chức quyết định theo thời gian và cung cấp dữ liệu cho dashboard. Cách phân vai này thể hiện việc phối hợp cảm biến, truyền thông và chấp hành trong một hệ thống nhúng có xử lý hình ảnh ở máy tính cục bộ, thay vì đặt toàn bộ yêu cầu tính toán lên vi điều khiển.

Ở phần nhận diện, YOLO Pose cung cấp điểm mốc, còn máy trạng thái đánh giá diễn biến trước khi xác nhận sự cố. Radar hỗ trợ hướng nhìn và ngữ cảnh vùng phòng, không trực tiếp phân loại té ngã. Ở phần vận hành, hệ thống có luồng xem trực tiếp, dữ liệu nhận diện, điều khiển MANUAL, AUTO, bản đồ phòng, lưu sự kiện và thông báo qua dashboard, Telegram theo cấu hình. Các cơ chế hàng đợi ảnh hữu hạn, quản lý phiên nguồn video và khởi động lại worker hỗ trợ hạn chế dữ liệu cũ và phục hồi một số tình huống gián đoạn.

Kết quả chạy 25 ca kiểm thử đã xác nhận các quy tắc phần mềm được thử trên đầu vào hiện có. Quan sát vận hành ghi nhận RAW FPS có thể đạt khoảng 30 FPS và AI FPS thường khoảng 15–20 FPS, có biến động theo điều kiện sử dụng. Những kết quả này cho thấy tính khả thi của kiến trúc và việc triển khai các chức năng chính trong phạm vi nguyên mẫu. Đóng góp của đề tài nằm ở tích hợp và kiểm tra hệ thống, chưa phải một thuật toán học sâu mới hoặc một kết quả xác nhận độ tin cậy đầy đủ cho mọi tình huống giám sát.

## **7.2. Giới hạn của hệ thống** {#7.2.-giới-hạn-của-hệ-thống}

Độ tin cậy nhận diện còn phụ thuộc chất lượng ảnh, khả năng thấy các điểm thân, tính liên tục của Track ID và trạng thái chuyển động camera. Phương pháp cần có quan sát trước sự cố, nên có thể bỏ qua người đã nằm từ trước hoặc pha ngã xảy ra trong lúc bị che khuất. Vùng SAFE giảm báo nhầm khi nghỉ nhưng cũng làm việc đánh giá bị ngừng tại khu vực đó. Hệ thống chưa ghép định danh mục tiêu radar với người trong ảnh và tạm ngừng nhận diện té ngã khi có nhiều người đủ pose, nên phạm vi phù hợp hiện tại vẫn là kịch bản một người trong phòng.

Ở mức vận hành, tín hiệu servo chỉ phản ánh góc lệnh và chưa đo góc cơ khí thực; watchdog chưa xử lý mọi trường hợp worker còn sống nhưng không tạo kết quả. Nhật ký giao diện chưa hoàn tất luồng truy xuất và xác nhận lịch sử SQLite, còn quyền truy cập phụ thuộc lớp mạng. Các kết quả định lượng về độ trễ toàn tuyến, báo nhầm, bỏ sót, sai số dẫn hướng và vận hành dài hạn chưa được xác lập bằng một bộ thử nghiệm đầy đủ. Vì vậy, nguyên mẫu cần tiếp tục được đánh giá có kiểm soát trước khi mở rộng phạm vi sử dụng.

## **7.3. Hướng phát triển** {#7.3.-hướng-phát-triển}

Ưu tiên trước hết là xây dựng quy trình đánh giá có thể tái lập với video và tình huống đa dạng. Dữ liệu cần bao gồm hoạt động sinh hoạt có hình dạng gần với ngã, các mức che khuất, khoảng cách, ánh sáng và chuyển động camera, kèm nhãn sự kiện và mốc thời gian. Trên cơ sở đó, có thể điều chỉnh ngưỡng hoặc lựa chọn phương pháp phân loại chuỗi phù hợp, đồng thời đo riêng chất lượng pose và chất lượng quyết định. Việc mở rộng kiểm thử tự động nên tập trung vào mất dấu, đổi ID, camera quay, ngữ cảnh SAFE và xử lý sự kiện toàn tuyến.

Về dẫn hướng, cần hiệu chuẩn quan hệ vị trí radar–camera, góc trung tâm và điểm ngắm theo cách lắp thực tế; bổ sung phản hồi thị giác hoặc cảm biến góc khi cần đo sai lệch cơ khí. Ghép mục tiêu giữa radar và ảnh là bước quan trọng nếu mở rộng sang nhiều người, vì lựa chọn một tọa độ radar và một Track ID độc lập chưa đủ để bảo đảm cùng đối tượng. Khả năng phát hiện sự cố trong lúc camera quay cũng cần được cải thiện bằng cách ước lượng hoặc bù chuyển động ảnh, giảm đánh đổi giữa theo dõi mục tiêu và duy trì quan sát hành vi.

Ở phần mềm vận hành, có thể hoàn thiện API tải lịch sử và lưu trạng thái xác nhận, quản lý thời gian giữ snapshot, giám sát worker theo độ mới kết quả và xây dựng cơ chế phục hồi sự kiện rõ ràng. Đăng nhập, phân quyền và khả năng cấu hình trên thiết bị di động cần được phát triển theo nhu cầu người chăm sóc. Mỗi hướng bổ sung phải đi kèm kiểm thử và chỉ số đánh giá tương ứng để chứng minh lợi ích đối với giám sát, thay vì chỉ làm tăng số tính năng trên giao diện.

# **Tài liệu tham khảo** {#tài-liệu-tham-khảo}

\[1\] World Health Organization. “Falls”. 26/04/2021. [https\://www\.who.int/news-room/fact-sheets/detail/falls](https://www.who.int/news-room/fact-sheets/detail/falls)

\[2\] Tổng cục Thống kê và Quỹ Dân số Liên Hợp Quốc. Già hóa dân số và người cao tuổi ở Việt Nam. 2021\. [https\://www\.nso.gov.vn/wp-content/uploads/2021/08/Dan-so-gia-hoaVI.pdf](https://www.nso.gov.vn/wp-content/uploads/2021/08/Dan-so-gia-hoaVI.pdf)

\[3\] Vu Quang Tuyen, Bui Ngoc Dung, Nguyen Huu Nghia, Chu Tran Dai và Viet Dung Nguyen. “Vision Based Fall Detection for the Elderly People”. Kỷ yếu AITC 2020, tr. 79–85. [https\://dost.hochiminhcity.gov.vn/documents/1217/AITC2020\_Proceedings.pdf](https://dost.hochiminhcity.gov.vn/documents/1217/AITC2020_Proceedings.pdf)

\[4\] Ng, P. H., Mai, A. và Nguyen, H. “Building an AI-Powered IoT App for Fall Detection Using Yolov8 Approach”. Intelligence of Things: Technologies and Applications, 2023, tr. 65–74. DOI: 10.1007/978-3-031-46749-3\_7. [https\://link.springer.com/chapter/10.1007/978-3-031-46749-3\_7](https://link.springer.com/chapter/10.1007/978-3-031-46749-3_7)

\[5\] Do, T. N. và Le, T. T. “A new design of a fall detection system integrating landmark identification and deep learning techniques”. Vietnam Journal of Science, Technology and Engineering, 68(1), 2026\. DOI: 10.31276/VJSTE.2024.0138. [https\://vietnamscience.vjst.vn/index.php/vjste/article/view/1333](https://vietnamscience.vjst.vn/index.php/vjste/article/view/1333)

\[6\] Lu, N., Wu, Y., Feng, L. và Song, J. “Deep Learning for Fall Detection: Three-Dimensional CNN Combined With LSTM on Video Kinematic Data”. IEEE Journal of Biomedical and Health Informatics, 23(1), 2019, tr. 314–323. DOI: 10.1109/JBHI.2018.2808281. [https\://pubmed.ncbi.nlm.nih.gov/29994460/](https://pubmed.ncbi.nlm.nih.gov/29994460/)

\[7\] Jin, F., Sengupta, A. và Cao, S. “mmFall: Fall Detection Using 4-D mmWave Radar and a Hybrid Variational RNN AutoEncoder”. IEEE Transactions on Automation Science and Engineering, 19(2), 2022, tr. 1245–1257. DOI: 10.1109/TASE.2020.3042158. [https\://arxiv.org/abs/2003.02386](https://arxiv.org/abs/2003.02386)

\[8\] Hi-Link. “HLK-LD2450”. Trang sản phẩm và tài liệu mô-đun. [https\://www\.hlktech.net/index.php?id=1182](https://www.hlktech.net/index.php?id=1182)

\[9\] Espressif Systems. ESP32 Series Datasheet. [https\://documentation.espressif.com/esp32\_datasheet\_en.pdf](https://documentation.espressif.com/esp32_datasheet_en.pdf)

\[10\] Espressif Systems. “ESP32 Camera Driver”. [https\://github.com/espressif/esp32-camera](https://github.com/espressif/esp32-camera)

\[11\] Texas Instruments. The fundamentals of millimeter wave radar sensors. [https\://www\.ti.com/lit/wp/spyy005a/spyy005a.pdf](https://www.ti.com/lit/wp/spyy005a/spyy005a.pdf)

\[12\] Ultralytics. “Pose Estimation”. [https\://docs.ultralytics.com/tasks/pose/](https://docs.ultralytics.com/tasks/pose/)

\[13\] Ultralytics. “Multi-Object Tracking”. [https\://docs.ultralytics.com/modes/track/](https://docs.ultralytics.com/modes/track/)

\[14\] OASIS. MQTT Version 3.1.1. 2014\. [https\://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html](https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html)

\[15\] Python Software Foundation. “multiprocessing — Process-based parallelism”. [https\://docs.python.org/3/library/multiprocessing.html](https://docs.python.org/3/library/multiprocessing.html)

\[16\] Nhóm thực hiện. FallGuard: README và mã nguồn các thư mục hardware, backend, frontend. Phiên bản đối chiếu ngày 11/10/2026.

\[17\] Biên bản kiểm thử phần mềm dự án FallGuard ngày 11/10/2026. Các bộ test\_fall\_detection, test\_zone\_config và test\_servo\_control; tổng cộng 25 ca đạt. Tệp kèm báo cáo: bien\_ban\_kiem\_thu\_2026-10-11.txt.

\[18\] Ghi nhận vận hành nguyên mẫu do người thực hiện cung cấp ngày 11/10/2026. RAW FPS có thể đạt khoảng 30 FPS; AI FPS thường khoảng 15–20 FPS và dao động theo điều kiện kết nối, nguồn, phần cứng. Số liệu quan sát, chưa phải thống kê benchmark theo thời lượng cố định.

# **Phụ lục** {#phụ-lục}

## **Phụ lục A. Mã nguồn và cấu hình tái lập** {#phụ-lục-a.-mã-nguồn-và-cấu-hình-tái-lập}

Hai firmware tương ứng với hai bo là hardware/esp32\_cam\_stream.ino và hardware/esp32\_cam\_radar.ino. Backend sử dụng main.py để điều phối, fall\_detection.py cho máy trạng thái, database.py cho SQLite và servo\_protocol.py cho giao thức servo. Frontend gồm các trang giám sát, phân tích, nhật ký và cài đặt, cùng thành phần bản đồ radar và các React Context. Khi lưu phiên bản phục vụ báo cáo, cần giữ đồng thời firmware, backend, frontend và các tệp phụ thuộc để việc đối chiếu không dựa vào những bản sketch hoặc mã giao diện khác nhau.

Cấu hình tái lập cần ghi tên mô hình pose, runtime, giới hạn AI FPS, độ phân giải camera, vị trí lắp, hệ tọa độ phòng và profile legacy\_step của firmware hiện hành. requirements.txt và package-lock.json giúp xác định các phụ thuộc phần mềm; thông tin CPU, GPU, RAM và phiên bản Python cần được ghi từ máy chạy phép đo thực tế. Các tham số này là điều kiện của kết quả, không thể suy ra đầy đủ chỉ từ tên bo ESP32 hoặc mô hình YOLO đang sử dụng.

## **Phụ lục B. Kênh giao tiếp và chỉ số chẩn đoán** {#phụ-lục-b.-kênh-giao-tiếp-và-chỉ-số-chẩn-đoán}

Camera cung cấp stream ở cổng 81 và trạng thái, cấu hình ảnh ở cổng 82; broker MQTT dùng cổng 1883; backend và dashboard lần lượt dùng cổng 8000, 3000 trong cấu hình triển khai. Các topic chính gồm embedded/radar/data, embedded/servo/mode, embedded/servo/manual, embedded/servo/tracking và embedded/servo/status. Nhóm giao tiếp HTTP cung cấp video, kết quả phát hiện, chẩn đoán, điều khiển và cấu hình phòng; WebSocket tại /api/v1/ws/alerts chuyển sự kiện tới trình duyệt.

Các chỉ số phục vụ đánh giá gồm RAW FPS, AI FPS, thời gian giải mã, suy luận, mã hóa, pipeline, tuổi dữ liệu, số khung bị bỏ và số lần kết nối lại. Khi chụp minh chứng, cần giữ tên chỉ số và thời điểm để phân biệt dữ liệu nguồn với dữ liệu xử lý. Log radar phân biệt có byte, có khung, có mục tiêu và có publish; log video phân biệt thu hình với AI. Chỉ số của từng khối được dùng để khoanh vùng vấn đề, còn kết luận toàn tuyến phải dựa trên phép đo nối các mốc của cùng một tình huống.

## **Phụ lục C. Bằng chứng kiểm thử và ghi nhận thực nghiệm** {#phụ-lục-c.-bằng-chứng-kiểm-thử-và-ghi-nhận-thực-nghiệm}

Biên bản ngày 11/10/2026 lưu lệnh chạy, tên từng ca, kết quả và môi trường của hai lượt kiểm thử. Các mô-đun được sao chép nguyên trạng vào thư mục cách ly và đối chiếu mã băm với nguồn; kiểm thử cấu hình dùng SQLite tạm, kiểm thử điều khiển dùng Broker giả. Việc nạp cấu hình dotenv được vô hiệu trong lượt thử servo để không sử dụng thông tin vận hành riêng. Không khởi chạy camera, worker AI hoặc phần cứng trong các phép kiểm thử này. Các thời gian do unittest in ra chỉ là thời gian chạy kiểm thử và không được đưa vào cột độ trễ vận hành.

Đối với thử nghiệm hình ảnh và phần cứng bổ sung, mỗi bản ghi cần gắn tình huống, cấu hình, mốc bắt đầu, thời điểm xác nhận, thời điểm nhận thông báo và kết quả quan sát. Nếu dùng snapshot hoặc ảnh dashboard làm minh chứng, cần liên kết chúng với đúng lần thử, thay vì chọn những ảnh rời không có ngữ cảnh. Ghi nhận FPS hiện có được giữ như số liệu quan sát của nguyên mẫu; khi có dữ liệu theo thời gian, có thể bổ sung thống kê trung bình, thấp nhất và mức dao động để đánh giá ổn định rõ hơn.