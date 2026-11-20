/**
 * Smart Grade Calculator - THPT & University Admission Calculation Engine
 * Chuẩn Quy chế Thi Tốt Nghiệp THPT & Tuyển sinh Đại học Bộ GD&ĐT
 */
const THPTCalculator = (function() {
  'use strict';

  /**
   * Tính điểm xét tốt nghiệp THPT
   * Công thức Bộ GD&ĐT:
   * ĐiểmTN = [((Tổng 4 bài thi / 4) * 7 + (ĐTB Lớp 12 * 3)) / 10] + (Điểm KK / 4) + Điểm UT
   */
  function calculateGraduation(data) {
    const { toan, van, anh, tohop, tb12, kk = 0, ut = 0 } = data;

    const scores = [toan, van, anh, tohop, tb12];
    if (scores.some(v => typeof v !== 'number' || isNaN(v) || v < 0 || v > 10)) {
      return {
        success: false,
        error: 'Vui lòng nhập đầy đủ và hợp lệ điểm các bài thi và TB lớp 12 (từ 0 đến 10).'
      };
    }

    // Điểm liệt: <= 1.0 điểm
    const isLiet = [toan, van, anh, tohop].some(v => v <= 1.0);
    const tong4Bai = toan + van + anh + tohop;
    const avg4Bai = tong4Bai / 4;

    const diemTN = (((avg4Bai * 7) + (tb12 * 3)) / 10) + (kk / 4) + ut;
    const rounded = Math.round(diemTN * 100) / 100;
    const isPass = !isLiet && rounded >= 5.0;

    return {
      success: true,
      diemTN,
      rounded,
      isLiet,
      isPass,
      avg4Bai: Math.round(avg4Bai * 100) / 100,
      tb12,
      kk,
      ut
    };
  }

  /**
   * Tính điểm xét tuyển Đại học (Khối 3 môn)
   * Tích hợp quy chế cộng điểm ưu tiên giảm dần khi tổng điểm đạt >= 22.5:
   * Điểm UT = [(30 - Tổng điểm đạt được) / 7.5] * Mức điểm ưu tiên quy định
   */
  function calculateUniversity(data) {
    const { m1, m2, m3, kv = 0, dt = 0, khoi = 'D01' } = data;

    const scores = [m1, m2, m3];
    if (scores.some(v => typeof v !== 'number' || isNaN(v) || v < 0 || v > 10)) {
      return {
        success: false,
        error: 'Vui lòng nhập đầy đủ điểm 3 môn từ 0 đến 10.'
      };
    }

    const rawSum = m1 + m2 + m3;
    const baseUt = (Number(kv) || 0) + (Number(dt) || 0);

    // Quy chế tuyển sinh ĐH: Từ 22.5 điểm trở lên, mức ưu tiên giảm dần
    let adjustedUt = baseUt;
    if (rawSum >= 22.5 && baseUt > 0) {
      adjustedUt = ((30 - rawSum) / 7.5) * baseUt;
    }
    adjustedUt = Math.max(0, adjustedUt);

    const total = rawSum + adjustedUt;
    const rounded = Math.round(total * 100) / 100;

    return {
      success: true,
      khoi,
      rawSum: Math.round(rawSum * 100) / 100,
      baseUt: Math.round(baseUt * 100) / 100,
      adjustedUt: Math.round(adjustedUt * 100) / 100,
      total: rounded,
      isDecreasedUt: rawSum >= 22.5 && baseUt > 0
    };
  }

  return {
    calculateGraduation,
    calculateUniversity
  };
})();

if (typeof window !== 'undefined') {
  window.THPTCalculator = THPTCalculator;
}
