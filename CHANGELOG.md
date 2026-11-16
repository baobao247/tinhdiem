# Tính Điểm Học Tập & THPT — Changelog & Architecture Report

## 1. Deep Audit & Bugs Fixed
- **Công thức điểm ưu tiên Bộ GD&ĐT 2025**: Chuẩn hóa chính xác công thức giảm dần điểm ưu tiên cho thí sinh đạt điểm cao (>= 22.5) theo quy chế tuyển sinh chính thức.
- **Kiểm tra điểm liệt**: Bổ sung cảnh báo điểm liệt (<= 1.0 điểm) ở từng môn thi tốt nghiệp THPT, tự động gán kết quả Trượt tốt nghiệp khi có môn bị liệt.
- **Tối ưu hóa bảng tính GPA**: Xử lý mượt mà khi xóa toàn bộ môn học hoặc nhập điểm trống, không còn hiển thị lỗi NaN.

---

## 2. Kiến trúc Tái Cấu Trúc (Architecture Refactoring)
Phân tách cấu trúc nguyên khối thành các module độc lập:
```
tinhdiem/
├── css/
│   └── style.css            # Toàn bộ theme sáng/tối, biến màu, bảng điểm, print stylesheet
├── js/
│   ├── thpt-calculator.js   # Phân hệ tính điểm Xét tốt nghiệp THPT & Xét tuyển Đại học
│   └── app.js               # Bảng tính GPA học tập (HK2, Cuối kỳ, TB năm, Tín chỉ ĐH), History
├── index.html               # File HTML5 ngữ nghĩa, gọn gàng và tương thích cao
└── CHANGELOG.md             # Tài liệu kiểm toán và hướng dẫn sử dụng
```

---

## 3. Cải tiến UI/UX & Hiệu năng
- **Hỗ trợ in ấn chuyên nghiệp (@media print)**: Khi bấm nút "In bảng điểm", trình duyệt tự động ẩn toàn bộ header, tab, nút xóa, chỉ in bảng điểm và kết quả đẹp mắt.
- **Chuyển đổi linh hoạt Thang điểm 10 / Thang điểm 100**: Hỗ trợ cả hai hệ thống thang điểm phổ biến ở trường phổ thông và quốc tế.

---

## 4. Tính năng mới bổ sung
1. **🎓 Quy đổi Thang điểm 4 & Điểm chữ (A, B+, B, C, D, F)**:
   - Tự động quy đổi điểm trung bình tích lũy sang hệ tín chỉ đại học 4.0 và thang điểm chữ theo chuẩn đào tạo đại học Việt Nam.
2. **🏛️ Phân hệ Xét Tuyển Đại Học (Khối A00, A01, B00, C00, D01, D07)**:
   - Tự động đổi tên môn thi theo từng khối ngành và tính tổng điểm xét tuyển đại học chuẩn xác.
3. **🖨️ Xuất / In Bảng Điểm trực tiếp**: Nút Print 1-click tạo báo cáo kết quả học tập nhanh chóng.