"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "vi";

type Dictionary = {
  [key: string]: string;
};

const translations: Record<Language, Dictionary> = {
  en: {
    // Desktop Only
    "common.version": "Version",
    "common.desktopRequired": "Desktop Required",
    "common.desktopRequiredDesc": "This feature requires a larger screen. Please access it via a desktop or tablet.",
    
    // Sidebar
    "nav.liveView": "Live View",
    "nav.radarAnalytics": "Radar Analytics",
    "nav.incidentLogs": "Incident Logs",
    "nav.systemSettings": "System Settings",
    "sidebar.monitoring": "Monitoring",
    "sidebar.systemStatus": "System Status",
    "sidebar.online": "Online",

    // Live View (Dashboard)
    "live.connected": "CONNECTED",
    "live.reconnecting": "RECONNECTING",
    "live.noSignal": "NO SIGNAL DETECTED",
    "live.streamWaiting": "Camera stream unavailable. Reconnecting...",
    "live.rawVideo": "Live",
    "live.aiOverlay": "AI overlay",
    "live.incidentLogs": "Incident Logs",
    "live.noAnomalies": "No anomalies detected.",
    "live.acknowledge": "Acknowledge",
    "live.acknowledged": "Acknowledged",
    
    // Camera Control Panel
    "cam.ptzControls": "PTZ Controls",
    "cam.mode": "Mode:",
    "cam.manualMode": "Manual Mode",
    "cam.autoTracking": "Auto Tracking",
    "cam.autoActive": "ESP32 received AUTO",
    "cam.autoDesc": "The servo follows radar targets when its wiring, power, and mechanics are working.",
    "cam.autoPending": "Waiting for ESP32 to confirm AUTO",
    "cam.autoPendingDesc": "Check the ESP32 Wi-Fi/MQTT connection if this message persists.",
    "cam.modeUnknown": "Camera mode has not been confirmed by the backend.",
    "cam.backendUnavailable": "Cannot connect to the backend. Check that it is running at:",
    "cam.requestFailed": "The backend did not confirm this command. Check the backend and MQTT logs:",
    "cam.stopUnconfirmed": "STOP could not be confirmed. Check the connection and whether the servo is still moving.",
    "cam.angleLimit": "has reached the configured angle limit. Move in the opposite direction or return to center.",
    "cam.legacyHint": "Step control: each press changes PAN by 12° or TILT by 7°. Holding does not repeat; release cannot cancel a sent step.",
    "cam.legacyAuto": "Requested mode: AUTO",
    "cam.legacyUnverified": "This firmware does not report online status, angles or mode confirmation. Check movement and Serial Monitor on the ESP32.",
    "servo.legacyUnsupported": "The supplied step firmware does not support remote calibration or TEST commands. Change limits, direction and geometry in the sketch, then flash the ESP32 DevKit.",
    "cam.retry": "Retry connection",

    // Radar Analytics
    "radar.title": "Radar Analytics",
    "radar.subtitle": "Map configuration and live tracking",
    "radar.saveConfig": "Save Config",
    "radar.saving": "Saving...",
    "radar.saved": "Configuration saved",
    "radar.saveFailed": "Could not save configuration",
    "radar.configureMap": "Map Setup",
    "radar.roomDims": "1. ROOM DIMENSIONS & RADAR POS",
    "radar.roomWidth": "Width (X)",
    "radar.roomLength": "Length (Y)",
    "radar.radarPosX": "Radar Pos (X)",
    "radar.radarPosY": "Radar Pos (Y)",
    "radar.radarYaw": "Radar Yaw",
    "radar.zoneConstraints": "2. SAFE ZONE CONSTRAINTS",
    "radar.infoText": "Adjust parameters and watch the minimap update instantly. Ensure radar field covers desired areas.",
    "radar.patientStatus": "Patient Status",
    "radar.stable": "Stable / Resting",
    "radar.continuousActive": "Continuous monitoring active",
    "radar.roomEnv": "Room Environment",
    "radar.radarAt": "Radar located at",
    "radar.sensorStatus": "Sensor Status",
    "radar.online": "LD2450 ONLINE",
    "radar.multiTarget": "Multi-target tracking enabled",
    "radar.liveMap": "Live Spatial Map",
    "radar.clearTrail": "Clear Trail",
    "radar.recordTrail": "Record Trail",
    "radar.recording": "Recording...",
    "radar.refresh": "Refresh",
    "radar.mapLiveStatus": "Live radar",
    "radar.mapStatus.loading": "Connecting to radar data...",
    "radar.mapStatus.live": "Radar is tracking a target",
    "radar.mapStatus.waiting": "No radar coordinates received. Check whether new_bytes, frames, and published increase in the ESP32 Serial Monitor.",
    "radar.mapStatus.stale": "Radar target updates stopped. Check the sensor and MQTT connection.",
    "radar.mapStatus.offline": "Cannot reach the radar status API.",
    "radar.pointInSafeZone": "INSIDE SAFE ZONE — {zone}",
    "radar.pointInDangerZone": "INSIDE DANGER ZONE — {zone}",
    "radar.pointOutsideZones": "OUTSIDE SAFE AND DANGER ZONES",
    "radar.backendZoneState": "Backend evaluation",
    "radar.zoneOutsideRoom": "{count} zone(s) extend outside the room. Use the numeric fields to bring them inside.",
    "radar.invalidZone": "Check each zone: min must be below max, and the zone must stay inside the room.",
    "radar.mapAccessibleLabel": "Radar room map with editable safe and danger zones",
    "radar.mapEditHint": "Drag a colored zone to reposition it; use the fields on the left to resize it. Save the configuration when finished.",
    "radar.mapStatusHint": "The target dot appears only while radar data is fresh.",
    "radar.targetMarker": "Patient position",

    // Incident Logs
    "logs.title": "Incident Logs",
    "logs.subtitle": "History of alerts and fall detections",
    "logs.clearLogs": "Clear Logs",
    "logs.ackSelected": "Acknowledge Selected",
    "logs.searchPlaceholder": "Search by time or message...",
    "logs.allStatus": "All Statuses",
    "logs.unack": "Unacknowledged",
    "logs.ack": "Acknowledged",
    "logs.noMatch": "No logs match your search.",
    "logs.time": "Time",
    "logs.eventType": "Event Type",
    "logs.message": "Message",
    "logs.status": "Status",

    // System Settings
    "settings.title": "System Settings",
    "settings.subtitle": "Manage AI, Connectivity, Storage, and Notifications",
    "settings.saveChanges": "Save Changes",
    "settings.aiAlgo": "Fall Detection AI Algorithm",
    "settings.sensitivity": "Sensitivity Level",
    "settings.sensitivityDesc": "High sensitivity detects falls faster but may cause false alarms. Low sensitivity requires clearer movement.",
    "settings.multiTarget": "Multi-Target Tracking",
    "settings.multiTargetDesc": "Allow Radar to detect and track up to 3 people simultaneously in the room.",
    "settings.camServer": "Camera & Backend Connectivity",
    "settings.camIp": "ESP32 Camera IP Address",
    "settings.camIpHint": "Use the IP printed by the ESP32-CAM Serial Monitor. Saving reconnects the backend camera stream.",
    "settings.cameraSaveFailed": "Browser settings saved, but the backend did not accept the camera IP. Check the backend URL and camera IP.",
    "settings.saved": "Settings saved.",
    "settings.backendUrl": "Backend API URL",
    "settings.integrations": "Third-Party Integrations",
    "settings.teleToken": "Telegram Bot Token",
    "settings.teleTokenDesc": "Required to send instant fall alerts with images to a Telegram group or doctor.",
    "settings.teleChatId": "Telegram Chat ID",
    "settings.teleChatIdDesc": "Target chat or group ID that will receive the alerts.",
    "settings.zaloToken": "Zalo ZNS API Key (Optional)",
    "settings.storage": "Storage Management (Danger Zone)",
    "settings.clearDb": "Clear Database Logs",
    "settings.clearDbDesc": "Permanently delete all historical fall detection logs, radar tracks, and telemetry data from the backend database. This frees up disk space.",
    "settings.clearDbBtn": "Clear Database",
    "servo.calibrationTitle": "Servo calibration and diagnostics",
    "servo.calibrationHint": "Use MANUAL mode and check the mechanism before testing. TEST moves one axis by 8° and returns. Changes are saved on the ESP32; no reflashing is needed.",
    "servo.parameter": "Parameter",
    "servo.newValue": "New value",
    "servo.currentValue": "Current",
    "servo.apply": "Apply on ESP32",
    "servo.commandFailed": "ESP32 rejected the command.",
    "servo.pending": "The broker received the command; ESP32 has not confirmed it.",
    "servo.applied": "ESP32 confirmed the command.",
    "servo.backendUnavailable": "Cannot reach the backend. Check its address and port 8000.",
    "servo.lastAck": "Latest device reply",
    
    // Alerts (Backend overrides)
    "alert.FALL_DETECTED": "Alert: Patient fall detected!",
    "alert.DANGER_ZONE": "Warning: A target entered a danger zone.",
    "alert.NIGHT_WANDERING": "Warning: Movement continued outside the safe zone at night.",
    "alert.SYSTEM_ERROR": "System error occurred.",
  },
  vi: {
    // Desktop Only
    "common.version": "Phiên bản",
    "common.desktopRequired": "Chỉ hỗ trợ Máy tính",
    "common.desktopRequiredDesc": "Tính năng này cần không gian hiển thị lớn. Vui lòng truy cập bằng máy tính PC hoặc Tablet.",

    // Sidebar
    "nav.liveView": "Giám sát trực tiếp",
    "nav.radarAnalytics": "Cấu hình thiết bị",
    "nav.incidentLogs": "Nhật ký sự cố",
    "nav.systemSettings": "Cài đặt hệ thống",
    "sidebar.monitoring": "Điều hướng",
    "sidebar.systemStatus": "Trạng thái hệ thống",
    "sidebar.online": "Trực tuyến",

    // Live View (Dashboard)
    "live.connected": "ĐÃ KẾT NỐI",
    "live.reconnecting": "ĐANG KẾT NỐI LẠI",
    "live.noSignal": "KHÔNG CÓ TÍN HIỆU",
    "live.streamWaiting": "Mất luồng camera. Đang kết nối lại...",
    "live.rawVideo": "Trực tiếp",
    "live.aiOverlay": "Lớp phủ AI",
    "live.incidentLogs": "Nhật ký sự cố",
    "live.noAnomalies": "Không phát hiện bất thường.",
    "live.acknowledge": "Xác nhận",
    "live.acknowledged": "Đã xác nhận",
    
    // Camera Control Panel
    "cam.ptzControls": "Điều khiển Camera",
    "cam.mode": "Chế độ:",
    "cam.manualMode": "Thủ công",
    "cam.autoTracking": "Theo dõi tự động",
    "cam.autoActive": "ESP32 đã nhận chế độ AUTO",
    "cam.autoDesc": "Servo sẽ bám tọa độ radar khi dây tín hiệu, nguồn và cơ cấu quay hoạt động đúng.",
    "cam.autoPending": "Đang chờ ESP32 xác nhận AUTO",
    "cam.autoPendingDesc": "Nếu chờ quá lâu, hãy kiểm tra Wi-Fi/MQTT và Serial Monitor của ESP32.",
    "cam.modeUnknown": "Backend chưa xác nhận chế độ camera.",
    "cam.backendUnavailable": "Không kết nối được backend. Kiểm tra backend đang chạy tại:",
    "cam.requestFailed": "Backend chưa xác nhận lệnh. Kiểm tra log backend và MQTT:",
    "cam.stopUnconfirmed": "Chưa xác nhận được lệnh STOP. Hãy kiểm tra kết nối và servo có còn quay không.",
    "cam.angleLimit": "đã tới giới hạn góc cấu hình. Nhấn hướng ngược lại hoặc đưa về giữa.",
    "cam.legacyHint": "Điều khiển từng bước: mỗi lần nhấn đổi PAN 12° hoặc TILT 7°. Giữ nút không lặp; nhả nút không hủy bước đã gửi.",
    "cam.legacyAuto": "Chế độ yêu cầu: AUTO",
    "cam.legacyUnverified": "Firmware này không báo online, góc hay xác nhận chế độ. Kiểm tra chuyển động và Serial Monitor trên ESP32.",
    "servo.legacyUnsupported": "Firmware từng bước bạn gửi không hỗ trợ hiệu chỉnh từ xa hay lệnh TEST. Sửa giới hạn, chiều quay và hình học trong sketch rồi nạp lại ESP32 DevKit.",
    "cam.retry": "Thử kết nối lại",

    // Radar Analytics
    "radar.title": "Phân tích không gian Radar",
    "radar.subtitle": "Cấu hình bản đồ và theo dõi trực tiếp",
    "radar.saveConfig": "Lưu cấu hình",
    "radar.saving": "Đang lưu...",
    "radar.saved": "Đã lưu cấu hình",
    "radar.saveFailed": "Không lưu được cấu hình",
    "radar.configureMap": "Thiết lập bản đồ",
    "radar.roomDims": "1. Kích thước phòng & Vị trí Radar",
    "radar.roomWidth": "Chiều rộng (X)",
    "radar.roomLength": "Chiều dài (Y)",
    "radar.radarPosX": "Vị trí Radar (X)",
    "radar.radarPosY": "Vị trí Radar (Y)",
    "radar.radarYaw": "Góc quay Radar",
    "radar.zoneConstraints": "2. Cấu hình Vùng an toàn",
    "radar.infoText": "Điều chỉnh các thông số trên và xem bản đồ thu nhỏ cập nhật ngay lập tức. Hãy đảm bảo vùng quét của Radar bao phủ đúng khu vực mong muốn.",
    "radar.patientStatus": "Trạng thái bệnh nhân",
    "radar.stable": "Ổn định / Đang nghỉ",
    "radar.continuousActive": "Hệ thống đang giám sát liên tục",
    "radar.roomEnv": "Thông số không gian",
    "radar.radarAt": "Radar đặt tại",
    "radar.sensorStatus": "Trạng thái cảm biến",
    "radar.online": "LD2450 TRỰC TUYẾN",
    "radar.multiTarget": "Đang bật theo dõi đa mục tiêu",
    "radar.liveMap": "Bản đồ không gian",
    "radar.clearTrail": "Xóa quỹ đạo",
    "radar.recordTrail": "Lưu quỹ đạo",
    "radar.recording": "Đang ghi hình...",
    "radar.refresh": "Làm mới",
    "radar.mapLiveStatus": "Radar đang hoạt động",
    "radar.mapStatus.loading": "Đang kết nối dữ liệu radar...",
    "radar.mapStatus.live": "Radar đang theo dõi mục tiêu",
    "radar.mapStatus.waiting": "Chưa nhận được tọa độ radar. Trên Serial Monitor ESP32, kiểm tra new_bytes, frames và published có tăng không.",
    "radar.mapStatus.stale": "Tọa độ radar đã ngừng cập nhật. Kiểm tra cảm biến và kết nối MQTT.",
    "radar.mapStatus.offline": "Không kết nối được API trạng thái radar.",
    "radar.pointInSafeZone": "TRONG VÙNG AN TOÀN — {zone}",
    "radar.pointInDangerZone": "TRONG VÙNG NGUY HIỂM — {zone}",
    "radar.pointOutsideZones": "NGOÀI VÙNG AN TOÀN VÀ NGUY HIỂM",
    "radar.backendZoneState": "Backend đang đánh giá",
    "radar.zoneOutsideRoom": "Có {count} vùng vượt ra ngoài kích thước phòng. Hãy dùng các ô số để đưa vùng vào trong phòng.",
    "radar.invalidZone": "Kiểm tra từng vùng: giá trị MIN phải nhỏ hơn MAX và vùng phải nằm trong phòng.",
    "radar.mapAccessibleLabel": "Bản đồ phòng radar có thể chỉnh sửa vùng an toàn và nguy hiểm",
    "radar.mapEditHint": "Kéo vùng màu để đổi vị trí; dùng các ô số bên trái để đổi kích thước. Nhấn Lưu cấu hình khi hoàn tất.",
    "radar.mapStatusHint": "Chấm mục tiêu chỉ hiện khi dữ liệu radar còn mới.",
    "radar.targetMarker": "Vị trí bệnh nhân",

    // Incident Logs
    "logs.title": "Nhật ký sự cố",
    "logs.subtitle": "Lịch sử cảnh báo và phát hiện té ngã",
    "logs.clearLogs": "Xóa nhật ký",
    "logs.ackSelected": "Xác nhận đã chọn",
    "logs.searchPlaceholder": "Tìm kiếm thời gian hoặc nội dung...",
    "logs.allStatus": "Tất cả trạng thái",
    "logs.unack": "Chưa xác nhận",
    "logs.ack": "Đã xác nhận",
    "logs.noMatch": "Không có dữ liệu nào khớp với tìm kiếm.",
    "logs.time": "Thời gian",
    "logs.eventType": "Loại sự kiện",
    "logs.message": "Nội dung chi tiết",
    "logs.status": "Trạng thái",

    // System Settings
    "settings.title": "Cài đặt hệ thống",
    "settings.subtitle": "Quản lý AI, Kết nối, Lưu trữ và Tích hợp thông báo",
    "settings.saveChanges": "Lưu thay đổi",
    "settings.aiAlgo": "Thuật toán AI phát hiện té ngã",
    "settings.sensitivity": "Độ nhạy",
    "settings.sensitivityDesc": "Độ nhạy cao giúp phát hiện té ngã nhanh hơn nhưng có thể gây báo động giả. Độ nhạy thấp sẽ khắt khe hơn, cần chuyển động rõ ràng để kích hoạt cảnh báo.",
    "settings.multiTarget": "Theo dõi đa mục tiêu",
    "settings.multiTargetDesc": "Cho phép Radar nhận diện và theo dõi tối đa 3 người cùng lúc trong phòng.",
    "settings.camServer": "Kết nối Camera & Máy chủ",
    "settings.camIp": "Địa chỉ IP Camera ESP32",
    "settings.camIpHint": "Nhập IP ESP32-CAM in trên Serial Monitor. Nhấn Lưu để backend kết nối lại stream.",
    "settings.cameraSaveFailed": "Đã lưu cài đặt trình duyệt, nhưng backend chưa nhận IP camera. Kiểm tra URL backend và IP camera.",
    "settings.saved": "Đã lưu cài đặt.",
    "settings.backendUrl": "Đường dẫn API Backend",
    "settings.integrations": "Tích hợp bên thứ 3 ",
    "settings.teleToken": "Telegram Bot Token",
    "settings.teleTokenDesc": "Bắt buộc để hệ thống gửi cảnh báo té ngã tức thì kèm hình ảnh vào nhóm Telegram hoặc trực tiếp cho bác sĩ.",
    "settings.teleChatId": "Telegram Chat ID",
    "settings.teleChatIdDesc": "Token dùng để xác thực Bot, còn Chat ID chỉ định chính xác nhóm hoặc người sẽ nhận được cảnh báo.",
    "settings.zaloToken": "Zalo ZNS API Key (Tùy chọn)",
    "settings.storage": "Quản lý dữ liệu lưu trữ",
    "settings.clearDb": "Xóa toàn bộ dữ liệu",
    "settings.clearDbDesc": "Xóa vĩnh viễn toàn bộ lịch sử cảnh báo, quỹ đạo di chuyển và dữ liệu lưu trong cơ sở dữ liệu. Giúp giải phóng bộ nhớ hệ thống.",
    "settings.clearDbBtn": "Xóa dữ liệu",
    "servo.calibrationTitle": "Hiệu chỉnh và chẩn đoán servo",
    "servo.calibrationHint": "Chuyển sang THỦ CÔNG và kiểm tra cơ cấu trước khi thử. TEST dịch từng trục 8° rồi quay về. Giá trị được lưu trên ESP32, không cần nạp lại.",
    "servo.parameter": "Thông số",
    "servo.newValue": "Giá trị mới",
    "servo.currentValue": "Hiện tại",
    "servo.apply": "Áp dụng trên ESP32",
    "servo.commandFailed": "ESP32 từ chối lệnh.",
    "servo.pending": "Broker đã nhận lệnh nhưng ESP32 chưa xác nhận.",
    "servo.applied": "ESP32 đã xác nhận lệnh.",
    "servo.backendUnavailable": "Không kết nối được backend. Kiểm tra địa chỉ và cổng 8000.",
    "servo.lastAck": "Phản hồi mới nhất từ thiết bị",

    // Alerts (Backend overrides)
    "alert.FALL_DETECTED": "Cảnh báo: Phát hiện bệnh nhân bị ngã!",
    "alert.DANGER_ZONE": "Cảnh báo: Có mục tiêu đi vào vùng nguy hiểm.",
    "alert.NIGHT_WANDERING": "Cảnh báo: Phát hiện di chuyển liên tục ngoài vùng an toàn ban đêm.",
    "alert.SYSTEM_ERROR": "Đã xảy ra lỗi hệ thống.",
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("vi");

  useEffect(() => {
    const saved = localStorage.getItem("fallguard_lang");
    if (saved === "en" || saved === "vi") {
      const frame = requestAnimationFrame(() => setLanguage(saved));
      return () => cancelAnimationFrame(frame);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("fallguard_lang", lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
