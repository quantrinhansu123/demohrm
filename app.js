// ========================================================
// TRANG WAY - HỆ THỐNG QUẢN LÝ CUNG ỨNG LAO ĐỘNG
// JAVASCRIPT LOGIC & STATE MANAGEMENT
// ========================================================

// Initial Database State (Matching Word Specifications & Images)
const state = {
  currentRole: 'DIRECTOR', // DIRECTOR, VICE_DIRECTOR, ACCOUNTANT, RECRUITER, LEAD_SALES
  currentView: 'desktop-orders',
  currentModule: 'orders',
  currentTeam: 'vinh-phuc',
  currentTeamTab: 'kpi',
  currentFactory: 'WESUM',
  currentFactoryTab: 'overview',
  currentCycle: 'T10-2026',
  currentCycleTab: 'orders',

  cycles: {
    'T10-2026': {
      id: 'T10-2026',
      title: 'Chu kỳ Tháng 10/2026',
      quarter: 'Quý 4/2026',
      range: '01/10/2026 – 31/10/2026',
      deadline: '05/11/2026',
      status: 'Đang diễn ra',
      statusClass: 'success',
      target: 120,
      actual: 78,
      pct: '65.0%',
      progressText: 'Tiến độ chu kỳ: 65.0% (Còn 26 ngày)',
      revenue: '545.000.000 VNĐ',
      expense: '380.000.000 VNĐ',
      profit: '165.000.000 VNĐ (30.2%)',
      totalDays: '1.450 ngày công',
      advance: '6.000.000 VNĐ',
      advanceCount: 12
    },
    'T11-2026': {
      id: 'T11-2026',
      title: 'Chu kỳ Tháng 11/2026',
      quarter: 'Quý 4/2026',
      range: '01/11/2026 – 30/11/2026',
      deadline: '05/12/2026',
      status: 'Chưa bắt đầu',
      statusClass: 'warning',
      target: 140,
      actual: 0,
      pct: '0.0%',
      progressText: 'Chu kỳ sắp tới · Đang nhận kế hoạch từ nhà máy',
      revenue: '0 VNĐ',
      expense: '0 VNĐ',
      profit: 'Dự kiến: 185.000.000 VNĐ',
      totalDays: '0 ngày công',
      advance: '0 VNĐ',
      advanceCount: 0
    },
    'T12-2026': {
      id: 'T12-2026',
      title: 'Chu kỳ Tháng 12/2026',
      quarter: 'Quý 4/2026',
      range: '01/12/2026 – 31/12/2026',
      deadline: '05/01/2027',
      status: 'Chưa bắt đầu',
      statusClass: 'warning',
      target: 160,
      actual: 0,
      pct: '0.0%',
      progressText: 'Chu kỳ cao điểm cuối năm',
      revenue: '0 VNĐ',
      expense: '0 VNĐ',
      profit: 'Dự kiến: 210.000.000 VNĐ',
      totalDays: '0 ngày công',
      advance: '0 VNĐ',
      advanceCount: 0
    },
    'Q4-2026': {
      id: 'Q4-2026',
      title: 'Tổng quan Toàn Quý 4/2026',
      quarter: 'Quý 4/2026',
      range: '01/10/2026 – 31/12/2026',
      deadline: '05/01/2027',
      status: 'Đang diễn ra',
      statusClass: 'success',
      target: 420,
      actual: 78,
      pct: '18.6%',
      progressText: 'Tổng hợp 3 tháng T10 + T11 + T12',
      revenue: '545.000.000 VNĐ',
      expense: '380.000.000 VNĐ',
      profit: '165.000.000 VNĐ',
      totalDays: '1.450 ngày công',
      advance: '6.000.000 VNĐ',
      advanceCount: 12
    },
    'Q3-2026': {
      id: 'Q3-2026',
      title: 'Tổng quan Toàn Quý 3/2026',
      quarter: 'Quý 3/2026',
      range: '01/07/2026 – 30/09/2026',
      deadline: '05/10/2026',
      status: 'Đã hoàn tất',
      statusClass: 'info',
      target: 350,
      actual: 342,
      pct: '97.7%',
      progressText: 'Đã hoàn tất quyết toán và thanh lý hợp đồng Quý 3',
      revenue: '1.480.000.000 VNĐ',
      expense: '1.020.000.000 VNĐ',
      profit: '460.000.000 VNĐ (31.1%)',
      totalDays: '8.920 ngày công',
      advance: '45.000.000 VNĐ',
      advanceCount: 85
    },
    'T9-2026': {
      id: 'T9-2026',
      title: 'Chu kỳ Tháng 9/2026',
      quarter: 'Quý 3/2026',
      range: '01/09/2026 – 30/09/2026',
      deadline: '05/10/2026',
      status: 'Đã khóa sổ',
      statusClass: 'info',
      target: 110,
      actual: 108,
      pct: '98.2%',
      progressText: 'Đã đối soát chấm công và thanh toán đủ',
      revenue: '490.000.000 VNĐ',
      expense: '340.000.000 VNĐ',
      profit: '150.000.000 VNĐ (30.6%)',
      totalDays: '2.850 ngày công',
      advance: '14.500.000 VNĐ',
      advanceCount: 28
    },
    'T8-2026': {
      id: 'T8-2026',
      title: 'Chu kỳ Tháng 8/2026',
      quarter: 'Quý 3/2026',
      range: '01/08/2026 – 31/08/2026',
      deadline: '05/09/2026',
      status: 'Đã khóa sổ',
      statusClass: 'info',
      target: 120,
      actual: 116,
      pct: '96.7%',
      progressText: 'Đã quyết toán hoàn tất',
      revenue: '510.000.000 VNĐ',
      expense: '350.000.000 VNĐ',
      profit: '160.000.000 VNĐ (31.4%)',
      totalDays: '3.100 ngày công',
      advance: '16.000.000 VNĐ',
      advanceCount: 30
    },
    'T7-2026': {
      id: 'T7-2026',
      title: 'Chu kỳ Tháng 7/2026',
      quarter: 'Quý 3/2026',
      range: '01/07/2026 – 31/07/2026',
      deadline: '05/08/2026',
      status: 'Đã khóa sổ',
      statusClass: 'info',
      target: 120,
      actual: 118,
      pct: '98.3%',
      progressText: 'Đã thanh toán đủ hoa hồng & lương',
      revenue: '480.000.000 VNĐ',
      expense: '330.000.000 VNĐ',
      profit: '150.000.000 VNĐ (31.2%)',
      totalDays: '2.970 ngày công',
      advance: '14.500.000 VNĐ',
      advanceCount: 27
    }
  },

  factories: {
    'WESUM': {
      code: 'WESUM',
      name: 'Công ty TNHH WESUM Việt Nam',
      avatar: 'W',
      colorClass: 'blue',
      address: 'KCN Khai Quang, TP. Vĩnh Yên, Vĩnh Phúc',
      hotline: '0211 3868 999',
      lead: 'Trần Thu Hà',
      target: 50,
      actual: 38,
      pct: '76.0%',
      attRate: '98%',
      attDetail: '37/38 công nhân đã check-in · 1 người đi muộn',
      geofenceRadius: 50,
      rate: '280.000đ',
      revenue: '220.000.000 VNĐ',
      gps: { lat: '21.3129', lng: '105.6022', address: 'Cổng số 1, KCN Khai Quang, TP. Vĩnh Yên, Vĩnh Phúc' },
      orders: [
        { code: 'DH-WESUM-01', name: 'Công nhân lắp ráp linh kiện điện tử', count: 35, filled: 28, pct: '80.0%', shift: 'Ca ngày (08:00 - 17:00)', salary: '6.500.000 - 8.500.000đ', status: 'Đang tuyển' },
        { code: 'DH-WESUM-02', name: 'QC Ngoại quan linh kiện SMT', count: 15, filled: 10, pct: '66.7%', shift: '2 ca xoay vòng', salary: '7.500.000 - 9.500.000đ', status: 'Đang tuyển' }
      ],
      vendors: [
        { name: 'Vendor DJC Hải Dương', count: 20, lead: 'Nguyễn Văn Minh', phone: '0912 345 678', status: 'Đang cấp' },
        { name: 'Vendor Nam An Vĩnh Phúc', count: 18, lead: 'Lê Văn An', phone: '0988 777 666', status: 'Đang cấp' }
      ]
    },
    'OJTEK': {
      code: 'OJTEK',
      name: 'Công ty TNHH Điện tử OJTEK Việt Nam',
      avatar: 'O',
      colorClass: 'indigo',
      address: 'KCN Bá Thiện 2, Huyện Bình Xuyên, Vĩnh Phúc',
      hotline: '0211 3599 888',
      lead: 'Vũ Văn Cường',
      target: 35,
      actual: 24,
      pct: '68.6%',
      attRate: '96%',
      attDetail: '23/24 công nhân đã check-in · 1 người xin phép',
      geofenceRadius: 60,
      rate: '320.000đ',
      revenue: '150.000.000 VNĐ',
      gps: { lat: '21.3412', lng: '105.6421', address: 'Tòa nhà A2, KCN Bá Thiện 2, Bình Xuyên, Vĩnh Phúc' },
      orders: [
        { code: 'DH-OJTEK-01', name: 'Kỹ thuật viên vận hành máy SMT', count: 20, filled: 14, pct: '70.0%', shift: 'Ca 1 (08:00 - 17:00)', salary: '7.000.000 - 9.000.000đ', status: 'Đang tuyển' },
        { code: 'DH-OJTEK-02', name: 'QC Kiểm định ngoại quan', count: 15, filled: 10, pct: '66.7%', shift: 'Ca 1 (08:00 - 17:00)', salary: '7.200.000 - 8.800.000đ', status: 'Đang tuyển' }
      ],
      vendors: [
        { name: 'Vendor Hải Phòng Tech', count: 12, lead: 'Phạm Minh Hùng', phone: '0934 111 222', status: 'Đang cấp' },
        { name: 'Tuyển dụng nội bộ VP', count: 12, lead: 'Vũ Văn Cường', phone: '0912 345 678', status: 'Đang cấp' }
      ]
    },
    'SUNGJEE': {
      code: 'SUNGJEE',
      name: 'Công ty TNHH SUNGJEE Việt Nam',
      avatar: 'S',
      colorClass: 'cyan',
      address: 'KCN Bình Xuyên 1, Hương Canh, Vĩnh Phúc',
      hotline: '0211 3712 333',
      lead: 'Đỗ Minh Thắng',
      target: 20,
      actual: 15,
      pct: '75.0%',
      attRate: '100%',
      attDetail: '15/15 công nhân đã check-in đúng giờ',
      geofenceRadius: 50,
      rate: '290.000đ',
      revenue: '95.000.000 VNĐ',
      gps: { lat: '21.2891', lng: '105.6602', address: 'Lô C5, KCN Bình Xuyên, Hương Canh, Vĩnh Phúc' },
      orders: [
        { code: 'DH-SUNGJEE-01', name: 'Công nhân đóng gói sản phẩm', count: 20, filled: 15, pct: '75.0%', shift: 'Ca hành chính', salary: '6.500.000 - 8.000.000đ', status: 'Đang tuyển' }
      ],
      vendors: [
        { name: 'Vendor Việt Trì', count: 8, lead: 'Ngô Thanh Sơn', phone: '0945 666 777', status: 'Đang cấp' },
        { name: 'Tuyển dụng nội bộ VP', count: 7, lead: 'Đỗ Minh Thắng', phone: '0977 654 321', status: 'Đang cấp' }
      ]
    },
    'AMO': {
      code: 'AMO',
      name: 'Công ty Cổ phần AMO Việt Nam',
      avatar: 'A',
      colorClass: 'pink',
      address: 'KCN Quang Minh, Mê Linh, Hà Nội',
      hotline: '024 3818 6666',
      lead: 'Nguyễn Tiến Đạt',
      target: 15,
      actual: 12,
      pct: '80.0%',
      attRate: '95%',
      attDetail: '11/12 công nhân đã check-in · 1 người xin phép',
      geofenceRadius: 50,
      rate: '270.000đ',
      revenue: '80.000.000 VNĐ',
      gps: { lat: '21.2156', lng: '105.7893', address: 'Lô 38B, KCN Quang Minh, Mê Linh, Hà Nội' },
      orders: [
        { code: 'DH-AMO-01', name: 'Công nhân dây chuyền sản xuất linh kiện', count: 15, filled: 12, pct: '80.0%', shift: 'Ca ngày (08:00 - 17:00)', salary: '6.800.000 - 8.500.000đ', status: 'Đang tuyển' }
      ],
      vendors: [
        { name: 'Tuyển dụng nội bộ Hà Nội', count: 12, lead: 'Nguyễn Tiến Đạt', phone: '0904 555 888', status: 'Đang cấp' }
      ]
    }
  },

  teams: {
    'vinh-phuc': {
      id: 'vinh-phuc',
      name: 'Nhóm Tuyển dụng Vĩnh Phúc',
      lead: 'Trần Thu Hà',
      subtitle: 'Trưởng nhóm: Trần Thu Hà · 3 thành viên · Phụ trách 3 nhà máy trọng điểm',
      target: 105,
      actual: 52,
      pct: '49.5%',
      factoryCount: 3,
      factoryList: 'WESUM, OJTEK, SUNGJEE',
      factoryStatus: '2 đúng tiến độ · 1 chậm nhẹ',
      weeklyCandidate: 14,
      weeklyInterview: 8,
      weeklyWaiting: 6,
      members: [
        { name: 'Trần Thu Hà', role: 'Trưởng nhóm Tuyển dụng VP', target: 45, actual: 26, progress: '57.8%', passRate: '92%', avatar: 'TH', colorClass: 'teal', rating: 'Xuất sắc', phone: '0988 123 456' },
        { name: 'Vũ Văn Cường', role: 'Chuyên viên Tuyển dụng & Điều phối', target: 35, actual: 16, progress: '45.7%', passRate: '88%', avatar: 'VC', colorClass: 'blue', rating: 'Tốt', phone: '0912 345 678' },
        { name: 'Đỗ Minh Thắng', role: 'Chuyên viên Tuyển dụng', target: 25, actual: 10, progress: '40.0%', passRate: '85%', avatar: 'DT', colorClass: 'purple', rating: 'Cần đẩy mạnh', phone: '0977 654 321' }
      ],
      orders: [
        { factory: 'WESUM Việt Nam (KCN Khai Quang)', orderName: 'Lắp ráp linh kiện Đợt 10', lead: 'Trần Thu Hà', target: 50, actual: 28, pct: '56.0%', status: 'Đang chạy' },
        { factory: 'OJTEK Việt Nam (KCN Bá Thiện 2)', orderName: 'QC Ngoại quan & Vận hành', lead: 'Vũ Văn Cường', target: 35, actual: 16, pct: '45.7%', status: 'Đang chạy' },
        { factory: 'SUNGJEE Việt Nam (KCN Bình Xuyên)', orderName: 'Công nhân Đóng gói T10', lead: 'Đỗ Minh Thắng', target: 20, actual: 8, pct: '40.0%', status: 'Chậm tiến độ' }
      ],
      interviews: [
        { candidate: 'Nguyễn Văn Nam', phone: '0987 112 233', factory: 'WESUM (Lắp ráp)', date: '06/10/2026 09:00', recruiter: 'Trần Thu Hà', status: 'Đã hẹn' },
        { candidate: 'Trần Thị Thu', phone: '0912 334 455', factory: 'OJTEK (QC)', date: '06/10/2026 14:00', recruiter: 'Vũ Văn Cường', status: 'Đã hẹn' },
        { candidate: 'Lê Văn Bảy', phone: '0978 556 677', factory: 'SUNGJEE (Đóng gói)', date: '07/10/2026 09:30', recruiter: 'Đỗ Minh Thắng', status: 'Chờ duyệt' }
      ]
    },
    'ha-noi': {
      id: 'ha-noi',
      name: 'Nhóm Tuyển dụng Hà Nội',
      lead: 'Nguyễn Tiến Đạt',
      subtitle: 'Trưởng nhóm: Nguyễn Tiến Đạt · 2 thành viên · Phụ trách 1 nhà máy trọng điểm',
      target: 45,
      actual: 26,
      pct: '57.8%',
      factoryCount: 1,
      factoryList: 'AMO (KCN Quang Minh)',
      factoryStatus: '1 đúng tiến độ',
      weeklyCandidate: 8,
      weeklyInterview: 5,
      weeklyWaiting: 3,
      members: [
        { name: 'Nguyễn Tiến Đạt', role: 'Trưởng nhóm Tuyển dụng HN', target: 25, actual: 15, progress: '60.0%', passRate: '90%', avatar: 'ND', colorClass: 'green', rating: 'Xuất sắc', phone: '0904 555 888' },
        { name: 'Lê Hoàng Yến', role: 'Chuyên viên Tuyển dụng', target: 20, actual: 11, progress: '55.0%', passRate: '87%', avatar: 'LY', colorClass: 'amber', rating: 'Tốt', phone: '0936 123 789' }
      ],
      orders: [
        { factory: 'AMO Việt Nam (KCN Quang Minh)', orderName: 'Công nhân sản xuất linh kiện', lead: 'Nguyễn Tiến Đạt', target: 45, actual: 26, pct: '57.8%', status: 'Đang chạy' }
      ],
      interviews: [
        { candidate: 'Hoàng Văn Khiêm', phone: '0904 123 789', factory: 'AMO (Sản xuất)', date: '06/10/2026 10:00', recruiter: 'Nguyễn Tiến Đạt', status: 'Đã hẹn' },
        { candidate: 'Vũ Thị Phương', phone: '0936 889 900', factory: 'AMO (Sản xuất)', date: '07/10/2026 15:00', recruiter: 'Lê Hoàng Yến', status: 'Đã hẹn' }
      ]
    }
  },
  
  workers: [
    { id: 1, code: 'NLD-001', name: 'Trần Văn Long', phone: '0981 234 567', hometown: 'Vĩnh Phúc', citizen_id: '026094001234', company: 'WESUM', position: 'Công nhân lắp ráp', type: 'Thời vụ', recruiter: 'Trần Thu Hà', status: 'Đang làm', daily_rate: 280000, worked_days: 5, advance: 500000, avatarColor: 'avatar-blue', initials: 'TL' },
    { id: 2, code: 'NLD-002', name: 'Lê Thị Mai', phone: '0972 345 678', hometown: 'Phú Thọ', citizen_id: '025198005678', company: 'WESUM', position: 'Công nhân lắp ráp', type: 'Thời vụ', recruiter: 'Trần Thu Hà', status: 'Đang làm', daily_rate: 280000, worked_days: 5, advance: 0, avatarColor: 'avatar-rose', initials: 'LM' },
    { id: 3, code: 'NLD-003', name: 'Nguyễn Văn Tuấn', phone: '0912 888 999', hometown: 'Tuyên Quang', citizen_id: '008092003456', company: 'OJTEK', position: 'QC ngoại quan', type: 'Chính thức', recruiter: 'Vũ Văn Cường', status: 'Đang làm', daily_rate: 320000, worked_days: 5, advance: 0, avatarColor: 'avatar-indigo', initials: 'NT' },
    { id: 4, code: 'NLD-004', name: 'Hoàng Thị Hoa', phone: '0966 111 222', hometown: 'Yên Bái', citizen_id: '015195007890', company: 'OJTEK', position: 'Vận hành máy', type: 'Thời vụ', recruiter: 'Vũ Văn Cường', status: 'Đang làm', daily_rate: 300000, worked_days: 4, advance: 300000, avatarColor: 'avatar-purple', initials: 'HH' },
    { id: 5, code: 'NLD-005', name: 'Đỗ Văn Hùng', phone: '0933 444 555', hometown: 'Hà Nội', citizen_id: '001099002345', company: 'SUNGJEE', position: 'Công nhân đóng gói', type: 'Chính thức', recruiter: 'Đỗ Minh Thắng', status: 'Đang làm', daily_rate: 290000, worked_days: 5, advance: 0, avatarColor: 'avatar-emerald', initials: 'ĐH' },
    { id: 6, code: 'NLD-006', name: 'Phạm Thị Lan', phone: '0944 555 666', hometown: 'Vĩnh Phúc', citizen_id: '026197008765', company: 'AMO', position: 'Công nhân sản xuất', type: 'Thời vụ', recruiter: 'Vũ Văn Cường', status: 'Đang làm', daily_rate: 270000, worked_days: 3, advance: 200000, avatarColor: 'avatar-amber', initials: 'PL' },
    { id: 7, code: 'NLD-007', name: 'Bùi Đức Anh', phone: '0988 999 000', hometown: 'Bắc Giang', citizen_id: '024096004321', company: 'WESUM', position: 'QC ngoại quan', type: 'Thời vụ', recruiter: 'Vendor DJC', status: 'Chờ đi làm', daily_rate: 300000, worked_days: 0, advance: 0, avatarColor: 'avatar-teal', initials: 'BA' },
    { id: 8, code: 'NLD-008', name: 'Vũ Thị Hạnh', phone: '0977 888 111', hometown: 'Thái Nguyên', citizen_id: '019194006543', company: 'AMO', position: 'Công nhân sản xuất', type: 'Thời vụ', recruiter: 'Vũ Văn Cường', status: 'Không đi làm', daily_rate: 270000, worked_days: 0, advance: 0, avatarColor: 'avatar-cyan', initials: 'VH' }
  ],

  attendances: [
    { code: 'NLD-001', name: 'Trần Văn Long', company: 'WESUM (KCN Khai Quang)', shift: 'Ca 1 (08:00 - 17:00)', in: '07:50', out: '17:05', gps: '21.3129, 105.6022 (Cách 15m)', days: '1.0 công', status: 'PRESENT' },
    { code: 'NLD-002', name: 'Lê Thị Mai', company: 'WESUM (KCN Khai Quang)', shift: 'Ca 1 (08:00 - 17:00)', in: '07:55', out: '17:00', gps: '21.3128, 105.6021 (Cách 10m)', days: '1.0 công', status: 'PRESENT' },
    { code: 'NLD-003', name: 'Nguyễn Văn Tuấn', company: 'OJTEK (KCN Bá Thiện 2)', shift: 'Ca 1 (08:00 - 17:00)', in: '08:12', out: '17:00', gps: '21.3412, 105.6421 (Cách 20m)', days: '1.0 công', status: 'LATE' },
    { code: 'NLD-004', name: 'Hoàng Thị Hoa', company: 'OJTEK (KCN Bá Thiện 2)', shift: 'Ca 1 (08:00 - 17:00)', in: '07:48', out: '17:10', gps: '21.3410, 105.6420 (Cách 30m)', days: '1.0 công', status: 'PRESENT' },
    { code: 'NLD-005', name: 'Đỗ Văn Hùng', company: 'SUNGJEE (KCN Bình Xuyên)', shift: 'Ca 1 (08:00 - 17:00)', in: '07:52', out: '17:00', gps: '21.2891, 105.6602 (Cách 12m)', days: '1.0 công', status: 'PRESENT' },
    { code: 'NLD-006', name: 'Phạm Thị Lan', company: 'AMO (KCN Quang Minh)', shift: 'Ca 1 (08:00 - 17:00)', in: '08:00', out: '17:00', gps: '21.2156, 105.7893 (Cách 45m)', days: '1.0 công', status: 'PRESENT' }
  ],

  financeTransactions: [
    { code: 'GD-2026-001', date: '05/10/2026', type: 'INCOME', category: 'Thu phí cung ứng WESUM', desc: 'Thanh toán phí dịch vụ cung ứng đợt 1 tháng 10', party: 'Công ty WESUM', amount: '220.000.000 VNĐ', user: 'Trần Thu Hà', status: 'Đã duyệt' },
    { code: 'GD-2026-002', date: '04/10/2026', type: 'INCOME', category: 'Thu phí cung ứng OJTEK', desc: 'Thanh toán tạm ứng hợp đồng tuyển dụng', party: 'Công ty OJTEK', amount: '150.000.000 VNĐ', user: 'Vũ Văn Cường', status: 'Đã duyệt' },
    { code: 'GD-2026-003', date: '04/10/2026', type: 'EXPENSE', category: 'Chi trả Vendor DJC', desc: 'Chi trả tiền dịch vụ cung ứng 30 lao động', party: 'Vendor DJC', amount: '120.000.000 VNĐ', user: 'Kế toán Hương', status: 'Đã duyệt' },
    { code: 'GD-2026-004', date: '03/10/2026', type: 'EXPENSE', category: 'Chi tạm ứng lao động thời vụ', desc: 'Tổng chi tạm ứng đợt đầu tháng cho 12 lao động', party: 'NLD Thời vụ WESUM', amount: '6.000.000 VNĐ', user: 'Kế toán Hương', status: 'Đã duyệt' },
    { code: 'GD-2026-005', date: '02/10/2026', type: 'EXPENSE', category: 'Chi xe đưa đón công nhân', desc: 'Hợp đồng xe đưa đón tuyến Vĩnh Phúc - Mê Linh', party: 'Nhà xe An Phát', amount: '18.500.000 VNĐ', user: 'Trần Thu Hà', status: 'Đã duyệt' }
  ],

  auditLogs: [
    { time: '05/10/2026 09:15:20', user: 'Trần Thu Hà', role: 'RECRUITER', action: 'CREATE_WORKER', target: 'workers (NLD-009)', detail: 'Tạo mới hồ sơ NLĐ Nguyễn Văn Nam (Gán vào WESUM)', ip: '192.168.1.45' },
    { time: '05/10/2026 08:30:11', user: 'Giám đốc Tuấn', role: 'DIRECTOR', action: 'VIEW_CCCD', target: 'workers (NLD-001)', detail: 'Lấy signed URL xem ảnh CCCD Trần Văn Long', ip: '192.168.1.10' },
    { time: '04/10/2026 16:45:00', user: 'Kế toán Hương', role: 'ACCOUNTANT', action: 'CREATE_PAYMENT', target: 'salary_advances', detail: 'Tạo phiếu tạm ứng 500.000đ cho NLĐ Trần Văn Long', ip: '192.168.1.22' },
    { time: '04/10/2026 14:10:30', user: 'Vũ Văn Cường', role: 'RECRUITER', action: 'UPDATE_STATUS', target: 'workers (NLD-008)', detail: 'Chuyển trạng thái NLĐ sang: Không đi làm', ip: '192.168.1.48' },
    { time: '03/10/2026 11:20:15', user: 'Giám đốc Tuấn', role: 'DIRECTOR', action: 'EXPORT_REPORT', target: 'commissions', detail: 'Xuất dữ liệu hoa hồng dự kiến Tháng 10 ra file CSV', ip: '192.168.1.10' }
  ]
};

// DOM Elements
const appRoot = document.getElementById('appRoot');
const desktopLayout = document.getElementById('desktopLayout');
const mobileDeviceFrame = document.getElementById('mobileDeviceFrame');
const roleSelector = document.getElementById('roleSelector');
const viewButtons = document.querySelectorAll('.view-btn');
const sidebarNavItems = document.querySelectorAll('.sidebar .nav-item');

// Helper: Format Currency
function formatVND(num) {
  return new Intl.NumberFormat('vi-VN').format(num) + ' VNĐ';
}

// Mask Citizen ID according to security policy
function formatCitizenId(cccd, hasPermission) {
  if (hasPermission) {
    return `<code>${cccd}</code>`;
  }
  return `<code style="color: var(--text-muted);">${cccd.substring(0, 6)}******</code>`;
}

// Render Workers Table
function renderWorkersTable() {
  const tbody = document.getElementById('workersTableBody');
  if (!tbody) return;

  const canViewCCCD = ['DIRECTOR', 'VICE_DIRECTOR', 'RECRUITER'].includes(state.currentRole);
  const searchVal = (document.getElementById('workerSearchFilter')?.value || '').toLowerCase().trim();
  const companyVal = document.getElementById('workerCompanyFilter')?.value || '';
  const statusVal = document.getElementById('workerStatusFilter')?.value || '';
  const typeVal = document.getElementById('workerTypeFilter')?.value || '';

  const filtered = state.workers.filter(w => {
    const matchSearch = w.name.toLowerCase().includes(searchVal) || w.code.toLowerCase().includes(searchVal) || w.phone.includes(searchVal) || w.citizen_id.includes(searchVal);
    const matchComp = !companyVal || w.company === companyVal;
    const matchStatus = !statusVal || w.status === statusVal;
    const matchType = !typeVal || w.type === typeVal;
    return matchSearch && matchComp && matchStatus && matchType;
  });

  const totalCountEl = document.getElementById('workerTotalCount');
  if (totalCountEl) totalCountEl.textContent = filtered.length;

  tbody.innerHTML = filtered.map(w => {
    let statusClass = 'success';
    if (w.status === 'Chờ đi làm') statusClass = 'warning';
    if (w.status === 'Tạm nghỉ') statusClass = 'info';
    if (w.status === 'Nghỉ việc' || w.status === 'Không đi làm') statusClass = 'danger';

    const avatarInitial = w.initials || (w.name.charAt(w.name.lastIndexOf(' ') + 1) || w.name.charAt(0));

    return `
      <tr>
        <td style="white-space: nowrap;">
          <div class="worker-user-cell" onclick="viewWorkerDetail(${w.id})" title="Nhấn để xem chi tiết hồ sơ & ảnh CCCD">
            <div class="worker-avatar-thumb ${w.avatarColor || 'avatar-blue'}">
              ${avatarInitial}
            </div>
            <strong class="worker-name-text">${w.name}</strong>
          </div>
        </td>
        <td style="white-space: nowrap;"><code style="font-size: 13px;">${w.phone}</code></td>
        <td style="white-space: nowrap;">${w.hometown}</td>
        <td style="white-space: nowrap;">${formatCitizenId(w.citizen_id, canViewCCCD)}</td>
        <td style="white-space: nowrap;"><strong>${w.company}</strong> <span style="font-size: 11.5px; color: var(--text-muted);">(${w.position})</span></td>
        <td style="white-space: nowrap;"><span class="status-pill ${w.type === 'Thời vụ' ? 'warning' : 'info'}">${w.type}</span></td>
        <td style="white-space: nowrap;">${w.recruiter}</td>
        <td style="white-space: nowrap;"><span class="status-pill ${statusClass}">${w.status}</span></td>
        <td style="white-space: nowrap; text-align: center; position: relative;">
          <div class="action-dropdown" id="actionDropdown-${w.id}">
            <button class="btn-dots" onclick="toggleActionMenu(event, ${w.id})" title="Thao tác">⋮</button>
            <div class="action-dropdown-menu" id="actionMenu-${w.id}">
              <button class="action-menu-item" onclick="viewWorkerDetail(${w.id})">Xem chi tiết</button>
              <button class="action-menu-item" onclick="openEditWorkerModal(${w.id})">Sửa thông tin</button>
              <button class="action-menu-item" onclick="openAdvanceModalForCode('${w.code}')">Tạo tạm ứng</button>
              <div class="action-menu-divider"></div>
              <button class="action-menu-item danger" onclick="deleteWorker(${w.id})">Xóa hồ sơ</button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Attendance Table
function renderAttendanceTable() {
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;

  tbody.innerHTML = state.attendances.map(a => {
    let statusBadge = `<span class="status-pill success">Hợp lệ</span>`;
    if (a.status === 'LATE') statusBadge = `<span class="status-pill warning">Đi muộn</span>`;
    if (a.status === 'GPS_WARNING') statusBadge = `<span class="status-pill danger">Lệch GPS</span>`;

    const matchedWorker = state.workers.find(w => w.code === a.code);
    const avatarColor = matchedWorker?.avatarColor || 'avatar-blue';
    const avatarInitial = matchedWorker?.initials || a.name.charAt(a.name.lastIndexOf(' ') + 1) || 'N';

    return `
      <tr>
        <td style="white-space: nowrap;">
          <div class="worker-user-cell" onclick="viewWorkerDetail('${a.code}')" title="Nhấn để xem chi tiết hồ sơ & ảnh CCCD">
            <div class="worker-avatar-thumb ${avatarColor}" style="width: 28px; height: 28px; font-size: 11.5px;">
              ${avatarInitial}
            </div>
            <strong class="worker-name-text">${a.name}</strong>
          </div>
        </td>
        <td style="white-space: nowrap;">${a.company}</td>
        <td style="white-space: nowrap;">${a.shift}</td>
        <td style="white-space: nowrap;"><strong style="color: var(--color-success);">${a.in}</strong></td>
        <td style="white-space: nowrap;"><strong>${a.out}</strong></td>
        <td style="white-space: nowrap;"><code>${a.gps}</code></td>
        <td style="white-space: nowrap;"><strong>${a.days}</strong></td>
        <td style="white-space: nowrap;">${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

// Render Payroll Table
function renderPayrollTable() {
  const tbody = document.getElementById('payrollTableBody');
  if (!tbody) return;

  tbody.innerHTML = state.workers.filter(w => w.worked_days > 0).map(w => {
    const gross = w.worked_days * w.daily_rate;
    const net = gross - w.advance;
    const avatarInitial = w.initials || w.name.charAt(w.name.lastIndexOf(' ') + 1) || 'N';

    return `
      <tr>
        <td style="white-space: nowrap;">
          <div class="worker-user-cell" onclick="viewWorkerDetail(${w.id})" title="Nhấn để xem chi tiết hồ sơ & ảnh CCCD">
            <div class="worker-avatar-thumb ${w.avatarColor || 'avatar-blue'}" style="width: 28px; height: 28px; font-size: 11.5px;">
              ${avatarInitial}
            </div>
            <strong class="worker-name-text">${w.name}</strong>
          </div>
        </td>
        <td style="white-space: nowrap;">${w.company}</td>
        <td style="white-space: nowrap;"><span class="status-pill ${w.type === 'Thời vụ' ? 'warning' : 'info'}">${w.type}</span></td>
        <td style="white-space: nowrap;"><strong>${w.worked_days} ngày</strong></td>
        <td style="white-space: nowrap;">${formatVND(w.daily_rate)}</td>
        <td style="white-space: nowrap;"><strong style="color: var(--color-navy);">${formatVND(gross)}</strong></td>
        <td style="white-space: nowrap;">${w.advance > 0 ? `<span style="color: var(--color-danger); font-weight: 600;">-${formatVND(w.advance)}</span>` : '0 VNĐ'}</td>
        <td style="white-space: nowrap;"><strong style="color: var(--color-success); font-size: 14px;">${formatVND(net)}</strong></td>
        <td style="white-space: nowrap;"><span class="status-pill success">Sẵn sàng chi</span></td>
      </tr>
    `;
  }).join('');
}

// Render Finance Table
function renderFinanceTable() {
  const tbody = document.getElementById('financeTableBody');
  if (!tbody) return;

  tbody.innerHTML = state.financeTransactions.map(t => {
    const isIncome = t.type === 'INCOME';
    return `
      <tr>
        <td style="white-space: nowrap;"><code>${t.code}</code></td>
        <td style="white-space: nowrap;">${t.date}</td>
        <td style="white-space: nowrap;"><span class="status-pill ${isIncome ? 'success' : 'danger'}">${isIncome ? 'Thu (+)' : 'Chi (-)'}</span></td>
        <td style="white-space: nowrap;"><strong>${t.category}</strong></td>
        <td style="white-space: nowrap;">${t.desc}</td>
        <td style="white-space: nowrap;">${t.party}</td>
        <td style="white-space: nowrap;"><strong style="color: ${isIncome ? 'var(--color-success)' : 'var(--color-danger)'};">${t.amount}</strong></td>
        <td style="white-space: nowrap;">${t.user}</td>
        <td style="white-space: nowrap;"><span class="status-pill success">${t.status}</span></td>
      </tr>
    `;
  }).join('');
}

// Render Commission Table (Formula: Đơn giá x Ngày công thực tế)
function renderCommissionTable() {
  const tbody = document.getElementById('commissionTableBody');
  if (!tbody) return;

  const unitRate = 40000; // 40k VND / worker / day
  tbody.innerHTML = state.workers.filter(w => w.worked_days > 0).map(w => {
    const commissionAmount = w.worked_days * unitRate;
    const avatarInitial = w.initials || w.name.charAt(w.name.lastIndexOf(' ') + 1) || 'N';

    return `
      <tr>
        <td style="white-space: nowrap;">
          <div class="worker-user-cell" onclick="viewWorkerDetail(${w.id})" title="Nhấn để xem chi tiết hồ sơ & ảnh CCCD">
            <div class="worker-avatar-thumb ${w.avatarColor || 'avatar-blue'}" style="width: 28px; height: 28px; font-size: 11.5px;">
              ${avatarInitial}
            </div>
            <strong class="worker-name-text">${w.name}</strong>
          </div>
        </td>
        <td style="white-space: nowrap;">${w.company}</td>
        <td style="white-space: nowrap;">Tháng 10/2026</td>
        <td style="white-space: nowrap;"><strong>${w.worked_days} ngày công</strong></td>
        <td style="white-space: nowrap;">${formatVND(unitRate)}/ngày</td>
        <td style="white-space: nowrap;"><strong style="color: #7c3aed; font-size: 14px;">${formatVND(commissionAmount)}</strong></td>
        <td style="white-space: nowrap;"><span class="status-pill success">Khớp chấm công</span></td>
      </tr>
    `;
  }).join('');
}

// Render Audit Logs Table
function renderAuditTable() {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;

  tbody.innerHTML = state.auditLogs.map(log => `
    <tr>
      <td style="white-space: nowrap;"><span style="color: var(--text-muted); font-size: 12px;">${log.time}</span></td>
      <td style="white-space: nowrap;"><strong>${log.user}</strong></td>
      <td style="white-space: nowrap;"><span class="status-pill info">${log.role}</span></td>
      <td style="white-space: nowrap;"><code>${log.action}</code></td>
      <td style="white-space: nowrap;"><strong>${log.target}</strong></td>
      <td style="white-space: nowrap;">${log.detail}</td>
      <td style="white-space: nowrap;"><code>${log.ip}</code></td>
    </tr>
  `).join('');
}

// Apply RBAC Rules
function applyRBACRules() {
  const role = state.currentRole;
  
  // Elements that require specific permissions
  const financeNav = document.getElementById('navFinance');
  const commissionNav = document.getElementById('navCommission');
  const auditNav = document.getElementById('navAudit');

  const canViewFinance = ['DIRECTOR', 'VICE_DIRECTOR', 'ACCOUNTANT'].includes(role);
  const canViewCommission = ['DIRECTOR', 'VICE_DIRECTOR'].includes(role);
  const canViewAudit = ['DIRECTOR', 'VICE_DIRECTOR', 'LEAD_SALES'].includes(role);

  if (financeNav) financeNav.style.display = canViewFinance ? 'flex' : 'none';
  if (commissionNav) commissionNav.style.display = canViewCommission ? 'flex' : 'none';
  if (auditNav) auditNav.style.display = canViewAudit ? 'flex' : 'none';

  // Update current user profile badge
  const avatarEl = document.getElementById('currentUserAvatar');
  const nameEl = document.getElementById('currentUserName');
  const roleEl = document.getElementById('currentUserRole');

  const roleProfiles = {
    'DIRECTOR': { av: 'TĐ', name: 'Nguyễn Quốc Tuấn', role: 'Giám đốc Điều hành' },
    'VICE_DIRECTOR': { av: 'PV', name: 'Phạm Văn Nam', role: 'Phó Giám đốc Vận hành' },
    'ACCOUNTANT': { av: 'TH', name: 'Đỗ Thu Hương', role: 'Kế toán Trưởng' },
    'RECRUITER': { av: 'TH', name: 'Trần Thu Hà', role: 'Chuyên viên Tuyển dụng VP' },
    'LEAD_SALES': { av: 'VC', name: 'Vũ Văn Cường', role: 'Trưởng nhóm Kinh doanh & Điều phối' }
  };

  if (avatarEl && roleProfiles[role]) avatarEl.textContent = roleProfiles[role].av;
  if (nameEl && roleProfiles[role]) nameEl.textContent = roleProfiles[role].name;
  if (roleEl && roleProfiles[role]) roleEl.textContent = roleProfiles[role].role;

  // Re-render components with masked data
  renderWorkersTable();
}

// ========================================================
// URL HASH ROUTING & LINK SYNC
// ========================================================
function updateUrlHash(hash) {
  if (window.location.hash !== '#' + hash) {
    history.replaceState(null, '', '#' + hash);
  }
}

// Module Navigation Switcher
function switchModule(moduleId, updateUrl = true) {
  state.currentModule = moduleId;

  // Hide all desktop modules
  document.querySelectorAll('.module-view').forEach(view => {
    view.style.display = 'none';
  });

  // Update sidebar active item
  sidebarNavItems.forEach(item => {
    item.classList.toggle('active', item.dataset.module === moduleId);
  });

  // Remove active from teams, factories, cycles
  document.querySelectorAll('.team-list .sub-item').forEach(sub => sub.classList.remove('active'));
  document.querySelectorAll('.factory-list .sub-item').forEach(sub => sub.classList.remove('active'));
  document.querySelectorAll('.cycle-item, .cycle-header').forEach(ci => ci.classList.remove('active'));

  // Show target module view
  const targetId = 'view' + moduleId.charAt(0).toUpperCase() + moduleId.slice(1);
  const targetView = document.getElementById(targetId);
  if (targetView) {
    targetView.style.display = 'flex';
  }

  // Refresh tables
  if (moduleId === 'workers') renderWorkersTable();
  if (moduleId === 'attendance') renderAttendanceTable();
  if (moduleId === 'payroll') renderPayrollTable();
  if (moduleId === 'finance') renderFinanceTable();
  if (moduleId === 'commission') renderCommissionTable();
  if (moduleId === 'audit') renderAuditTable();

  // Update URL Hash
  if (updateUrl) {
    updateUrlHash(moduleId);
  }
}

// View Mode Switcher (Desktop vs Mobile)
function switchViewMode(mode, updateUrl = true) {
  state.currentView = mode;

  viewButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });

  if (mode.startsWith('desktop')) {
    appRoot.classList.remove('mobile-mode');
    desktopLayout.style.display = 'flex';
    mobileDeviceFrame.style.display = 'none';

    if (mode === 'desktop-orders') {
      switchModule('orders', updateUrl);
    } else if (mode === 'desktop-dashboard') {
      switchModule('dashboard', updateUrl);
    }
  } else if (mode.startsWith('mobile')) {
    appRoot.classList.add('mobile-mode');
    desktopLayout.style.display = 'none';
    mobileDeviceFrame.style.display = 'block';

    const mobileOrders = document.getElementById('mobileOrdersView');
    const mobileTargets = document.getElementById('mobileTargetsView');

    if (mode === 'mobile-orders') {
      if (mobileOrders) mobileOrders.style.display = 'flex';
      if (mobileTargets) mobileTargets.style.display = 'none';
      if (updateUrl) updateUrlHash('mobile-orders');
    } else if (mode === 'mobile-targets') {
      if (mobileOrders) mobileOrders.style.display = 'none';
      if (mobileTargets) mobileTargets.style.display = 'flex';
      if (updateUrl) updateUrlHash('mobile-targets');
    }
  }
}

// Modal Controls
window.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
};

window.openCCCDModal = function(cccd) {
  // Check permission
  if (!['DIRECTOR', 'VICE_DIRECTOR', 'RECRUITER'].includes(state.currentRole)) {
    alert('Truy cập bị từ chối: Vai trò hiện tại không có quyền CCCD_VIEW.');
    return;
  }

  const nameEl = document.getElementById('cccdWorkerName');
  if (nameEl) nameEl.textContent = `Số định danh: ${cccd} · Xác thực Token Signed URL`;
  
  // Record audit log
  state.auditLogs.unshift({
    time: new Date().toLocaleString('vi-VN'),
    user: state.currentRole,
    role: state.currentRole,
    action: 'VIEW_CCCD',
    target: `workers (CCCD ${cccd.substring(0, 6)}***)`,
    detail: 'Lấy signed URL xem ảnh CCCD thành công',
    ip: '127.0.0.1'
  });

  openModal('modalViewCCCD');
};

// ========================================================
// WORKER PROFILE DETAIL & CCCD PHOTO VIEWER
// ========================================================
let currentViewingWorker = null;

window.viewWorkerDetail = function(workerId) {
  // Close any open action dropdown menus
  document.querySelectorAll('.action-dropdown-menu').forEach(m => m.classList.remove('show'));

  const w = state.workers.find(item => item.id === workerId || item.code === workerId);
  if (!w) return;

  currentViewingWorker = w;

  const canViewCCCD = ['DIRECTOR', 'VICE_DIRECTOR', 'RECRUITER'].includes(state.currentRole);

  // 1. Header & Hero Banner
  const avatarEl = document.getElementById('dtWorkerAvatar');
  if (avatarEl) avatarEl.textContent = w.name.charAt(w.name.lastIndexOf(' ') + 1) || w.name.charAt(0);

  const nameEl = document.getElementById('dtWorkerName');
  if (nameEl) nameEl.textContent = w.name;

  const codeBadge = document.getElementById('dtWorkerCodeBadge');
  if (codeBadge) codeBadge.textContent = w.code;

  const statusEl = document.getElementById('dtWorkerStatus');
  if (statusEl) {
    statusEl.textContent = w.status;
    let stClass = 'success';
    if (w.status === 'Chờ đi làm') stClass = 'warning';
    if (w.status === 'Tạm nghỉ') stClass = 'info';
    if (w.status === 'Không đi làm' || w.status === 'Nghỉ việc') stClass = 'danger';
    statusEl.className = `status-pill ${stClass}`;
  }

  const typeEl = document.getElementById('dtWorkerType');
  if (typeEl) {
    typeEl.textContent = w.type;
    typeEl.className = `status-pill ${w.type === 'Thời vụ' ? 'warning' : 'info'}`;
  }

  const compEl = document.getElementById('dtWorkerCompany');
  if (compEl) compEl.textContent = `${w.company} Việt Nam`;

  const posEl = document.getElementById('dtWorkerPosition');
  if (posEl) posEl.textContent = w.position;

  const recEl = document.getElementById('dtWorkerRecruiter');
  if (recEl) recEl.textContent = w.recruiter;

  // 2. Tab 1: Personal Info & CCCD Photos
  const infoName = document.getElementById('dtInfoName');
  if (infoName) infoName.textContent = w.name;

  const infoCode = document.getElementById('dtInfoCode');
  if (infoCode) infoCode.textContent = w.code;

  const infoPhone = document.getElementById('dtInfoPhone');
  if (infoPhone) infoPhone.textContent = w.phone;

  const infoCccd = document.getElementById('dtInfoCitizenId');
  if (infoCccd) infoCccd.textContent = canViewCCCD ? w.citizen_id : `${w.citizen_id.substring(0, 6)}****** (Bảo mật)`;

  const infoHometown = document.getElementById('dtInfoHometown');
  if (infoHometown) infoHometown.textContent = w.hometown;

  const infoAddr = document.getElementById('dtInfoAddress');
  if (infoAddr) infoAddr.textContent = `${w.hometown}, Việt Nam`;

  // CCCD Card Front Details
  const cccdCardNum = document.getElementById('dtCccdCardNum');
  if (cccdCardNum) {
    if (canViewCCCD) {
      cccdCardNum.textContent = `${w.citizen_id.substring(0, 3)} ${w.citizen_id.substring(3, 6)} ${w.citizen_id.substring(6)}`;
    } else {
      cccdCardNum.textContent = `${w.citizen_id.substring(0, 3)} ${w.citizen_id.substring(3, 6)} ******`;
    }
  }

  const cccdCardName = document.getElementById('dtCccdCardName');
  if (cccdCardName) cccdCardName.textContent = w.name.toUpperCase();

  const cccdCardOrigin = document.getElementById('dtCccdCardOrigin');
  if (cccdCardOrigin) cccdCardOrigin.textContent = w.hometown;

  const cccdThumb = document.getElementById('dtThumbInitials');
  if (cccdThumb) cccdThumb.textContent = w.name.charAt(w.name.lastIndexOf(' ') + 1) || '3x4';

  const portraitName = document.getElementById('dtPortraitNameLabel');
  if (portraitName) portraitName.textContent = `${w.name} (3x4)`;

  // MRZ code generator
  const mrzLine1 = document.getElementById('dtCccdMrzLine1');
  if (mrzLine1) mrzLine1.textContent = `IDVNM${canViewCCCD ? w.citizen_id : w.citizen_id.substring(0, 6) + 'xxxxxx'}<<<<<<<<<<<<`;

  const mrzName = document.getElementById('dtCccdMrzName');
  if (mrzName) {
    const rawName = w.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, '<');
    mrzName.textContent = `${rawName}<<<<<<<<<<<<<<<<<<<`.substring(0, 30);
  }

  // RBAC Permission alert & blur handling
  const permWarning = document.getElementById('dtCccdPermissionWarning');
  const cccdFront = document.getElementById('dtCccdFront');
  const cccdBack = document.getElementById('dtCccdBack');
  const portraitBox = document.getElementById('dtPortraitBox');

  if (!canViewCCCD) {
    if (permWarning) permWarning.style.display = 'flex';
    if (cccdFront) cccdFront.style.filter = 'blur(2.5px)';
    if (cccdBack) cccdBack.style.filter = 'blur(2.5px)';
    if (portraitBox) portraitBox.style.filter = 'blur(1.5px)';
  } else {
    if (permWarning) permWarning.style.display = 'none';
    if (cccdFront) cccdFront.style.filter = 'none';
    if (cccdBack) cccdBack.style.filter = 'none';
    if (portraitBox) portraitBox.style.filter = 'none';

    // Record audit log for viewing CCCD profile
    state.auditLogs.unshift({
      time: new Date().toLocaleString('vi-VN'),
      user: state.currentRole,
      role: state.currentRole,
      action: 'VIEW_CCCD_PROFILE',
      target: `workers (${w.code})`,
      detail: `Xem chi tiết hồ sơ & ảnh CCCD của NLĐ ${w.name} (${w.code})`,
      ip: '127.0.0.1'
    });
  }

  // 3. Tab 2: Job & Dispatch
  const jobComp = document.getElementById('dtJobCompany');
  if (jobComp) jobComp.textContent = `${w.company} Việt Nam`;

  const jobPos = document.getElementById('dtJobPosition');
  if (jobPos) jobPos.textContent = w.position;

  const jobType = document.getElementById('dtJobType');
  if (jobType) jobType.textContent = `Lao động ${w.type}`;

  const jobRec = document.getElementById('dtJobRecruiter');
  if (jobRec) jobRec.textContent = w.recruiter;

  // 4. Tab 3: Payroll & Attendance
  const workedDays = w.worked_days || 5;
  const rate = w.daily_rate || 280000;
  const gross = workedDays * rate;
  const advance = w.advance || 0;
  const net = gross - advance;

  const payrollDays = document.getElementById('dtPayrollDays');
  if (payrollDays) payrollDays.textContent = `${workedDays} ngày công`;

  const payrollRate = document.getElementById('dtPayrollRate');
  if (payrollRate) payrollRate.textContent = `${new Intl.NumberFormat('vi-VN').format(rate)}đ/ngày`;

  const payrollGross = document.getElementById('dtPayrollGross');
  if (payrollGross) payrollGross.textContent = formatVND(gross);

  const payrollAdvance = document.getElementById('dtPayrollAdvance');
  if (payrollAdvance) payrollAdvance.textContent = formatVND(advance);

  const payrollNet = document.getElementById('dtPayrollNet');
  if (payrollNet) payrollNet.textContent = formatVND(net);

  // Reset to personal tab
  switchWorkerDetailTab('personal');

  // Open modal
  openModal('modalWorkerDetail');
};

window.switchWorkerDetailTab = function(tabName) {
  // Update Tab buttons
  const btnPersonal = document.getElementById('tabBtnPersonal');
  const btnJob = document.getElementById('tabBtnJob');
  const btnPayroll = document.getElementById('tabBtnPayroll');

  if (btnPersonal) btnPersonal.classList.toggle('active', tabName === 'personal');
  if (btnJob) btnJob.classList.toggle('active', tabName === 'job');
  if (btnPayroll) btnPayroll.classList.toggle('active', tabName === 'payroll');

  // Update Tab Panes
  const panePersonal = document.getElementById('paneDetailPersonal');
  const paneJob = document.getElementById('paneDetailJob');
  const panePayroll = document.getElementById('paneDetailPayroll');

  if (panePersonal) panePersonal.classList.toggle('active', tabName === 'personal');
  if (paneJob) paneJob.classList.toggle('active', tabName === 'job');
  if (panePayroll) panePayroll.classList.toggle('active', tabName === 'payroll');
};

window.openEditWorkerModalFromDetail = function() {
  if (!currentViewingWorker) return;
  closeModal('modalWorkerDetail');
  openEditWorkerModal(currentViewingWorker.id);
};

window.openAdvanceModalForCurrentWorker = function() {
  if (!currentViewingWorker) return;
  closeModal('modalWorkerDetail');
  openAdvanceModalForCode(currentViewingWorker.code);
};

window.downloadWorkerProfilePdf = function() {
  if (!currentViewingWorker) return;
  alert(`Đã tải trọn bộ tài liệu hồ sơ & ảnh CCCD của NLĐ ${currentViewingWorker.name} (${currentViewingWorker.code}) thành công!`);
};


// Form Handlers
window.handleCreateWorker = function(e) {
  e.preventDefault();
  const code = document.getElementById('wCode').value.trim();
  const name = document.getElementById('wName').value.trim();
  const phone = document.getElementById('wPhone').value.trim();
  const citizen_id = document.getElementById('wCitizenId').value.trim();
  const hometown = document.getElementById('wHometown').value.trim();
  const company = document.getElementById('wCompany').value;
  const type = document.getElementById('wType').value;
  const recruiter = document.getElementById('wRecruiter').value;

  const newWorker = {
    id: state.workers.length + 1,
    code,
    name,
    phone,
    hometown,
    citizen_id,
    company,
    position: 'Công nhân lắp ráp',
    type,
    recruiter,
    status: 'Đang làm',
    daily_rate: 280000,
    worked_days: 1,
    advance: 0
  };

  state.workers.unshift(newWorker);
  
  // Add audit log
  state.auditLogs.unshift({
    time: new Date().toLocaleString('vi-VN'),
    user: state.currentRole,
    role: state.currentRole,
    action: 'CREATE_WORKER',
    target: `workers (${code})`,
    detail: `Tạo mới hồ sơ NLĐ ${name} tại ${company}`,
    ip: '127.0.0.1'
  });

  closeModal('modalCreateWorker');
  renderWorkersTable();
  alert(`Đã lưu hồ sơ người lao động ${name} (${code}) thành công!`);
};

// Toggle Action Dropdown Menu
window.toggleActionMenu = function(e, workerId) {
  e.stopPropagation();
  const currentMenu = document.getElementById(`actionMenu-${workerId}`);
  const isShown = currentMenu ? currentMenu.classList.contains('show') : false;

  // Close all open action menus
  document.querySelectorAll('.action-dropdown-menu').forEach(m => m.classList.remove('show'));

  if (currentMenu && !isShown) {
    currentMenu.classList.add('show');
  }
};

// Open Edit Worker Modal
window.openEditWorkerModal = function(id) {
  const w = state.workers.find(item => item.id === id);
  if (!w) return;

  document.getElementById('editWorkerId').value = w.id;
  document.getElementById('editWCode').value = w.code;
  document.getElementById('editWName').value = w.name;
  document.getElementById('editWPhone').value = w.phone;
  document.getElementById('editWHometown').value = w.hometown || '';
  document.getElementById('editWCompany').value = w.company;
  document.getElementById('editWPosition').value = w.position;
  document.getElementById('editWType').value = w.type;
  document.getElementById('editWStatus').value = w.status;

  // Close open dropdowns
  document.querySelectorAll('.action-dropdown-menu').forEach(m => m.classList.remove('show'));

  openModal('modalEditWorker');
};

// Handle Edit Worker Submit
window.handleEditWorker = function(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById('editWorkerId').value);
  const w = state.workers.find(item => item.id === id);

  if (w) {
    const oldName = w.name;
    w.name = document.getElementById('editWName').value;
    w.phone = document.getElementById('editWPhone').value;
    w.hometown = document.getElementById('editWHometown').value;
    w.company = document.getElementById('editWCompany').value;
    w.position = document.getElementById('editWPosition').value;
    w.type = document.getElementById('editWType').value;
    w.status = document.getElementById('editWStatus').value;

    state.auditLogs.unshift({
      time: new Date().toLocaleString('vi-VN'),
      user: state.currentRole,
      role: state.currentRole,
      action: 'UPDATE_WORKER',
      target: `workers (${w.code})`,
      detail: `Cập nhật thông tin NLĐ ${w.name} (${w.code})`,
      ip: '127.0.0.1'
    });

    closeModal('modalEditWorker');
    renderWorkersTable();
    alert(`Đã cập nhật thông tin người lao động ${w.name} (${w.code}) thành công!`);
  }
};

// Delete Worker
window.deleteWorker = function(id) {
  const index = state.workers.findIndex(item => item.id === id);
  if (index === -1) return;

  const w = state.workers[index];

  // Close open dropdowns
  document.querySelectorAll('.action-dropdown-menu').forEach(m => m.classList.remove('show'));

  if (confirm(`Bạn có chắc chắn muốn XÓA hồ sơ người lao động: ${w.name} (${w.code})?`)) {
    state.workers.splice(index, 1);

    state.auditLogs.unshift({
      time: new Date().toLocaleString('vi-VN'),
      user: state.currentRole,
      role: state.currentRole,
      action: 'DELETE_WORKER',
      target: `workers (${w.code})`,
      detail: `Xóa hồ sơ NLĐ ${w.name} (${w.code}) khỏi hệ thống`,
      ip: '127.0.0.1'
    });

    renderWorkersTable();
    renderPayrollTable();
    alert(`Đã xóa hồ sơ người lao động ${w.name} thành công!`);
  }
};

// Open Advance Modal for a specific Worker Code
window.openAdvanceModalForCode = function(workerCode) {
  document.querySelectorAll('.action-dropdown-menu').forEach(m => m.classList.remove('show'));
  openModal('modalCreateAdvance');
  const sel = document.getElementById('advWorker');
  if (sel) sel.value = workerCode;
};

window.handleCheckIn = function(e) {
  e.preventDefault();
  const workerCode = document.getElementById('ciWorker').value;
  const worker = state.workers.find(w => w.code === workerCode);
  
  if (worker) {
    worker.worked_days += 1;
    state.attendances.unshift({
      code: worker.code,
      name: worker.name,
      company: worker.company + ' (KCN Khai Quang)',
      shift: 'Ca 1 (08:00 - 17:00)',
      in: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      out: '--:--',
      gps: '21.3129, 105.6022 (Cách 15m - Vừa check-in)',
      days: '1.0 công',
      status: 'PRESENT'
    });
  }

  closeModal('modalCheckIn');
  renderAttendanceTable();
  alert('Đã ghi nhận check-in chấm công thành công!');
};

window.handleCreateAdvance = function(e) {
  e.preventDefault();
  const workerCode = document.getElementById('advWorker').value;
  const amount = parseInt(document.getElementById('advAmount').value) || 0;
  const reason = document.getElementById('advReason').value;

  const worker = state.workers.find(w => w.code === workerCode);
  if (worker) {
    worker.advance += amount;
    state.financeTransactions.unshift({
      code: `GD-2026-00${state.financeTransactions.length + 1}`,
      date: new Date().toLocaleDateString('vi-VN'),
      type: 'EXPENSE',
      category: 'Chi tạm ứng lao động thời vụ',
      desc: reason,
      party: `${worker.name} (${worker.code})`,
      amount: formatVND(amount),
      user: state.currentRole,
      status: 'Đã duyệt'
    });
  }

  closeModal('modalCreateAdvance');
  renderPayrollTable();
  renderFinanceTable();
  alert(`Đã duyệt tạm ứng ${formatVND(amount)} thành công!`);
};

window.handleCreateOrder = function(e) {
  e.preventDefault();
  closeModal('modalCreateOrder');
  alert('Đã ghi nhận tạo đơn hàng cung ứng mới vào hệ thống!');
};

// Team Management Logic & Dynamic View
window.renderTeamView = function(teamId) {
  const team = state.teams[teamId || state.currentTeam || 'vinh-phuc'];
  if (!team) return;

  state.currentTeam = team.id;

  // Header & Subtitles
  const titleEl = document.getElementById('teamDetailTitle');
  const subEl = document.getElementById('teamDetailSubtitle');
  if (titleEl) titleEl.textContent = team.name;
  if (subEl) subEl.textContent = team.subtitle;

  // KPIs
  const targetValEl = document.getElementById('teamTargetValue');
  const actualValEl = document.getElementById('teamActualValue');
  const progBarEl = document.getElementById('teamProgressBar');
  const fCountEl = document.getElementById('teamFactoryCount');
  const fListEl = document.getElementById('teamFactoryList');

  if (targetValEl) targetValEl.innerHTML = `${team.target} <span>người</span>`;
  if (actualValEl) actualValEl.innerHTML = `Đã đi làm thực tế: <strong>${team.actual} người</strong> (Đạt ${team.pct})`;
  if (progBarEl) progBarEl.style.width = team.pct;
  if (fCountEl) fCountEl.innerHTML = `${team.factoryCount} <span>nhà máy</span>`;
  if (fListEl) fListEl.textContent = team.factoryList;

  // Update Assign Modal team name
  const assignTeamInput = document.getElementById('assignTeamName');
  if (assignTeamInput) assignTeamInput.value = team.name;

  const assignMemberSelect = document.getElementById('assignMember');
  if (assignMemberSelect) {
    assignMemberSelect.innerHTML = team.members.map(m => `<option value="${m.name}">${m.name} (${m.role})</option>`).join('');
  }

  // Render Member Cards
  const memberContainer = document.getElementById('teamMemberListContainer');
  if (memberContainer) {
    memberContainer.innerHTML = team.members.map(m => `
      <div class="team-member-card">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div class="avatar-md ${m.colorClass}">${m.avatar}</div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="font-size: 14.5px; color: var(--text-main);">${m.name}</strong>
              <span class="status-pill ${m.rating === 'Xuất sắc' ? 'success' : m.rating === 'Tốt' ? 'info' : 'warning'}">${m.rating}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">
              ${m.role} · ĐT: <strong>${m.phone}</strong> · Tỷ lệ đậu PV: <strong style="color: var(--primary-blue);">${m.passRate}</strong>
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
          <div style="text-align: right;">
            <div style="font-size: 11.5px; color: var(--text-muted);">Tiến độ hoàn thành</div>
            <div style="font-size: 14px; font-weight: 700; color: var(--text-main);">
              ${m.actual} / ${m.target} người <span style="font-size: 12px; color: var(--color-success);">(${m.progress})</span>
            </div>
          </div>
          <div style="width: 100px;">
            <div class="progress-track">
              <div class="progress-bar-fill ${parseFloat(m.progress) >= 50 ? 'green' : 'amber'}" style="width: ${m.progress};"></div>
            </div>
          </div>
          <button class="btn-sm btn-secondary" onclick="openAssignModalForMember('${m.name}')">Giao việc</button>
        </div>
      </div>
    `).join('');
  }

  // Render Orders Table
  const ordersTbody = document.getElementById('teamOrdersTableBody');
  if (ordersTbody) {
    ordersTbody.innerHTML = team.orders.map(o => {
      const pctNum = parseFloat(o.pct) || 0;
      const isSuccess = pctNum >= 50;
      const factoryFirstChar = o.factory.charAt(0);
      const leadLastChar = o.lead.split(' ').slice(-1)[0].charAt(0);
      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="badge-avatar blue" style="width: 32px; height: 32px; font-size: 13px; border-radius: 8px;">
                ${factoryFirstChar}
              </div>
              <div>
                <strong style="font-size: 13.5px; color: var(--text-main);">${o.factory}</strong>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${o.orderName}</div>
              </div>
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="avatar-xs teal" style="width: 26px; height: 26px; font-size: 11px;">
                ${leadLastChar}
              </div>
              <strong style="color: var(--text-main);">${o.lead}</strong>
            </div>
          </td>
          <td><strong>${o.target}</strong> <span style="font-size: 12px; color: var(--text-muted);">người</span></td>
          <td><strong style="color: var(--color-success); font-size: 14px;">${o.actual}</strong> <span style="font-size: 12px; color: var(--text-muted);">người</span></td>
          <td style="min-width: 180px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; margin-bottom: 5px;">
              <span style="color: ${isSuccess ? 'var(--color-success)' : 'var(--color-warning)'};">${o.pct}</span>
              <span style="font-size: 11.5px; color: var(--text-muted); font-weight: 500;">${o.actual}/${o.target}</span>
            </div>
            <div class="progress-track" style="height: 7px; background: #e2e8f0; border-radius: 4px;">
              <div class="progress-bar-fill ${isSuccess ? 'green' : 'amber'}" style="width: ${o.pct}; height: 100%; border-radius: 4px;"></div>
            </div>
          </td>
          <td><span class="status-pill ${o.status === 'Đang chạy' ? 'success' : 'danger'}">${o.status}</span></td>
          <td style="text-align: center;">
            <button class="btn-sm btn-secondary" onclick="filterOrderForFactory('${o.factory.split(' ')[0]}')" title="Xem chi tiết nhà máy và danh sách lao động">Xem chi tiết</button>
          </td>
        </tr>
      `;
    }).join('');
  }
};

// Switch Team Active View
window.switchTeam = function(teamId, updateUrl = true) {
  state.currentTeam = teamId;
  state.currentModule = 'team';

  // Ensure in desktop layout
  appRoot.classList.remove('mobile-mode');
  desktopLayout.style.display = 'flex';
  mobileDeviceFrame.style.display = 'none';

  // Hide all module views
  document.querySelectorAll('.module-view').forEach(view => {
    view.style.display = 'none';
  });

  // Show team view
  const teamView = document.getElementById('viewTeam');
  if (teamView) {
    teamView.style.display = 'flex';
  }

  // Update navigation items active state
  sidebarNavItems.forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.factory-list .sub-item').forEach(sub => sub.classList.remove('active'));
  document.querySelectorAll('.cycle-item, .cycle-header').forEach(ci => ci.classList.remove('active'));
  
  // Update sub-items
  document.querySelectorAll('.team-list .sub-item').forEach(sub => {
    sub.classList.toggle('active', sub.getAttribute('data-team-id') === teamId);
  });

  renderTeamView(teamId);

  if (updateUrl) {
    updateUrlHash('teams/' + teamId);
  }
};

// Switch Team Tab (KPI / Factories / Interviews)
window.switchTeamTab = function(tabName) {
  state.currentTeamTab = tabName;
  const tabs = document.querySelectorAll('#viewTeam .tab-btn');
  tabs.forEach(t => t.classList.remove('active'));

  const team = state.teams[state.currentTeam || 'vinh-phuc'];
  if (!team) return;

  const memberContainer = document.getElementById('teamMemberListContainer');
  const ordersTbody = document.getElementById('teamOrdersTableBody');

  if (tabName === 'kpi') {
    tabs[0]?.classList.add('active');
    renderTeamView(state.currentTeam);
  } else if (tabName === 'factories') {
    tabs[1]?.classList.add('active');
    if (memberContainer) {
      memberContainer.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 16px;">
          <h4 style="font-size: 14px; margin-bottom: 8px; color: var(--primary-blue);">Danh sách nhà máy trọng điểm nhóm đang chăm sóc</h4>
          <p style="font-size: 13px; color: var(--text-secondary);">Nhóm phụ trách toàn diện quy trình tiếp nhận chỉ tiêu từ nhà máy, điều phối ứng viên đến phỏng vấn, làm thủ tục nhận việc và chấm công hàng ngày.</p>
        </div>
      `;
    }
  } else if (tabName === 'interviews') {
    tabs[2]?.classList.add('active');
    if (memberContainer) {
      memberContainer.innerHTML = `
        <div class="data-table-card" style="margin-top: 0;">
          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>Ứng viên</th>
                  <th>Số điện thoại</th>
                  <th>Vị trí ứng tuyển</th>
                  <th>Thời gian hẹn</th>
                  <th>Chuyên viên phụ trách</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                ${team.interviews.map(inv => `
                  <tr>
                    <td><strong>${inv.candidate}</strong></td>
                    <td>${inv.phone}</td>
                    <td>${inv.factory}</td>
                    <td><span style="color: var(--primary-blue); font-weight: 600;">${inv.date}</span></td>
                    <td>${inv.recruiter}</td>
                    <td><span class="status-pill success">${inv.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  }
};

// Open target modal pre-selecting a member
window.openAssignModalForMember = function(memberName) {
  openModal('modalAssignTarget');
  const select = document.getElementById('assignMember');
  if (select) select.value = memberName;
};

// Filter orders by factory name
window.filterOrderForFactory = function(factoryKey) {
  switchModule('orders');
  const input = document.getElementById('orderSearchInput');
  if (input) {
    input.value = factoryKey;
    input.dispatchEvent(new Event('input'));
  }
};

// Handle Assign Target Submit
window.handleAssignTarget = function(e) {
  e.preventDefault();
  const team = state.teams[state.currentTeam || 'vinh-phuc'];
  const memberName = document.getElementById('assignMember').value;
  const num = parseInt(document.getElementById('assignNumber').value) || 0;
  const factory = document.getElementById('assignFactory').value;

  if (team) {
    team.target += num;
    const member = team.members.find(m => m.name === memberName);
    if (member) {
      member.target += num;
      member.progress = ((member.actual / member.target) * 100).toFixed(1) + '%';
    }
    team.pct = ((team.actual / team.target) * 100).toFixed(1) + '%';
  }

  // Audit log
  state.auditLogs.unshift({
    time: new Date().toLocaleString('vi-VN'),
    user: state.currentRole,
    role: state.currentRole,
    action: 'ASSIGN_KPI',
    target: `team (${team?.name})`,
    detail: `Giao thêm chỉ tiêu ${num} người cho ${memberName} tại ${factory}`,
    ip: '127.0.0.1'
  });

  closeModal('modalAssignTarget');
  renderTeamView(state.currentTeam);
  alert(`Đã giao thêm chỉ tiêu ${num} người cho ${memberName} thành công!`);
};

// Factory Management Logic & Dynamic View (NHÀ MÁY ĐANG THEO DÕI)
window.renderFactoryView = function(factoryCode) {
  const factory = state.factories[factoryCode || state.currentFactory || 'WESUM'];
  if (!factory) return;

  state.currentFactory = factory.code;

  // Header & Subtitles
  const avatarEl = document.getElementById('factoryHeaderAvatar');
  const titleEl = document.getElementById('factoryDetailTitle');
  const subEl = document.getElementById('factoryDetailSubtitle');

  if (avatarEl) {
    avatarEl.className = `badge-avatar ${factory.colorClass}`;
    avatarEl.textContent = factory.avatar;
  }
  if (titleEl) titleEl.textContent = factory.name;
  if (subEl) subEl.textContent = `${factory.address} · Hotline: ${factory.hotline} · Người phụ trách: ${factory.lead}`;

  // KPIs
  const wCountEl = document.getElementById('factoryWorkerCount');
  const fulfillEl = document.getElementById('factoryFulfillment');
  const progBarEl = document.getElementById('factoryProgressBar');
  const attRateEl = document.getElementById('factoryAttendanceRate');
  const attDetailEl = document.getElementById('factoryAttendanceDetail');
  const geoTextEl = document.getElementById('factoryGeofenceText');
  const priceRateEl = document.getElementById('factoryPriceRate');
  const revEl = document.getElementById('factoryRevenue');

  if (wCountEl) wCountEl.innerHTML = `${factory.actual} / ${factory.target} <span>người</span>`;
  if (fulfillEl) fulfillEl.innerHTML = `Tỷ lệ lấp đầy: <strong>${factory.pct}</strong> (Chỉ tiêu tháng 10: ${factory.target} người)`;
  if (progBarEl) progBarEl.style.width = factory.pct;
  if (attRateEl) attRateEl.innerHTML = `${factory.attRate} <span>đúng giờ</span>`;
  if (attDetailEl) attDetailEl.textContent = factory.attDetail;
  if (geoTextEl) geoTextEl.textContent = `Bán kính Geofence: ${factory.geofenceRadius} mét`;
  if (priceRateEl) priceRateEl.innerHTML = `${factory.rate} <span>/ngày</span>`;
  if (revEl) revEl.innerHTML = `Doanh thu dự kiến T10: <strong>${factory.revenue}</strong>`;

  // Tab content
  const container = document.getElementById('factoryTabContentContainer');
  if (!container) return;

  const currentTab = state.currentFactoryTab || 'overview';

  if (currentTab === 'overview') {
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; color: var(--text-main);">
          Các đơn hàng cung ứng đang tuyển dụng cho ${factory.code}
        </h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${factory.orders.map(o => `
            <div class="team-member-card">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <strong style="font-size: 14.5px; color: var(--text-main);">${o.name}</strong>
                  <span class="status-pill success">${o.status}</span>
                  <code>${o.code}</code>
                </div>
                <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px;">
                  Ca làm việc: <strong>${o.shift}</strong> · Mức lương: <strong style="color: var(--primary-blue);">${o.salary}</strong>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                <div style="text-align: right;">
                  <div style="font-size: 11.5px; color: var(--text-muted);">Đã tiếp nhận</div>
                  <div style="font-size: 14px; font-weight: 700; color: var(--text-main);">
                    ${o.filled} / ${o.count} người <span style="font-size: 12px; color: var(--color-success);">(${o.pct})</span>
                  </div>
                </div>
                <div style="width: 100px;">
                  <div class="progress-track">
                    <div class="progress-bar-fill green" style="width: ${o.pct};"></div>
                  </div>
                </div>
                <button class="btn-sm btn-primary" onclick="openModal('modalCreateWorker')">+ Thêm NLĐ</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (currentTab === 'workers') {
    const factoryWorkers = state.workers.filter(w => w.company === factory.code);
    const canViewCCCD = ['DIRECTOR', 'VICE_DIRECTOR', 'RECRUITER'].includes(state.currentRole);

    container.innerHTML = `
      <div class="data-table-card" style="margin-top: 0;">
        <div class="table-card-header">
          <div>
            <h3>Danh sách Người lao động tại ${factory.code} (${factoryWorkers.length} người)</h3>
            <p>Hồ sơ công nhân thời vụ và chính thức đang làm việc thực tế</p>
          </div>
          <button class="btn-sm btn-secondary" onclick="exportDataCSV('nha_may')">Xuất CSV</button>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Số điện thoại</th>
                <th>CCCD</th>
                <th>Vị trí</th>
                <th>Loại hình</th>
                <th>Người tuyển</th>
                <th>Ngày công</th>
                <th>Tạm ứng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              ${factoryWorkers.length > 0 ? factoryWorkers.map(w => `
                <tr>
                  <td>
                    <div class="worker-user-cell" onclick="viewWorkerDetail(${w.id})" title="Nhấn để xem chi tiết hồ sơ & ảnh CCCD">
                      <div class="worker-avatar-thumb ${w.avatarColor || 'avatar-blue'}" style="width: 28px; height: 28px; font-size: 11.5px;">
                        ${w.initials || w.name.charAt(w.name.lastIndexOf(' ') + 1) || 'N'}
                      </div>
                      <strong class="worker-name-text">${w.name}</strong>
                    </div>
                  </td>
                  <td>${w.phone}</td>
                  <td>${formatCitizenId(w.citizen_id, canViewCCCD)}</td>
                  <td>${w.position}</td>
                  <td><span class="status-pill info">${w.type}</span></td>
                  <td>${w.recruiter}</td>
                  <td><strong>${w.worked_days} ngày</strong></td>
                  <td>${w.advance > 0 ? `<span style="color: var(--color-danger); font-weight: 600;">${formatVND(w.advance)}</span>` : '0 VNĐ'}</td>
                  <td><span class="status-pill ${w.status === 'Đang làm' ? 'success' : 'warning'}">${w.status}</span></td>
                </tr>
              `).join('') : `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px;">Chưa có lao động nào được gán vào nhà máy này.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (currentTab === 'gps') {
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
        <div class="kpi-card" style="border-left: 4px solid var(--primary-blue);">
          <div class="kpi-title">CẤU HÌNH TRẠM CHẤM CÔNG GPS (GEOFENCING)</div>
          <div style="margin-top: 12px; font-size: 13.5px; line-height: 1.8;">
            <div><strong>Địa chỉ trạm:</strong> ${factory.gps.address}</div>
            <div><strong>Tọa độ GPS:</strong> <code>${factory.gps.lat}, ${factory.gps.lng}</code></div>
            <div><strong>Bán kính hợp lệ:</strong> <strong style="color: var(--color-success); font-size: 15px;">${factory.geofenceRadius} mét</strong></div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">
              * Công nhân khi check-in qua App Mobile nếu nằm ngoài bán kính ${factory.geofenceRadius}m sẽ bị gắn cờ "Ngoài vùng GPS" và gửi cảnh báo đến quản lý.
            </div>
          </div>
          <div style="margin-top: 16px;">
            <button class="btn-sm btn-primary" onclick="changeGeofenceRadius('${factory.code}')">Đổi bán kính GPS</button>
          </div>
        </div>

        <div class="kpi-card" style="border-left: 4px solid var(--color-success);">
          <div class="kpi-title">TỔNG HỢP CHẤM CÔNG HÔM NAY</div>
          <div style="display: flex; gap: 20px; align-items: center; margin-top: 16px;">
            <div style="font-size: 32px; font-weight: 800; color: var(--color-success);">${factory.attRate}</div>
            <div style="font-size: 13px; color: var(--text-secondary);">
              <div><strong>37</strong> check-in đúng giờ</div>
              <div><strong>1</strong> đi muộn (&lt; 15 phút)</div>
              <div><strong>0</strong> vắng mặt không phép</div>
            </div>
          </div>
        </div>
      </div>

      <div class="data-table-card" style="margin-top: 0;">
        <div class="table-card-header">
          <h3>Nhật ký Check-in GPS thời gian thực tại ${factory.code}</h3>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Ca làm việc</th>
                <th>Giờ vào</th>
                <th>Tọa độ GPS Check-in</th>
                <th>Độ lệch khoảng cách</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              ${state.attendances.filter(a => a.company.includes(factory.code)).map(a => `
                <tr>
                  <td><strong>${a.name}</strong></td>
                  <td>${a.shift}</td>
                  <td><strong style="color: var(--primary-blue);">${a.in}</strong></td>
                  <td><code>${a.gps.split('(')[0]}</code></td>
                  <td><span class="status-pill success">${a.gps.includes('(') ? a.gps.split('(')[1].replace(')', '') : '15m'}</span></td>
                  <td><span class="status-pill ${a.status === 'PRESENT' ? 'success' : 'warning'}">${a.status === 'PRESENT' ? 'Hợp lệ' : 'Đi muộn'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (currentTab === 'vendors') {
    container.innerHTML = `
      <div class="data-table-card" style="margin-top: 0;">
        <div class="table-card-header">
          <div>
            <h3>Các Vendor đang cùng cấp lao động vào ${factory.code}</h3>
            <p>Phân bổ hạn ngạch và theo dõi số lượng lao động từ đối tác tuyển dụng</p>
          </div>
          <button class="btn-sm btn-primary" onclick="openModal('modalCreateWorker')">+ Cấp thêm số lượng</button>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Tên Vendor / Đơn vị cung ứng</th>
                <th>Số lao động đang cấp</th>
                <th>Người phụ trách Vendor</th>
                <th>Số điện thoại</th>
                <th>Trạng thái cung ứng</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${factory.vendors.map(v => `
                <tr>
                  <td><strong>${v.name}</strong></td>
                  <td><strong style="color: var(--primary-blue); font-size: 14px;">${v.count} người</strong></td>
                  <td><strong>${v.lead}</strong></td>
                  <td>${v.phone}</td>
                  <td><span class="status-pill success">${v.status}</span></td>
                  <td><button class="btn-sm btn-secondary" onclick="alert('Xem hợp đồng & thanh toán phí cho ${v.name}')">Chi tiết phí</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
};

// Switch Factory Active View (NHÀ MÁY ĐANG THEO DÕI)
window.switchFactory = function(factoryCode, updateUrl = true) {
  state.currentFactory = factoryCode;
  state.currentModule = 'factory';

  // Ensure in desktop layout
  appRoot.classList.remove('mobile-mode');
  desktopLayout.style.display = 'flex';
  mobileDeviceFrame.style.display = 'none';

  // Hide all module views
  document.querySelectorAll('.module-view').forEach(view => {
    view.style.display = 'none';
  });

  // Show factory view
  const factoryView = document.getElementById('viewFactory');
  if (factoryView) {
    factoryView.style.display = 'flex';
  }

  // Update navigation items active state
  sidebarNavItems.forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.team-list .sub-item').forEach(sub => sub.classList.remove('active'));
  document.querySelectorAll('.cycle-item, .cycle-header').forEach(ci => ci.classList.remove('active'));
  
  // Update factory list sub-items
  document.querySelectorAll('.factory-list .sub-item').forEach(sub => {
    sub.classList.toggle('active', sub.getAttribute('data-factory-name') === factoryCode);
  });

  renderFactoryView(factoryCode);

  if (updateUrl) {
    updateUrlHash('factories/' + factoryCode);
  }
};

// Switch Factory Tab (Overview / Workers / GPS / Vendors)
window.switchFactoryTab = function(tabName) {
  state.currentFactoryTab = tabName;
  const tabs = document.querySelectorAll('#viewFactory .tab-btn');
  tabs.forEach(t => t.classList.remove('active'));

  const tabIndexMap = { 'overview': 0, 'workers': 1, 'gps': 2, 'vendors': 3 };
  if (tabs[tabIndexMap[tabName]]) {
    tabs[tabIndexMap[tabName]].classList.add('active');
  }

  renderFactoryView(state.currentFactory);
};

// Change Geofence Radius
window.changeGeofenceRadius = function(factoryCode) {
  const factory = state.factories[factoryCode || state.currentFactory];
  if (!factory) return;

  const newRadius = prompt(`Nhập bán kính Geofence GPS mới cho ${factory.name} (mét):`, factory.geofenceRadius);
  if (newRadius && !isNaN(newRadius) && parseInt(newRadius) > 0) {
    factory.geofenceRadius = parseInt(newRadius);
    
    state.auditLogs.unshift({
      time: new Date().toLocaleString('vi-VN'),
      user: state.currentRole,
      role: state.currentRole,
      action: 'UPDATE_GEOFENCE',
      target: `factories (${factory.code})`,
      detail: `Cập nhật bán kính GPS thành ${factory.geofenceRadius}m tại ${factory.name}`,
      ip: '127.0.0.1'
    });

    renderFactoryView(factory.code);
    alert(`Đã cập nhật bán kính Geofence thành công: ${factory.geofenceRadius}m!`);
  }
};

// Cycle Management Logic & Dynamic View (CHU KỲ)
window.renderCycleView = function(cycleId) {
  const cycle = state.cycles[cycleId || state.currentCycle || 'T10-2026'];
  if (!cycle) return;

  state.currentCycle = cycle.id;

  // Header & Subtitles
  const titleEl = document.getElementById('cycleDetailTitle');
  const subEl = document.getElementById('cycleDetailSubtitle');
  const statusEl = document.getElementById('cycleDetailStatus');

  if (titleEl) titleEl.textContent = cycle.title;
  if (subEl) subEl.textContent = `Thuộc ${cycle.quarter} · Khung thời gian: ${cycle.range} · Hạn chốt công tính lương: ${cycle.deadline}`;
  if (statusEl) {
    statusEl.className = `status-pill ${cycle.statusClass}`;
    statusEl.textContent = cycle.status;
  }

  // KPIs
  const headEl = document.getElementById('cycleHeadcount');
  const progTextEl = document.getElementById('cycleProgressText');
  const progBarEl = document.getElementById('cycleProgressBar');
  const revEl = document.getElementById('cycleRevenue');
  const expEl = document.getElementById('cycleExpense');
  const profEl = document.getElementById('cycleProfit');
  const daysEl = document.getElementById('cycleDaysTotal');
  const advEl = document.getElementById('cycleAdvanceTotal');

  if (headEl) headEl.innerHTML = `${cycle.actual} / ${cycle.target} <span>lao động</span>`;
  if (progTextEl) progTextEl.innerHTML = cycle.progressText;
  if (progBarEl) progBarEl.style.width = cycle.pct;
  if (revEl) revEl.innerHTML = `${cycle.revenue} <span></span>`;
  if (expEl) expEl.innerHTML = `Chi phí Vendor & Tạm ứng: <strong>${cycle.expense}</strong>`;
  if (profEl) profEl.innerHTML = `Lợi nhuận gộp: ${cycle.profit}`;
  if (daysEl) daysEl.innerHTML = `${cycle.totalDays} <span></span>`;
  if (advEl) advEl.innerHTML = `Đã duyệt tạm ứng: <strong>${cycle.advance}</strong> (${cycle.advanceCount} lượt)`;

  // Tab content
  const container = document.getElementById('cycleTabContentContainer');
  if (!container) return;

  const currentTab = state.currentCycleTab || 'orders';

  if (currentTab === 'orders') {
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; color: var(--text-main);">
          Các đơn hàng cung ứng ghi nhận trong ${cycle.title}
        </h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div class="team-member-card">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <strong style="font-size: 14.5px; color: var(--text-main);">WESUM – Lắp ráp linh kiện điện tử</strong>
                <span class="status-pill success">Đang chạy</span>
              </div>
              <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px;">
                Phụ trách: <strong>Trần Thu Hà</strong> · 35 lao động · Tỷ lệ lấp đầy: <strong style="color: var(--color-success);">80.0%</strong>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 20px;">
              <div style="text-align: right;">
                <div style="font-size: 14px; font-weight: 700;">28 / 35 người</div>
              </div>
              <button class="btn-sm btn-secondary" onclick="switchFactory('WESUM')">Xem nhà máy</button>
            </div>
          </div>

          <div class="team-member-card">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <strong style="font-size: 14.5px; color: var(--text-main);">OJTEK – QC Ngoại quan & Vận hành máy</strong>
                <span class="status-pill success">Đang chạy</span>
              </div>
              <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px;">
                Phụ trách: <strong>Vũ Văn Cường</strong> · 35 lao động · Tỷ lệ lấp đầy: <strong style="color: var(--color-success);">68.6%</strong>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 20px;">
              <div style="text-align: right;">
                <div style="font-size: 14px; font-weight: 700;">24 / 35 người</div>
              </div>
              <button class="btn-sm btn-secondary" onclick="switchFactory('OJTEK')">Xem nhà máy</button>
            </div>
          </div>

          <div class="team-member-card">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <strong style="font-size: 14.5px; color: var(--text-main);">SUNGJEE – Công nhân đóng gói sản phẩm</strong>
                <span class="status-pill warning">Cần đẩy nhanh</span>
              </div>
              <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px;">
                Phụ trách: <strong>Đỗ Minh Thắng</strong> · 20 lao động · Tỷ lệ lấp đầy: <strong style="color: var(--color-warning);">75.0%</strong>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 20px;">
              <div style="text-align: right;">
                <div style="font-size: 14px; font-weight: 700;">15 / 20 người</div>
              </div>
              <button class="btn-sm btn-secondary" onclick="switchFactory('SUNGJEE')">Xem nhà máy</button>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (currentTab === 'payroll') {
    container.innerHTML = `
      <div class="data-table-card" style="margin-top: 0;">
        <div class="table-card-header">
          <div>
            <h3>Bảng Quyết Toán Tiền Lương & Tạm Ứng - ${cycle.title}</h3>
            <p>Dữ liệu tính lương dựa trên chấm công GPS thực tế</p>
          </div>
          <button class="btn-sm btn-secondary" onclick="exportDataCSV('bang_luong')">Xuất Bảng Lương</button>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Nhà máy</th>
                <th>Loại hình</th>
                <th>Số ngày công</th>
                <th>Đơn giá</th>
                <th>Tổng lương</th>
                <th>Tạm ứng</th>
                <th>Thực lĩnh</th>
              </tr>
            </thead>
            <tbody>
              ${state.workers.map(w => {
                const gross = w.worked_days * w.daily_rate;
                const net = gross - w.advance;
                return `
                  <tr>
                    <td>
                      <div class="worker-user-cell" onclick="viewWorkerDetail(${w.id})" title="Nhấn để xem chi tiết hồ sơ & ảnh CCCD">
                        <div class="worker-avatar-thumb ${w.avatarColor || 'avatar-blue'}" style="width: 28px; height: 28px; font-size: 11.5px;">
                          ${w.initials || w.name.charAt(w.name.lastIndexOf(' ') + 1) || 'N'}
                        </div>
                        <strong class="worker-name-text">${w.name}</strong>
                      </div>
                    </td>
                    <td>${w.company}</td>
                    <td><span class="status-pill info">${w.type}</span></td>
                    <td><strong>${w.worked_days} ngày</strong></td>
                    <td>${formatVND(w.daily_rate)}</td>
                    <td><strong>${formatVND(gross)}</strong></td>
                    <td>${w.advance > 0 ? `<span style="color: var(--color-danger); font-weight: 600;">${formatVND(w.advance)}</span>` : '0 VNĐ'}</td>
                    <td><strong style="color: #0d9488; font-size: 14px;">${formatVND(net)}</strong></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (currentTab === 'commission') {
    const canViewCommission = ['DIRECTOR', 'VICE_DIRECTOR'].includes(state.currentRole);
    if (!canViewCommission) {
      container.innerHTML = `
        <div class="data-table-card" style="text-align: center; padding: 40px 20px;">
          <div style="font-size: 36px; margin-bottom: 12px;"></div>
          <h3 style="font-size: 16px; margin-bottom: 8px;">Dữ liệu Hoa hồng bị hạn chế quyền truy cập</h3>
          <p style="font-size: 13px; color: var(--text-muted);">Chỉ Giám đốc điều hành và Phó Giám đốc mới có quyền xem bảng tính hoa hồng chu kỳ theo quy định bảo mật.</p>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="data-table-card" style="margin-top: 0;">
          <div class="table-card-header">
            <div>
              <h3>Hoa hồng Cung ứng dự kiến - ${cycle.title} (Công thức: Đơn giá x Ngày công)</h3>
              <p>Quyền hạn: Giám đốc / Phó Giám đốc</p>
            </div>
            <button class="btn-sm btn-secondary" onclick="exportDataCSV('hoa_hong')">Xuất Hoa Hồng</button>
          </div>
          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Nhà máy</th>
                  <th>Số ngày công</th>
                  <th>Đơn giá hoa hồng</th>
                  <th>Hoa hồng dự kiến</th>
                  <th>Trạng thái đối soát</th>
                </tr>
              </thead>
              <tbody>
                ${state.workers.map(w => {
                  const unitRate = 35000;
                  const comm = w.worked_days * unitRate;
                  return `
                    <tr>
                      <td>
                        <div class="worker-user-cell" onclick="viewWorkerDetail(${w.id})" title="Nhấn để xem chi tiết hồ sơ & ảnh CCCD">
                          <div class="worker-avatar-thumb ${w.avatarColor || 'avatar-blue'}" style="width: 28px; height: 28px; font-size: 11.5px;">
                            ${w.initials || w.name.charAt(w.name.lastIndexOf(' ') + 1) || 'N'}
                          </div>
                          <strong class="worker-name-text">${w.name}</strong>
                        </div>
                      </td>
                      <td>${w.company}</td>
                      <td><strong>${w.worked_days} công</strong></td>
                      <td>${formatVND(unitRate)}/ngày</td>
                      <td><strong style="color: #7c3aed; font-size: 14px;">${formatVND(comm)}</strong></td>
                      <td><span class="status-pill success">Khớp GPS</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  } else if (currentTab === 'growth') {
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="kpi-card">
          <div class="kpi-title">SO SÁNH TĂNG TRƯỞNG VỚI CHU KỲ TRƯỚC</div>
          <div style="margin-top: 16px; font-size: 13.5px; line-height: 2;">
            <div><strong>Lượng lao động cung ứng:</strong> <span style="color: var(--color-success); font-weight: 700;">+14.2%</span> (So với tháng trước)</div>
            <div><strong>Doanh thu dịch vụ:</strong> <span style="color: var(--color-success); font-weight: 700;">+18.5%</span> (Đạt 545 triệu VNĐ)</div>
            <div><strong>Tỷ lệ đi làm đúng giờ GPS:</strong> <span style="color: var(--primary-blue); font-weight: 700;">98.5%</span> (+1.2%)</div>
            <div><strong>Số lượng nhà máy hợp tác:</strong> <strong>4 nhà máy</strong> (WESUM, OJTEK, SUNGJEE, AMO)</div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">ĐÁNH GIÁ CHẤT LƯỢNG CHU KỲ</div>
          <div style="margin-top: 16px; font-size: 13.5px; line-height: 2;">
            <div><strong>Độ hài lòng nhà máy:</strong> <span style="color: var(--color-success); font-weight: 700;">4.8 / 5.0</span></div>
            <div><strong>Tỷ lệ nghỉ việc đột xuất:</strong> <span style="color: var(--color-success); font-weight: 700;">&lt; 3%</span> (Rất tốt)</div>
            <div><strong>Hiệu quả điều phối Vendor:</strong> <strong>38 lao động</strong> từ đối tác</div>
          </div>
        </div>
      </div>
    `;
  }
};

// Switch Cycle Active View (CHU KỲ)
window.switchCycle = function(cycleId, updateUrl = true) {
  state.currentCycle = cycleId;
  state.currentModule = 'cycle';

  // Ensure in desktop layout
  appRoot.classList.remove('mobile-mode');
  desktopLayout.style.display = 'flex';
  mobileDeviceFrame.style.display = 'none';

  // Hide all module views
  document.querySelectorAll('.module-view').forEach(view => {
    view.style.display = 'none';
  });

  // Show cycle view
  const cycleView = document.getElementById('viewCycle');
  if (cycleView) {
    cycleView.style.display = 'flex';
  }

  // Update navigation items active state
  sidebarNavItems.forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.team-list .sub-item').forEach(sub => sub.classList.remove('active'));
  document.querySelectorAll('.factory-list .sub-item').forEach(sub => sub.classList.remove('active'));
  
  // Update cycle list sub-items
  document.querySelectorAll('.cycle-item, .cycle-header').forEach(ci => {
    ci.classList.toggle('active', ci.getAttribute('data-cycle-id') === cycleId);
  });

  renderCycleView(cycleId);

  if (updateUrl) {
    updateUrlHash('cycles/' + cycleId);
  }
};

// Switch Cycle Tab (Orders / Payroll / Commission / Growth)
window.switchCycleTab = function(tabName) {
  state.currentCycleTab = tabName;
  const tabs = document.querySelectorAll('#viewCycle .tab-btn');
  tabs.forEach(t => t.classList.remove('active'));

  const tabIndexMap = { 'orders': 0, 'payroll': 1, 'commission': 2, 'growth': 3 };
  if (tabs[tabIndexMap[tabName]]) {
    tabs[tabIndexMap[tabName]].classList.add('active');
  }

  renderCycleView(state.currentCycle);
};

// Lock Cycle Data
window.lockCycleData = function() {
  const cycle = state.cycles[state.currentCycle || 'T10-2026'];
  if (!cycle) return;

  if (confirm(`Bạn có chắc chắn muốn CHỐT SỔ & KHÓA DỮ LIỆU cho ${cycle.title}?\n\nSau khi khóa, dữ liệu chấm công và bảng lương sẽ được cố định để xuất hóa đơn.`)) {
    cycle.status = 'Đã khóa sổ';
    cycle.statusClass = 'info';

    state.auditLogs.unshift({
      time: new Date().toLocaleString('vi-VN'),
      user: state.currentRole,
      role: state.currentRole,
      action: 'LOCK_CYCLE',
      target: `cycles (${cycle.id})`,
      detail: `Khóa sổ và chốt quyết toán ${cycle.title}`,
      ip: '127.0.0.1'
    });

    renderCycleView(cycle.id);
    alert(`Đã chốt sổ thành công cho ${cycle.title}!`);
  }
};

// CSV Export Generator (Works offline on browser)
window.exportDataCSV = function(moduleName) {
  let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
  let filename = `trangway_${moduleName}_${new Date().toISOString().slice(0, 10)}.csv`;

  if (moduleName === 'nguoi_lao_dong') {
    csvContent += 'Mã NLĐ,Họ và tên,Số ĐT,Quê quán,Công ty,Vị trí,Loại hình,Recruiter,Trạng thái\n';
    state.workers.forEach(w => {
      csvContent += `"${w.code}","${w.name}","${w.phone}","${w.hometown}","${w.company}","${w.position}","${w.type}","${w.recruiter}","${w.status}"\n`;
    });
  } else if (moduleName === 'bang_luong') {
    csvContent += 'Mã NLĐ,Họ tên,Công ty,Loại hình,Số ngày công,Đơn giá/ngày,Tổng lương,Tạm ứng,Thực lĩnh\n';
    state.workers.forEach(w => {
      const gross = w.worked_days * w.daily_rate;
      const net = gross - w.advance;
      csvContent += `"${w.code}","${w.name}","${w.company}","${w.type}","${w.worked_days}","${w.daily_rate}","${gross}","${w.advance}","${net}"\n`;
    });
  } else if (moduleName === 'nhom_tuyen_dung') {
    const team = state.teams[state.currentTeam || 'vinh-phuc'];
    csvContent += 'Thành viên,Chức vụ,Chỉ tiêu giao,Đã đi làm,Tiến độ,Tỷ lệ đậu PV,Đánh giá\n';
    team.members.forEach(m => {
      csvContent += `"${m.name}","${m.role}","${m.target}","${m.actual}","${m.progress}","${m.passRate}","${m.rating}"\n`;
    });
  } else if (moduleName === 'nha_may') {
    const f = state.factories[state.currentFactory || 'WESUM'];
    const factoryWorkers = state.workers.filter(w => w.company === f.code);
    csvContent += 'Mã NLĐ,Họ tên,Số ĐT,CCCD,Nhà máy,Vị trí,Loại hình,Recruiter,Ngày công,Trạng thái\n';
    factoryWorkers.forEach(w => {
      csvContent += `"${w.code}","${w.name}","${w.phone}","${w.citizen_id}","${w.company}","${w.position}","${w.type}","${w.recruiter}","${w.worked_days}","${w.status}"\n`;
    });
  } else if (moduleName === 'chu_ky') {
    const c = state.cycles[state.currentCycle || 'T10-2026'];
    csvContent += 'Chu kỳ,Khung thời gian,Hạn chốt,Chỉ tiêu,Thực đạt,Doanh thu,Chi phí,Lợi nhuận gộp\n';
    csvContent += `"${c.title}","${c.range}","${c.deadline}","${c.target}","${c.actual}","${c.revenue}","${c.expense}","${c.profit}"\n`;
  } else {
    csvContent += 'Mã,Nội dung,Số tiền,Trạng thái\n';
    csvContent += '"Báo cáo kết xuất từ Trang Way","Hoạt động bình thường","100%","Đã xác nhận"\n';
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Desktop Tree Table Toggle Function
window.toggleTreeGroup = function(groupId) {
  const children = document.getElementById(`children-${groupId}`);
  const arrow = document.getElementById(`arrow-${groupId}`);
  if (children && arrow) {
    if (children.style.display === 'none') {
      children.style.display = 'block';
      arrow.textContent = '▼';
      arrow.classList.remove('collapsed');
    } else {
      children.style.display = 'none';
      arrow.textContent = '▶';
      arrow.classList.add('collapsed');
    }
  }
};

// Mobile Accordion Toggle Function
window.toggleMobAcc = function(accId) {
  const body = document.getElementById(`${accId}`);
  const arrow = document.getElementById(`m-arrow-${accId.replace('m-', '')}`);
  if (body) {
    if (body.style.display === 'none') {
      body.style.display = 'block';
      if (arrow) arrow.textContent = '▼';
    } else {
      body.style.display = 'none';
      if (arrow) arrow.textContent = '▶';
    }
  }
};

// ========================================================
// MOBILE NAVIGATION & INTERACTIVE CONTROLS
// ========================================================
window.switchMobileNavTab = function(tabName, updateUrl = true) {
  // Ensure we are in mobile view mode
  appRoot.classList.add('mobile-mode');
  desktopLayout.style.display = 'none';
  mobileDeviceFrame.style.display = 'block';

  // Mobile Views
  const views = {
    'orders': document.getElementById('mobileOrdersView'),
    'targets': document.getElementById('mobileTargetsView'),
    'workers': document.getElementById('mobileWorkersView'),
    'more': document.getElementById('mobileMoreView')
  };

  // Hide all mobile views, then show target
  Object.keys(views).forEach(key => {
    if (views[key]) views[key].style.display = 'none';
  });

  if (views[tabName]) {
    views[tabName].style.display = 'flex';
  }

  // Update active status for all bottom navs
  document.querySelectorAll('.mobile-bottom-nav').forEach(nav => {
    const buttons = nav.querySelectorAll('.mobile-nav-btn');
    buttons.forEach(btn => {
      const onclickAttr = btn.getAttribute('onclick') || '';
      btn.classList.toggle('active', onclickAttr.includes(`'${tabName}'`));
    });
  });

  // If switching to workers tab, render workers list
  if (tabName === 'workers') {
    renderMobileWorkers();
  }

  // Update URL hash
  if (updateUrl) {
    updateUrlHash(`mobile-${tabName}`);
  }
};

// Filter orders on Mobile Screen 1 (Theo Tháng / Theo Quý / Theo Nhà Máy)
window.setMobileOrderFilter = function(filterType, el) {
  document.querySelectorAll('.mobile-tabs-strip .mobile-tab-item').forEach(item => {
    item.classList.remove('active');
  });
  if (el) el.classList.add('active');

  const container = document.querySelector('#mobileOrdersView .mobile-body-content');
  if (!container) return;

  if (filterType === 'quarter') {
    // Show quarterly summary
    container.innerHTML = `
      <div class="mobile-overview-card">
        <div class="mobile-overview-top">
          <div class="mobile-donut-gauge" style="width: 54px; height: 54px;">
            <svg viewBox="0 0 42 42" style="transform: rotate(-90deg); width: 100%; height: 100%;">
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e2e8f0" stroke-width="4"/>
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#0052cc" stroke-width="4" pathLength="100" stroke-dasharray="18.6 81.4" stroke-dashoffset="0"/>
            </svg>
            <div class="donut-center-label"><span style="font-size: 11px; font-weight: 700;">19%</span></div>
          </div>
          <div>
            <div class="mobile-overview-title">Tổng quan Quý 4/2026</div>
            <div class="mobile-overview-val">78 / 420 người</div>
            <div class="mobile-overview-sub">Tháng 10, 11, 12/2026</div>
          </div>
        </div>
      </div>
      <div class="mobile-section-heading">Chi tiết các tháng trong quý</div>
      <div class="mobile-accordion-card">
        <div class="mobile-acc-header" onclick="setMobileOrderFilter('month', document.querySelector('.mobile-tabs-strip .mobile-tab-item'))">
          <div class="mobile-acc-left">
            <span class="status-pill success" style="font-size: 10px;">Đang chạy</span>
            <div class="mobile-acc-title">Tháng 10/2026</div>
          </div>
          <span class="mobile-acc-pct">48,3% (58/120)</span>
        </div>
      </div>
      <div class="mobile-accordion-card">
        <div class="mobile-acc-header">
          <div class="mobile-acc-left">
            <span class="status-pill warning" style="font-size: 10px;">Sắp tới</span>
            <div class="mobile-acc-title">Tháng 11/2026</div>
          </div>
          <span class="mobile-acc-pct" style="color: var(--text-muted);">0% (0/140)</span>
        </div>
      </div>
      <div class="mobile-accordion-card">
        <div class="mobile-acc-header">
          <div class="mobile-acc-left">
            <span class="status-pill warning" style="font-size: 10px;">Sắp tới</span>
            <div class="mobile-acc-title">Tháng 12/2026</div>
          </div>
          <span class="mobile-acc-pct" style="color: var(--text-muted);">0% (0/160)</span>
        </div>
      </div>
    `;
  } else {
    // Restore default month orders
    container.innerHTML = `
      <!-- WESUM -->
      <div class="mobile-order-card" onclick="openMobOrderDetail('WESUM')">
        <div class="mobile-order-top">
          <div class="mobile-donut-gauge">
            <svg viewBox="0 0 42 42" style="transform: rotate(-90deg); width: 100%; height: 100%;">
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e2e8f0" stroke-width="4"/>
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#f59e0b" stroke-width="4" pathLength="100" stroke-dasharray="16 84" stroke-dashoffset="0"/>
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#10b981" stroke-width="4" pathLength="100" stroke-dasharray="52 48" stroke-dashoffset="-16"/>
            </svg>
            <div class="donut-center-label"><span style="font-size: 11px; font-weight: 700;">52%</span></div>
          </div>
          <div class="mobile-order-info">
            <div class="mobile-order-name">WESUM – Lắp ráp T10</div>
            <div class="mobile-order-manager">Phụ trách: Trần Thu Hà</div>
            <div class="mobile-status-tag success">Đúng tiến độ</div>
          </div>
        </div>
        <div class="mobile-stats-row">
          <div class="mobile-mini-stat"><div class="val">50</div><div class="lbl">Chỉ tiêu</div></div>
          <div class="mobile-mini-stat"><div class="val">26</div><div class="lbl">Đi làm</div></div>
          <div class="mobile-mini-stat"><div class="val">3</div><div class="lbl">Vị trí</div></div>
          <div class="mobile-mini-stat"><div class="val">2</div><div class="lbl">Vendor</div></div>
        </div>
        <div class="mobile-pos-list">
          <div class="mobile-pos-item"><div class="mobile-pos-meta"><span class="title">Công nhân lắp ráp</span><span class="ratio">18/30 · 60%</span></div><div class="progress-track"><div class="progress-bar-fill green" style="width: 60%"></div></div></div>
          <div class="mobile-pos-item"><div class="mobile-pos-meta"><span class="title">QC ngoại quan</span><span class="ratio">6/12 · 50%</span></div><div class="progress-track"><div class="progress-bar-fill green" style="width: 50%"></div></div></div>
          <div class="mobile-pos-item"><div class="mobile-pos-meta"><span class="title">Nhân viên kho</span><span class="ratio">2/8 · 25%</span></div><div class="progress-track"><div class="progress-bar-fill green" style="width: 25%"></div></div></div>
        </div>
      </div>

      <!-- OJTEK -->
      <div class="mobile-order-card" onclick="openMobOrderDetail('OJTEK')">
        <div class="mobile-order-top">
          <div class="mobile-donut-gauge">
            <svg viewBox="0 0 42 42" style="transform: rotate(-90deg); width: 100%; height: 100%;">
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e2e8f0" stroke-width="4"/>
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#f59e0b" stroke-width="4" pathLength="100" stroke-dasharray="47 53" stroke-dashoffset="0"/>
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#10b981" stroke-width="4" pathLength="100" stroke-dasharray="30 70" stroke-dashoffset="-47"/>
            </svg>
            <div class="donut-center-label"><span style="font-size: 11px; font-weight: 700;">47%</span></div>
          </div>
          <div class="mobile-order-info">
            <div class="mobile-order-name">OJTEK – QC & vận hành T10</div>
            <div class="mobile-order-manager">Phụ trách: Vũ Văn Cường</div>
            <div class="mobile-status-tag warning">Chậm tiến độ</div>
          </div>
        </div>
        <div class="mobile-stats-row">
          <div class="mobile-mini-stat"><div class="val">30</div><div class="lbl">Chỉ tiêu</div></div>
          <div class="mobile-mini-stat"><div class="val">14</div><div class="lbl">Đi làm</div></div>
          <div class="mobile-mini-stat"><div class="val">2</div><div class="lbl">Vị trí</div></div>
          <div class="mobile-mini-stat"><div class="val">1</div><div class="lbl">Vendor</div></div>
        </div>
        <div class="mobile-pos-list">
          <div class="mobile-pos-item"><div class="mobile-pos-meta"><span class="title">QC ngoại quan</span><span class="ratio">10/20 · 50%</span></div><div class="progress-track"><div class="progress-bar-fill green" style="width: 50%"></div></div></div>
          <div class="mobile-pos-item"><div class="mobile-pos-meta"><span class="title">Vận hành máy</span><span class="ratio">4/10 · 40%</span></div><div class="progress-track"><div class="progress-bar-fill green" style="width: 40%"></div></div></div>
        </div>
      </div>

      <!-- SUNGJEE -->
      <div class="mobile-order-card" onclick="openMobOrderDetail('SUNGJEE')">
        <div class="mobile-order-top">
          <div class="mobile-donut-gauge">
            <svg viewBox="0 0 42 42" style="transform: rotate(-90deg); width: 100%; height: 100%;">
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e2e8f0" stroke-width="4"/>
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#10b981" stroke-width="4" pathLength="100" stroke-dasharray="48 52" stroke-dashoffset="0"/>
            </svg>
            <div class="donut-center-label"><span style="font-size: 11px; font-weight: 700;">48%</span></div>
          </div>
          <div class="mobile-order-info">
            <div class="mobile-order-name">SUNGJEE – Đóng gói T10</div>
            <div class="mobile-order-manager">Phụ trách: Đỗ Minh Thắng</div>
            <div class="mobile-status-tag success">Đúng tiến độ</div>
          </div>
        </div>
        <div class="mobile-stats-row">
          <div class="mobile-mini-stat"><div class="val">25</div><div class="lbl">Chỉ tiêu</div></div>
          <div class="mobile-mini-stat"><div class="val">12</div><div class="lbl">Đi làm</div></div>
          <div class="mobile-mini-stat"><div class="val">1</div><div class="lbl">Vị trí</div></div>
          <div class="mobile-mini-stat"><div class="val">2</div><div class="lbl">Vendor</div></div>
        </div>
        <div class="mobile-pos-list">
          <div class="mobile-pos-item"><div class="mobile-pos-meta"><span class="title">Công nhân đóng gói</span><span class="ratio">12/25 · 48%</span></div><div class="progress-track"><div class="progress-bar-fill green" style="width: 48%"></div></div></div>
        </div>
      </div>

      <!-- AMO -->
      <div class="mobile-order-card" onclick="openMobOrderDetail('AMO')">
        <div class="mobile-order-top">
          <div class="mobile-donut-gauge">
            <svg viewBox="0 0 42 42" style="transform: rotate(-90deg); width: 100%; height: 100%;">
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e2e8f0" stroke-width="4"/>
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#ef4444" stroke-width="4" pathLength="100" stroke-dasharray="40 60" stroke-dashoffset="0"/>
            </svg>
            <div class="donut-center-label"><span style="font-size: 11px; font-weight: 700;">40%</span></div>
          </div>
          <div class="mobile-order-info">
            <div class="mobile-order-name">AMO – Sản xuất T10</div>
            <div class="mobile-order-manager">Phụ trách: Vũ Văn Cường</div>
            <div class="mobile-status-tag danger">Có rủi ro</div>
          </div>
        </div>
        <div class="mobile-stats-row">
          <div class="mobile-mini-stat"><div class="val">15</div><div class="lbl">Chỉ tiêu</div></div>
          <div class="mobile-mini-stat"><div class="val">6</div><div class="lbl">Đi làm</div></div>
          <div class="mobile-mini-stat"><div class="val">1</div><div class="lbl">Vị trí</div></div>
          <div class="mobile-mini-stat"><div class="val">0</div><div class="lbl">Vendor</div></div>
        </div>
        <div class="mobile-pos-list">
          <div class="mobile-pos-item"><div class="mobile-pos-meta"><span class="title">Công nhân sản xuất</span><span class="ratio">6/15 · 40%</span></div><div class="progress-track"><div class="progress-bar-fill red" style="width: 40%"></div></div></div>
        </div>
      </div>
    `;
  }
};

// Open order detail from mobile card
window.openMobOrderDetail = function(factoryCode) {
  switchMobileNavTab('targets');
  // Auto open the accordion for that factory
  const body = document.getElementById(`m-body-${factoryCode.toLowerCase()}`);
  const arrow = document.getElementById(`m-arrow-${factoryCode.toLowerCase()}`);
  if (body) {
    body.style.display = 'block';
    if (arrow) arrow.textContent = '▼';
  }
};

// Render Mobile Worker Cards (Screen 3)
window.renderMobileWorkers = function() {
  const container = document.getElementById('mobileWorkerListContainer');
  if (!container) return;

  const searchInput = document.getElementById('mobWorkerSearchInput');
  const term = (searchInput ? searchInput.value : '').toLowerCase().trim();

  const filtered = state.workers.filter(w => {
    return w.name.toLowerCase().includes(term) ||
           w.phone.includes(term) ||
           w.citizen_id.includes(term) ||
           w.company.toLowerCase().includes(term);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 14px; color: var(--text-muted);">
        <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
        <p style="font-size: 13px;">Không tìm thấy lao động phù hợp</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(w => {
    let statusClass = 'success';
    if (w.status === 'Chờ đi làm') statusClass = 'warning';
    if (w.status === 'Tạm nghỉ') statusClass = 'info';
    if (w.status === 'Nghỉ việc' || w.status === 'Không đi làm') statusClass = 'danger';

    const avatarInitial = w.initials || w.name.charAt(w.name.lastIndexOf(' ') + 1) || 'N';

    return `
      <div class="mobile-worker-card" onclick="viewWorkerDetail(${w.id})">
        <div class="mobile-worker-top-row">
          <div class="mobile-worker-main">
            <div class="worker-avatar-thumb ${w.avatarColor || 'avatar-blue'}" style="width: 36px; height: 36px; font-size: 13px;">
              ${avatarInitial}
            </div>
            <div>
              <strong style="font-size: 14px; color: var(--text-main);">${w.name}</strong>
              <div style="font-size: 11px; color: var(--text-muted);">${w.code} · ${w.hometown}</div>
            </div>
          </div>
          <span class="status-pill ${statusClass}" style="font-size: 10.5px;">${w.status}</span>
        </div>
        <div class="mobile-worker-meta-grid">
          <div>🏢 Nhà máy: <strong style="color: var(--text-main);">${w.company}</strong></div>
          <div>📞 SĐT: <strong style="color: var(--primary-blue);">${w.phone}</strong></div>
          <div>💼 Vị trí: <span>${w.position}</span></div>
          <div>⏱ Ngày công: <strong style="color: var(--color-success);">${w.worked_days} công</strong></div>
        </div>
      </div>
    `;
  }).join('');
};

// Event Listeners Setup
document.addEventListener('DOMContentLoaded', () => {
  // Bind View Mode Buttons
  viewButtons.forEach(btn => {
    btn.addEventListener('click', () => switchViewMode(btn.dataset.view));
  });

  // Bind Sidebar Nav Items
  sidebarNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const mod = item.dataset.module;
      document.querySelectorAll('.team-list .sub-item').forEach(sub => sub.classList.remove('active'));
      document.querySelectorAll('.factory-list .sub-item').forEach(sub => sub.classList.remove('active'));
      document.querySelectorAll('.cycle-item, .cycle-header').forEach(ci => ci.classList.remove('active'));
      if (mod) switchModule(mod);
    });
  });

  // Bind Sidebar Team Sub-items (NHÓM CỦA TÔI)
  const sideTeamVP = document.getElementById('sideTeamVP');
  if (sideTeamVP) {
    sideTeamVP.addEventListener('click', () => {
      switchTeam('vinh-phuc');
    });
  }

  const sideTeamHN = document.getElementById('sideTeamHN');
  if (sideTeamHN) {
    sideTeamHN.addEventListener('click', () => {
      switchTeam('ha-noi');
    });
  }

  // Bind Sidebar Factory Items (NHÀ MÁY ĐANG THEO DÕI)
  document.querySelectorAll('.factory-list .sub-item').forEach(item => {
    item.addEventListener('click', () => {
      const fName = item.getAttribute('data-factory-name');
      if (fName) switchFactory(fName);
    });
  });

  // Bind Sidebar Cycle Items (CHU KỲ)
  document.querySelectorAll('.cycle-item, .cycle-header').forEach(item => {
    item.addEventListener('click', () => {
      const cycleId = item.getAttribute('data-cycle-id');
      if (cycleId) switchCycle(cycleId);
    });
  });

  // Bind Role Selector
  if (roleSelector) {
    roleSelector.addEventListener('change', (e) => {
      state.currentRole = e.target.value;
      applyRBACRules();
    });
  }

  // Bind Filters
  const workerSearch = document.getElementById('workerSearchFilter');
  const workerCompany = document.getElementById('workerCompanyFilter');
  const workerStatus = document.getElementById('workerStatusFilter');
  const workerType = document.getElementById('workerTypeFilter');

  if (workerSearch) workerSearch.addEventListener('input', renderWorkersTable);
  if (workerCompany) workerCompany.addEventListener('change', renderWorkersTable);
  if (workerStatus) workerStatus.addEventListener('change', renderWorkersTable);
  if (workerType) workerType.addEventListener('change', renderWorkersTable);

  // Bind Mobile Worker Search Input
  const mobWorkerSearch = document.getElementById('mobWorkerSearchInput');
  if (mobWorkerSearch) {
    mobWorkerSearch.addEventListener('input', renderMobileWorkers);
  }

  // Search filter for orders
  const orderSearchInput = document.getElementById('orderSearchInput');
  if (orderSearchInput) {
    orderSearchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      document.querySelectorAll('#viewOrders .order-card').forEach(card => {
        const title = card.getAttribute('data-title').toLowerCase();
        const content = card.textContent.toLowerCase();
        card.style.display = (title.includes(term) || content.includes(term)) ? 'grid' : 'none';
      });
    });
  }

  // Initial table & views rendering
  applyRBACRules();
  renderWorkersTable();
  renderAttendanceTable();
  renderPayrollTable();
  renderFinanceTable();
  renderCommissionTable();
  renderAuditTable();
  renderTeamView('vinh-phuc');
  renderFactoryView('WESUM');
  renderCycleView('T10-2026');
  renderMobileWorkers();

  // URL Hash Routing initialization & hashchange listener
  handleUrlRouting();
  window.addEventListener('hashchange', handleUrlRouting);

  // Close action dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.action-dropdown')) {
      document.querySelectorAll('.action-dropdown-menu').forEach(m => m.classList.remove('show'));
    }
  });
});

// Global URL Hash Router Handler
window.handleUrlRouting = function() {
  const hash = (window.location.hash || '').replace(/^#\/?/, '').trim();
  if (!hash) {
    switchModule('orders', true);
    return;
  }

  const parts = hash.split('/');
  const main = parts[0];
  const sub = parts[1];

  if (main === 'mobile-orders') {
    switchMobileNavTab('orders', false);
  } else if (main === 'mobile-targets') {
    switchMobileNavTab('targets', false);
  } else if (main === 'mobile-workers') {
    switchMobileNavTab('workers', false);
  } else if (main === 'mobile-more') {
    switchMobileNavTab('more', false);
  } else if (main === 'teams') {
    switchTeam(sub || 'vinh-phuc', false);
  } else if (main === 'factories') {
    switchFactory(sub || 'WESUM', false);
  } else if (main === 'cycles') {
    switchCycle(sub || 'T10-2026', false);
  } else if (['dashboard', 'orders', 'workers', 'attendance', 'payroll', 'finance', 'commission', 'audit', 'companies', 'vendors'].includes(main)) {
    appRoot.classList.remove('mobile-mode');
    desktopLayout.style.display = 'flex';
    mobileDeviceFrame.style.display = 'none';
    switchModule(main, false);
  } else {
    switchModule('orders', true);
  }
};





