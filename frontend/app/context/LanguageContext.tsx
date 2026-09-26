"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "vi";

type Dictionary = {
  [key: string]: string;
};

const translations: Record<Language, Dictionary> = {
  en: {
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
    "live.incidentLogs": "Incident Logs",
    "live.noAnomalies": "No anomalies detected.",
    "live.acknowledge": "Acknowledge",
    "live.acknowledged": "Acknowledged",
    
    // Camera Control Panel
    "cam.ptzControls": "PTZ Controls",
    "cam.mode": "Mode:",
    "cam.manualMode": "Manual Mode",
    "cam.autoTracking": "Auto Tracking",
    "cam.autoActive": "Auto-Tracking Active",
    "cam.autoDesc": "Camera automatically tracks movement.",

    // Radar Analytics
    "radar.title": "Radar Spatial Analytics",
    "radar.subtitle": "Map configuration and live tracking",
    "radar.saveConfig": "Save Config",
    "radar.saving": "Saving...",
    "radar.configureMap": "Configure Map",
    "radar.roomDims": "1. Room Dimensions & Radar Placement",
    "radar.roomWidth": "Room Width (X)",
    "radar.roomLength": "Room Length (Y)",
    "radar.radarPosX": "Radar Pos X",
    "radar.radarPosY": "Radar Pos Y",
    "radar.radarYaw": "Radar Yaw (Rotate)",
    "radar.zoneConstraints": "2. Zone Constraints",
    "radar.infoText": "Adjust values above and watch the live minimap preview update instantly. Check if the Radar coverage arc covers your zones properly.",
    "radar.patientStatus": "Patient Status",
    "radar.stable": "Stable / Resting",
    "radar.continuousActive": "Continuous monitoring active",
    "radar.roomEnv": "Room Environment",
    "radar.radarAt": "Radar at",
    "radar.sensorStatus": "Sensor Status",
    "radar.online": "LD2450 ONLINE",
    "radar.multiTarget": "Multi-target tracking enabled",
    "radar.liveMap": "Live spatial map",
    "radar.clearTrail": "Clear Trail",
    "radar.recordTrail": "Record Trail",
    "radar.recording": "Recording...",
    "radar.refresh": "Refresh",

    // Incident Logs
    "logs.title": "Incident Logs",
    "logs.subtitle": "Historical records of system alerts",
    "logs.clearLogs": "Clear Logs",
    "logs.ackSelected": "Ack Selected",
    "logs.searchPlaceholder": "Search time or message...",
    "logs.allStatus": "All Status",
    "logs.unack": "Unacknowledged",
    "logs.ack": "Acknowledged",
    "logs.noMatch": "No incidents match your criteria.",
    "logs.time": "Time",
    "logs.eventType": "Event Type",
    "logs.message": "Message",
    "logs.status": "Status",

    // System Settings
    "settings.title": "System Settings",
    "settings.subtitle": "Manage AI, Connectivity, Storage, and Integrations",
    "settings.saveChanges": "Save Changes",
    "settings.aiAlgo": "AI Fall Detection Algorithm",
    "settings.sensitivity": "Sensitivity Threshold",
    "settings.sensitivityDesc": "Higher sensitivity detects falls faster but may cause more false alarms. Lower sensitivity is stricter and waits for clearer movement data before triggering an alert.",
    "settings.multiTarget": "Multi-Target Tracking",
    "settings.multiTargetDesc": "Allow Radar to track up to 3 people simultaneously in the room.",
    "settings.camServer": "Camera & Server Endpoints",
    "settings.camIp": "ESP32 Camera IP Address",
    "settings.backendUrl": "Backend API URL",
    "settings.integrations": "3rd Party Integrations (Push Notifications)",
    "settings.teleToken": "Telegram Bot Token",
    "settings.teleTokenDesc": "Required to send instant fall alerts and video snapshots directly to a Telegram group or doctor's chat.",
    "settings.teleChatId": "Telegram Chat ID",
    "settings.teleChatIdDesc": "The Token authenticates the bot, while the Chat ID tells the bot exactly which user or group to send the alert to.",
    "settings.zaloToken": "Zalo ZNS API Key (Optional)",
    "settings.storage": "Storage Management (Danger Zone)",
    "settings.clearDb": "Clear Database Logs",
    "settings.clearDbDesc": "Permanently delete all historical fall detection logs, radar tracks, and telemetry data from the backend database. This frees up disk space.",
    "settings.clearDbBtn": "Clear Database",
    
    // Alerts (Backend overrides)
    "alert.FALL_DETECTED": "Alert: Patient fall detected!",
    "alert.SYSTEM_ERROR": "System error occurred.",
  },
  vi: {
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
    "live.incidentLogs": "Nhật ký sự cố",
    "live.noAnomalies": "Không phát hiện bất thường.",
    "live.acknowledge": "Xác nhận",
    "live.acknowledged": "Đã xác nhận",
    
    // Camera Control Panel
    "cam.ptzControls": "Điều khiển Camera",
    "cam.mode": "Chế độ:",
    "cam.manualMode": "Thủ công",
    "cam.autoTracking": "Theo dõi tự động",
    "cam.autoActive": "Đang theo dõi tự động",
    "cam.autoDesc": "Camera đang tự động xoay theo chuyển động.",

    // Radar Analytics
    "radar.title": "Phân tích không gian Radar",
    "radar.subtitle": "Cấu hình bản đồ và theo dõi trực tiếp",
    "radar.saveConfig": "Lưu cấu hình",
    "radar.saving": "Đang lưu...",
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

    // Alerts (Backend overrides)
    "alert.FALL_DETECTED": "Cảnh báo: Phát hiện bệnh nhân bị ngã!",
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
      setLanguage(saved);
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
