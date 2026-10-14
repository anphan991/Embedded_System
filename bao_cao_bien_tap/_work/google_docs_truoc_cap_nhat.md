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

# **LỜI CẢM ƠN** {#lời-cảm-ơn}

Lời đầu tiên, đại diện nhóm xin gửi lời cảm ơn chân thành đến quý thầy cô Khoa Công nghệ Thông tin – Trường Đại học Công nghệ Kỹ thuật TP. Hồ Chí Minh đã tạo điều kiện tốt nhất để nhóm được tiếp cận kiến thức thực tế và áp dụng các kiến thức chuyên ngành đã học vào đề tài thiết kế hệ thống nhúng trong môi trường học thuật chuyên nghiệp. Đặc biệt, nhóm thực hiện xin bày tỏ lòng biết ơn sâu sắc đến ThS. Võ Lê Phúc Hậu, người đã trực tiếp hướng dẫn và truyền đạt những kiến thức nền tảng quý báu cho nhóm trong suốt quá trình thực hiện đề tài. Những lời góp ý, định hướng chuyên môn và sự tận tình của cô đã giúp bài báo cáo giữa kỳ của nhóm được hoàn thiện và đạt được kết quả như mong muốn. Bài báo cáo là kết quả đúc kết từ những bài học trong quá trình nghiên cứu, xây dựng và phát triển hệ thống của nhóm. Tuy nhiên, do hạn chế về mặt kiến thức chuyên môn và thời gian thực hiện nên không thể tránh khỏi những thiếu sót. Nhóm thực hiện rất mong có được những ý kiến đóng góp của cô để bài báo cáo cũng như hệ thống được hoàn thiện hơn trong tương lai. Để có thể hoàn thành được đề tài này, nhóm đã nhận được sự quan tâm và giúp đỡ của nhiều cá nhân, tập thể trong và ngoài trường. Một lần nữa xin bày tỏ lòng biết ơn sâu sắc về sự hỗ trợ quý báu này.

*TP. HCM, ngày 1 tháng 4 năm 2026*

   								Sinh viên

								Nhóm 9 

**MỤC LỤC**  
[LỜI CẢM ƠN	II](#lời-cảm-ơn)

[DANH MỤC CÁC TỪ VIẾT TẮT	VII](#danh-mục-các-từ-viết-tắt)

[DANH SÁCH HÌNH ẢNH	IX](#danh-sách-hình-ảnh)

[DANH SÁCH BẢNG	IX](#danh-sách-bảng)

[CHƯƠNG 1	TỔNG QUAN ĐỀ TÀI	1](#tổng-quan-đề-tài)

[1.1. Đặt vấn đề	1](#đặt-vấn-đề)

[1.2. Tình hình nghiên cứu	2](#heading=h.1wknixj0zi33)

[1.2.1. Các hệ thống trong nước	2](#heading=h.r25z16bzc0q3)

[1.2.2. Các hệ thống nước ngoài	3](#heading=h.cgdm5jwzawin)

[1.3. Lý do chọn đề tài	4](#heading=h.ad5yiaqplwqy)

[1.4. Mục tiêu và phạm vi đề tài	4](#heading=h.ehf7eewal7gs)

[1.4.1. Mục tiêu đề tài	4](#heading=h.wu7nlv1vot50)

[1.4.2. Phạm vi đề tài	5](#heading=h.25575yax530a)

[CHƯƠNG 2	CƠ SỞ LÝ THUYẾT	6](#heading=h.7ma2iyi0sbee)

[2.1. Tổng quan về vi điều khiển ESP32	6](#heading=h.ejl8fm54a3hj)

[2.1.1. Kiến trúc và đặc tả kỹ thuật	6](#heading=h.txfkvegwpumq)

[2.1.2. Mô-đun ESP32-CAM và cơ chế truyền luồng video MJPEG	8](#heading=h.9dlp71s4kz62)

[2.2. Cảm biến radar sóng milimet HLK-LD2450	9](#heading=h.f02gqcvp0ddx)

[2.2.1. Nguyên lý radar điều tần liên tục FMCW	9](#heading=h.bmafg2gwbk3u)

[2.2.2. Đặc tả kỹ thuật và giao tiếp dữ liệu của mô-đun HLK-LD2450	10](#heading=h.cw1ox7gaxokx)

[2.3. Cơ cấu chấp hành Pan-Tilt và kỹ thuật điều khiển servo	12](#heading=h.xsg723wb3w79)

[2.3.1. Động cơ servo RC và điều chế độ rộng xung (PWM)	12](#heading=h.2k969zhxy3s6)

[2.3.2. Cơ cấu Pan-Tilt hai bậc tự do và ánh xạ tọa độ	13](#heading=h.dzfwawab00gi)

[2.3.3. Deadband và kỹ thuật ổn định chuyển động	15](#heading=h.eb6ph15fpu44)

[2.4. Thị giác máy tính và ước lượng tư thế người	16](#heading=h.vrmwvax6bnhv)

[2.4.1. Kiến trúc mạng nơ-ron tích chập YOLO và biến thể YOLO Pose	16](#heading=h.nbjk1vlkudqd)

[2.4.2. Trích xuất đặc trưng hình học cơ thể và thuật toán nhận diện té ngã	17](#heading=h.ki7djs9w92v6)

[2.4.3. Cửa sổ thời gian và lọc nhiễu dữ liệu động học	19](#heading=h.mvulnxkn8xhs)

[2.5. Giao thức truyền thông và kiến trúc mạng IoT	20](#heading=h.4bntz2e4u8b2)

[2.5.1. Giao thức MQTT và mô hình Publish \- Subscribe	20](#heading=h.9uszhbjmysow)

[2.5.2. Máy chủ trung gian Mosquitto Broker và cấu hình mạng cục bộ	22](#heading=h.dy14mug1lv6m)

[2.6. Kiến trúc phần mềm máy chủ và giao diện người dùng	22](#heading=h.wadikps6gqoq)

[2.6.1. Khung ứng dụng FastAPI, RESTful API và giao thức WebSocket	22](#heading=h.q0cdtdfgz97v)

[2.6.2. Nền tảng giao diện Next.js, React và công nghệ trực quan hóa	23](#heading=h.6ew0qhtb0zyy)

[2.6.3. Cơ chế đa tiến trình giải quyết giới hạn GIL trong Python	24](#heading=h.eou8b3ae9ig2)

[CHƯƠNG 3	THIẾT KẾ HỆ THỐNG	26](#heading=h.fnrc82uenkzz)

[3.1. Phân tích yêu cầu và kiến trúc hệ thống	26](#heading=h.tnl9sg38i2g7)

[3.1.1. Phân tích yêu cầu hệ thống	26](#heading=h.w0rddkm8m7pl)

[3.1.2. Sơ đồ khối tổng quát	28](#heading=h.e4nsabs01g6g)

[3.1.1. Kiến trúc đa tiến trình của backend	29](#heading=h.k1xjihyada0e)

[3.2. Thiết kế phần cứng	31](#heading=h.mzp3ovs6azfq)

[3.3. Thiết kế giải thuật và logic điều khiển	32](#heading=h.m0rwrmc0vuul)

[3.3.1. Xử lý tại thiết bị biên	32](#heading=h.6guwqdo5g5o7)

[3.3.2. Phát hiện té ngã	33](#heading=h.futeasdkd691)

[3.3.3. Bám sát mục tiêu và vùng chết	34](#heading=h.1g2fw8nbqks4)

[3.3.4. Xử lý chuyển động camera, mất dấu và cơ chế Solo Protection	35](#heading=h.k73sn1kljxtn)

[3.3.5. Cử chỉ hủy báo động và tiến trình Watchdog	36](#heading=h.qzo2vziw8mf4)

[3.3.6. . Chuyển đổi tọa độ radar sang hệ quy chiếu phòng	37](#heading=h.wxkfcixn2g4w)

[3.4. Thiết kế giao tiếp và lưu trữ dữ liệu	37](#heading=h.2b9slef471po)

[3.4.1. Giao tiếp MQTT	37](#heading=h.l6p5lyu5xntr)

[3.4.2. Giao diện lập trình ứng dụng REST API	38](#heading=h.74re16ypqmo6)

[3.4.3. Giao tiếp thời gian thực qua WebSocket	39](#heading=h.n5r1v2swpirg)

[3.4.4. Mô hình lưu trữ dữ liệu	39](#heading=h.8jahajv1twqw)

[3.5. Thiết kế giao diện Web	40](#heading=h.89mozntgybk0)

[3.5.1. Màn hình giám sát và điều khiển camera	40](#heading=h.beusegmtsnv3)

[3.5.2. Bản đồ radar, nhật ký sự kiện và cấu hình hệ thống	40](#heading=h.ydpcd44l1nq8)

[CHƯƠNG 4	42](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.3vuhokiy2pd)

[CHƯƠNG 5	XÂY DỰNG VÀ THIẾT LẬP MÔ PHỎNG	42](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.crozh13zh7j4)

[5.1. Môi trường phát triển	42](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.voekvop7p9en)

[5.2. Xây dựng Firmware (Wokwi) cho ESP32	42](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.b9bgb2as04ps)

[5.2.1. Cấu trúc điều khiển đa nhiệm (FreeRTOS)	43](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.gyn1jgqe21hm)

[5.2.2. Cơ chế Local Caching và đồng bộ hóa API	43](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.qh9obyeicug9)

[5.2.3. Xử lý logic nhận dạng và phản hồi người dùng	44](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.fcx2igvzxvk8)

[5.2.4. Đồng bộ thời gian thực qua NTP	44](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.lvo798tv3oic)

[5.3. Xây dựng Backend	45](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.z74g1ooao476)

[5.3.1. Tổng quan kiến trúc Backend	45](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.duj682e3dcy6)

[5.3.2. Thiết kế cơ sở dữ liệu (Database Schema)	46](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.uo7zkv9bdpke)

[5.3.3. Xây dựng các API giao tiếp với ESP32	46](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.dxbjzl9348js)

[5.3.4. Xây dựng các API phục vụ quản lý (Web Dashboard)	47](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.nlbawn86c6vh)

[5.4. Xây dựng giao diện Web	47](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.xkqzxl2k6bta)

[5.4.1. Lựa chọn công nghệ và Kiến trúc Frontend	48](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.umnbb96yz4kh)

[5.4.2. Xây dựng trang Xác thực người dùng	48](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.abg5flm820g8)

[5.4.3. Xây dựng Bảng điều khiển (Dashboard) và Quản lý lớp học	50](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.7yl5xdzct564)

[5.4.4. Tối ưu hóa Trải nghiệm người dùng (Advanced UI/UX)	51](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.55jgjxidr2c2)

[5.4.5. Cơ chế tương tác API và Cập nhật dữ liệu thời gian thực	52](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.jo04q81waqk4)

[5.5. Thiết lập thông số mô phỏng	53](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.uqn0ojqg6s3c)

[5.6. Thiết kế các kịch bản mô phỏng	53](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.64j0re65qlmk)

[CHƯƠNG 6	THIẾT LẬP VÀ TRIỂN KHAI PHẦN CỨNG	54](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.k49jcz954p0d)

[6.1. Chuẩn bị linh kiện và thiết lập môi trường phát triển	54](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.yr6hp9kpzh15)

[6.2. Lắp ráp và kiểm thử theo từng phân hệ (Incremental Testing)	55](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.81q6psga3kzr)

[6.3. Tích hợp hệ thống và xử lý sự cố vận hành thực tế	55](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.4arh3mvfuold)

[6.3.1. Xử lý lỗi đồng bộ thời gian (Lỗi 400 Bad Request)	56](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.r2y06yispxzn)

[6.3.2. Xử lý lỗi vi phạm toàn vẹn dữ liệu	57](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.a9t63b1s4hy)

[CHƯƠNG 7	KẾT QUẢ, ĐÁNH GIÁ MÔ PHỎNG VÀ NGOÀI THỰC NGHIỆM	58](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.a8syapfb0i9)

[7.1. Kết quả, đánh giá mô phỏng	58](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.d7e1j0z8dtz8)

[7.1.1. Kịch bản 1: Đánh giá tốc độ phản hồi của hệ thống (Latency)	58](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.ai6tc6wcade1)

[7.1.2. Kịch bản 2: Đánh giá độ ổn định khi chịu tải cao	59](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.rcmlxti93s5e)

[7.1.3. Kịch bản 3: Đánh hệ thống trong trường hợp ngoại tuyến	59](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.a46wdhck84r4)

[7.2. Kết quả, đánh giá ngoài thực nghiệm	60](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.y9vv326swhag)

[7.2.1. Kịch bản 1: Đánh giá tốc độ phản hồi của hệ thống (Latency)	60](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.gbffi5etkqwn)

[7.2.2. Kịch bản 2: Đánh giá độ ổn định khi chịu tải cao	61](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.1409krgwuzyk)

[7.2.3. Kịch bản 3: Đánh giá độ ổn định của hệ thống khi vận hành khi ngoại tuyến	62](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.g7ayo02myzqi)

[CHƯƠNG 8	KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN	63](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.npxbljqki7jn)

[TÀI LIỆU THAM KHẢO	1](#heading=h.mzwsj8jmzfhr)

[PHỤ LỤC	2](#heading=h.u66zoq42fo1t)

# **DANH MỤC CÁC TỪ VIẾT TẮT** {#danh-mục-các-từ-viết-tắt}

| Từ viết tắt | Thuật ngữ Tiếng Anh đầy đủ | Giải nghĩa Tiếng Việt / Chú thích |
| :---- | :---- | :---- |
| 3NF | Third Normal Form | Dạng chuẩn hóa 3 (trong thiết kế Cơ sở dữ liệu) |
| AC | Alternating Current | Dòng điện xoay chiều  |
| ACID | Atomicity, Consistency, Isolation, Durability | 4 tính chất của giao dịch CSDL: Tính nguyên tử, Tính nhất quán, Tính cô lập, Tính bền vững |
| ADC | Analog-to-Digital Converter | Bộ chuyển đổi tín hiệu tương tự sang số |
| AI | Artificial Intelligence | Trí tuệ nhân tạo |
| API | Application Programming Interface | Giao diện lập trình ứng dụng |
| ASGI | Asynchronous Server Gateway Interface | Giao diện cổng máy chủ bất đồng bộ |
| BaaS | Backend-as-a-Service | Dịch vụ máy chủ cung cấp sẵn |
| BLE | Bluetooth Low Energy | Bluetooth tiêu thụ năng lượng thấp |
| CPU | Central Processing Unit | Bộ vi xử lý trung tâm |
| CSDL | Database | Cơ sở dữ liệu |
| CRUD | Create, Read, Update, Delete | Bốn thao tác cơ bản trên dữ liệu (Tạo, Đọc, Cập nhật, Xóa). |
| DAC | Digital-to-Analog Converter | Bộ chuyển đổi tín hiệu số sang tương tự |
| DB | Database | Cơ sở dữ liệu |
| DC | Direct Current | Dòng điện một chiều |
| DMIPS | Dhrystone Million Instructions Per Second | Triệu lệnh Dhrystone trên giây (Đơn vị đo hiệu suất) |
| DOM | Document Object Model | Mô hình đối tượng tài liệu |
| EEPROM | Electrically Erasable Programmable Read-Only Memory | Bộ nhớ đọc chỉ dữ liệu có thể xóa bằng điện (Cấu trúc thẻ Mifare ). |
| ERD | Entity-Relationship Diagram | Sơ đồ quan hệ thực thể. |
| GPIO | General-Purpose Input/Output | Chân tín hiệu vào/ra đa dụng. |
| HF | High Frequency | Tần số cao. |
| HTTP | Hypertext Transfer Protocol | Giao thức truyền tải siêu văn bản. |
| I2C | Inter-Integrated Circuit | Giao thức truyền thông nối tiếp đồng bộ mạch tích hợp. |
| IoT | Internet of Things | Vạn vật kết nối. |
| I/O | Input/Output | Luồng nhập/xuất dữ liệu (liên quan đến các thao tác đọc ghi). |
| ISO | International Organization for Standardization | Tổ chức tiêu chuẩn hóa quốc tế (Dùng cho chuẩn ISO/IEC 14443 ). |
| JS | JavaScript | Ngôn ngữ lập trình kịch bản thường dùng cho ứng dụng Web. |
| JSON | JavaScript Object Notation | Định dạng dữ liệu văn bản nhẹ. |
| JWT | JSON Web Token | Chuỗi mã thông báo bảo mật Web. |
| LF | Low Frequency | Tần số thấp. |
| MISO | Master In Slave Out | Đường truyền dữ liệu từ thiết bị tớ về thiết bị chủ. |
| MOSI | Master Out Slave In | Đường truyền dữ liệu từ thiết bị chủ đến thiết bị tới. |
| MSSV | Student ID | Mã số sinh viên. |
| Mutex | Mutual Exclusion | Khóa loại trừ tương hỗ. |
| NFC | Near-Field Communication | Công nghệ giao tiếp tầm ngắn. |

# **DANH SÁCH HÌNH ẢNH** {#danh-sách-hình-ảnh}

[Hình 2.1. Sơ đồ chân của bo 30 chân ESP32 DevKit \- Ảnh: ELECTRONICS HUB \[4\].	6](#heading=h.9jtcz7agxl98)  
[Hình 2.2. Hình ảnh một xung chrip \- Ảnh: Wikipedia	9](#heading=h.b4vqb5spcydn)  
[Hình 2.3. Vùng quét hình quạt và hệ quy chiếu không gian hai chiều của radar HLK-LD2450 \-Ảnh: Nshop	11](#heading=h.3suek9tau8kg)  
[Hình 2.4. Mô hình cơ cấu Pan-Tilt	13](#heading=h.rdi85z48697z)  
[Hình 2.5. Minh họa cách thức hoạt động của mô hình YOLO	16](#heading=h.f6ex858d31o)  
[Hình 2.6. Các điểm mốc giải phẫu cơ thể theo chuẩn COCO	17](#heading=h.2jhqavswibl4)  
[Hình 2.7. Mô hình kiến trúc truyền thông Publish \- Subscribe thông qua MQTT Broker trung gian.	20](#heading=h.ypdgkr41x0jq)  
[Hình 3.1. Sơ đồ khối tổng quát kiến trúc hệ thống	28](#heading=h.f3xoxjvgclvy)  
[Hình 3.2. Sơ đồ luồng dữ liệu đa tiến trình và cơ chế giao tiếp liên tiến trình	29](#heading=h.aud6xmilkxj5)  
[Hình 5.1. Ảnh Project trên Wokwi	42](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.pme9k2gq2rgt)  
[Hình 5.2. Giao diện khi đăng nhập	49](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.yjq6ymi884sj)  
[Hình 5.3. Giao diện khi người dùng nhập sai tài khoản hoặc mật khẩu	49](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.2j9sbwavzjg5)  
[Hình 5.4. Giao diện Dashboard	50](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.m8b4b47gftvm)  
[Hình 5.5. Hộp thoại hiện lên khi giảng viên muốn điểm danh bù cho sinh viên	51](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.69go9mpiyka3)  
[Hình 5.6. Hộp thoại hiện lên khi đăng nhập thành công	52](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.d0xpwoclzer1)  
[Hình 5.7. Giao diện Dark Mode	52](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.6vabjl9kbfef)  
[Hình 6.1. Hình ảnh sản phẩm khi sẵn sàng quét	54](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.n4bwjhbbeqh9)  
[Hình 6.2. Màn hình sản phẩm hiển thị thông báo khi quét thành công	56](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.j6tji8p2kb3w)  
[Hình 6.3. Màn hình sản phẩm hiển thị thông báo khi quét thất bại	57](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.5jnbx2vpl1k5)

# **DANH SÁCH BẢNG** {#danh-sách-bảng}

[Bảng 2.1. Bảng đặc tả kỹ thuật chi tiết của vi điều khiển ESP32 \[5\].	4](#heading=h.nt3ffn1m8tyf)  
[Bảng 2.2. Bảng phân loại và phạm vi tín hiệu của các tần số vô tuyến \[10\].	7](#heading=h.qtdqspgs9b15)  
[Bảng 3.1. Bảng admin\_users	13](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.u6m1p3s3yf5j)  
[Bảng 3.2. Bảng sinh\_vien	14](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.d0z6wgddxbou)  
[Bảng 3.3. Bảng thiet\_bi	15](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.gu9enzkmozaq)  
[Bảng 3.4. Bảng lop\_hoc	15](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.szgk9uxay3rg)  
[Bảng 3.5. Bảng danh\_sach\_lop	16](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.idtqm09lipkw)  
[Bảng 3.6. Bảng nhat\_ky\_diem\_danh	17](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.odgwq8cwuy9i)  
[Bảng 3.7. Danh sách các API Endpoints trong hệ thống	19](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.9l2rh1w2y6of)  
[Bảng 5.1. Số liệu tốc độ phản hồi phần cứng ở môi trường mô phỏng	42](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.defhtlpbfo1k)  
[Bảng 5.2. Số liệu đánh giá độ ổn định trong môi trường mô phỏng	43](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.2x6gjivr3tf1)  
[Bảng 5.3. Số liệu khi kiểm tra hệ thống ở các điều kiện khác nhau trong môi trường mô phỏng	44](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.c5rsxhcb7lbl)  
[Bảng 5.4. Số liệu tốc độ phản hồi phần cứng ở môi trường thực tế	45](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.6l7albg0m9xc)  
[Bảng 5.5. Số liệu đánh giá độ ổn định trong môi trường thực tế	46](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.y0fs5d1nmx7)  
[Bảng 5.6. Số liệu kiểm tra hệ thống ở các điều kiện khác nhau trong môi trường thực tế	46](https://docs.google.com/document/d/1MFFeyXQ7_OPdtNHDWHUVfBYEizuwicumaXCyo6W3HAA/edit#heading=h.o8d78e581iid)

1. # **TỔNG QUAN ĐỀ TÀI** {#tổng-quan-đề-tài}

   1. ## **Đặt vấn đề** {#đặt-vấn-đề}

Té ngã có thể gây chấn thương nghiêm trọng và làm suy giảm khả năng sinh hoạt độc lập của người cao tuổi. Theo báo cáo của Tổ chức Y tế Thế giới công bố năm 2021, mỗi năm trên thế giới có khoảng 684.000 trường hợp tử vong do té ngã và 37,3 triệu trường hợp cần chăm sóc y tế; người trên 60 tuổi là nhóm chịu số ca tử vong nhiều nhất \[1\]. Tại Việt Nam, báo cáo của Tổng cục Thống kê và Quỹ Dân số Liên Hợp Quốc dựa trên các cuộc Tổng điều tra dân số năm 2009 và 2019 ghi nhận tỷ lệ người cao tuổi sống một mình hoặc chỉ sống cùng vợ, chồng có xu hướng tăng \[2\]. Trong bối cảnh đó, việc phát hiện sự cố và thông báo sớm cho người chăm sóc là một nhu cầu thiết thực, đặc biệt khi người được giám sát không thể tự gọi trợ giúp.

Các phương thức giám sát hiện có đáp ứng nhu cầu này ở những mức độ khác nhau. Thiết bị đeo cung cấp thông tin chuyển động trực tiếp nhưng phụ thuộc vào việc người dùng mang và duy trì nguồn điện cho thiết bị. Camera cho phép quan sát tư thế mà không cần tiếp xúc với cơ thể, song hiệu quả phụ thuộc vào góc nhìn, ánh sáng và mức độ che khuất. Với camera cố định, người cần giám sát còn có thể di chuyển ra ngoài khung hình. Vì vậy, bài toán không chỉ là nhận diện tư thế ngã, mà còn là duy trì khả năng quan sát và tổ chức luồng cảnh báo đủ rõ ràng để người chăm sóc có thể phản hồi.

Đề tài “Hệ thống servo Pan-Tilt điều hướng camera chủ động và nhận diện té ngã thời gian thực” xây dựng một nguyên mẫu giám sát trong nhà theo hướng kết hợp radar định vị với camera phân tích tư thế. Radar HLK-LD2450 cung cấp tọa độ mục tiêu để dẫn hướng cơ cấu Pan-Tilt; ESP32-CAM thu nhận hình ảnh; máy tính cục bộ sử dụng YOLO Pose và thuật toán phân tích theo thời gian để đánh giá dấu hiệu té ngã. Khi phát hiện sự cố, hệ thống ghi nhận sự kiện, lưu ảnh và gửi cảnh báo tới giao diện web, đồng thời hỗ trợ thông báo qua Telegram. Trọng tâm của đề tài là tích hợp các khối cảm biến, điều khiển nhúng, truyền thông và xử lý hình ảnh thành một hệ thống có thể vận hành và kiểm chứng trên nguyên mẫu.

1.2. Tình hình nghiên cứu

1.2.1. Các nghiên cứu trong nước

Các nghiên cứu trong nước đã tiếp cận bài toán té ngã thông qua phân tích tư thế và chuyển động từ video. Trong công trình “Vision Based Fall Detection for the Elderly People”, Bùi Ngọc Dũng và các cộng sự kết hợp phát hiện người, ước lượng khớp cơ thể, phân loại tư thế bằng XGBoost và phân tích chuỗi tọa độ khớp bằng LSTM \[3\]. Việc sử dụng thông tin theo thời gian có ý nghĩa vì tư thế nằm sau một cú ngã có thể gần giống tư thế nằm nghỉ; chỉ quan sát một khung hình thường chưa đủ để xác định quá trình dẫn đến trạng thái đó. Theo hướng tích hợp ứng dụng, Ng, Mai và Nguyen sử dụng YOLOv8 trong một hệ thống phát hiện té ngã kết hợp phần mềm và IoT \[4\]. Đỗ Trí Nhựt và Lê Thị Thủy cũng nghiên cứu kết hợp nhận diện điểm mốc cơ thể với học sâu, báo cáo tỷ lệ phát hiện 95% trên phạm vi thử nghiệm của công trình \[5\].

Những kết quả này cho thấy khả năng sử dụng mô hình thị giác để hỗ trợ giám sát, nhưng không thể chuyển trực tiếp các chỉ số của từng nghiên cứu thành độ chính xác của hệ thống trong đề tài. Chẳng hạn, công trình của Đỗ Trí Nhựt và cộng sự thử nghiệm với người từ 8 đến 50 tuổi, nên chưa phản ánh đầy đủ đặc điểm vận động của người cao tuổi \[5\]. Ngoài thuật toán nhận diện, một hệ thống triển khai trong phòng còn phải xử lý việc đối tượng rời khỏi khung hình, dữ liệu bị gián đoạn và sự khác biệt giữa môi trường thử nghiệm với không gian sinh hoạt thực tế. Đây là các vấn đề mà đề tài xem xét ở cấp độ tích hợp hệ thống.

 1.2.2. Các nghiên cứu nước ngoài

Các hướng nghiên cứu quốc tế thường khai thác cảm biến đeo, thị giác máy tính hoặc radar. Thiết bị đeo đo trực tiếp gia tốc và chuyển động của cơ thể, thuận lợi khi người dùng di chuyển giữa nhiều không gian nhưng đòi hỏi duy trì việc sử dụng thiết bị. Với thị giác máy tính, Lu và cộng sự kết hợp mạng tích chập 3D với LSTM có cơ chế attention để khai thác thông tin chuyển động trong video \[6\]. Cách tiếp cận này làm rõ vai trò của chuỗi thời gian trong phân biệt hành động, đồng thời vẫn chịu các giới hạn của dữ liệu hình ảnh như thiếu sáng, che khuất và góc quan sát.

Radar cung cấp một nguồn dữ liệu khác, ít phụ thuộc vào ánh sáng và không thu ảnh RGB. Công trình mmFall của Jin, Sengupta và Cao sử dụng đám mây điểm radar cùng mô hình học theo chuỗi để phát hiện té ngã \[7\]. Tuy nhiên, dữ liệu radar của công trình này phong phú hơn dữ liệu tọa độ hai chiều do HLK-LD2450 cung cấp; không thể suy ra rằng mô-đun trong đề tài có cùng khả năng nhận diện. Vì vậy, hệ thống lựa chọn cách phối hợp theo chức năng: radar hỗ trợ định vị và dẫn hướng, còn camera cung cấp đặc trưng tư thế để đánh giá sự cố. Sự phối hợp này mở rộng khả năng quan sát, nhưng không loại bỏ hoàn toàn che khuất hoặc các yêu cầu bảo vệ dữ liệu hình ảnh.

\# 1.3. Mục tiêu và phạm vi đề tài

Mục tiêu của đề tài là thiết kế và tích hợp một nguyên mẫu có khả năng điều hướng camera hai trục theo mục tiêu, phân tích sự thay đổi tư thế để phát hiện dấu hiệu té ngã và thông báo cho người chăm sóc. Về mặt hệ thống nhúng, đề tài tập trung vào thu nhận dữ liệu radar qua UART, điều khiển servo bằng PWM, trao đổi dữ liệu qua MQTT và phối hợp với khối xử lý trên máy tính. Về mặt nhận diện, mô hình YOLO Pose được sử dụng để trích xuất điểm mốc cơ thể; quyết định té ngã được xây dựng bằng các đặc trưng hình học và máy trạng thái theo thời gian, thay vì huấn luyện một mô hình phân loại té ngã mới.

Hệ thống hướng tới kịch bản giám sát một người trong phòng có sàn tương đối phẳng và ánh sáng phù hợp cho camera. Vùng hoạt động phải được xác lập sau khi lắp đặt, căn cứ vào phạm vi danh định của radar, góc nhìn camera, hành trình cơ khí và vật cản trong phòng. HLK-LD2450 có phạm vi danh định tối đa 6 m và góc phương vị ±60°, nhưng các thông số này không đồng nghĩa với vùng nhận diện té ngã được bảo đảm trong mọi điều kiện \[8\]. Radar hiện được khai thác để chọn một mục tiêu dẫn hướng; hệ thống chưa thực hiện ghép định danh mục tiêu radar với từng Track ID trong ảnh và chưa giải quyết đầy đủ bài toán giám sát nhiều người.

Nguyên mẫu gồm một ESP32-CAM thu hình, một ESP32 DevKit kết nối radar và hai servo MG996R, cùng máy tính Windows vận hành Mosquitto, backend và giao diện web. Suy luận AI và lưu trữ được thực hiện cục bộ; truy cập từ xa có thể tổ chức qua mạng riêng Tailscale theo cấu hình triển khai. Đề tài đánh giá tính khả thi của kiến trúc và các cơ chế xử lý, còn độ chính xác, độ trễ và độ ổn định dài hạn cần được xác định bằng thực nghiệm. Việc nhận diện tư thế trong phạm vi này không cung cấp kết luận về nguyên nhân y khoa như ngất xỉu hoặc đột quỵ. Các giới hạn trên là cơ sở để lựa chọn phần cứng và phương pháp xử lý ở những chương tiếp theo.

 Chương 2\. Cơ sở lý thuyết

\# 2.1. Vi điều khiển ESP32 và mô-đun ESP32-CAM

ESP32 là hệ thống trên chip tích hợp bộ xử lý, bộ nhớ, kết nối Wi-Fi và các ngoại vi phục vụ điều khiển nhúng. Biến thể ESP32 cổ điển được sử dụng trong đề tài có bộ xử lý Xtensa LX6, xung nhịp tối đa 240 MHz và 520 KB SRAM. Hai ngoại vi quan trọng đối với thiết kế là UART để nhận dữ liệu cảm biến và LEDC để tạo xung điều khiển servo \[9\]. Việc tạo PWM bằng phần cứng giúp duy trì tín hiệu điều khiển mà không phải phát từng xung bằng phần mềm. Tuy nhiên, khả năng đáp ứng của chương trình vẫn phụ thuộc vào cách tổ chức vòng lặp, xử lý mạng và phân bổ tài nguyên; cấu trúc hai nhân không tự bảo đảm mọi tác vụ diễn ra đúng hạn.

ESP32-CAM bổ sung giao tiếp camera và bộ nhớ PSRAM để hỗ trợ bộ đệm ảnh. Driver camera của Espressif hỗ trợ nhiều cảm biến, trong đó có OV2640 và OV3660, cùng chế độ thu ảnh JPEG \[10\]. Trong nguyên mẫu, mô-đun được sử dụng với cảm biến OV3660 theo cấu hình của dự án. Bộ nhớ PSRAM cho phép duy trì nhiều bộ đệm và độ phân giải cao hơn; khi không có PSRAM, firmware có thể giảm độ phân giải để phù hợp tài nguyên còn lại. Việc tách ESP32-CAM khỏi ESP32 điều khiển radar và servo giúp phân định trách nhiệm giữa thu hình và chấp hành, thuận lợi cho việc kiểm tra từng khối trước khi tích hợp.

Luồng MJPEG truyền liên tiếp các ảnh JPEG độc lập qua một kết nối HTTP, thường sử dụng kiểu nội dung multipart/x-mixed-replace. Cách truyền này phù hợp với cấu hình camera hiện có vì không đòi hỏi mã hóa liên khung hình phức tạp. Máy chủ có thể tách từng ảnh từ luồng byte rồi giải mã khung cần xử lý, trong khi luồng xem trực tiếp vẫn dùng dữ liệu JPEG. Đổi lại, MJPEG có thể tiêu thụ băng thông đáng kể do mỗi ảnh được nén riêng; tăng độ phân giải hoặc chất lượng ảnh sẽ làm tăng lượng dữ liệu truyền và có thể giảm tốc độ khung hình. Vì vậy, cấu hình camera cần cân bằng giữa độ rõ của điểm mốc cơ thể, băng thông Wi-Fi và năng lực suy luận của máy tính.

\# 2.2. Radar HLK-LD2450 và dữ liệu định vị

 2.2.1. Nguyên lý radar FMCW

Radar FMCW phát tín hiệu có tần số thay đổi theo thời gian, thường dưới dạng các chirp. Sóng phản xạ từ mục tiêu trở về trễ hơn tín hiệu phát; khi trộn hai tín hiệu, radar thu được tín hiệu phách có tần số liên quan đến khoảng cách. Với mô hình mục tiêu đứng yên, độ trễ truyền hai chiều là τ \= 2R/c và tần số phách xấp xỉ f\_b \= Sτ, trong đó R là khoảng cách, c là tốc độ ánh sáng và S là độ dốc biến thiên tần số. Radar có thể suy ra vận tốc từ sự thay đổi pha giữa các chirp, còn thông tin góc được khai thác từ chênh lệch tín hiệu giữa các anten thu \[11\].

HLK-LD2450 thực hiện xử lý tín hiệu bên trong mô-đun và xuất kết quả qua cổng nối tiếp, nên vi điều khiển không phải tự thực hiện các phép biến đổi phổ của radar. Đề tài chỉ khai thác dữ liệu tọa độ và vận tốc đầu ra. Cách sử dụng này giảm yêu cầu tính toán tại thiết bị nhúng, đồng thời giới hạn mức thông tin có thể phân tích: dữ liệu vị trí hai chiều không cung cấp trực tiếp tư thế cơ thể hoặc độ cao để xác nhận một cú ngã.

 2.2.2. Đặc điểm và hệ tọa độ của HLK-LD2450

Theo nhà sản xuất, HLK-LD2450 là radar theo dõi mục tiêu chuyển động ở băng tần 24 GHz, sử dụng cấu hình một anten phát và hai anten thu; phạm vi danh định tối đa 6 m và góc phương vị ±60° \[8\]. Mô-đun thường được giới thiệu trong nhóm radar mmWave thương mại; trong bài này, thuật ngữ radar 24 GHz được dùng để mô tả rõ băng tần thực tế. Dữ liệu gồm tọa độ ngang X, tọa độ theo hướng phía trước Y và vận tốc trong hệ quy chiếu gắn với cảm biến. Vị trí này biểu diễn quan hệ giữa mục tiêu và radar, chưa phải vị trí trên mặt bằng phòng.

Để đưa mục tiêu lên bản đồ phòng, cần biết vị trí lắp radar và góc xoay của nó, sau đó áp dụng phép quay và tịnh tiến. Độ chính xác của bản đồ vì thế phụ thuộc cả dữ liệu cảm biến lẫn việc hiệu chuẩn vị trí lắp đặt. Trong hệ thống Pan-Tilt, tọa độ radar còn được dùng để suy ra hướng nhìn camera. Do radar không cung cấp độ cao mục tiêu, góc nghiêng camera phải dựa trên một điểm ngắm giả định hoặc phản hồi từ hình ảnh. Đây là giới hạn cần xem xét khi người thay đổi tư thế hoặc di chuyển gần thiết bị.

\[Vị trí chèn Hình 2.1 tại đây\]

Hình 2.1. Hệ tọa độ radar và quan hệ hình học với hướng quan sát của camera Pan-Tilt.

Nguồn: Tác giả xây dựng dựa trên đặc tả HLK-LD2450 \[8\]. Gợi ý thể hiện trục X, Y, góc phương vị, vị trí camera và điểm ngắm giả định; ghi rõ vùng quét là phạm vi danh định.

\# 2.3. Cơ cấu Pan-Tilt và điều khiển servo

 2.3.1. Nguyên lý điều khiển servo RC

Servo RC là cơ cấu chấp hành gồm động cơ, bộ truyền cơ khí, mạch điều khiển và phần tử phản hồi vị trí. Mạch bên trong điều chỉnh động cơ để trục ra tiến tới góc tương ứng với tín hiệu điều khiển. Với servo vị trí thông dụng, tín hiệu là một chuỗi xung lặp theo chu kỳ; góc đặt được biểu diễn bằng độ rộng xung mức cao. Trong đề tài, PWM được cấu hình ở tần số 50 Hz bằng thư viện ESP32Servo. Dải xung và hành trình sử dụng phải phù hợp với servo thực tế và cơ cấu lắp ráp, vì cùng một độ rộng xung không nhất thiết cho cùng góc quay trên mọi sản phẩm.

Cơ cấu Pan-Tilt bố trí hai trục quay để thay đổi hướng ngang và góc ngẩng, cúi của camera. Servo có vòng điều khiển vị trí bên trong, nhưng ESP32 trong nguyên mẫu chỉ gửi góc lệnh, không đo độc lập góc thực của cơ cấu. Vì vậy, sai số lắp ráp, độ rơ bánh răng, tải camera và giới hạn hành trình vẫn ảnh hưởng đến hướng quan sát. Việc giới hạn góc bằng phần mềm và kiểm tra chuyển động thực tế là cần thiết để tránh camera chạm cữ hoặc servo duy trì tải tại điểm cuối hành trình.

 2.3.2. Dẫn hướng và ổn định chuyển động

Với tọa độ mục tiêu trên mặt phẳng ngang, góc phương vị được tính bằng atan2(X, Y), sau đó ánh xạ về góc servo theo vị trí trung tâm và chiều quay thực tế. Hàm atan2 thể hiện hướng của vector mục tiêu rõ hơn phép tính arctan(X/Y), đồng thời tránh phép chia trực tiếp cho Y. Góc Tilt được ước lượng từ khoảng cách ngang và chênh lệch giữa độ cao camera với điểm ngắm giả định. Mô hình này phù hợp khi radar và camera được bố trí theo cùng hướng tham chiếu; nếu hai thiết bị có độ lệch vị trí đáng kể, cần bổ sung hiệu chuẩn thay vì coi ánh xạ góc là chính xác trong mọi khoảng cách.

Dữ liệu vị trí luôn có nhiễu, nên điều khiển phản ứng với mọi dao động nhỏ có thể khiến camera quay liên tục. Bộ lọc trung bình động hàm mũ, hay EMA, làm mượt dữ liệu theo quan hệ S\_t \= αY\_t \+ (1 − α)S\_(t−1), với Y\_t là giá trị mới và S\_t là giá trị đã lọc. Hệ số α lớn cho phản ứng nhanh hơn nhưng giữ nhiều nhiễu hơn; hệ số nhỏ làm tín hiệu êm hơn nhưng tăng độ trễ. Ngoài lọc tọa độ, có thể làm mượt góc lệnh để giảm thay đổi đột ngột giữa hai lần cập nhật.

Khi dẫn hướng bằng hình ảnh, vùng chết được đặt quanh tâm khung hình để cơ cấu giữ nguyên hướng nếu đối tượng vẫn nằm trong phạm vi cho phép. Chỉ khi sai lệch vượt ngưỡng, bộ điều khiển mới phát lệnh hiệu chỉnh. Vùng chết và EMA giải quyết hai vấn đề khác nhau: vùng chết hạn chế các chuyển động không cần thiết, còn EMA giảm nhiễu trong tín hiệu đầu vào hoặc góc lệnh. Việc lựa chọn các tham số phải cân bằng độ ổn định hình ảnh với khả năng theo kịp người di chuyển, thay vì ưu tiên độ êm đến mức làm camera phản ứng quá chậm.

\# 2.4. Ước lượng tư thế và nhận diện té ngã

 2.4.1. YOLO Pose và theo dõi đối tượng

YOLO Pose kết hợp phát hiện người với ước lượng các điểm mốc cơ thể trong một mô hình. Với cấu hình pose theo COCO, đầu ra gồm khung bao và 17 điểm mốc, bao gồm các điểm ở mặt, vai, khuỷu tay, cổ tay, hông, đầu gối và cổ chân; mỗi điểm có thông tin độ tin cậy \[12\]. Các điểm mốc cung cấp biểu diễn hình học gọn hơn ảnh RGB, giúp phân tích hướng thân và sự thay đổi tương quan giữa các phần cơ thể. Tuy nhiên, mô hình pose huấn luyện sẵn chỉ ước lượng vị trí điểm mốc, không tự đưa ra kết luận rằng một người vừa té ngã.

Để phân tích diễn biến theo thời gian, hệ thống cần liên kết các quan sát của cùng đối tượng giữa nhiều khung hình. BoT-SORT là bộ theo dõi được sử dụng cùng YOLO để duy trì Track ID trong video \[13\]. Track ID phục vụ quản lý lịch sử chuyển động, không phải danh tính đã được xác thực của người trong phòng. Khi bị che khuất, thay đổi góc nhìn hoặc mất phát hiện, đối tượng có thể nhận ID mới; việc sử dụng lịch sử cần có điều kiện kiểm tra tính liên tục để tránh nối nhầm chuyển động của hai đối tượng hoặc hai giai đoạn quan sát không liên quan.

\[Vị trí chèn Hình 2.2 tại đây\]

Hình 2.2. Các điểm mốc cơ thể và đặc trưng hình học dùng trong phân tích tư thế.

Nguồn: Tác giả tổng hợp từ đầu ra YOLO Pose và tài liệu Ultralytics \[12\]. Gợi ý đánh dấu trung điểm vai, trung điểm hông, hướng thân và khung bao; không cần minh họa cấu trúc mạng nơ-ron chi tiết.

 2.4.2. Đặc trưng hình học và phân tích theo thời gian

Một dấu hiệu của tư thế nằm là tỷ lệ chiều rộng trên chiều cao của khung bao tăng, đồng thời đoạn nối trung điểm vai với trung điểm hông trở nên gần phương ngang. Tuy nhiên, các đặc trưng này chỉ mô tả hình dáng trong ảnh. Người nằm nghỉ có thể tạo đặc trưng tương tự người sau một cú ngã, còn người khuỵu xuống hoặc gục khi ngồi có thể không tạo khung bao nằm ngang. Vì vậy, thuật toán cần kết hợp tư thế hiện tại với lịch sử tư thế trước đó và mức thay đổi vị trí thân trong một khoảng thời gian.

Trong đề tài, tọa độ trung điểm hai hông được dùng làm đại diện cho chuyển động của phần thân; khi không có đủ điểm mốc phù hợp, chương trình sử dụng tâm khung bao làm giá trị dự phòng. Đại lượng này là đặc trưng ảnh, không phải phép đo trọng tâm cơ học chính xác của toàn cơ thể. Độ dịch chuyển được chuẩn hóa theo chiều cao khung bao để giảm ảnh hưởng của kích thước người trong ảnh; tốc độ tương ứng có đơn vị chiều cao khung bao trên giây, không phải m/s. Các quan hệ đầu–vai và đầu–hông bổ sung thông tin cho tình huống gục phần thân trên. Chuẩn hóa giúp so sánh các quan sát thuận tiện hơn nhưng không loại bỏ sai số phối cảnh, thay đổi khung bao hoặc chuyển động camera.

Máy trạng thái hữu hạn tổ chức quyết định theo trình tự: xác lập tư thế ban đầu, nhận diện dấu hiệu chuyển tiếp, chờ tư thế suy sụp duy trì và xác nhận sự kiện. Cửa sổ trượt lưu các quan sát gần nhất để so sánh trạng thái hiện tại với tư thế trước đó, còn EMA giảm dao động của đặc trưng giữa các khung hình. Cách kết hợp này hạn chế việc kết luận chỉ từ một tư thế nằm hoặc một điểm mốc sai. Đổi lại, yêu cầu quan sát liên tục và thời gian xác nhận làm tăng độ trễ, đồng thời có thể bỏ sót sự cố nếu quá trình ngã xảy ra khi đối tượng bị che khuất hoặc camera đang quay.

\# 2.5. Truyền thông MQTT và mạng cục bộ

MQTT là giao thức truyền thông điệp theo mô hình publish–subscribe. Thiết bị gửi thông điệp tới một topic trên broker, còn các thiết bị quan tâm đăng ký nhận dữ liệu từ topic đó. Broker chuyển tiếp thông điệp đến các bên đăng ký, giúp bên gửi và bên nhận không cần thiết lập kết nối trực tiếp với nhau. Các mức QoS xác định cơ chế giao nhận: QoS 0 không có xác nhận ở tầng MQTT, QoS 1 cho phép truyền lại và có thể tạo thông điệp trùng, còn QoS 2 bổ sung thủ tục để giao một lần ở tầng giao thức \[14\]. Lựa chọn QoS cần xét tính chất dữ liệu, thay vì áp dụng cùng một mức cho mọi thông điệp.

Trong hệ thống, Mosquitto chuyển tiếp dữ liệu radar và các lệnh điều khiển giữa ESP32 với backend. Dữ liệu vị trí được cập nhật liên tục có thể ưu tiên giá trị mới nhất, trong khi lệnh chuyển chế độ cần được quản lý khác với một lệnh quay từng bước. Đặc biệt, lệnh bước không nên được giữ lại để phát lại cho thiết bị sau khi kết nối lại, vì có thể gây chuyển động ngoài thời điểm người dùng yêu cầu. Cấu hình broker hiện phục vụ mạng thử nghiệm cục bộ và cho phép kết nối không xác thực; phạm vi truy cập vì vậy phải được giới hạn ở lớp mạng khi vận hành. MQTT là kênh điều khiển và dữ liệu cảm biến, còn video được truyền riêng qua HTTP để phù hợp đặc điểm và dung lượng của từng loại dữ liệu.

\# 2.6. Tổ chức xử lý trên máy chủ và giao diện web

Máy chủ tiếp nhận đồng thời video, dữ liệu radar và thao tác từ người dùng, trong khi suy luận pose là tác vụ có chi phí tính toán lớn. Kiến trúc đa tiến trình cho phép tách thu nhận hình ảnh, suy luận và phục vụ web vào các tiến trình riêng. Trong CPython có GIL, nhiều luồng không đồng thời thực thi bytecode Python; multiprocessing sử dụng các tiến trình riêng để hỗ trợ xử lý song song \[15\]. Tuy nhiên, các thư viện tính toán như PyTorch có thể giải phóng GIL trong một số tác vụ, nên không thể quy toàn bộ độ trễ AI cho cơ chế này. Giá trị chính của việc tách tiến trình trong đề tài là giảm mức phụ thuộc giữa các khối xử lý và thuận lợi cho việc khởi động lại khối bị dừng.

Khi suy luận chậm hơn tốc độ camera, hàng đợi không giới hạn sẽ tích lũy khung hình cũ. Với giám sát và điều hướng, một kết quả chính xác trên ảnh quá cũ vẫn có thể không hữu ích. Do đó, hệ thống ưu tiên khung hình mới nhất bằng hàng đợi ảnh có dung lượng nhỏ, chấp nhận bỏ qua một số khung để hạn chế phần độ trễ do tồn đọng dữ liệu. Chính sách này không thay thế việc đo độ trễ toàn tuyến, vì thời gian thu ảnh, truyền mạng, giải mã, suy luận và hiển thị vẫn đóng góp vào thời gian phản hồi.

FastAPI cung cấp các giao tiếp của backend, còn Next.js và React tổ chức giao diện giám sát. REST API phục vụ thao tác cấu hình, điều khiển và truy vấn; WebSocket đẩy sự kiện cảnh báo và thông báo trạng thái tới các phiên đang kết nối. Một số dữ liệu như vị trí radar và kết quả nhận diện vẫn được giao diện lấy định kỳ qua HTTP. Sự kết hợp này cho phép chọn cách cập nhật phù hợp với từng nội dung, đồng thời yêu cầu giao diện hiển thị rõ dữ liệu còn mới hay đã gián đoạn. Các nền tảng trên được áp dụng vào kiến trúc cụ thể ở chương 3\.

 Chương 3\. Thiết kế hệ thống

\# 3.1. Yêu cầu và kiến trúc tổng thể

 3.1.1. Yêu cầu thiết kế

Hệ thống được thiết kế cho kịch bản một người sinh hoạt trong phòng. Các chức năng chính gồm thu nhận video, tự động điều hướng camera, phân tích tư thế theo thời gian, ghi nhận sự cố và hỗ trợ người chăm sóc theo dõi qua giao diện web. Người vận hành có thể chuyển giữa AUTO và MANUAL, quay camera từng bước hoặc đưa về vị trí trung tâm. Bản đồ phòng cho phép cấu hình vị trí radar và vùng SAFE, DANGER để cung cấp ngữ cảnh không gian cho quá trình giám sát. Các cảnh báo vào vùng nguy hiểm hoặc đi lại ban đêm là chức năng bổ trợ, cần được phân biệt với sự kiện té ngã.

Các ràng buộc thiết kế tập trung vào độ trễ, khả năng phục hồi và an toàn cơ điện. Luồng xem trực tiếp phải hoạt động độc lập với tốc độ suy luận; hàng đợi ảnh cần tránh tích lũy dữ liệu cũ. Chương trình phải thể hiện được tình trạng camera, radar, MQTT và tiến trình AI để người dùng nhận biết khi hệ thống không còn đủ dữ liệu giám sát. Ở phần chấp hành, góc quay được giới hạn và nguồn servo phải đáp ứng tải chuyển động mà không gây sụt áp nghiêm trọng ở khối logic. Những yêu cầu này định hướng cách phân chia thiết bị và phần mềm, nhưng mức đáp ứng thực tế vẫn cần được đo trên nguyên mẫu.

 3.1.2. Phân chia các khối chức năng

Hệ thống gồm hai nhánh dữ liệu phối hợp tại máy chủ. Ở nhánh hình ảnh, ESP32-CAM phát MJPEG qua Wi-Fi; backend thu nhận khung hình, đưa vào YOLOv8m-pose và BoT-SORT, sau đó chuyển đặc trưng tư thế tới bộ phát hiện té ngã. Ở nhánh định vị và điều khiển, radar HLK-LD2450 gửi tọa độ qua UART tới ESP32 DevKit. Vi điều khiển chọn mục tiêu, lọc dữ liệu và tính góc servo trong chế độ AUTO, đồng thời gửi dữ liệu radar về máy chủ qua Mosquitto. Dashboard nhận hình ảnh và trạng thái từ backend, còn thao tác điều khiển được chuyển qua API và MQTT tới ESP32.

Phân chia này đưa các tác vụ thu cảm biến và tạo tín hiệu chấp hành xuống thiết bị nhúng, còn suy luận và quản lý sự kiện lên máy tính cục bộ. Radar có thể tiếp tục dẫn hướng tại ESP32 khi khối AI giảm tốc độ, nhưng chế độ tự động vẫn phụ thuộc trạng thái đã được thiết lập và chương trình điều khiển đang hoạt động. Việc phối hợp radar với camera ở đây diễn ra qua các quy tắc ưu tiên điều khiển và ngữ cảnh vùng phòng, chưa phải mô hình hợp nhất đặc trưng hoặc ghép định danh giữa hai cảm biến.

\[Vị trí chèn Hình 3.1 tại đây\]

Hình 3.1. Sơ đồ khối hệ thống giám sát và các kênh trao đổi dữ liệu.

Nguồn: Tác giả xây dựng. Gợi ý phân biệt hai nhánh camera–AI và radar–servo; ghi UART, PWM, MQTT, HTTP, REST API và WebSocket trên đúng đường kết nối, đồng thời thể hiện Telegram ở phía backend.

\# 3.2. Thiết kế phần cứng

Cụm thu hình gồm ESP32-CAM với cảm biến OV3660 được gắn trên giá Pan-Tilt, còn radar cần được cố định theo hướng đã hiệu chuẩn để hệ quy chiếu của nó không thay đổi khi camera quay. Cụm điều khiển sử dụng ESP32 DevKit kết nối radar và hai servo MG996R. Theo firmware hiện tại, tín hiệu Pan nối GPIO13, Tilt nối GPIO27, còn chân TX của radar nối GPIO32 để ESP32 nhận dữ liệu qua UART2 ở 256.000 baud, định dạng 8N1. GPIO17 được khởi tạo làm đường TX của UART; firmware hiện chưa thực hiện gửi lệnh cấu hình radar qua đường này. Việc chọn GPIO27 cho Tilt cũng tránh sử dụng GPIO12, một chân có liên quan đến cấu hình khởi động của ESP32 \[9\].

Hai servo được cấp qua nhánh nguồn 5 V từ adapter 12 V/5 A và bộ hạ áp XL4015 theo cấu hình dự án. Dòng tải tăng khi servo khởi động, đổi hướng hoặc chịu lực cản, nên không cấp nguồn động cơ từ GPIO hay rail 3,3 V của ESP32. Nhánh nguồn servo và khối logic cần có GND chung để tín hiệu PWM sử dụng cùng mốc điện áp. Khả năng cấp dòng phải được đánh giá tại tải, vì thông số adapter không phản ánh đầy đủ sụt áp trên bộ hạ áp, dây dẫn và đầu nối. Khi kiểm tra nguyên mẫu, cần theo dõi điện áp lúc hai servo cùng chuyển động và xác nhận cơ cấu không bị kẹt tại giới hạn quay.

Firmware camera phát luồng tại cổng 81 và cung cấp trạng thái, điều chỉnh cấu hình ảnh tại cổng 82\. Cấu hình mặc định dùng JPEG ở VGA 640 × 480, xung XCLK 20 MHz và hai bộ đệm khi có PSRAM; nếu thiếu PSRAM, firmware chuyển sang QVGA với một bộ đệm. Camera chỉ phục vụ một kết nối stream trực tiếp đồng thời, nên backend giữ vai trò tiếp nhận và phân phối hình ảnh cho dashboard. Thiết kế này giúp các phiên xem không phải cùng mở kết nối riêng tới ESP32-CAM, nhưng băng thông và tải phục vụ nhiều người xem vẫn cần được kiểm chứng tại máy chủ.

\[Vị trí chèn Hình 3.2 tại đây\]

Hình 3.2. Bố trí cụm camera Pan-Tilt, radar cố định và kết nối nguồn, tín hiệu.

Nguồn: Ảnh chụp và sơ đồ do tác giả xây dựng. Gợi ý dùng một ảnh nguyên mẫu kèm sơ đồ nối dây có nhãn GPIO13, GPIO27, GPIO32 và GND chung.

\# 3.3. Thiết kế giải thuật và logic điều khiển

 3.3.1. Đọc radar và điều hướng camera

Firmware ESP32 DevKit tổ chức công việc trong vòng lặp Arduino, chưa tạo các tác vụ FreeRTOS riêng cho từng chức năng. Dữ liệu UART được xử lý bằng bộ đệm trượt 30 byte; khung chỉ được chấp nhận khi có đúng tiêu đề và chuỗi kết thúc. Khi giải mã tọa độ, bit cao nhất biểu diễn dấu theo định dạng của radar, còn các bit còn lại biểu diễn độ lớn; dữ liệu này không được đọc như số nguyên bù hai thông thường. Trong ba vị trí mục tiêu được báo về, firmware chọn mục tiêu đầu tiên có tọa độ Y hợp lệ để dẫn hướng. Cách chọn đơn giản phù hợp với phạm vi một người, nhưng không cung cấp cơ chế bám một cá thể đã định danh khi nhiều mục tiêu cùng xuất hiện.

Tọa độ được lọc EMA với hệ số 0,25 trước khi tính góc đích. Theo chiều lắp cơ cấu hiện tại, góc Pan là 90° trừ góc phương vị atan2(X, Y) sau khi đổi sang độ. Góc Tilt được tính tương tự từ chênh lệch độ cao và khoảng cách ngang; firmware đặt độ cao camera là 1.500 mm và điểm ngắm là 900 mm. Hai giá trị này là giả định của mô hình dẫn hướng, không phải kết quả radar đo độ cao người. Các góc đích được kẹp trong khoảng 10°–170°. Mỗi lần cập nhật, góc lệnh tiến 12% khoảng cách còn lại tới góc đích, nhờ đó chuyển động được làm mượt thay vì đổi góc ngay lập tức.

MANUAL là chế độ khởi tạo; các lệnh LEFT, RIGHT, UP, DOWN dịch góc theo bước 12° ở Pan và 7° ở Tilt, còn RESET đưa cơ cấu về tâm. Trong AUTO, dữ liệu radar mới được ưu tiên dẫn hướng; firmware bỏ qua lệnh bám bằng hình ảnh khi radar vừa cung cấp mục tiêu trong vòng 1,2 giây. Khi radar mất mục tiêu, backend có thể gửi tâm khung bao để hiệu chỉnh theo ảnh. Nhánh thị giác chỉ gửi lệnh nếu độ lệch vượt 15% chiều rộng hoặc chiều cao toàn khung hình, tương ứng ±96 pixel và ±72 pixel ở VGA. Backend quy đổi tọa độ về hệ VGA cho giao thức hiện hành, còn firmware hiệu chỉnh theo sai lệch với hệ số 0,02°/pixel. Khi mục tiêu radar đã có bị mất hơn 3 giây, firmware xóa cờ mục tiêu và đặt góc đích về 90°/90° một lần; các lệnh bám theo ảnh nhận sau đó có thể tiếp tục thay đổi góc đích.

Chương trình tăng bộ đệm UART lên 2.048 byte và đọc dữ liệu trước, sau phần xử lý mạng để giảm nguy cơ bỏ sót khung. Các lần thử kết nối lại được giãn cách, nhưng lời gọi kết nối MQTT vẫn đồng bộ và có thể làm chậm vòng lặp. Khoảng nghỉ 15 ms ở cuối loop không đồng nghĩa với một chu kỳ điều khiển cố định 15 ms. Trạng thái MOVING hoặc STOPPED được suy ra từ quá trình cập nhật góc lệnh và gửi về backend; do không có cảm biến đo góc ngoài, đây là trạng thái chuyển động ước tính, cần phân biệt với phản hồi xác nhận cơ khí đã dừng.

 3.3.2. Phát hiện té ngã theo chuỗi tư thế

Backend sử dụng YOLOv8m-pose để phát hiện người và điểm mốc, kết hợp BoT-SORT để theo dõi. Từ khung bao và các điểm ở vai, hông, đầu, chương trình tính tỷ lệ khung bao, góc thân, vị trí đại diện của thân và các quan hệ đầu–vai, đầu–hông. Góc thân và vị trí thân được làm mượt với hệ số EMA lần lượt 0,6 và 0,7. Mô-đun FallDetector duy trì lịch sử tối đa 5 giây cho từng Track ID; quan sát được sử dụng khi độ tin cậy khung bao đạt ít nhất 0,55 và độ tin cậy trung bình của hai vai, hai hông đạt ít nhất 0,35. Nếu khoảng cách giữa hai quan sát hợp lệ vượt 0,9 giây, lịch sử được đặt lại để tránh suy luận xuyên qua một khoảng mất dấu dài.

Máy trạng thái bắt đầu từ unknown và chỉ xác lập upright khi quan sát được tư thế đứng hoặc ngồi thẳng ổn định ít nhất 0,45 giây. Người đã nằm ngay khi xuất hiện không được tự động coi là vừa té ngã. Sau khi có trạng thái ban đầu, thuật toán tìm dấu hiệu chuyển tiếp sang tư thế suy sụp. Ngã ngang được đánh giá bằng sự kết hợp giữa khung bao rộng, thân nghiêng về phương ngang và mức tụt hoặc tốc độ dịch chuyển của thân. Khuỵu xuống được xem xét khi thân dịch xuống rõ rệt dù vẫn tương đối thẳng. Với gục khi ngồi, thuật toán theo dõi sự thay đổi quan hệ đầu–vai, đầu–hông cùng biến động tư thế. Những nhánh này bổ sung cho nhau để không giới hạn phát hiện vào hình dáng nằm ngang.

Khi đủ dấu hiệu, trạng thái chuyển sang candidate thay vì phát cảnh báo ngay. Ứng viên phải tồn tại ít nhất 0,70 giây ở nhánh thông thường hoặc 1,20 giây ở nhánh gục từ từ, đồng thời còn thỏa điều kiện tư thế suy sụp và giới hạn biến động tại thời điểm xác nhận. Cách xử lý hiện tại không đo một khoảng bất động liên tục kéo dài toàn bộ thời gian chờ. Ứng viên không còn thỏa điều kiện sẽ hết hạn; sau xác nhận, cơ chế cooldown 4 giây và trạng thái recovery hạn chế cảnh báo lặp, đồng thời cho phép tiếp tục đánh giá khi người tự phục hồi. Các ngưỡng chuyển động đều phải được hiểu theo đại lượng chuẩn hóa của thuật toán, không được diễn giải thành vận tốc rơi đo bằng m/s.

Trình tự trên giúp phân biệt một biến cố quan sát được với tư thế nằm đơn thuần, nhưng tạo ra một đánh đổi: người đã ngã trước khi vào khung hình hoặc bị che khuất trong pha chuyển tiếp có thể không được xác nhận. Tương tự, các dấu hiệu gục được suy ra từ hình ảnh không đủ để xác định nguyên nhân sức khỏe. Các ngưỡng hiện tại là quy tắc heuristic của nguyên mẫu; độ phù hợp phải được đánh giá bằng những tình huống sinh hoạt và mô phỏng té ngã trong không gian sử dụng, thay vì lấy độ chính xác của YOLO làm độ chính xác của bộ phát hiện sự cố.

\[Vị trí chèn Hình 3.3 tại đây\]

Hình 3.3. Máy trạng thái phát hiện té ngã từ chuỗi quan sát tư thế.

Nguồn: Tác giả xây dựng từ mô-đun FallDetector. Gợi ý thể hiện unknown, upright, observed\_horizontal, candidate, confirmed và recovery; ghi điều kiện chuyển chính và thời gian xác nhận, tránh đưa toàn bộ ngưỡng nhỏ lên sơ đồ.

 3.3.3. Xử lý camera quay, mất dấu và nhiều người

Camera quay làm tọa độ điểm mốc dịch chuyển ngay cả khi người đứng yên, nên biến động trong ảnh không thể luôn được quy cho chuyển động cơ thể. Backend sử dụng trạng thái servo để tạm chặn việc hình thành ứng viên té ngã mới trong lúc camera di chuyển. Nếu đang có ứng viên, thời điểm bắt đầu chờ được đặt lại theo quan sát khi camera còn quay, tránh tính thời gian quay vào thời gian xác nhận. Cơ chế này giảm khả năng báo nhầm do dịch chuyển toàn khung hình, nhưng có thể làm chậm hoặc bỏ qua sự cố xảy ra đúng lúc camera điều hướng. Chất lượng tín hiệu MOVING, STOPPED vì vậy ảnh hưởng trực tiếp tới bộ phát hiện.

Khi Track ID thay đổi trong một khoảng ngắn, backend có thể tiếp nối lịch sử nếu chỉ có một người, camera không quay, nguồn video không thay đổi và hai khung bao có quan hệ không gian phù hợp. Đây là quy tắc duy trì vết trong tình huống giới hạn, không phải cơ chế tái định danh người bằng đặc trưng sinh trắc học. Nếu không đủ điều kiện, đối tượng phải được đánh giá lại từ lịch sử mới. Khi có từ hai người với điểm mốc thân đủ tin cậy, backend tạm ngừng đánh giá té ngã và hiển thị MUTED. Tuy nhiên, firmware vẫn có thể bám mục tiêu radar trong AUTO; không thể coi cơ chế này là khóa toàn bộ điều hướng hoặc là giải pháp đầy đủ cho giám sát nhiều người.

 3.3.4. Ngữ cảnh vùng phòng và xử lý cảnh báo

Backend chuyển tọa độ radar sang hệ phòng theo vị trí lắp đặt (x\_r, y\_r) và góc xoay θ. Theo quy ước chiều quay đang dùng trong mã, phép đổi là x\_phòng \= x\_r \+ Xcosθ \+ Ysinθ và y\_phòng \= y\_r − Xsinθ \+ Ycosθ. Kết quả được đối chiếu với các vùng chữ nhật SAFE và DANGER do người vận hành cấu hình. Việc phân vùng phải dựa trên vị trí thực tế và dấu trục đã kiểm tra; cấu hình sai có thể khiến một vị trí trên sàn bị coi là vùng nghỉ hoặc khiến cảnh báo xuất hiện ở sai khu vực.

SAFE biểu diễn khu vực nghỉ có chủ đích, chẳng hạn mặt giường. Khi mục tiêu radar thuộc SAFE, dữ liệu còn mới trong vòng 2 giây và không đồng thời thuộc DANGER, backend xóa lịch sử phát hiện té ngã của đối tượng đang đánh giá và hiển thị SAFE ZONE. Đây là cách dùng vị trí để hạn chế báo nhầm khi nằm nghỉ, nhưng cũng làm hệ thống không đánh giá té ngã trong vùng đó. Do chưa ghép định danh giữa radar và ảnh, ngữ cảnh SAFE không bảo đảm gắn đúng người trong tình huống nhiều mục tiêu. Vùng nghỉ cần được giới hạn đúng diện tích thực, tránh bao phủ sàn hoặc lối đi chỉ để giảm báo động giả.

Khi mục tiêu vào DANGER, backend tạo sự kiện cảnh báo vùng nguy hiểm; đây là cảnh báo vị trí, không phải xác nhận té ngã. Chức năng đi lại ban đêm theo dõi mục tiêu di chuyển liên tục ngoài SAFE hơn 5 phút trong khung 23:00–05:00, sử dụng thời gian của máy chủ triển khai. Các sự kiện này cung cấp thêm ngữ cảnh cho người chăm sóc nhưng cần được hiển thị bằng tên riêng để tránh nhầm mức độ và nguyên nhân cảnh báo.

Với sự kiện té ngã mới được xác nhận, backend chuyển ảnh và thông tin liên quan tới khối xử lý cảnh báo để lưu snapshot, ghi metadata vào SQLite và đẩy thông báo qua WebSocket. Nếu đã cấu hình Telegram, máy chủ gửi thông điệp kèm ảnh; thời gian giãn cách tối thiểu giữa các lần gửi là 60 giây. Giới hạn này giảm thông báo lặp nhưng có thể khiến một sự kiện tiếp theo không tạo tin nhắn ngay. Backend cũng phát lệnh ON, OFF tới topic còi dự phòng; firmware hiện chưa có phần điều khiển chân còi, nên cảnh báo âm thanh tại chỗ chưa được xem là chức năng đã hoàn tất.

Người dùng có thể thực hiện cử chỉ đưa hai cổ tay lên trên vai và gần nhau theo phương ngang để đặt lại trạng thái phát hiện khi nghi ngờ báo động giả. Khi nhận cử chỉ, backend đặt lại các biến trạng thái và hiển thị ALARM CANCELED trên hình ảnh, đồng thời phát lệnh OFF tới topic dự phòng. Thao tác này không xóa sự kiện đã lưu và không thu hồi tin nhắn Telegram đã gửi. Việc xác nhận đã xem cảnh báo trên dashboard cũng là một thao tác riêng. Phân biệt các hành vi này giúp nhật ký phản ánh sự cố đã được phát hiện, ngay cả khi người dùng sau đó cho rằng đó là báo động giả.

\[Vị trí chèn Hình 3.4 tại đây\]

Hình 3.4. Chuyển đổi tọa độ radar và vai trò của vùng SAFE, DANGER trong xử lý sự kiện.

Nguồn: Tác giả xây dựng. Gợi ý thể hiện radar lệch góc so với trục phòng, một vùng giường SAFE và một vùng nguy hiểm DANGER; nối ngữ cảnh SAFE với nhánh tạm ngừng đánh giá té ngã.

\# 3.4. Tổ chức phần mềm, giao tiếp và lưu trữ

 3.4.1. Luồng xử lý đa tiến trình

Backend gồm tiến trình web và hai tiến trình con camera\_process, ai\_process. Tiến trình camera duy trì kết nối HTTP tới ESP32-CAM, tách ảnh JPEG từ luồng và gửi JPEG thô cho nhánh xem trực tiếp. Những khung được chọn cho AI được giải mã bằng OpenCV rồi chuyển sang tiến trình suy luận. Các hàng đợi ảnh có dung lượng một phần tử và ưu tiên thay ảnh cũ bằng ảnh mới. Tiến trình AI chạy mô hình pose, theo dõi, đánh giá té ngã và trao đổi MQTT, sau đó trả ảnh có chú giải, dữ liệu khung bao, điểm mốc và sự kiện cho tiến trình web. Một số cờ và chỉ số nhỏ được chia sẻ qua vùng nhớ multiprocessing để các tiến trình cập nhật trạng thái vận hành.

Luồng xem trực tiếp và luồng suy luận được tách để tốc độ hiển thị không phụ thuộc hoàn toàn vào AI. Tốc độ đưa khung vào nhánh suy luận được điều chỉnh theo thời gian xử lý quan sát được và không vượt trần AI\_FPS\_LIMIT, mặc định 15 FPS. Đây là giới hạn cấu hình, không phải tốc độ đầu ra được bảo đảm. Mã cũng có lựa chọn runtime tăng tốc theo phần cứng và phương án dự phòng; lợi ích thực tế cần đo với mô hình, bộ xử lý và độ phân giải đang dùng. Việc giảm tồn đọng hàng đợi có thể làm hình ảnh mới hơn, nhưng số khung được phân tích ít đi cũng có thể ảnh hưởng việc quan sát các chuyển tiếp ngắn.

Một luồng watchdog trong tiến trình web kiểm tra các tiến trình con khoảng mỗi 3 giây và khởi tạo lại tiến trình đã dừng. Cơ chế này hỗ trợ phục hồi khi worker kết thúc bất thường, nhưng không tự phát hiện mọi trường hợp tiến trình vẫn còn sống mà không tạo kết quả. Vì vậy, các chỉ số về thời điểm khung hình gần nhất, hoạt động AI và độ mới của radar cần được theo dõi cùng trạng thái tiến trình. Tách tiến trình và giới hạn hàng đợi là các biện pháp tăng khả năng vận hành, chưa đủ để kết luận hệ thống đã đạt độ ổn định liên tục 24/7.

\[Vị trí chèn Hình 3.5 tại đây\]

Hình 3.5. Luồng video trực tiếp, luồng suy luận và giao tiếp giữa các tiến trình backend.

Nguồn: Tác giả xây dựng từ kiến trúc phần mềm. Gợi ý thể hiện JPEG thô đi vào nhánh xem trực tiếp, ảnh giải mã đi vào AI, hàng đợi ảnh dung lượng một phần tử và hàng đợi sự kiện riêng; đặt watchdog trong tiến trình web.

 3.4.2. Giao tiếp giữa thiết bị, backend và dashboard

MQTT được tổ chức theo nhóm chức năng: embedded/radar/data mang tọa độ và vận tốc; embedded/servo/mode chọn chế độ; embedded/servo/manual mang lệnh bước; embedded/servo/tracking mang tọa độ tâm ảnh; embedded/servo/status mang trạng thái chuyển động ước tính. Với firmware hiện tại, backend dùng giao thức legacy\_step để gửi đúng các lệnh mà thiết bị hỗ trợ. Các bản tin vị trí và lệnh bước chủ yếu dùng QoS 0, còn bản tin chế độ do backend phát dùng QoS 1 và retained để thiết bị có thể nhận lại chế độ khi kết nối. Việc lựa chọn này không đồng nghĩa mọi lệnh đều được xác nhận đã thực thi, vì firmware hiện chưa cung cấp phản hồi đầy đủ cho từng thao tác.

Các giao tiếp HTTP cung cấp luồng xem trực tiếp, luồng có chú giải và các API truy vấn dữ liệu phát hiện, tình trạng video, radar, cấu hình. Lệnh chuyển chế độ hoặc quay camera được backend kiểm tra trước khi chuyển xuống thiết bị. Các lệnh bước được giới hạn tần suất và không xếp thành chuỗi chuyển động chờ lâu, nhằm giảm nguy cơ camera tiếp tục quay sau khi ý định điều khiển đã thay đổi. WebSocket tại /api/v1/ws/alerts đẩy các sự kiện và thông báo tình trạng hệ thống; radar và một số chỉ số video vẫn được dashboard truy vấn định kỳ. Do đó, độ mới của dữ liệu phải được xác định theo thời điểm cập nhật của từng kênh, không chỉ dựa vào việc trình duyệt còn mở.

 3.4.3. Lưu trữ và phạm vi truy cập

SQLite lưu metadata sự kiện, các bản ghi radar và cấu hình phòng, vùng giám sát. Bảng alerts hiện chứa thời điểm, mã sự kiện, nội dung và đường dẫn ảnh; bảng radar\_logs chứa tọa độ và vận tốc; room\_config chứa kích thước phòng, vị trí và góc radar; zones\_config biểu diễn vùng chữ nhật bằng các giới hạn tọa độ. Snapshot được lưu thành tệp riêng, còn cơ sở dữ liệu giữ đường dẫn để truy xuất khi cần. Việc tách ảnh khỏi metadata giúp cấu trúc dữ liệu sự kiện gọn hơn và thuận lợi khi quản lý tệp ảnh theo thời gian.

Giao diện nhật ký hiện nhận các cảnh báo qua WebSocket và giữ danh sách trong trạng thái React. Thao tác đánh dấu đã xem hoặc xóa danh sách trên giao diện chưa tương đương với việc cập nhật, xóa lịch sử SQLite. Cơ sở dữ liệu có thể lưu sự kiện bền vững, nhưng giao diện hiện chưa hoàn tất luồng tải lại và xác nhận lịch sử đó sau khi mở một phiên mới. Đây là giới hạn của chức năng quản lý sự kiện cần phân biệt với cơ chế lưu snapshot và metadata ở backend.

Xử lý cục bộ hạn chế việc phải gửi toàn bộ video tới dịch vụ suy luận bên ngoài. Tuy nhiên, hình ảnh vẫn được thu, lưu và có thể gửi qua Telegram, nên quyền riêng tư phụ thuộc cách cấp quyền và quản lý dữ liệu. Theo phương án triển khai của dự án, Tailscale hỗ trợ truy cập qua mạng riêng; ứng dụng hiện chưa có đăng nhập và phân quyền riêng, do đó quyền truy cập chủ yếu được kiểm soát ở lớp mạng. Việc mở dashboard cho thiết bị từ xa cần đi kèm giới hạn đối tượng được phép xem và điều khiển. Đây là phần quản lý vận hành cần thiết để hệ thống giám sát không trở thành một nguồn truy cập hình ảnh ngoài ý muốn.

\# 3.5. Thiết kế giao diện giám sát

Màn hình chính đặt video và trạng thái nhận diện cạnh các nút điều khiển Pan-Tilt. Người vận hành có thể chọn AUTO, MANUAL, quay theo bốn hướng hoặc đưa camera về tâm. Các thông tin về tốc độ camera, tốc độ AI và kết nối giúp phân biệt tình trạng video đang chạy với tình trạng thuật toán đang thực sự phân tích. Đặc biệt, việc hiển thị MUTED, SAFE ZONE hoặc dữ liệu cũ cần được hiểu là điều kiện hạn chế giám sát, tránh tạo cảm giác hệ thống đang bảo vệ đầy đủ chỉ vì vẫn có hình ảnh trên màn hình.

Bản đồ radar ở trang phân tích sử dụng SVG để biểu diễn mặt bằng phòng, vị trí radar, tọa độ mục tiêu và các vùng cấu hình. Người dùng có thể điều chỉnh vùng chữ nhật và đối chiếu vị trí trên bản đồ với vị trí thực tế để kiểm tra hiệu chuẩn. Vùng quét hiển thị là minh họa theo cấu hình, không phải bản đồ đo thực nghiệm về khả năng phát hiện tại từng điểm. Vết di chuyển trên giao diện hỗ trợ quan sát lịch sử gần trong phiên, nhưng không nên được xem là quỹ đạo đã xác định chính xác danh tính một người.

Trang cài đặt cho phép chọn địa chỉ backend và cập nhật nguồn ESP32-CAM; cấu hình phòng, vùng được lưu qua các API tương ứng. Khả năng hiệu chuẩn servo qua giao diện còn phụ thuộc giao thức firmware: bản legacy\_step hiện tại không hỗ trợ áp dụng cấu hình servo qua MQTT, nên các tham số này phải được sửa trong sketch và nạp lại. Một số lựa chọn giao diện mới chỉ được lưu trong trình duyệt, chưa đồng bộ với khối xử lý. Mô tả giao diện vì vậy cần căn cứ vào luồng chức năng đã hoạt động, thay vì xem mọi trường nhập là một tính năng đã hoàn chỉnh.

\[Vị trí chèn Hình 3.6 tại đây\]

Hình 3.6. Giao diện giám sát video và cấu hình bản đồ phòng trên nguyên mẫu.

Nguồn: Ảnh chụp màn hình hệ thống của tác giả. Gợi ý dùng hai ảnh cùng một hình, gồm màn hình video–điều khiển và bản đồ radar–vùng giám sát, với dữ liệu của cùng một tình huống thử nghiệm.

Thiết kế trên tạo cơ sở cho việc triển khai và đánh giá nguyên mẫu theo từng khối. Phần thực nghiệm tiếp theo cần làm rõ khả năng điều hướng tại các vị trí trong phòng, phân biệt các tình huống sinh hoạt với té ngã, độ trễ cảnh báo và hành vi khi mất dữ liệu hoặc có nhiều người. Kết quả đo sẽ cho phép xác định mức đáp ứng của hệ thống và những giới hạn còn phải cải thiện, thay vì suy ra hiệu quả vận hành chỉ từ việc tích hợp đủ các thành phần.

 Tài liệu tham khảo

\[1\] World Health Organization. “Falls”. 26/04/2021. https\://www\.who.int/news-room/fact-sheets/detail/falls

\[2\] Tổng cục Thống kê và Quỹ Dân số Liên Hợp Quốc. Già hóa dân số và người cao tuổi ở Việt Nam. 2021\. https\://www\.nso.gov.vn/wp-content/uploads/2021/08/Dan-so-gia-hoaVI.pdf

\[3\] Vu Quang Tuyen, Bui Ngoc Dung, Nguyen Huu Nghia, Chu Tran Dai và Viet Dung Nguyen. “Vision Based Fall Detection for the Elderly People”. Kỷ yếu AITC 2020, tr. 79–85. https\://dost.hochiminhcity.gov.vn/documents/1217/AITC2020\_Proceedings.pdf

\[4\] Ng, P. H., Mai, A. và Nguyen, H. “Building an AI-Powered IoT App for Fall Detection Using Yolov8 Approach”. Intelligence of Things: Technologies and Applications, 2023, tr. 65–74. DOI: 10.1007/978-3-031-46749-3\_7. https\://link.springer.com/chapter/10.1007/978-3-031-46749-3\_7

\[5\] Do, T. N. và Le, T. T. “A new design of a fall detection system integrating landmark identification and deep learning techniques”. Vietnam Journal of Science, Technology and Engineering, 68(1), 2026\. DOI: 10.31276/VJSTE.2024.0138. https\://vietnamscience.vjst.vn/index.php/vjste/article/view/1333

\[6\] Lu, N., Wu, Y., Feng, L. và Song, J. “Deep Learning for Fall Detection: Three-Dimensional CNN Combined With LSTM on Video Kinematic Data”. IEEE Journal of Biomedical and Health Informatics, 23(1), 2019, tr. 314–323. DOI: 10.1109/JBHI.2018.2808281. https\://pubmed.ncbi.nlm.nih.gov/29994460/

\[7\] Jin, F., Sengupta, A. và Cao, S. “mmFall: Fall Detection Using 4-D mmWave Radar and a Hybrid Variational RNN AutoEncoder”. IEEE Transactions on Automation Science and Engineering, 19(2), 2022, tr. 1245–1257. DOI: 10.1109/TASE.2020.3042158. https\://arxiv.org/abs/2003.02386

\[8\] Hi-Link. “HLK-LD2450”. Trang sản phẩm và tài liệu mô-đun. https\://www\.hlktech.net/index.php?id=1182

\[9\] Espressif Systems. ESP32 Series Datasheet. https\://documentation.espressif.com/esp32\_datasheet\_en.pdf

\[10\] Espressif Systems. “ESP32 Camera Driver”. https\://github.com/espressif/esp32-camera

\[11\] Texas Instruments. The fundamentals of millimeter wave radar sensors. https\://www\.ti.com/lit/wp/spyy005a/spyy005a.pdf

\[12\] Ultralytics. “Pose Estimation”. https\://docs.ultralytics.com/tasks/pose/

\[13\] Ultralytics. “Multi-Object Tracking”. https\://docs.ultralytics.com/modes/track/

\[14\] OASIS. MQTT Version 3.1.1. 2014\. https\://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html

\[15\] Python Software Foundation. “multiprocessing — Process-based parallelism”. https\://docs.python.org/3/library/multiprocessing.html