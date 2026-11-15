// =========================================================================
// CẤU HÌNH DÀNH CHO GITHUB PAGES (TÙY CHỌN)
// Dán thông số Firebase của bạn vào đây nếu muốn mọi người vào link GitHub
// đều tự động kết nối chung 1 Bảng xếp hạng & Phòng STEM:
// =========================================================================
const GITHUB_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// =========================================================================
// 1. ĐỊNH MỨC KINH TẾ NHIÊN LIỆU BAY (FUEL ECONOMY CONSTANTS)
// =========================================================================
const FUEL_RULES = {
  STARTER_FUEL: 20,
  RING_ENTRY_COST: { 1: 0, 2: 15, 3: 30 },
  RING_FIRST_CLEAR_REWARD: { 1: 20, 2: 25, 3: 40 },
  RING_PRACTICE_REWARD: 10,
  MYSTERY_BOX_REWARD: 15,
  ARENA_PER_CORRECT: 2,
  STEM_PROJECT_REWARD: 30,
  LIBRARY_DOC_REWARD: 10,
  LIFELINE_5050_COST: 10,
  LIFELINE_TIME_COST: 5,
};

// =========================================================================
// 2. BỘ KIỂM TRA DỮ LIỆU, BÓC TÁCH FIREBASE CONFIG & TRỘN ĐỀ
// =========================================================================
const Validator = {
  sanitizeText(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>?/gm, '').trim();
  },

  getTodayLocalISO() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  },

  shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  },

  shuffleQuestions(questions) {
    return this.shuffleArray(questions).map((q) => {
      const rightAnsText = String(q.options[q.answer]);
      const mixedOpts = this.shuffleArray(q.options.map(String));
      return { ...q, options: mixedOpts, answer: mixedOpts.indexOf(rightAnsText) };
    });
  },

  parseFirebaseConfig(rawInput) {
    if (!rawInput || typeof rawInput !== 'string') return null;
    const trimmed = rawInput.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.apiKey && parsed.projectId) return parsed;
    } catch (_) {
      const keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
      const extracted = {};
      keys.forEach((k) => {
        const reg = new RegExp(`${k}\\s*:\\s*["']([^"']+)["']`);
        const match = trimmed.match(reg);
        if (match && match[1]) extracted[k] = match[1].trim();
      });
      if (extracted.apiKey && extracted.projectId) return extracted;
    }
    return null;
  },

  validateStemProject(raw, existingProjects = []) {
    const errors = {};
    const title = this.sanitizeText(raw.title);
    const category = this.sanitizeText(raw.category);
    const description = this.sanitizeText(raw.description);

    if (title.length < 5 || title.length > 100) {
      errors.title = 'Tên dự án phải từ 5 đến 100 ký tự hợp lệ.';
    } else if (existingProjects.some((p) => p.title.toLowerCase() === title.toLowerCase())) {
      errors.title = 'Tên dự án này đã tồn tại trên hệ thống.';
    }

    const memberRaw = String(raw.memberCount ?? '').trim();
    const memberNum = Number(memberRaw);
    if (memberRaw === '' || !Number.isFinite(memberNum) || !Number.isInteger(memberNum) || memberNum < 2 || memberNum > 10) {
      errors.memberCount = 'Yêu cầu số nguyên từ 2 đến 10 thành viên (không nhận 1, số âm hay số lẻ).';
    }

    const budgetRaw = String(raw.budget ?? '').trim();
    const budgetNum = Number(budgetRaw);
    if (budgetRaw === '' || !Number.isFinite(budgetNum) || budgetNum < 0 || budgetNum > 500000000) {
      errors.budget = 'Kinh phí phải là số không âm (0 – 500.000.000 VNĐ).';
    }

    const dateStr = String(raw.eventDate ?? '').trim();
    const todayStr = this.getTodayLocalISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      errors.eventDate = 'Vui lòng chọn ngày tổ chức hợp lệ.';
    } else if (dateStr < todayStr) {
      errors.eventDate = `Ngày báo cáo không được nằm trong quá khứ (tối thiểu từ ${todayStr}).`;
    }

    if (description.length < 15 || description.length > 500) {
      errors.description = 'Mô tả nguyên lý cần từ 15 đến 500 ký tự.';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      cleaned: {
        title,
        category: category || 'Vật lý & Kỹ thuật',
        memberCount: memberNum,
        budget: budgetNum,
        eventDate: dateStr,
        description,
      },
    };
  },

  validateLibraryResource(raw) {
    const errors = {};
    const title = this.sanitizeText(raw.title);
    const summary = this.sanitizeText(raw.summary);
    const url = this.sanitizeText(raw.url);
    if (title.length < 5 || title.length > 80) errors.title = 'Tiêu đề tài liệu cần từ 5 đến 80 ký tự.';
    if (summary.length < 10 || summary.length > 300) errors.summary = 'Tóm tắt nội dung cần từ 10 đến 300 ký tự.';
    if (url && !/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(url)) errors.url = 'Liên kết phải bắt đầu bằng http:// hoặc https://.';
    return { isValid: Object.keys(errors).length === 0, errors, cleaned: { title, summary, url } };
  },

  clampNumber(val, min, max, fallback) {
    const num = Number(val);
    return Number.isFinite(num) ? Math.min(max, Math.max(min, num)) : fallback;
  },
};

// =========================================================================
// 3. ĐỘNG CƠ SINH CÂU HỎI ĐỘNG (PROCEDURAL STEM GENERATOR)
// =========================================================================
const DynamicQuestionGenerator = {
  randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  generateForPlanetTier(planetId, tier) {
    if (planetId === 'mercury') {
      if (tier === 1) {
        const dec = this.randInt(11, 59);
        const bin = dec.toString(2);
        const w1 = (dec + 1).toString(2);
        const w2 = (dec - 1).toString(2);
        const w3 = (dec + 2).toString(2);
        return {
          q: `[Đề động] Số nguyên thập phân ${dec} khi chuyển sang hệ nhị phân (cơ số 2) có giá trị là bao nhiêu?`,
          options: [`${bin}₂`, `${w1}₂`, `${w2}₂`, `${w3}₂`],
          answer: 0,
          topic: 'Hệ nhị phân & Biểu diễn số',
          explain: `Chia liên tiếp ${dec} cho 2 và lấy số dư ngược từ dưới lên ta được ${bin}₂.`,
          subject: 'Công nghệ & Tin học'
        };
      }
      if (tier === 2) {
        const k = this.randInt(7, 13);
        const n = Math.pow(2, k);
        return {
          q: `[Đề động] Với danh sách gồm ${n.toLocaleString('vi-VN')} phần tử đã được sắp xếp, thuật toán Tìm kiếm nhị phân (Binary Search) cần tối đa khoảng bao nhiêu bước chia đôi?`,
          options: [`${k} bước`, `${n / 2} bước`, `${k * 3} bước`, `${n} bước`],
          answer: 0,
          topic: 'Thuật toán tìm kiếm & Big-O',
          explain: `Do log₂(${n}) = ${k}, thuật toán tìm kiếm nhị phân chỉ cần tối đa ${k} lần chia đôi không gian tìm kiếm.`,
          subject: 'Công nghệ & Tin học'
        };
      }
    }

    if (planetId === 'mars') {
      if (tier === 1) {
        const tMax = this.randInt(2, 6);
        const a = 5;
        const b = 2 * a * tMax;
        const c = this.randInt(1, 9);
        const hMax = -a * tMax * tMax + b * tMax + c;
        return {
          q: `[Đề động] Độ cao của một tên lửa mô hình được xác định bởi h(t) = -5t² + ${b}t + ${c} (m). Độ cao cực đại mà tên lửa đạt được là bao nhiêu?`,
          options: [`${hMax} m`, `${hMax - 5} m`, `${b + c} m`, `${tMax * 10} m`],
          answer: 0,
          topic: 'Hàm số bậc hai & Cực trị',
          explain: `Đỉnh parabol đạt tại t = -b/(2a) = ${b}/10 = ${tMax} giây. Thay t = ${tMax} vào hàm số: h(${tMax}) = -5(${tMax}²) + ${b}(${tMax}) + ${c} = ${hMax} m.`,
          subject: 'Toán học'
        };
      }
      if (tier === 2) {
        const n = this.randInt(5, 11);
        const ways = (n * (n - 1)) / 2;
        return {
          q: `[Đề động] Một câu lạc bộ STEM có ${n} thành viên. Có bao nhiêu cách chọn ra 2 bạn bất kỳ để tham gia ban điều phối (không phân biệt chức vụ)?`,
          options: [`${ways} cách`, `${n * (n - 1)} cách`, `${n * 2} cách`, `${ways + n} cách`],
          answer: 0,
          topic: 'Tổ hợp & Xác suất',
          explain: `Áp dụng công thức tổ hợp chập 2 của ${n}: C(${n}, 2) = (${n} × ${n - 1}) / 2 = ${ways} cách.`,
          subject: 'Toán học'
        };
      }
      if (tier === 3) {
        const side = this.randInt(6, 16);
        const perimeter = side * 4;
        const maxArea = side * side;
        return {
          q: `[Đề động] Trong các hình chữ nhật có cùng chu vi bằng ${perimeter} cm, diện tích lớn nhất có thể đạt được là bao nhiêu?`,
          options: [`${maxArea} cm²`, `${maxArea - 4} cm²`, `${side * 2} cm²`, `${maxArea + 8} cm²`],
          answer: 0,
          topic: 'Đạo hàm & Bài toán tối ưu',
          explain: `Nửa chu vi a + b = ${perimeter / 2} cm. Theo BĐT Cauchy, diện tích S = a·b ≤ [(a+b)/2]² = ${side}² = ${maxArea} cm².`,
          subject: 'Toán học'
        };
      }
    }

    if (planetId === 'earth') {
      if (tier === 1) {
        const t = this.randInt(2, 6);
        const g = 10;
        const h = 0.5 * g * t * t;
        const v = g * t;
        return {
          q: `[Đề động] Một vật rơi tự do không vận tốc đầu từ độ cao ${h} m xuống đất (lấy g = 10 m/s²). Vận tốc của vật ngay khi chạm đất là:`,
          options: [`${v} m/s`, `${v / 2} m/s`, `${h} m/s`, `${v + 10} m/s`],
          answer: 0,
          topic: 'Động học & Bảo toàn cơ năng',
          explain: `Áp dụng định luật bảo toàn cơ năng: v = √(2gh) = √(2 × 10 × ${h}) = ${v} m/s.`,
          subject: 'Khoa học Tự nhiên'
        };
      }
      if (tier === 3) {
        const A = this.randInt(2, 6) * 100;
        const G = this.randInt(2, 6) * 100;
        const H = 2 * A + 3 * G;
        return {
          q: `[Đề động] Một phân tử ADN có ${A} nucleotide loại Adenine (A) và ${G} nucleotide loại Guanine (G). Tổng số liên kết hydro của ADN này là:`,
          options: [`${H} liên kết`, `${2 * A + 2 * G} liên kết`, `${3 * A + 2 * G} liên kết`, `${A + G} liên kết`],
          answer: 0,
          topic: 'Di truyền phân tử & ADN',
          explain: `A liên kết với T bằng 2 liên kết H, G liên kết với X bằng 3 liên kết H ⇒ Tổng H = 2A + 3G = 2(${A}) + 3(${G}) = ${H}.`,
          subject: 'Khoa học Tự nhiên'
        };
      }
    }

    return null;
  }
};

// =========================================================================
// 4. DỮ LIỆU 5 HÀNH TINH & NGÂN HÀNG CÂU HỎI NỀN TẢNG
// =========================================================================
const PLANETS_DATA = [
  {
    id: 'mercury', code: 'SAO THỦY', name: 'Sao Thủy', subject: 'Công nghệ & Tin học',
    orbitRadius: 72, planetRadius: 9, color: '#06B6D4', angularSpeed: 0.0085, initialAngle: 0.4,
    tagline: 'Tốc độ xử lý, tư duy thuật toán, cấu trúc dữ liệu và an toàn mạng.',
    keyConcepts: [
      { title: 'Chuyển đổi Hệ Nhị Phân (Base-2)', formula: 'N = Σ bᵢ · 2ⁱ (với bᵢ ∈ {0, 1})', detail: 'Mọi dữ liệu trong máy tính đều biểu diễn qua bit 0 và 1. Với n bit không dấu, giá trị cực đại là 2ⁿ - 1.' },
      { title: 'Độ phức tạp thuật toán Big-O', formula: 'O(1) < O(log n) < O(n) < O(n log n) < O(n²)', detail: 'Tìm kiếm nhị phân trên mảng đã sắp xếp đạt O(log n), nhanh hơn vượt bậc so với tìm tuần tự O(n).' },
      { title: 'Cổng Logic & Bảo Mật Ứng Dụng', formula: 'AND (A·B), OR (A+B), NOT (Ā), XOR (A ⊕ B)', detail: 'Cổng XOR trả về 1 khi hai đầu vào khác nhau. Luôn lọc thẻ HTML đầu vào để chống lỗ hổng XSS.' },
    ],
    tiers: [
      {
        tier: 1, name: 'Vòng 1: Vệ Tinh — Hệ Nhị Phân & Dữ Liệu', xpReward: 40, fuelReward: FUEL_RULES.RING_FIRST_CLEAR_REWARD[1], entryCost: FUEL_RULES.RING_ENTRY_COST[1],
        brief: 'Nắm vững cách biểu diễn số nguyên sang hệ nhị phân và đơn vị đo lường thông tin (Bit, Byte).',
        questions: [
          { q: '1 Byte tiêu chuẩn bao gồm bao nhiêu bit?', options: ['4 bit', '8 bit', '16 bit', '32 bit'], answer: 1, topic: 'Hệ nhị phân & Biểu diễn số', explain: '1 Byte chuẩn gồm 8 bit, biểu diễn được 2⁸ = 256 trạng thái.' },
          { q: 'Với 4 bit không dấu, giá trị nguyên lớn nhất biểu diễn được là bao nhiêu?', options: ['8', '15', '16', '31'], answer: 1, topic: 'Hệ nhị phân & Biểu diễn số', explain: '4 bit toàn số 1 (1111₂) có giá trị là 2⁴ - 1 = 15.' },
        ],
      },
      {
        tier: 2, name: 'Vòng 2: Bề Mặt — Thuật Toán & Tìm Kiếm', xpReward: 60, fuelReward: FUEL_RULES.RING_FIRST_CLEAR_REWARD[2], entryCost: FUEL_RULES.RING_ENTRY_COST[2],
        brief: 'Phân tích hiệu năng thuật toán tìm kiếm và sắp xếp trên tập dữ liệu lớn.',
        questions: [
          { q: 'Điều kiện bắt buộc để áp dụng thuật toán Tìm kiếm nhị phân (Binary Search) là gì?', options: ['Mảng chỉ chứa số nguyên dương', 'Mảng đã được sắp xếp theo thứ tự', 'Số phần tử là lũy thừa của 2', 'Mảng không có số âm'], answer: 1, topic: 'Thuật toán tìm kiếm & Big-O', explain: 'Binary Search chia đôi khoảng tìm kiếm nên bắt buộc mảng phải được sắp xếp trước.' },
          { q: 'Hai vòng lặp lồng nhau duyệt qua tất cả cặp (i, j) của mảng n phần tử có độ phức tạp nào?', options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], answer: 2, topic: 'Thuật toán tìm kiếm & Big-O', explain: 'Tổng số phép lặp là n × n = n², độ phức tạp O(n²).' },
        ],
      },
      {
        tier: 3, name: 'Vòng 3: Lõi Năng Lượng — Mạch Logic & Bảo Mật', xpReward: 90, fuelReward: FUEL_RULES.RING_FIRST_CLEAR_REWARD[3], entryCost: FUEL_RULES.RING_ENTRY_COST[3],
        brief: 'Vận dụng đại số Boole và nguyên tắc an toàn dữ liệu trong hệ thống mạng.',
        questions: [
          { q: 'Cho đầu vào A = 1, B = 1. Đầu ra của biểu thức NOT(A XOR B) là gì?', options: ['0', '1', 'Không xác định', '2'], answer: 1, topic: 'Cổng logic & Đại số Boole', explain: '1 XOR 1 = 0, sau đó NOT(0) = 1.' },
          { q: 'Giao thức HTTPS bảo vệ dữ liệu truyền tải trên Internet chủ yếu nhờ cơ chế nào?', options: ['Nén dữ liệu bằng ZIP', 'Mã hóa TLS/SSL kết hợp chứng thực khóa công khai', 'Ẩn địa chỉ MAC', 'Tăng băng thông cáp quang'], answer: 1, topic: 'An toàn thông tin & Mạng', explain: 'HTTPS dùng giao thức TLS/SSL để mã hóa đường truyền giữa trình duyệt và máy chủ.' },
          { q: 'Hàm băm mật mã (Cryptographic Hash) như SHA-256 có đặc tính nào sau đây?', options: ['Giải mã ngược dễ dàng về văn bản gốc', 'Tính một chiều; thay đổi 1 bit đầu vào làm thay đổi hoàn toàn chuỗi băm', 'Độ dài bằng dữ liệu gốc', 'Chỉ băm được số nguyên'], answer: 1, topic: 'An toàn thông tin & Mạng', explain: 'Hàm băm mật mã là hàm một chiều, dùng để kiểm tra tính toàn vẹn dữ liệu và lưu mật khẩu.' },
        ],
      },
    ],
  },
  {
    id: 'mars', code: 'SAO HỎA', name: 'Sao Hỏa', subject: 'Toán học',
    orbitRadius: 114, planetRadius: 11, color: '#EF4444', angularSpeed: 0.0062, initialAngle: 2.1,
    tagline: 'Độ chính xác tuyệt đối, hàm số bậc hai, xác suất và tối ưu hóa.',
    keyConcepts: [
      { title: 'Đỉnh Parabol Hàm Số Bậc Hai', formula: 'y = ax² + bx + c (a ≠ 0) ⇒ x_đỉnh = -b / (2a)', detail: 'Khi a < 0, hàm số đạt giá trị lớn nhất tại x = -b/(2a) — ứng dụng tính độ cao cực đại quỹ đạo.' },
      { title: 'Tổ Hợp & Xác Suất Cổ Điển', formula: 'C(n, k) = n! / [k!(n - k)!] ; P(A) = n(A) / n(Ω)', detail: 'Phân biệt rõ chỉnh hợp (có xét thứ tự) và tổ hợp (không xét thứ tự) khi đếm không gian mẫu.' },
      { title: 'Đạo Hàm & Cực Trị Hàm Số', formula: "(xⁿ)' = n·xⁿ⁻¹ ; f'(x₀) = 0 và đổi dấu qua x₀", detail: 'Đạo hàm biểu thị tốc độ biến thiên tức thời và giúp giải bài toán tối ưu chi phí vật liệu.' },
    ],
    tiers: [
      {
        tier: 1, name: 'Vòng 1: Vệ Tinh — Hàm Số Bậc Hai', xpReward: 40, fuelReward: FUEL_RULES.RING_FIRST_CLEAR_REWARD[1], entryCost: FUEL_RULES.RING_ENTRY_COST[1],
        brief: 'Xác định tọa độ đỉnh, trục đối xứng và điều kiện nghiệm của parabol.',
        questions: [
          { q: 'Phương trình x² - 6x + m = 0 có hai nghiệm thực phân biệt khi và chỉ khi:', options: ['m < 9', 'm > 9', 'm ≤ 9', 'm < 36'], answer: 0, topic: 'Hàm số bậc hai & Cực trị', explain: "Ta có Δ' = 9 - m > 0 ⇔ m < 9." },
          { q: 'Trục đối xứng của đồ thị hàm số y = 2x² - 8x + 5 là đường thẳng:', options: ['x = -2', 'x = 2', 'x = 4', 'x = -4'], answer: 1, topic: 'Hàm số bậc hai & Cực trị', explain: 'Trục đối xứng x = -b/(2a) = 8 / 4 = 2.' },
        ],
      },
      {
        tier: 2, name: 'Vòng 2: Bề Mặt — Tổ Hợp & Xác Suất', xpReward: 60, fuelReward: FUEL_RULES.RING_FIRST_CLEAR_REWARD[2], entryCost: FUEL_RULES.RING_ENTRY_COST[2],
        brief: 'Tính toán xác suất biến cố và bài toán đếm tổ hợp ứng dụng.',
        questions: [
          { q: 'Gieo đồng thời hai con xúc xắc cân đối. Xác suất để tổng số chấm trên hai mặt bằng 7 là:', options: ['1/6', '1/12', '5/36', '7/36'], answer: 0, topic: 'Tổ hợp & Xác suất', explain: 'Có 6 cặp tổng bằng 7 trên tổng số 36 kết quả đồng khả năng ⇒ 6/36 = 1/6.' },
          { q: 'Từ các chữ số {1, 2, 3, 4, 5} lập được bao nhiêu số tự nhiên có 3 chữ số khác nhau?', options: ['125', '60', '10', '15'], answer: 1, topic: 'Tổ hợp & Xác suất', explain: 'Số cách chọn là 5 × 4 × 3 = 60 số.' },
        ],
      },
      {
        tier: 3, name: 'Vòng 3: Lõi Năng Lượng — Tối Ưu Hóa Bằng Đạo Hàm', xpReward: 90, fuelReward: FUEL_RULES.RING_FIRST_CLEAR_REWARD[3], entryCost: FUEL_RULES.RING_ENTRY_COST[3],
        brief: 'Giải quyết bài toán tối ưu diện tích và chi phí bằng công cụ giải tích.',
        questions: [
          { q: 'Đạo hàm của hàm số f(x) = x³ - 3x² + 4 tại điểm x = 1 bằng:', options: ['-3', '0', '3', '2'], answer: 0, topic: 'Đạo hàm & Bài toán tối ưu', explain: "f'(x) = 3x² - 6x ⇒ f'(1) = 3 - 6 = -3." },
          { q: 'Giá trị nhỏ nhất của hàm số y = x + 4/x trên khoảng (0; +∞) là:', options: ['2', '4', '5', '8'], answer: 1, topic: 'Đạo hàm & Bài toán tối ưu', explain: 'Áp dụng BĐT Cauchy cho 2 số dương: x + 4/x ≥ 2√(x · 4/x) = 4.' },
        ],
      },
    ],
  },
  {
    id: 'earth', code: 'TRÁI ĐẤT', name: 'Trái Đất', subject: 'Khoa học Tự nhiên',
    orbitRadius: 158, planetRadius: 12, color: '#10B981', angularSpeed: 0.0046, initialAngle: 3.8,
    tagline: 'Quy luật vật lý, phản ứng chuẩn độ hóa học và cơ chế di truyền sự sống.',
    keyConcepts: [
      { title: 'Định Luật Bảo Toàn Cơ Năng', formula: 'W = W_đ + W_t = ½mv² + mgh = hằng số', detail: 'Khi bỏ qua lực cản không khí, động năng và thế năng chuyển hóa qua lại nhưng tổng cơ năng không đổi.' },
      { title: 'Phản Ứng Oxi Hóa – Khử & Thang pH', formula: 'pH = -log₁₀[H⁺] | Chất khử nhường e, chất oxi hóa nhận e', detail: 'Ghi nhớ: "Khử cho – O nhận". Phenolphthalein chuyển màu hồng khi môi trường kiềm có pH ≥ 8.2.' },
      { title: 'Nguyên Tắc Bổ Sung ADN & ARN', formula: 'ADN: A = T, G = X (H = 2A + 3G) | Phiên mã: A_gốc → U_mARN', detail: 'Trình tự nucleotide trên mạch gốc ADN quy định trình tự mARN và chuỗi polypeptide.' },
    ],
    tiers: [
      {
        tier: 1, name: 'Vòng 1: Vệ Tinh — Cơ Học & Năng Lượng', xpReward: 40, fuelReward: FUEL_RULES.RING_FIRST_CLEAR_REWARD[1], entryCost: FUEL_RULES.RING_ENTRY_COST[1],
        brief: 'Phân tích chuyển động rơi tự do và bảo toàn cơ năng trong trường trọng lực.',
        questions: [
          { q: 'Khi một vật được ném thẳng đứng lên cao (bỏ qua sức cản không khí), đại lượng nào sau đây không đổi?', options: ['Động năng', 'Thế năng trọng trường', 'Cơ năng toàn phần', 'Vận tốc'], answer: 2, topic: 'Động học & Bảo toàn cơ năng', explain: 'Trong trọng trường không ma sát, cơ năng toàn phần luôn được bảo toàn.' },
          { q: 'Nếu tăng vận tốc của một ô tô lên gấp 2 lần thì động năng của ô tô thay đổi thế nào?', options: ['Tăng 2 lần', 'Tăng 4 lần', 'Giảm 2 lần', 'Không đổi'], answer: 1, topic: 'Động học & Bảo toàn cơ năng', explain: 'W_đ = ½mv² tỉ lệ với bình phương vận tốc nên v tăng 2 lần thì W_đ tăng 4 lần.' },
        ],
      },
      {
        tier: 2, name: 'Vòng 2: Bề Mặt — Hóa Học & Tốc Độ Phản Ứng', xpReward: 60, fuelReward: FUEL_RULES.RING_FIRST_CLEAR_REWARD[2], entryCost: FUEL_RULES.RING_ENTRY_COST[2],
        brief: 'Xác định chất oxi hóa – khử và các yếu tố ảnh hưởng cân bằng hóa học.',
        questions: [
          { q: 'Trong phản ứng: Fe + CuSO₄ → FeSO₄ + Cu, kim loại sắt (Fe) đóng vai trò là gì?', options: ['Chất oxi hóa', 'Chất khử', 'Chất xúc tác', 'Môi trường phản ứng'], answer: 1, topic: 'Phản ứng oxi hóa - khử', explain: 'Fe nhường 2e (số oxi hóa tăng từ 0 lên +2) nên đóng vai trò là chất khử.' },
          { q: 'Yếu tố nào sau đây KHÔNG làm dịch chuyển cân bằng hóa học của phản ứng thuận nghịch?', options: ['Nhiệt độ', 'Nồng độ chất phản ứng', 'Chất xúc tác', 'Áp suất chung'], answer: 2, topic: 'Phản ứng oxi hóa - khử', explain: 'Chất xúc tác làm tăng tốc độ phản ứng thuận và nghịch như nhau nên không làm dịch chuyển cân bằng.' },
          { q: 'Số oxi hóa của nguyên tố Lưu huỳnh (S) trong phân tử H₂SO₄ là:', options: ['+2', '+4', '+6', '-2'], answer: 2, topic: 'Phản ứng oxi hóa - khử', explain: '2(+1) + x + 4(-2) = 0 ⇒ x = +6.' },
        ],
      },
      {
        tier: 3, name: 'Vòng 3: Lõi Năng Lượng — Di Truyền Học Phân Tử', xpReward: 90, fuelReward: FUEL_RULES.RING_FIRST_CLEAR_REWARD[3], entryCost: FUEL_RULES.RING_ENTRY_COST[3],
        brief: 'Giải mã cơ chế nhân đôi ADN, phiên mã và dòng năng lượng sinh thái.',
        questions: [
          { q: 'Một đoạn mạch gốc của gen có trình tự 3’-TAX-GGA-5’. Trình tự mARN được phiên mã từ đoạn này là:', options: ['5’-AUG-XXU-3’', '5’-ATG-CCT-3’', '3’-AUG-XXU-5’', '5’-UAC-GGA-3’'], answer: 0, topic: 'Di truyền phân tử & ADN', explain: 'Theo nguyên tắc bổ sung A-U, T-A, G-X, X-G: 3’-TAX-GGA-5’ phiên mã thành 5’-AUG-XXU-3’.' },
          { q: 'Trong chuỗi thức ăn, hiệu suất sinh thái chuyển hóa năng lượng giữa hai bậc dinh dưỡng liền kề thường đạt khoảng:', options: ['1%', '10%', '50%', '90%'], answer: 1, topic: 'Hệ sinh thái & Chuyển hóa năng lượng', explain: 'Khoảng 90% năng lượng thất thoát qua nhiệt và hô hấp, chỉ khoảng 10% truyền lên bậc kế tiếp.' },
        ],
      },
    ],
  },
  {
    id: 'saturn', code: 'SAO THỔ', name: 'Sao Thổ', subject: 'Ngôn ngữ (Văn & Anh)',
    orbitRadius: 204, planetRadius: 13, hasRing: true, color: '#F59E0B', angularSpeed: 0.0033, initialAngle: 5.2,
    tagline: 'Vành đai kết nối tư duy phản biện, nghị luận và Anh ngữ học thuật.',
    keyConcepts: [
      { title: 'Cấu Trúc Đoạn Văn Nghị Luận PEEL', formula: 'Point (Luận điểm) → Evidence (Dẫn chứng) → Explain (Phân tích) → Link (Kết nối)', detail: 'Giữ cho bài viết nghị luận xã hội và báo cáo khoa học chặt chẽ, thuyết phục.' },
      { title: 'Câu Điều Kiện Tiếng Anh (Conditionals)', formula: 'Type 2: If + S + V₂/ed, S + would + V₀ | Type 3: If + S + had P₂, S + would have P₂', detail: 'Type 2 diễn tả giả định trái hiện tại; Type 3 diễn tả giả định trái ngược quá khứ.' },
      { title: 'Thể Bị Động Trong Văn Bản Khoa Học', formula: 'S + be (chia thì) + V₃/ed (+ by agent)', detail: 'Báo cáo STEM tiếng Anh ưu tiên dùng câu bị động để nhấn mạnh quy trình khách quan.' },
    ],
    tiers: [
      {
        tier: 1, name: 'Vòng 1: Vệ Tinh — Tư Duy Lập Luận & Tiếng Việt', xpReward: 40, fuelReward: FUEL_RULES.RING_FIRST_CLEAR_REWARD[1], entryCost: FUEL_RULES.RING_ENTRY_COST[1],
        brief: 'Nhận diện lỗi ngữ pháp và thao tác lập luận trong văn bản nghị luận.',
        questions: [
          { q: 'Trong đoạn văn nghị luận, thao tác nào dùng để chia tách đối tượng nhằm làm sáng tỏ bản chất và nguyên nhân?', options: ['Thao tác phân tích', 'Thao tác bác bỏ', 'Thao tác so sánh', 'Thao tác bình luận'], answer: 0, topic: 'Tư duy nghị luận & Tiếng Việt', explain: 'Phân tích là chia nhỏ đối tượng thành các yếu tố để đi sâu xem xét bản chất.' },
          { q: 'Câu nào sau đây mắc lỗi thiếu chủ ngữ ngữ pháp?', options: ['Nhờ áp dụng phương pháp học chủ động, kết quả của nhóm đã cải thiện.', 'Anh ấy là một nhà khoa học trẻ tài năng.', 'Qua tác phẩm cho thấy tinh thần yêu nước nồng nàn của nhân dân ta.', 'Dữ liệu thực nghiệm chứng minh giả thuyết ban đầu là chính xác.'], answer: 2, topic: 'Tư duy nghị luận & Tiếng Việt', explain: '"Qua tác phẩm" là trạng ngữ, nối thẳng với vị ngữ "cho thấy..." khiến câu bị thiếu chủ ngữ.' },
          { q: 'Biện pháp tu từ nào gọi tên sự vật này bằng tên sự vật khác dựa trên nét tương đồng?', options: ['Hoán dụ', 'Ẩn dụ', 'Nói giảm nói tránh', 'Điệp ngữ'], answer: 1, topic: 'Tư duy nghị luận & Tiếng Việt', explain: 'Ẩn dụ dựa trên nét tương đồng ngầm ẩn giữa hai sự vật, hiện tượng.' },
        ],
      },
      {
        tier: 2, name: 'Vòng 2: Bề Mặt — Ngữ Pháp Tiếng Anh Học Thuật', xpReward: 60, fuelReward: FUEL_RULES.RING_FIRST_CLEAR_REWARD[2], entryCost: FUEL_RULES.RING_ENTRY_COST[2],
        brief: 'Làm chủ câu điều kiện, mệnh đề quan hệ và cấu trúc bị động khoa học.',
        questions: [
          { q: 'Chọn phương án đúng: "If the spacecraft ______ sufficient fuel, it would enter the outer orbit right now."', options: ['has', 'had', 'had had', 'will have'], answer: 1, topic: 'Ngữ pháp tiếng Anh học thuật', explain: 'Câu điều kiện loại 2 giả định trái với hiện tại ("right now") nên dùng quá khứ đơn (had).' },
          { q: 'Chuyển sang thể bị động: "Researchers tested the prototype under extreme temperatures."', options: ['The prototype was tested under extreme temperatures by researchers.', 'The prototype is tested under extreme temperatures by researchers.', 'The prototype has been tested under extreme temperatures.', 'The prototype were tested under extreme temperatures.'], answer: 0, topic: 'Ngữ pháp tiếng Anh học thuật', explain: 'Quá khứ đơn bị động với chủ ngữ số ít: was + V₃/ed (was tested).' },
          { q: 'Chọn từ nối phù hợp: "The experiment failed twice; ______, the team refined the sensor calibration and succeeded."', options: ['moreover', 'nevertheless', 'therefore', 'meanwhile'], answer: 1, topic: 'Ngữ pháp tiếng Anh học thuật', explain: '"Nevertheless" (tuy nhiên / dù vậy) nối hai mệnh đề có ý nghĩa tương phản.' },
        ],
      },
      {
        tier: 3, name: 'Vòng 3: Lõi Năng Lượng — Đọc Hiểu Khoa Học Tiếng Anh', xpReward: 90, fuelReward: FUEL_RULES.RING_FIRST_CLEAR_REWARD[3], entryCost: FUEL_RULES.RING_ENTRY_COST[3],
        brief: 'Đọc phân tích thuật ngữ chuyên ngành STEM và suy luận ý chính từ ngữ cảnh.',
        questions: [
          { q: 'Trong câu: "Unlike fossil fuels, solar energy is a renewable resource that mitigates carbon emissions." Từ "mitigates" gần nghĩa nhất với:', options: ['accelerates', 'reduces', 'generates', 'ignores'], answer: 1, topic: 'Đọc hiểu STEM tiếng Anh', explain: '"Mitigate" nghĩa là làm giảm nhẹ tác động tiêu cực (gần nghĩa nhất với reduce).' },
          { q: 'Thuật ngữ "peer-reviewed" trong nghiên cứu khoa học có nghĩa là gì?', options: ['Được viết bởi học sinh trung học', 'Được thẩm định độc lập bởi các chuyên gia cùng lĩnh vực trước khi công bố', 'Được đăng tải tự do không cần kiểm chứng', 'Được dịch tự động sang nhiều ngôn ngữ'], answer: 1, topic: 'Đọc hiểu STEM tiếng Anh', explain: 'Peer-reviewed là quy trình bình duyệt khoa học độc lập bởi các chuyên gia cùng ngành.' },
          { q: 'Chọn từ đúng: "Gravity on Mars is roughly 38% of Earth’s, which ______ astronauts to carry heavier loads."', options: ['prevents', 'enables', 'forbids', 'hesitates'], answer: 1, topic: 'Đọc hiểu STEM tiếng Anh', explain: 'Enable + O + to V: cho phép ai làm được việc gì.' },
        ],
      },
    ],
  },
  {
    id: 'jupiter', code: 'SAO MỘC', name: 'Sao Mộc', subject: 'Lịch sử',
    orbitRadius: 252, planetRadius: 15, color: '#D97706', angularSpeed: 0.0021, initialAngle: 1.1,
    tagline: 'Kho lưu trữ ký ức nhân loại, cách mạng công nghiệp và lịch sử vũ trụ.',
    keyConcepts: [
      { title: 'Bốn Cuộc Cách Mạng Công Nghiệp', formula: '1.0 (Hơi nước) → 2.0 (Điện khí) → 3.0 (Tự động hóa) → 4.0 (AI & IoT)', detail: 'Mỗi cuộc cách mạng đều bắt nguồn từ đột phá về năng lượng hoặc công nghệ xử lý thông tin.' },
      { title: 'Phương Pháp Phân Tích Sử Liệu', formula: 'Bối cảnh ra đời → Nguồn gốc (Sơ cấp/Thứ cấp) → Mục đích & Tính khách quan', detail: 'Sử liệu sơ cấp (văn bản gốc, hiện vật đương thời) luôn có độ tin cậy chứng thực cao nhất.' },
      { title: 'Cột Mốc Chinh Phục Không Gian', formula: '1957 (Sputnik 1) → 1961 (Yuri Gagarin) → 1969 (Apollo 11) → 1980 (Phạm Tuân)', detail: 'Kỷ nguyên vũ trụ mở đường cho vệ tinh viễn thông, định vị GPS và vật liệu mới.' },
    ],
    tiers: [
      {
        tier: 1, name: 'Vòng 1: Vệ Tinh — Các Cuộc Cách Mạng Công Nghiệp', xpReward: 40, fuelReward: FUEL_RULES.RING_FIRST_CLEAR_REWARD[1], entryCost: FUEL_RULES.RING_ENTRY_COST[1],
        brief: 'Hệ thống hóa đặc trưng cốt lõi của 4 cuộc cách mạng kỹ thuật nhân loại.',
        questions: [
          { q: 'Phát minh nào đóng vai trò biểu tượng khởi đầu cho Cách mạng Công nghiệp lần thứ nhất cuối thế kỷ XVIII?', options: ['Động cơ hơi nước của James Watt', 'Động cơ đốt trong chạy xăng', 'Máy tính điện tử ENIAC', 'Mạng Internet toàn cầu WWW'], answer: 0, topic: 'Lịch sử Cách mạng Công nghiệp', explain: 'Máy hơi nước của James Watt cơ khí hóa sản xuất, mở đầu CMCN 1.0.' },
          { q: 'Đặc trưng cốt lõi của Cách mạng Công nghiệp lần thứ ba (nửa sau thế kỷ XX) là gì?', options: ['Cơ giới hóa bằng sức nước', 'Sản xuất dây chuyền bằng điện năng', 'Sự ra đời của máy tính điện tử, tự động hóa và Internet', 'Công nghệ in 3D sinh học'], answer: 2, topic: 'Lịch sử Cách mạng Công nghiệp', explain: 'CMCN 3.0 gắn liền với bóng bán dẫn, máy tính điện tử và tự động hóa.' },
          { q: 'Cuộc Cách mạng Công nghiệp lần thứ nhất diễn ra đầu tiên tại quốc gia nào?', options: ['Pháp', 'Đức', 'Anh', 'Hoa Kỳ'], answer: 2, topic: 'Lịch sử Cách mạng Công nghiệp', explain: 'CMCN 1.0 khởi phát đầu tiên tại nước Anh vào nửa sau thế kỷ XVIII.' },
        ],
      },
      {
        tier: 2, name: 'Vòng 2: Bề Mặt — Lịch Sử Việt Nam & Tư Duy Sử Liệu', xpReward: 60, fuelReward: FUEL_RULES.RING_FIRST_CLEAR_REWARD[2], entryCost: FUEL_RULES.RING_ENTRY_COST[2],
        brief: 'Nắm vững các bước ngoặt lịch sử dân tộc và kỹ năng đánh giá sử liệu.',
        questions: [
          { q: 'Thắng lợi quân sự nào năm 1954 đã giáng đòn quyết định, buộc thực dân Pháp phải ký Hiệp định Giơ-ne-vơ?', options: ['Chiến dịch Việt Bắc 1947', 'Chiến dịch Biên giới 1950', 'Chiến dịch Điện Biên Phủ 1954', 'Chiến dịch Hồ Chí Minh 1975'], answer: 2, topic: 'Lịch sử Việt Nam hiện đại', explain: 'Chiến thắng Điện Biên Phủ (7/5/1954) đập tan kế hoạch Nava, dẫn tới Hiệp định Giơ-ne-vơ.' },
          { q: 'Tài liệu nào sau đây được phân loại là "sử liệu sơ cấp" (Primary Source)?', options: ['Sách giáo khoa Lịch sử biên soạn năm 2025', 'Bản gốc Tuyên ngôn Độc lập công bố ngày 2/9/1945', 'Bài viết tổng hợp trên bách khoa toàn thư', 'Phim tài liệu tái hiện chiến dịch'], answer: 1, topic: 'Phương pháp nghiên cứu lịch sử', explain: 'Bản gốc Tuyên ngôn Độc lập ra đời trực tiếp tại thời điểm sự kiện diễn ra nên là sử liệu sơ cấp.' },
          { q: 'Đường lối Đổi mới toàn diện đất nước ở Việt Nam được đề ra từ Đại hội Đảng lần thứ mấy (năm 1986)?', options: ['Đại hội IV', 'Đại hội V', 'Đại hội VI', 'Đại hội VII'], answer: 2, topic: 'Lịch sử Việt Nam hiện đại', explain: 'Đại hội VI (tháng 12/1986) khởi xướng đường lối Đổi mới toàn diện đất nước.' },
        ],
      },
      {
        tier: 3, name: 'Vòng 3: Lõi Năng Lượng — Lịch Sử Chinh Phục Vũ Trụ', xpReward: 90, fuelReward: FUEL_RULES.RING_FIRST_CLEAR_REWARD[3], entryCost: FUEL_RULES.RING_ENTRY_COST[3],
        brief: 'Khám phá những cột mốc đưa con người vượt khỏi bầu khí quyển Trái Đất.',
        questions: [
          { q: 'Vệ tinh nhân tạo đầu tiên của loài người được phóng lên quỹ đạo năm 1957 có tên là gì?', options: ['Explorer 1', 'Sputnik 1', 'Vostok 1', 'Voyager 1'], answer: 1, topic: 'Lịch sử khoa học vũ trụ', explain: 'Sputnik 1 được Liên Xô phóng ngày 4/10/1957 là vệ tinh nhân tạo đầu tiên của nhân loại.' },
          { q: 'Phi hành gia Việt Nam đầu tiên bay vào vũ trụ năm 1980 trên tàu Soyuz 37 là ai?', options: ['Phạm Tuân', 'Bùi Thanh Liêm', 'Nguyễn Văn Cốc', 'Trần Đại Nghĩa'], answer: 0, topic: 'Lịch sử khoa học vũ trụ', explain: 'Anh hùng Phạm Tuân bay vào vũ trụ ngày 23/7/1980 trên tàu Liên hợp 37 (Soyuz 37).' },
          { q: 'Kính viễn vọng không gian kế nhiệm Hubble, quan sát vũ trụ ở dải hồng ngoại sâu phóng cuối năm 2021 là:', options: ['Kepler', 'James Webb (JWST)', 'Cassini', 'Curiosity'], answer: 1, topic: 'Lịch sử khoa học vũ trụ', explain: 'Kính viễn vọng không gian James Webb (JWST) phóng ngày 25/12/2021.' },
        ],
      },
    ],
  },
];

const INITIAL_LIBRARY_DOCS = [
  { id: 'doc-1', planetId: 'mercury', title: 'Sổ tay Độ phức tạp Thuật toán & Cấu trúc dữ liệu cơ bản', type: 'ĐỀ CƯƠNG', summary: 'Bảng so sánh Big-O của mảng, danh sách liên kết, ngăn xếp, hàng đợi và cây tìm kiếm nhị phân.', url: 'https://vi.wikipedia.org/wiki/K%C3%BD_hi%E1%BB%87u_O_l%E1%BB%9Bn', authorId: 'system' },
  { id: 'doc-2', planetId: 'mars', title: 'Chuyên đề Ứng dụng Hàm số bậc hai & Đạo hàm trong bài toán tối ưu', type: 'TÀI LIỆU', summary: 'Mô hình toán thực tế về tối ưu diện tích, thể tích vật liệu và quỹ đạo chuyển động.', url: 'https://vi.wikipedia.org/wiki/%C4%90%E1%BA%A1o_h%C3%A0m', authorId: 'system' },
  { id: 'doc-3', planetId: 'earth', title: 'Hệ thống công thức Cơ học – Chuẩn độ pH – Di truyền phân tử', type: 'SỔ TAY', summary: 'Tóm tắt điều kiện áp dụng định luật bảo toàn cơ năng, tính pH và liên kết hydro ADN.', url: 'https://vi.wikipedia.org/wiki/C%C6%A1_n%C4%83ng', authorId: 'system' },
  { id: 'doc-4', planetId: 'saturn', title: 'Bộ từ vựng & Cấu trúc viết báo cáo khoa học tiếng Anh (STEM Writing)', type: 'ĐỀ CƯƠNG', summary: 'Tổng hợp động từ học thuật, mẫu câu mô tả biểu đồ và cấu trúc lập luận PEEL.', url: '', authorId: 'system' },
  { id: 'doc-5', planetId: 'jupiter', title: 'Niên biểu 4 Cuộc Cách mạng Công nghiệp & Lịch sử Hàng không Vũ trụ', type: 'TÀI LIỆU', summary: 'Sơ đồ chuỗi sự kiện từ động cơ hơi nước đến trạm vũ trụ quốc tế ISS.', url: 'https://vi.wikipedia.org/wiki/C%C3%A1ch_m%E1%BA%A1ng_C%C3%B4ng_nghi%E1%BB%87p', authorId: 'system' },
];

const TOPIC_REPAIR_GUIDES = {
  'Hệ nhị phân & Biểu diễn số': 'Mẹo đổi thập phân sang nhị phân: Chia liên tiếp cho 2 và đọc ngược số dư từ dưới lên. Với n bit không dấu, giá trị tối đa luôn là 2ⁿ - 1.',
  'Thuật toán tìm kiếm & Big-O': 'Binary Search luôn chia đôi không gian tìm kiếm sau mỗi bước nên số bước tối đa là ⌈log₂(N)⌉. Nhớ kiểm tra mảng đã sắp xếp trước khi chạy.',
  'Cổng logic & Đại số Boole': 'Cổng XOR chỉ cho kết quả 1 khi hai bit đầu vào khác nhau (1⊕0=1, 0⊕1=1). Phủ định NOT đảo ngược 0 thành 1 và ngược lại.',
  'An toàn thông tin & Mạng': 'Hàm băm (Hash) là biến đổi một chiều dùng để kiểm tra toàn vẹn dữ liệu; còn mã hóa (Encryption) dùng khóa để giải mã ngược lại.',
  'Hàm số bậc hai & Cực trị': 'Hoành độ đỉnh parabol luôn là x = -b/(2a). Thay ngược x vào hàm số ban đầu để tìm giá trị cực đại/cực tiểu.',
  'Tổ hợp & Xác suất': 'Nếu việc chọn 2 người không phân biệt vai trò trước sau, dùng tổ hợp C(n,2) = n(n-1)/2 thay vì chỉnh hợp A(n,2).',
  'Đạo hàm & Bài toán tối ưu': 'Với hai số dương có tổng không đổi, tích của chúng lớn nhất khi hai số bằng nhau (Bất đẳng thức Cauchy).',
  'Động học & Bảo toàn cơ năng': 'Vận tốc chạm đất khi rơi tự do từ độ cao h là v = √(2gh). Động năng tỉ lệ thuận với bình phương vận tốc (v²).',
  'Phản ứng oxi hóa - khử': 'Chất xúc tác làm giảm năng lượng hoạt hóa giúp phản ứng đạt cân bằng nhanh hơn, KHÔNG làm dịch chuyển cân bằng.',
  'Di truyền phân tử & ADN': 'Trên mARN không có Thymine (T) mà thay bằng Uracil (U). Mạch gốc 3’→5’ tạo ra mARN chiều 5’→3’.',
  'Hệ sinh thái & Chuyển hóa năng lượng': 'Khoảng 90% năng lượng bị thất thoát qua hô hấp và nhiệt ở mỗi bậc dinh dưỡng, chỉ ~10% truyền lên bậc kế tiếp.',
  'Tư duy nghị luận & Tiếng Việt': 'Tránh mở đầu câu bằng "Qua tác phẩm..." rồi dùng ngay "cho thấy..." vì sẽ làm câu thiếu chủ ngữ ngữ pháp.',
  'Ngữ pháp tiếng Anh học thuật': 'Câu điều kiện loại 2 giả định trái hiện tại dùng quá khứ đơn (V₂/ed) ở mệnh đề If và would + V₀ ở mệnh đề chính.',
  'Đọc hiểu STEM tiếng Anh': 'Đoán nghĩa từ vựng khoa học qua tiền tố và ngữ cảnh đối lập ("Unlike fossil fuels... mitigates emissions").',
  'Lịch sử Cách mạng Công nghiệp': 'CMCN 1.0 gắn với hơi nước (Anh); 2.0 gắn với điện khí hóa; 3.0 gắn với máy tính & tự động hóa; 4.0 gắn với AI & IoT.',
  'Lịch sử Việt Nam hiện đại': 'Chiến dịch Điện Biên Phủ (7/5/1954) quyết định cục diện Giơ-ne-vơ; công cuộc Đổi mới bắt đầu từ Đại hội VI (1986).',
  'Phương pháp nghiên cứu lịch sử': 'Sử liệu sơ cấp là tài liệu ra đời ngay tại thời điểm sự kiện diễn ra (văn bản gốc, hiện vật, nhật ký).',
  'Lịch sử khoa học vũ trụ': 'Sputnik 1 (1957) là vệ tinh nhân tạo đầu tiên; Phạm Tuân bay vào vũ trụ năm 1980 trên tàu Soyuz 37.',
};

const MYSTERY_CAPSULES = [
  {
    fact: 'Trên Sao Kim (Venus), một ngày tự quay quanh trục (243 ngày Trái Đất) dài hơn cả một năm Sao Kim quay quanh Mặt Trời (225 ngày Trái Đất).',
    quote: '"Điều quan trọng là không ngừng đặt câu hỏi. Sự tò mò có lý do tồn tại riêng của nó." — Albert Einstein',
    riddle: 'Tôi không có trọng lượng, nhưng bạn có thể nhìn thấy tôi. Nếu đặt tôi vào một chiếc thùng gỗ, tôi sẽ làm chiếc thùng nhẹ đi. Tôi là gì?',
    options: ['Ánh sáng', 'Một cái lỗ', 'Khí Heli', 'Chân không'], answer: 1,
  },
  {
    fact: 'Nước nóng đôi khi có thể đóng băng nhanh hơn nước lạnh trong cùng điều kiện làm lạnh — hiện tượng vật lý này được gọi là Hiệu ứng Mpemba.',
    quote: '"Khoa học không chỉ là tập hợp các quy luật, mà là một cách tư duy phản biện." — Carl Sagan',
    riddle: 'Một vi khuẩn phân đôi mỗi phút. Nếu đặt 1 con vào bình lúc 12:00 và bình đầy lúc 13:00, thì bình đầy một nửa vào lúc mấy giờ?',
    options: ['12:30', '12:45', '12:59', '12:50'], answer: 2,
  },
  {
    fact: 'Tổng khối lượng của Sao Mộc lớn gấp 2,5 lần tổng khối lượng của tất cả các hành tinh còn lại trong Hệ Mặt Trời cộng lại.',
    quote: '"Đừng bao giờ tin vào bất kỳ con số thống kê nào mà chính bạn chưa kiểm tra cách thu thập." — Nguyên tắc thực nghiệm',
    riddle: 'Trong một cuộc đua, bạn vừa vượt qua người đang đứng ở vị trí thứ hai. Hỏi hiện tại bạn đang đứng ở vị trí thứ mấy?',
    options: ['Thứ nhất', 'Thứ hai', 'Thứ ba', 'Chưa xác định'], answer: 1,
  },
];

const BADGES_DEF = [
  { id: 'first_orbit', code: 'ORB-01', title: 'Khởi Hành Quỹ Đạo', desc: 'Hoàn thành vòng đầu tiên của một hành tinh.' },
  { id: 'planet_master', code: 'CORE-X', title: 'Chinh Phục Lõi Hành Tinh', desc: 'Đạt 3/3 vòng tại ít nhất một hành tinh.' },
  { id: 'stem_builder', code: 'LAB-PRO', title: 'Kiến Trúc Sư STEM', desc: 'Đăng tải dự án STEM hợp lệ đầu tiên.' },
  { id: 'daily_streak', code: 'SYNC-5M', title: 'Kỷ Luật Không Gian', desc: 'Hoàn thành Thử thách 5 phút trong ngày.' },
  { id: 'arena_ace', code: 'BLITZ-8', title: 'Xạ Thủ Đấu Trường', desc: 'Đạt từ 8/10 câu đúng trong Đấu trường trí tuệ.' },
  { id: 'galaxy_cmd', code: 'CMD-500', title: 'Chỉ Huy Thiên Hà', desc: 'Tích lũy từ 500 XP trở lên.' },
];

// =========================================================================
// 5. QUẢN LÝ TRẠNG THÁI THẬT & ĐỒNG BỘ FIREBASE / LOCAL
// =========================================================================
const LOCAL_ACCOUNTS_KEY = 'eduniverse_v4_accounts_db';
const LOCAL_ACTIVE_USER_KEY = 'eduniverse_v4_active_user';
const LOCAL_SHARED_PROJECTS_KEY = 'eduniverse_v4_shared_projects';
const LOCAL_SHARED_DOCS_KEY = 'eduniverse_v4_shared_docs';
const LOCAL_CFG_KEY = 'eduniverse_v4_cloud_cfg';

function createFreshProfile(userName) {
  const cleanName = Validator.sanitizeText(userName) || 'Phi hành gia';
  const accountId = 'user_' + cleanName.toLowerCase().replace(/\s+/g, '_');
  return {
    userId: accountId,
    userName: cleanName,
    xp: 0,
    fuel: FUEL_RULES.STARTER_FUEL, // Khởi tạo 20 L nhiên liệu nền
    starterFuelGranted: true,
    planetProgress: { mercury: 1, mars: 1, earth: 1, saturn: 1, jupiter: 1 },
    weakTopics: [],
    badges: [],
    claimedMysteryDate: null,
    completedDailyDate: null,
    dailyResult: null,
    arenaBestScore: 0,
    updatedAt: new Date().toISOString()
  };
}

const state = {
  activeModule: 'map',
  selectedPlanetId: 'mars',
  inspectorSubtab: 'climb',
  orbitSpeedMultiplier: 1,
  orbitTick: 0,

  userId: 'user_duc_bao',
  userName: 'Đức Bảo',
  xp: 0,
  fuel: FUEL_RULES.STARTER_FUEL,
  starterFuelGranted: true,
  planetProgress: { mercury: 1, mars: 1, earth: 1, saturn: 1, jupiter: 1 },
  weakTopics: [],
  badges: [],
  claimedMysteryDate: null,
  completedDailyDate: null,
  dailyResult: null,
  arenaBestScore: 0,

  libraryDocs: [...INITIAL_LIBRARY_DOCS],
  stemProjects: [],
  leaderboardUsers: [],
  chatHistory: [
    { role: 'ai', text: 'Chào bạn! Mình là gia sư Socratic trên trạm Eduniverse. Thay vì đưa ngay đáp án chép sẵn, mình sẽ gợi ý công thức và đặt câu hỏi để bạn tự suy luận. Bạn đang vướng bài tập hay khái niệm nào?' },
  ],
};

let localAccountsDb = {};
let cloudCfg = { geminiKey: '', firebaseJson: '' };
let db = null;
let auth = null;
let currentUser = null;
let fbSdk = null;
let isCloudActive = false;

function loadFromLocalStorage() {
  try {
    const rawCfg = localStorage.getItem(LOCAL_CFG_KEY);
    if (rawCfg) cloudCfg = { ...cloudCfg, ...JSON.parse(rawCfg) };

    const rawAccounts = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (rawAccounts) localAccountsDb = JSON.parse(rawAccounts) || {};

    const activeName = localStorage.getItem(LOCAL_ACTIVE_USER_KEY) || 'Đức Bảo';
    switchOrCreateLocalAccount(activeName, false);

    const rawProjects = localStorage.getItem(LOCAL_SHARED_PROJECTS_KEY);
    if (rawProjects) state.stemProjects = JSON.parse(rawProjects) || [];

    const rawDocs = localStorage.getItem(LOCAL_SHARED_DOCS_KEY);
    if (rawDocs) {
      const savedDocs = JSON.parse(rawDocs);
      if (Array.isArray(savedDocs) && savedDocs.length) state.libraryDocs = savedDocs;
    }
  } catch (e) {}
}

function switchOrCreateLocalAccount(targetName, notify = true) {
  const cleanName = Validator.sanitizeText(targetName) || 'Đức Bảo';
  const key = 'user_' + cleanName.toLowerCase().replace(/\s+/g, '_');

  if (!localAccountsDb[key]) {
    localAccountsDb[key] = createFreshProfile(cleanName);
  }

  const acc = localAccountsDb[key];
  // Tự động cấp 20 L khởi hành cho tài khoản cũ chưa từng nhận
  if (!acc.starterFuelGranted && (acc.xp || 0) === 0 && (acc.fuel || 0) === 0) {
    acc.fuel = FUEL_RULES.STARTER_FUEL;
    acc.starterFuelGranted = true;
  }

  state.userId = acc.userId;
  state.userName = acc.userName;
  state.xp = Math.max(0, Number(acc.xp) || 0);
  state.fuel = Math.max(0, Number(acc.fuel) || 0);
  state.starterFuelGranted = true;
  state.planetProgress = { mercury: 1, mars: 1, earth: 1, saturn: 1, jupiter: 1, ...(acc.planetProgress || {}) };
  state.weakTopics = Array.isArray(acc.weakTopics) ? acc.weakTopics : [];
  state.badges = Array.isArray(acc.badges) ? acc.badges : [];
  state.claimedMysteryDate = acc.claimedMysteryDate || null;
  state.completedDailyDate = acc.completedDailyDate || null;
  state.dailyResult = acc.dailyResult || null;
  state.arenaBestScore = acc.arenaBestScore ?? 0;

  localStorage.setItem(LOCAL_ACTIVE_USER_KEY, state.userName);
  saveToLocalStorage();
  if (notify) {
    showToast('ĐÃ CHUYỂN HỒ SƠ', `Tài khoản "${state.userName}" (${state.xp} XP | ${state.fuel} L).`, 'info');
  }
}

function saveToLocalStorage() {
  try {
    const key = 'user_' + state.userName.toLowerCase().replace(/\s+/g, '_');
    const totalRings = Object.values(state.planetProgress).reduce((acc, v) => acc + Math.max(0, v - 1), 0);

    localAccountsDb[key] = {
      userId: state.userId,
      userName: state.userName,
      xp: Math.max(0, state.xp),
      fuel: Math.max(0, state.fuel),
      starterFuelGranted: true,
      rings: totalRings,
      planetProgress: state.planetProgress,
      weakTopics: state.weakTopics,
      badges: state.badges,
      claimedMysteryDate: state.claimedMysteryDate,
      completedDailyDate: state.completedDailyDate,
      dailyResult: state.dailyResult,
      arenaBestScore: state.arenaBestScore,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(localAccountsDb));
    localStorage.setItem(LOCAL_SHARED_PROJECTS_KEY, JSON.stringify(state.stemProjects));
    localStorage.setItem(LOCAL_SHARED_DOCS_KEY, JSON.stringify(state.libraryDocs));

    if (!isCloudActive) {
      state.leaderboardUsers = Object.values(localAccountsDb).map((u) => ({
        id: u.userId,
        name: u.userName,
        xp: u.xp || 0,
        fuel: u.fuel || 0,
        rings: Object.values(u.planetProgress || {}).reduce((acc, v) => acc + Math.max(0, v - 1), 0)
      }));
    }
  } catch (e) {}
}

async function loadFirebaseModules() {
  if (fbSdk) return fbSdk;
  const [appMod, authMod, fsMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'),
  ]);
  fbSdk = { ...appMod, ...authMod, ...fsMod };
  return fbSdk;
}

async function initFirebaseConnection() {
  let firebaseConfig = Validator.parseFirebaseConfig(cloudCfg.firebaseJson);
  if (!firebaseConfig && GITHUB_FIREBASE_CONFIG.apiKey && GITHUB_FIREBASE_CONFIG.projectId) {
    firebaseConfig = GITHUB_FIREBASE_CONFIG;
  }

  if (!firebaseConfig) {
    isCloudActive = false;
    saveToLocalStorage();
    updateSyncStatus(false, 'Chế độ: Lưu trên máy');
    renderDiagnosticsAndLeaderboard();
    return;
  }

  try {
    const sdk = await loadFirebaseModules();
    const app = sdk.getApps().length ? sdk.getApps()[0] : sdk.initializeApp(firebaseConfig);
    auth = sdk.getAuth(app);
    db = sdk.getFirestore(app);

    if (!auth.currentUser) {
      await sdk.signInAnonymously(auth);
    }

    sdk.onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      currentUser = user;
      isCloudActive = true;
      state.userId = user.uid;
      if (user.displayName) {
        state.userName = user.displayName;
        localStorage.setItem(LOCAL_ACTIVE_USER_KEY, state.userName);
      }

      updateSyncStatus(true, `Cloud: ${firebaseConfig.projectId}`);

      const profileRef = sdk.doc(db, 'eduniverse_users', user.uid);
      const snap = await sdk.getDoc(profileRef);
      if (snap.exists()) {
        const d = snap.data();
        if (d.userName && !user.displayName) state.userName = d.userName;
        state.xp = Math.max(0, d.xp ?? state.xp);
        state.fuel = Math.max(0, d.fuel ?? state.fuel);
        if (d.planetProgress) {
          Object.keys(state.planetProgress).forEach((k) => {
            state.planetProgress[k] = Math.max(state.planetProgress[k] || 1, d.planetProgress[k] || 1);
          });
        }
        state.weakTopics = Array.isArray(d.weakTopics) ? d.weakTopics : state.weakTopics;
        state.badges = Array.isArray(d.badges) ? d.badges : state.badges;
        state.arenaBestScore = Math.max(state.arenaBestScore, d.arenaBestScore ?? 0);
        await persistUserProfile();
        refreshAllUI();
      } else {
        await persistUserProfile();
      }

      const lbCol = sdk.collection(db, 'eduniverse_leaderboard');
      sdk.onSnapshot(lbCol, (snapshot) => {
        const realCloudUsers = [];
        snapshot.forEach((docSnap) => {
          const u = docSnap.data();
          if (u && u.name) {
            realCloudUsers.push({
              id: docSnap.id,
              name: u.name,
              xp: Number(u.xp) || 0,
              fuel: Number(u.fuel) || 0,
              rings: Number(u.rings) || 0
            });
          }
        });
        state.leaderboardUsers = realCloudUsers;
        renderDiagnosticsAndLeaderboard();
      }, () => {});

      const projCol = sdk.collection(db, 'eduniverse_projects');
      sdk.onSnapshot(projCol, (snapshot) => {
        const cloudProjects = [];
        snapshot.forEach((docSnap) => {
          cloudProjects.push({ id: docSnap.id, ...docSnap.data() });
        });
        cloudProjects.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        state.stemProjects = cloudProjects;
        saveToLocalStorage();
        renderStemProjects();
      }, () => {});

      const libCol = sdk.collection(db, 'eduniverse_library');
      sdk.onSnapshot(libCol, (snapshot) => {
        const cloudDocs = [];
        snapshot.forEach((docSnap) => {
          cloudDocs.push({ id: docSnap.id, ...docSnap.data() });
        });
        const mergedDocs = [...INITIAL_LIBRARY_DOCS];
        cloudDocs.forEach((cd) => {
          if (!mergedDocs.some((m) => m.id === cd.id || m.title.toLowerCase() === String(cd.title).toLowerCase())) {
            mergedDocs.unshift(cd);
          }
        });
        state.libraryDocs = mergedDocs;
        saveToLocalStorage();
        if (state.inspectorSubtab === 'library') renderPlanetInspector();
      }, () => {});
    });
  } catch (err) {
    isCloudActive = false;
    updateSyncStatus(false, 'Lỗi Firebase (Đang lưu trên máy)');
  }
}

function updateSyncStatus(isOnline, label) {
  const dot = document.getElementById('sync-dot');
  const txt = document.getElementById('sync-status-text');
  const userLbl = document.getElementById('user-id-display');
  if (dot) dot.className = `w-3 h-3 rounded-full ${isOnline ? 'bg-emeraldLock shadow-[0_0_10px_#34D399]' : 'bg-amberSolar shadow-[0_0_10px_#FBBF24]'}`;
  if (txt) txt.textContent = label;
  if (userLbl) userLbl.textContent = state.userName;
}

async function persistUserProfile() {
  saveToLocalStorage();
  renderDiagnosticsAndLeaderboard();
  if (!db || !currentUser || !fbSdk) return;

  try {
    const totalCompletedRings = Object.values(state.planetProgress).reduce((acc, v) => acc + Math.max(0, v - 1), 0);
    const profileRef = fbSdk.doc(db, 'eduniverse_users', currentUser.uid);
    await fbSdk.setDoc(profileRef, {
      userName: state.userName,
      xp: state.xp,
      fuel: state.fuel,
      planetProgress: state.planetProgress,
      weakTopics: state.weakTopics,
      badges: state.badges,
      claimedMysteryDate: state.claimedMysteryDate,
      completedDailyDate: state.completedDailyDate,
      dailyResult: state.dailyResult,
      arenaBestScore: state.arenaBestScore,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    const lbRef = fbSdk.doc(db, 'eduniverse_leaderboard', currentUser.uid);
    await fbSdk.setDoc(lbRef, {
      name: state.userName,
      xp: state.xp,
      fuel: state.fuel,
      rings: totalCompletedRings,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {}
}

// =========================================================================
// 6. HÀM CỘNG / TRỪ NHIÊN LIỆU & KIỂM TRA SỐ DƯ AN TOÀN
// =========================================================================
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  const borderMap = {
    success: 'border-emeraldLock text-emeraldLock',
    error: 'border-crimsonSignal text-crimsonSignal',
    amber: 'border-amberSolar text-amberSolar',
    info: 'border-cyanRadar text-cyanRadar',
  };
  const el = document.createElement('div');
  el.className = `pointer-events-auto bg-surfaceAlt border ${borderMap[type] || borderMap.info} px-4 py-3 rounded-2xl shadow-xl backdrop-blur-md transition-all duration-200`;
  el.innerHTML = `<div class="font-mono-num text-xs font-extrabold uppercase">${Validator.sanitizeText(title)}</div><div class="text-xs text-offwhite mt-0.5">${Validator.sanitizeText(message)}</div>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 220); }, 3600);
}

function getAstronautRank(xp) {
  if (xp >= 500) return 'Chỉ huy thiên hà';
  if (xp >= 200) return 'Phi công liên hành tinh';
  return 'Tập sự quỹ đạo';
}

function canAccessTier(planetId, tier) { return tier <= (state.planetProgress[planetId] || 1); }
function isTierCompleted(planetId, tier) { return (state.planetProgress[planetId] || 1) > tier; }

// Tính phí nhiên liệu bay vào Vòng quỹ đạo: Vòng đã chinh phục thì miễn phí (0 L) để ôn tập
function getTierEntryFuelCost(planetId, tier) {
  if (isTierCompleted(planetId, tier)) return 0;
  return FUEL_RULES.RING_ENTRY_COST[tier] || 0;
}

function addWeakTopic(topic) { if (topic && !state.weakTopics.includes(topic)) state.weakTopics.push(topic); }
function removeWeakTopic(topic) { state.weakTopics = state.weakTopics.filter((t) => t !== topic); }

function awardRewards(xpGain, fuelGain) {
  state.xp = Math.max(0, state.xp + (Number(xpGain) || 0));
  state.fuel = Math.max(0, state.fuel + (Number(fuelGain) || 0));
  evaluateBadges();
  persistUserProfile();
  updateTopTelemetry();
}

// Hàm trừ nhiên liệu an toàn (Không bao giờ cho phép âm nhiên liệu)
function spendFuel(amount, reasonLabel = '') {
  const cost = Number(amount) || 0;
  if (cost <= 0) return true;
  if (state.fuel < cost) {
    showToast(
      'KHÔNG ĐỦ NHIÊN LIỆU BAY',
      `Cần ${cost} L nhưng bạn chỉ còn ${state.fuel} L. Hãy làm Vòng 1, mở Hộp thư bí mật (+15 L) hoặc thi Đấu trường để nạp thêm!`,
      'error'
    );
    return false;
  }
  state.fuel = Math.max(0, state.fuel - cost);
  persistUserProfile();
  updateTopTelemetry();
  if (reasonLabel) {
    showToast('ĐÃ TIÊU HAO NHIÊN LIỆU', `-${cost} L (${reasonLabel}). Còn lại: ${state.fuel} L.`, 'amber');
  }
  return true;
}

function evaluateBadges() {
  const earned = new Set(state.badges);
  const totalCompletedRings = Object.values(state.planetProgress).reduce((acc, v) => acc + Math.max(0, v - 1), 0);
  if (totalCompletedRings >= 1) earned.add('first_orbit');
  if (Object.values(state.planetProgress).some((v) => v >= 4)) earned.add('planet_master');
  if (state.stemProjects.some((p) => p.author === state.userName || p.authorId === state.userId)) earned.add('stem_builder');
  if (state.completedDailyDate) earned.add('daily_streak');
  if (state.arenaBestScore >= 8) earned.add('arena_ace');
  if (state.xp >= 500) earned.add('galaxy_cmd');
  state.badges = Array.from(earned);
}

function updateTopTelemetry() {
  document.getElementById('hud-xp').textContent = `${state.xp} XP`;
  document.getElementById('hud-fuel').textContent = `${state.fuel} L`;
  document.getElementById('hud-rank').textContent = getAstronautRank(state.xp);
  const userLbl = document.getElementById('user-id-display');
  if (userLbl) userLbl.textContent = state.userName;
  const totalCompletedRings = Object.values(state.planetProgress).reduce((acc, v) => acc + Math.max(0, v - 1), 0);
  document.getElementById('map-overall-progress').textContent = `Tiến độ: ${totalCompletedRings}/15 vòng quỹ đạo`;
}

// =========================================================================
// 7. CHUYỂN PHÂN KHU & BẢN ĐỒ HỆ MẶT TRỜI XOAY SVG
// =========================================================================
window.switchModule = function (moduleKey) {
  state.activeModule = moduleKey;
  document.querySelectorAll('.module-section').forEach((sec) => sec.classList.add('hidden'));
  document.getElementById(`module-${moduleKey}`)?.classList.remove('hidden');

  document.querySelectorAll('.nav-tab').forEach((btn) => {
    const isTarget = btn.dataset.tab === moduleKey;
    btn.classList.toggle('border-cyanRadar', isTarget);
    btn.classList.toggle('text-offwhite', isTarget);
    btn.classList.toggle('font-semibold', isTarget);
    btn.classList.toggle('border-transparent', !isTarget);
    btn.classList.toggle('text-slateMuted', !isTarget);
  });

  if (moduleKey === 'lab') {
    resizePhysicsCanvas();
    drawActiveLabScene();
  } else if (moduleKey === 'advisor') {
    renderDiagnosticsAndLeaderboard();
  } else if (moduleKey === 'arena') {
    renderMysteryBox();
    renderDailyChallenge();
    renderArenaHome();
  }
};

function initSolarMap() {
  document.getElementById('orbit-rings-layer').innerHTML = PLANETS_DATA.map(
    (p) => `<circle cx="300" cy="300" r="${p.orbitRadius}" fill="none" stroke="rgba(226, 232, 240, 0.16)" stroke-width="1.2" />`
  ).join('');

  document.getElementById('planets-layer').innerHTML = PLANETS_DATA.map((p) => {
    const ringSvg = p.hasRing
      ? `<ellipse cx="0" cy="0" rx="${p.planetRadius + 9}" ry="5" fill="none" stroke="${p.color}" stroke-width="1.8" transform="rotate(-22)" opacity="0.9" />`
      : '';
    return `
      <g id="planet-group-${p.id}" class="planet-node" data-planet-id="${p.id}">
        <circle class="planet-ring-hover" cx="0" cy="0" r="${p.planetRadius + 8}" fill="none" stroke="#38BDF8" stroke-width="1.8" stroke-opacity="0" stroke-dasharray="3 2" />
        ${ringSvg}
        <circle cx="0" cy="0" r="${p.planetRadius}" fill="${p.color}" fill-opacity="0.32" stroke="${p.color}" stroke-width="2" />
        <circle cx="0" cy="0" r="${Math.max(3.5, p.planetRadius * 0.38)}" fill="${p.color}" />
        <text x="0" y="${p.planetRadius + 16}" text-anchor="middle" fill="#F8FAFC" font-family="Be Vietnam Pro" font-size="11" font-weight="700">${p.name}</text>
        <text id="planet-badge-txt-${p.id}" x="0" y="${p.planetRadius + 28}" text-anchor="middle" fill="#B4C6E7" font-family="Plus Jakarta Sans" font-size="9.5" font-weight="600">0/3</text>
      </g>
    `;
  }).join('');

  PLANETS_DATA.forEach((p) => {
    document.getElementById(`planet-group-${p.id}`)?.addEventListener('click', () => selectPlanet(p.id));
  });

  document.querySelectorAll('.speed-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.orbitSpeedMultiplier = Number(btn.dataset.speed);
      document.querySelectorAll('.speed-btn').forEach((b) => {
        b.className = 'speed-btn font-mono-num text-xs px-3 py-1.5 border border-[rgba(226,232,240,0.18)] bg-void text-slateMuted rounded';
      });
      btn.className = 'speed-btn font-mono-num text-xs px-3 py-1.5 border border-cyanRadar bg-cyanRadar/15 text-cyanRadar font-bold rounded';
    });
  });

  updatePlanetPositions();
  requestAnimationFrame(animateSolarOrbits);
}

function updatePlanetPositions() {
  const laser = document.getElementById('target-laser-line');
  PLANETS_DATA.forEach((p) => {
    const angle = p.initialAngle + state.orbitTick * p.angularSpeed;
    const x = 300 + p.orbitRadius * Math.cos(angle);
    const y = 300 + p.orbitRadius * Math.sin(angle);
    const g = document.getElementById(`planet-group-${p.id}`);
    if (g) {
      g.setAttribute('transform', `translate(${x.toFixed(2)}, ${y.toFixed(2)})`);
      const hoverRing = g.querySelector('.planet-ring-hover');
      const isSelected = p.id === state.selectedPlanetId;
      if (hoverRing) {
        hoverRing.setAttribute('stroke-opacity', isSelected ? '1' : '0');
        hoverRing.setAttribute('stroke-width', isSelected ? '2' : '1');
      }
      if (isSelected && laser) {
        laser.setAttribute('x2', x.toFixed(2));
        laser.setAttribute('y2', y.toFixed(2));
        laser.setAttribute('stroke', p.color);
      }
    }
    const completed = Math.max(0, (state.planetProgress[p.id] || 1) - 1);
    const badgeTxt = document.getElementById(`planet-badge-txt-${p.id}`);
    if (badgeTxt) {
      badgeTxt.textContent = `${completed}/3 vòng`;
      badgeTxt.setAttribute('fill', completed === 3 ? '#34D399' : '#B4C6E7');
    }
  });
}

function animateSolarOrbits() {
  if (state.orbitSpeedMultiplier > 0 && state.activeModule === 'map') {
    state.orbitTick += state.orbitSpeedMultiplier;
    updatePlanetPositions();
  }
  requestAnimationFrame(animateSolarOrbits);
}

function selectPlanet(planetId) {
  state.selectedPlanetId = planetId;
  const planet = PLANETS_DATA.find((p) => p.id === planetId) || PLANETS_DATA[1];
  document.getElementById('selected-planet-coords').textContent = `MỤC TIÊU: ${planet.code} — ${planet.subject.toUpperCase()}`;
  updatePlanetPositions();
  renderPlanetQuickCards();
  renderPlanetInspector();
}
window.selectPlanetById = selectPlanet;

function renderPlanetQuickCards() {
  const container = document.getElementById('planet-quick-cards');
  container.innerHTML = PLANETS_DATA.map((p) => {
    const isSelected = p.id === state.selectedPlanetId;
    const completed = Math.max(0, (state.planetProgress[p.id] || 1) - 1);
    return `
      <button type="button" onclick="window.selectPlanetById('${p.id}')" class="w-full text-left p-3 border ${isSelected ? 'border-cyanRadar bg-surfaceAlt shadow-lg' : 'border-[rgba(226,232,240,0.16)] bg-surface hover:border-[rgba(226,232,240,0.4)]'} rounded-2xl transition-all flex items-center justify-between gap-2.5">
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-3.5 h-3.5 rounded-full shrink-0" style="background-color:${p.color}; box-shadow: 0 0 10px ${p.color}"></span>
          <div class="truncate">
            <div class="text-xs font-bold text-white truncate">${p.name} — ${p.subject}</div>
            <div class="text-[11px] text-slateMuted truncate">${p.tagline}</div>
          </div>
        </div>
        <span class="font-mono-num text-[11px] font-bold px-2 py-0.5 rounded-lg bg-void border border-[rgba(226,232,240,0.15)] shrink-0 ${completed === 3 ? 'text-emeraldLock border-emeraldLock/40' : 'text-cyanRadar'}">${completed}/3</span>
      </button>
    `;
  }).join('');
}

function renderPlanetInspector() {
  const planet = PLANETS_DATA.find((p) => p.id === state.selectedPlanetId) || PLANETS_DATA[1];
  const completed = Math.max(0, (state.planetProgress[planet.id] || 1) - 1);

  document.getElementById('planet-inspector-header').innerHTML = `
    <div class="flex items-center justify-between">
      <span class="font-mono-num text-xs font-extrabold" style="color:${planet.color}">${planet.code}</span>
      <span class="font-mono-num text-xs px-2.5 py-1 border border-[rgba(226,232,240,0.2)] bg-void text-white rounded-full">Hoàn thành: ${completed}/3 vòng</span>
    </div>
    <h2 class="text-lg font-extrabold text-white mt-1.5">${planet.name} — ${planet.subject}</h2>
    <p class="text-xs text-slateMuted mt-0.5">${planet.tagline}</p>
  `;

  document.querySelectorAll('.inspector-subtab').forEach((btn) => {
    const active = btn.dataset.subtab === state.inspectorSubtab;
    btn.className = active
      ? 'inspector-subtab text-xs py-2.5 px-3 bg-surfaceAlt text-cyanRadar border border-cyanRadar/40 rounded-xl font-bold'
      : 'inspector-subtab text-xs py-2.5 px-3 text-slateMuted hover:text-offwhite rounded-xl font-medium';
  });

  const body = document.getElementById('planet-inspector-body');
  if (state.inspectorSubtab === 'climb') {
    body.innerHTML = `<div class="space-y-3.5">${planet.tiers.map((t) => {
      const unlocked = canAccessTier(planet.id, t.tier);
      const done = isTierCompleted(planet.id, t.tier);
      const entryCost = getTierEntryFuelCost(planet.id, t.tier);
      const hasEnoughFuel = state.fuel >= entryCost;

      const statusBadge = done
        ? '<span class="font-mono-num text-[10px] font-bold px-2.5 py-0.5 bg-emeraldLock/15 border border-emeraldLock/50 text-emeraldLock rounded-full">ĐÃ CHINH PHỤC</span>'
        : unlocked
        ? `<span class="font-mono-num text-[10px] font-bold px-2.5 py-0.5 ${hasEnoughFuel ? 'bg-cyanRadar/15 border-cyanRadar/50 text-cyanRadar' : 'bg-amberSolar/15 border-amberSolar/50 text-amberSolar'} border rounded-full">${entryCost > 0 ? `PHÍ BAY: -${entryCost} L` : 'MIỄN PHÍ BAY (0 L)'}</span>`
        : '<span class="font-mono-num text-[10px] font-bold px-2.5 py-0.5 bg-crimsonSignal/15 border border-crimsonSignal/40 text-crimsonSignal rounded-full">ĐANG KHÓA</span>';

      let btnLabel = 'Cần vượt vòng trước';
      if (unlocked) {
        if (done) btnLabel = 'Ôn tập lại (0 L • Thưởng +10 L)';
        else if (!hasEnoughFuel) btnLabel = `Thiếu nhiên liệu (Cần ${entryCost} L)`;
        else btnLabel = entryCost > 0 ? `Phóng tàu khảo sát (-${entryCost} L)` : 'Bắt đầu khảo sát (0 L)';
      }

      return `
        <div class="p-4 border ${done ? 'border-emeraldLock/40 bg-void/90' : unlocked ? 'border-[rgba(226,232,240,0.22)] bg-void' : 'border-[rgba(226,232,240,0.08)] bg-void/40 opacity-70'} rounded-2xl relative">
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono-num text-[11px] text-slateMuted">VÒNG 0${t.tier} • Thưởng: +${t.xpReward} XP | +${t.fuelReward} L</span>
            ${statusBadge}
          </div>
          <h4 class="text-sm font-bold text-white mt-1.5">${t.name}</h4>
          <p class="text-xs text-slateMuted mt-1 leading-relaxed">${t.brief}</p>
          <div class="mt-3.5 flex items-center justify-between gap-2">
            <span class="font-mono-num text-[11px] text-slateMuted">Đạt ≥ 70% để qua vòng</span>
            <button type="button" onclick="window.launchTierQuiz('${planet.id}', ${t.tier})" ${!unlocked ? 'disabled' : ''} class="font-mono-num text-xs px-3.5 py-2 rounded-xl transition-colors ${!unlocked ? 'bg-surface border border-[rgba(226,232,240,0.1)] text-slateMuted cursor-not-allowed' : done ? 'border border-emeraldLock/50 text-emeraldLock hover:bg-emeraldLock/10 font-semibold' : hasEnoughFuel ? 'bg-cyanRadar text-void font-bold' : 'border border-amberSolar/50 text-amberSolar bg-amberSolar/10 font-semibold'}">
              ${btnLabel}
            </button>
          </div>
        </div>
      `;
    }).join('')}</div>`;
  } else if (state.inspectorSubtab === 'theory') {
    body.innerHTML = `<div class="space-y-3.5"><div class="text-xs text-amberSolar font-bold">📌 Công thức & Nguyên lý trọng tâm</div>${planet.keyConcepts.map((kc) => `
      <div class="p-4 bg-void border border-[rgba(226,232,240,0.16)] rounded-2xl space-y-2">
        <h4 class="text-sm font-bold text-white">${kc.title}</h4>
        <div class="font-mono-num text-xs px-3 py-2 bg-surface border-l-4 border-cyanRadar text-cyanRadar rounded-r-xl">${kc.formula}</div>
        <p class="text-xs text-slateMuted leading-relaxed">${kc.detail}</p>
      </div>
    `).join('')}</div>`;
  } else {
    const docs = state.libraryDocs.filter((d) => d.planetId === planet.id);
    body.innerHTML = `
      <div class="space-y-4">
        <div class="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
          ${docs.map((d) => `
            <div class="p-3.5 bg-void border border-[rgba(226,232,240,0.16)] rounded-2xl space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <span class="font-mono-num text-[10px] font-bold px-2 py-0.5 border border-amberSolar/40 text-amberSolar rounded-full">${Validator.sanitizeText(d.type)}</span>
                <div class="flex items-center gap-2">
                  ${d.url ? `<a href="${Validator.sanitizeText(d.url)}" target="_blank" rel="noopener noreferrer" class="text-[11px] font-semibold text-cyanRadar hover:underline">Mở tài liệu ↗</a>` : '<span class="text-[10px] text-slateMuted">Ghi chú nội bộ</span>'}
                  ${d.authorId === state.userId ? `<button type="button" onclick="window.deleteLibraryDoc('${d.id}')" class="text-[10px] text-crimsonSignal hover:underline">Xóa (-15 XP, -10 L)</button>` : ''}
                </div>
              </div>
              <h5 class="text-xs font-bold text-white">${Validator.sanitizeText(d.title)}</h5>
              <p class="text-[11px] text-slateMuted leading-relaxed">${Validator.sanitizeText(d.summary)}</p>
            </div>
          `).join('')}
        </div>
        <form id="add-lib-doc-form" novalidate class="p-4 bg-void/80 border border-[rgba(226,232,240,0.18)] rounded-2xl space-y-2.5">
          <div class="text-xs text-cyanRadar font-bold">Đóng góp tài liệu / đề cương mới</div>
          <input id="lib-doc-title" type="text" maxlength="80" placeholder="Tên tài liệu (5–80 ký tự) *" class="w-full text-xs" />
          <p id="err-lib-title" class="text-[10px] text-crimsonSignal hidden"></p>
          <input id="lib-doc-summary" type="text" maxlength="300" placeholder="Tóm tắt nội dung chính (10–300 ký tự) *" class="w-full text-xs" />
          <p id="err-lib-summary" class="text-[10px] text-crimsonSignal hidden"></p>
          <input id="lib-doc-url" type="url" placeholder="Liên kết https://... (tùy chọn)" class="w-full text-xs" />
          <p id="err-lib-url" class="text-[10px] text-crimsonSignal hidden"></p>
          <button type="submit" class="w-full text-xs py-2.5 bg-surfaceAlt border border-cyanRadar/50 text-cyanRadar hover:bg-cyanRadar hover:text-void font-bold rounded-xl">Lưu vào Thư viện số (+15 XP, +${FUEL_RULES.LIBRARY_DOC_REWARD} L)</button>
        </form>
      </div>
    `;
    document.getElementById('add-lib-doc-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const res = Validator.validateLibraryResource({
        title: document.getElementById('lib-doc-title').value,
        summary: document.getElementById('lib-doc-summary').value,
        url: document.getElementById('lib-doc-url').value,
      });
      setFieldError('lib-doc-title', 'err-lib-title', res.errors.title);
      setFieldError('lib-doc-summary', 'err-lib-summary', res.errors.summary);
      setFieldError('lib-doc-url', 'err-lib-url', res.errors.url);
      if (!res.isValid) return;

      const newDoc = {
        id: 'doc-' + Date.now(),
        planetId: planet.id,
        title: res.cleaned.title,
        type: `ĐÓNG GÓP (${state.userName})`,
        summary: res.cleaned.summary,
        url: res.cleaned.url,
        authorId: state.userId,
        createdAt: new Date().toISOString()
      };

      state.libraryDocs.unshift(newDoc);
      awardRewards(15, FUEL_RULES.LIBRARY_DOC_REWARD);
      showToast('THƯ VIỆN SỐ', `Đã lưu tài liệu mới (+15 XP, +${FUEL_RULES.LIBRARY_DOC_REWARD} L).`, 'success');
      renderPlanetInspector();

      if (db && currentUser && fbSdk) {
        try {
          await fbSdk.setDoc(fbSdk.doc(db, 'eduniverse_library', newDoc.id), newDoc);
        } catch (_) {}
      }
    });
  }
}

window.deleteLibraryDoc = async function (docId) {
  const target = state.libraryDocs.find((d) => d.id === docId);
  if (!target) return;
  state.libraryDocs = state.libraryDocs.filter((d) => d.id !== docId);
  // Thu hồi XP và nhiên liệu đã cấp để chống tạo-xóa liên tục cày điểm
  if (target.authorId === state.userId) {
    awardRewards(-15, -FUEL_RULES.LIBRARY_DOC_REWARD);
  }
  saveToLocalStorage();
  renderPlanetInspector();
  if (db && currentUser && fbSdk) {
    try {
      const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
      await deleteDoc(doc(db, 'eduniverse_library', docId));
    } catch (_) {}
  }
  showToast('ĐÃ XÓA TÀI LIỆU', 'Đã gỡ tài liệu và thu hồi phần thưởng đóng góp.', 'info');
};

// =========================================================================
// 8. MODAL KIỂM TRA QUỸ ĐẠO (CÓ THU PHÍ BAY & TRỢ GIÚP 50:50 TRỪ 10 L)
// =========================================================================
let activeTierQuiz = null;

window.launchTierQuiz = function (planetId, tierNumber) {
  if (!canAccessTier(planetId, tierNumber)) {
    showToast('CHƯA MỞ KHÓA', 'Bạn cần hoàn thành vòng quỹ đạo trước đó với tối thiểu 70% điểm.', 'error');
    return;
  }
  const planet = PLANETS_DATA.find((p) => p.id === planetId);
  const tierObj = planet?.tiers.find((t) => t.tier === tierNumber);
  if (!planet || !tierObj) return;

  const entryCost = getTierEntryFuelCost(planetId, tierNumber);
  if (entryCost > 0) {
    const ok = spendFuel(entryCost, `Phóng tàu vào ${tierObj.name}`);
    if (!ok) {
      renderPlanetInspector();
      return;
    }
  }

  const basePool = [...tierObj.questions];
  const dynamicQ = DynamicQuestionGenerator.generateForPlanetTier(planetId, tierNumber);
  if (dynamicQ) basePool.push(dynamicQ);

  const shuffledQuestions = Validator.shuffleQuestions(basePool).slice(0, 3).map((q) => ({
    ...q,
    eliminatedOptions: [],
    used5050: false
  }));

  activeTierQuiz = {
    planetId,
    tierNumber,
    planet,
    tierObj,
    questions: shuffledQuestions,
    answers: new Array(shuffledQuestions.length).fill(null),
    submitted: false
  };

  document.getElementById('quiz-modal-tag').textContent = `${planet.code} • VÒNG 0${tierNumber}`;
  document.getElementById('quiz-modal-title').textContent = tierObj.name;
  renderQuizModalContent();
  renderPlanetInspector();
  document.getElementById('quiz-modal').classList.remove('hidden');
};

window.useQuiz5050 = function (qIdx) {
  if (!activeTierQuiz || activeTierQuiz.submitted) return;
  const qItem = activeTierQuiz.questions[qIdx];
  if (!qItem || qItem.used5050) return;

  if (!spendFuel(FUEL_RULES.LIFELINE_5050_COST, `Trợ giúp 50:50 Câu ${qIdx + 1}`)) return;

  const wrongIndices = qItem.options
    .map((_, idx) => idx)
    .filter((idx) => idx !== qItem.answer);

  const toEliminate = Validator.shuffleArray(wrongIndices).slice(0, 2);
  qItem.eliminatedOptions = toEliminate;
  qItem.used5050 = true;

  // Nếu người dùng đang chọn đúng vào phương án sai vừa bị gạch bỏ thì xóa lựa chọn đó
  if (toEliminate.includes(activeTierQuiz.answers[qIdx])) {
    activeTierQuiz.answers[qIdx] = null;
  }

  renderQuizModalContent();
};

function renderQuizModalContent() {
  if (!activeTierQuiz) return;
  const { planetId, tierNumber, questions, answers, submitted } = activeTierQuiz;
  const body = document.getElementById('quiz-modal-body');

  let html = `
    <div class="flex flex-wrap items-center justify-between gap-2 p-3 bg-surface border border-indigo-300/20 rounded-2xl text-xs">
      <span>Nhiên liệu hiện có: <strong class="font-mono-num text-cyanRadar">${state.fuel} L</strong></span>
      <span class="text-slateMuted">Quyền trợ giúp: <strong>50:50 (-${FUEL_RULES.LIFELINE_5050_COST} L / câu)</strong></span>
    </div>
    <div class="space-y-4">
  `;

  questions.forEach((item, qIdx) => {
    const can5050 = !submitted && !item.used5050 && state.fuel >= FUEL_RULES.LIFELINE_5050_COST;
    html += `
      <div class="p-4 bg-void border border-[rgba(226,232,240,0.16)] rounded-2xl space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-num text-slateMuted">
          <span>CÂU 0${qIdx + 1}/${questions.length} • ${item.topic}</span>
          ${!submitted ? `
            <button type="button" onclick="window.useQuiz5050(${qIdx})" ${!can5050 ? 'disabled' : ''} class="px-2.5 py-1 rounded-lg border text-[11px] font-bold ${item.used5050 ? 'border-emeraldLock/40 text-emeraldLock opacity-70 cursor-not-allowed' : can5050 ? 'border-amberSolar/60 text-amberSolar bg-amberSolar/10 hover:bg-amberSolar/20' : 'border-slate-700 text-slateMuted opacity-50 cursor-not-allowed'}">
              ${item.used5050 ? 'Đã dùng 50:50' : `Trợ giúp 50:50 (-${FUEL_RULES.LIFELINE_5050_COST} L)`}
            </button>
          ` : ''}
        </div>
        <p class="text-sm font-semibold text-white leading-relaxed">${item.q}</p>
        <div class="grid grid-cols-1 gap-2">
          ${item.options.map((opt, optIdx) => {
            const isEliminated = Array.isArray(item.eliminatedOptions) && item.eliminatedOptions.includes(optIdx);
            const isPicked = answers[qIdx] === optIdx;
            const isCorrect = item.answer === optIdx;

            let btnClass = 'border-[rgba(226,232,240,0.18)] bg-surface text-offwhite hover:border-cyanRadar';
            if (isEliminated && !submitted) {
              btnClass = 'border-slate-800 bg-void/40 text-slateMuted line-through opacity-35 cursor-not-allowed';
            } else if (submitted) {
              if (isCorrect) btnClass = 'border-emeraldLock bg-emeraldLock/15 text-emeraldLock font-bold';
              else if (isPicked) btnClass = 'border-crimsonSignal bg-crimsonSignal/15 text-crimsonSignal';
              else btnClass = 'border-[rgba(226,232,240,0.08)] bg-surface/50 text-slateMuted';
            } else if (isPicked) {
              btnClass = 'border-cyanRadar bg-cyanRadar/20 text-cyanRadar font-bold';
            }

            return `<button type="button" ${submitted || isEliminated ? 'disabled' : ''} onclick="window.selectTierQuizOption(${qIdx}, ${optIdx})" class="text-left text-xs px-3.5 py-2.5 border ${btnClass} rounded-xl transition-colors flex items-center gap-2.5"><span class="font-mono-num text-xs opacity-80">[${String.fromCharCode(65 + optIdx)}]</span><span>${opt}</span></button>`;
          }).join('')}
        </div>
        ${submitted && item.explain ? `<div class="text-xs text-cyanRadar bg-surface px-3.5 py-2.5 rounded-xl border-l-4 border-cyanRadar">💡 Giải thích: ${item.explain}</div>` : ''}
      </div>
    `;
  });

  if (!submitted) {
    const allAnswered = answers.every((a) => a !== null);
    html += `
      <div class="flex items-center justify-between pt-2">
        <span class="font-mono-num text-xs text-slateMuted">Đã chọn: ${answers.filter((a) => a !== null).length}/${questions.length} câu</span>
        <button type="button" onclick="window.submitTierQuiz()" ${!allAnswered ? 'disabled' : ''} class="text-xs px-5 py-2.5 rounded-xl font-bold ${allAnswered ? 'bg-cyanRadar text-void' : 'bg-surface border border-[rgba(226,232,240,0.14)] text-slateMuted cursor-not-allowed'}">Nộp bài khảo sát</button>
      </div>
    `;
  } else {
    const correctCount = questions.reduce((acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0), 0);
    const pct = Math.round((correctCount / questions.length) * 100);
    const passed = pct >= 70;
    const retryCost = getTierEntryFuelCost(planetId, tierNumber);
    const canRetry = state.fuel >= retryCost;

    html += `
      <div class="p-4 border ${passed ? 'border-emeraldLock bg-emeraldLock/10' : 'border-crimsonSignal bg-crimsonSignal/10'} rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div class="font-mono-num text-xs font-extrabold ${passed ? 'text-emeraldLock' : 'text-crimsonSignal'}">KẾT QUẢ: ${correctCount}/${questions.length} CÂU ĐÚNG (${pct}%) — ${passed ? 'ĐẠT CHUẨN MỞ KHÓA' : 'CHƯA ĐẠT (YÊU CẦU ≥ 70%)'}</div>
          <p class="text-xs text-offwhite mt-1">${passed ? 'Trạm quỹ đạo tiếp theo đã được mở khóa!' : 'Các chủ đề làm sai đã được lưu vào hồ sơ để Gia sư AI hỗ trợ bạn ôn lại.'}</p>
        </div>
        <button type="button" onclick="window.launchTierQuiz('${planetId}', ${tierNumber})" ${!canRetry ? 'disabled' : ''} class="text-xs px-4 py-2.5 ${canRetry ? 'bg-surfaceAlt border border-cyanRadar text-cyanRadar font-bold' : 'bg-surface border border-slate-700 text-slateMuted opacity-60 cursor-not-allowed'} rounded-xl shrink-0">
          ${retryCost > 0 ? (canRetry ? `Thử lại vòng này (-${retryCost} L)` : `Thiếu nhiên liệu (${state.fuel}/${retryCost} L)`) : 'Luyện lại đề mới (0 L)'}
        </button>
      </div>
    `;
  }
  html += `</div>`;
  body.innerHTML = html;
}

window.selectTierQuizOption = function (qIdx, optIdx) {
  if (!activeTierQuiz || activeTierQuiz.submitted) return;
  const qItem = activeTierQuiz.questions[qIdx];
  if (qItem?.eliminatedOptions?.includes(optIdx)) return;
  activeTierQuiz.answers[qIdx] = optIdx;
  renderQuizModalContent();
};

window.submitTierQuiz = function () {
  if (!activeTierQuiz || activeTierQuiz.submitted) return;
  activeTierQuiz.submitted = true;
  const { planetId, tierNumber, tierObj, questions, answers } = activeTierQuiz;
  let correctCount = 0;
  questions.forEach((q, idx) => {
    if (answers[idx] === q.answer) { correctCount++; removeWeakTopic(q.topic); }
    else addWeakTopic(q.topic);
  });
  const pct = Math.round((correctCount / questions.length) * 100);
  if (pct >= 70) {
    if ((state.planetProgress[planetId] || 1) === tierNumber) {
      state.planetProgress[planetId] = tierNumber + 1;
      awardRewards(tierObj.xpReward, tierObj.fuelReward);
      showToast('MỞ KHÓA QUỸ ĐẠO', `Hoàn thành ${tierObj.name} (+${tierObj.xpReward} XP, +${tierObj.fuelReward} L).`, 'success');
    } else {
      awardRewards(10, FUEL_RULES.RING_PRACTICE_REWARD);
      showToast('ÔN TẬP HOÀN TẤT', `Củng cố kiến thức thành công (+10 XP, +${FUEL_RULES.RING_PRACTICE_REWARD} L).`, 'info');
    }
  } else {
    persistUserProfile();
    showToast('CHƯA ĐẠT NGƯỠNG 70%', 'Hãy xem lời giải chi tiết bên dưới trước khi thử lại.', 'error');
  }
  renderQuizModalContent();
  updatePlanetPositions();
  renderPlanetQuickCards();
  renderPlanetInspector();
};

// =========================================================================
// 9. HỘP THƯ BÍ MẬT, THỬ THÁCH 5 PHÚT & ĐẤU TRƯỜNG (CÓ 50:50 & +15 GIÂY)
// =========================================================================
function getDayIndex(dateStr) {
  const p = dateStr.split('-').map(Number);
  return (p[0] * 365 + p[1] * 31 + p[2]) >>> 0;
}

function renderMysteryBox() {
  const todayStr = Validator.getTodayLocalISO();
  document.getElementById('mystery-date-tag').textContent = todayStr;
  const container = document.getElementById('mystery-box-content');
  const capsule = MYSTERY_CAPSULES[getDayIndex(todayStr) % MYSTERY_CAPSULES.length];
  const priorityWeak = state.weakTopics[0] || null;
  const adaptiveTip = priorityWeak
    ? `<strong>Gợi ý ôn tập [${Validator.sanitizeText(priorityWeak)}]:</strong> ${TOPIC_REPAIR_GUIDES[priorityWeak] || 'Hãy xem lại công thức tại Góc kiến thức.'}`
    : '<strong>Hồ sơ học tập tốt:</strong> Hiện tại bạn không có chủ đề nào bị đánh dấu sai.';

  if (state.claimedMysteryDate !== todayStr) {
    container.innerHTML = `
      <div class="p-4 bg-void border border-amberSolar/40 rounded-2xl space-y-3.5">
        <div class="flex items-center justify-between"><span class="text-xs text-amberSolar font-bold">ĐANG NIÊM PHONG</span><span class="font-mono-num text-[11px] text-slateMuted">Thưởng: +30 XP | +${FUEL_RULES.MYSTERY_BOX_REWARD} L</span></div>
        <div class="p-3.5 bg-surface border border-[rgba(226,232,240,0.14)] rounded-xl text-xs text-white leading-relaxed">${capsule.riddle}</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          ${capsule.options.map((opt, idx) => `<button type="button" onclick="window.solveDailyMystery(${idx})" class="text-left text-xs px-3.5 py-2.5 bg-surface border border-[rgba(226,232,240,0.18)] hover:border-amberSolar text-white rounded-xl">[${String.fromCharCode(65 + idx)}] ${opt}</button>`).join('')}
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="p-4 bg-void border border-emeraldLock/40 rounded-2xl space-y-3 text-xs">
        <div class="text-[11px] text-emeraldLock font-bold">✅ ĐÃ MỞ HỘP THƯ HÔM NAY (+30 XP, +${FUEL_RULES.MYSTERY_BOX_REWARD} L)</div>
        <div class="p-3 bg-surface border-l-4 border-cyanRadar text-white leading-relaxed rounded-r-xl"><span class="block text-[10px] text-cyanRadar font-bold mb-0.5">SỰ THẬT KHOA HỌC</span>${capsule.fact}</div>
        <div class="p-3 bg-surface border-l-4 border-amberSolar text-white leading-relaxed rounded-r-xl"><span class="block text-[10px] text-amberSolar font-bold mb-0.5">NHẮC NHỞ CÁ NHÂN HÓA</span>${adaptiveTip}</div>
        <p class="italic text-slateMuted">${capsule.quote}</p>
      </div>
    `;
  }
}

window.solveDailyMystery = function (pickedIdx) {
  const todayStr = Validator.getTodayLocalISO();
  if (state.claimedMysteryDate === todayStr) return;
  const capsule = MYSTERY_CAPSULES[getDayIndex(todayStr) % MYSTERY_CAPSULES.length];
  if (pickedIdx === capsule.answer) {
    state.claimedMysteryDate = todayStr;
    awardRewards(30, FUEL_RULES.MYSTERY_BOX_REWARD);
    showToast('MỞ HỘP THÀNH CÔNG', `Nhận +30 XP và +${FUEL_RULES.MYSTERY_BOX_REWARD} L nhiên liệu.`, 'amber');
    renderMysteryBox();
  } else {
    showToast('CHƯA ĐÚNG', 'Thử suy luận lại câu đố nhé!', 'error');
  }
};

let dailySession = { active: false, isPractice: false, secondsLeft: 300, intervalId: null, questions: [], answers: [null, null, null, null] };

function buildDynamicDailyDrill() {
  const qMath = DynamicQuestionGenerator.generateForPlanetTier('mars', 3);
  const qSci = DynamicQuestionGenerator.generateForPlanetTier('earth', 1);
  const qLogic = DynamicQuestionGenerator.generateForPlanetTier('mercury', 1);
  const qEng = {
    subject: 'TIẾNG ANH',
    topic: 'Đọc hiểu STEM tiếng Anh',
    q: 'Choose the best word: "To ensure accurate results, scientists must ______ all variables except the one being tested."',
    options: ['control', 'ignore', 'multiply', 'abandon'],
    answer: 0
  };
  return Validator.shuffleQuestions([
    { ...qMath, subject: 'TOÁN HỌC' },
    { ...qSci, subject: 'KHOA HỌC' },
    qEng,
    { ...qLogic, subject: 'TƯ DUY LOGIC' }
  ]);
}

function formatMMSS(sec) {
  const c = Math.max(0, sec);
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
}

function renderDailyChallenge() {
  const todayStr = Validator.getTodayLocalISO();
  const container = document.getElementById('daily-challenge-container');
  const timerEl = document.getElementById('daily-timer-display');

  if (state.completedDailyDate === todayStr && state.dailyResult && !dailySession.active) {
    timerEl.textContent = '00:00';
    container.innerHTML = `
      <div class="p-4 bg-void border border-emeraldLock/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div>
          <div class="font-bold text-emeraldLock">ĐÃ HOÀN THÀNH THỬ THÁCH NGÀY ${todayStr}</div>
          <p class="text-white mt-1">Kết quả: <strong>${state.dailyResult.score}/4 câu đúng</strong> (${state.dailyResult.timeTaken}s) — Nhận <strong class="text-amberSolar">+${state.dailyResult.xpEarned} XP</strong> & <strong class="text-cyanRadar">+${state.dailyResult.fuelEarned ?? 0} L</strong>.</p>
        </div>
        <button type="button" onclick="window.practiceDailyAgain()" class="px-3.5 py-2 bg-surfaceAlt border border-cyanRadar/50 text-cyanRadar font-bold rounded-xl shrink-0">Luyện thêm đề mới</button>
      </div>
    `;
    return;
  }
  if (!dailySession.active) {
    timerEl.textContent = '05:00';
    container.innerHTML = `<div class="p-4 bg-void border border-[rgba(226,232,240,0.16)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div class="space-y-1"><p class="text-sm text-white font-semibold">4 câu hỏi sinh số liệu động: Toán học, Khoa học, Tiếng Anh và Tư duy Logic.</p><p class="text-xs text-slateMuted">Thưởng tối đa +25 L nhiên liệu (tính theo số câu làm đúng). Khi về 00:00 tự động thu bài.</p></div><button type="button" onclick="window.startDailyChallenge(false)" class="text-xs px-5 py-2.5 bg-cyanRadar font-bold rounded-xl shrink-0">Bắt đầu 05:00</button></div>`;
    return;
  }

  timerEl.textContent = formatMMSS(dailySession.secondsLeft);
  container.innerHTML = `<div class="space-y-3.5">${dailySession.questions.map((item, qIdx) => `
    <div class="p-3.5 bg-void border border-[rgba(226,232,240,0.16)] rounded-2xl space-y-2.5">
      <div class="flex justify-between font-mono-num text-[10px] text-cyanRadar font-bold"><span>CÂU 0${qIdx + 1} • ${item.subject}</span><span class="text-slateMuted">${item.topic}</span></div>
      <p class="text-xs text-white font-semibold">${item.q}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        ${item.options.map((opt, oIdx) => `<button type="button" onclick="window.pickDailyOption(${qIdx}, ${oIdx})" class="text-left text-xs px-3 py-2 border ${dailySession.answers[qIdx] === oIdx ? 'border-cyanRadar bg-cyanRadar/20 text-cyanRadar font-bold' : 'border-[rgba(226,232,240,0.15)] bg-surface text-offwhite'} rounded-xl">[${String.fromCharCode(65 + oIdx)}] ${opt}</button>`).join('')}
      </div>
    </div>
  `).join('')}<div class="flex justify-between items-center pt-1"><span class="font-mono-num text-xs text-slateMuted">Đã chọn: ${dailySession.answers.filter((a) => a !== null).length}/4</span><button type="button" onclick="window.submitDailyChallenge(false)" class="text-xs px-5 py-2.5 bg-amberSolar font-bold rounded-xl">Nộp bài thử thách</button></div></div>`;
}

window.practiceDailyAgain = function () {
  window.startDailyChallenge(true);
};

window.startDailyChallenge = function (isPracticeMode = false) {
  if (dailySession.active) return;
  dailySession = {
    active: true,
    isPractice: Boolean(isPracticeMode),
    secondsLeft: 300,
    questions: buildDynamicDailyDrill(),
    answers: [null, null, null, null],
    intervalId: setInterval(() => {
      dailySession.secondsLeft -= 1;
      const timerEl = document.getElementById('daily-timer-display');
      if (timerEl) timerEl.textContent = formatMMSS(dailySession.secondsLeft);
      if (dailySession.secondsLeft <= 0) window.submitDailyChallenge(true);
    }, 1000),
  };
  renderDailyChallenge();
};

window.pickDailyOption = function (qIdx, oIdx) {
  if (!dailySession.active || dailySession.secondsLeft <= 0) return;
  dailySession.answers[qIdx] = oIdx;
  renderDailyChallenge();
};

window.submitDailyChallenge = function (isTimeout) {
  if (!dailySession.active) return;
  if (dailySession.intervalId) clearInterval(dailySession.intervalId);
  const todayStr = Validator.getTodayLocalISO();
  let score = 0;
  dailySession.questions.forEach((item, idx) => {
    if (dailySession.answers[idx] === item.answer) { score++; removeWeakTopic(item.topic); }
    else addWeakTopic(item.topic);
  });

  const timeTaken = 300 - Math.max(0, dailySession.secondsLeft);
  // Chống nộp bài 0 điểm để cày nhiên liệu: Đúng 0 câu nhận 0 XP, 0 L
  let xpEarned = 0;
  let fuelEarned = 0;
  if (dailySession.isPractice) {
    xpEarned = score * 5;
    fuelEarned = score >= 3 ? 5 : 0;
  } else {
    xpEarned = score > 0 ? (score * 25 + 15) : 0;
    fuelEarned = score > 0 ? (5 + score * 5) : 0; // 4/4 = +25 L, 0/4 = 0 L
    state.completedDailyDate = todayStr;
    state.dailyResult = { score, timeTaken, xpEarned, fuelEarned };
  }

  dailySession.active = false;
  awardRewards(xpEarned, fuelEarned);
  showToast(
    isTimeout ? 'HẾT GIỜ 00:00 — TỰ ĐỘNG THU BÀI' : 'HOÀN THÀNH THỬ THÁCH',
    `Đạt ${score}/4 câu đúng (+${xpEarned} XP, +${fuelEarned} L).`,
    score > 0 ? 'success' : 'error'
  );
  renderDailyChallenge();
};

// --- Đấu trường trí tuệ 10 câu (Có Trợ giúp 50:50 trừ 10 L & +15 giây trừ 5 L) ---
let arenaSession = null;
function buildArenaDeck() {
  const pool = [];
  PLANETS_DATA.forEach((p) => {
    p.tiers.forEach((t) => {
      t.questions.forEach((q) => pool.push({ ...q, subject: p.subject }));
      const dyn = DynamicQuestionGenerator.generateForPlanetTier(p.id, t.tier);
      if (dyn) pool.push(dyn);
    });
  });
  return Validator.shuffleQuestions(pool).slice(0, 10).map((q) => ({
    ...q,
    eliminatedOptions: [],
    used5050: false,
    usedExtraTime: false
  }));
}

function renderArenaHome() {
  document.getElementById('arena-best-score').textContent = `${state.arenaBestScore}/10`;
  const ws = document.getElementById('arena-workspace');
  if (arenaSession && arenaSession.active) return;
  ws.innerHTML = `<div class="p-4 bg-void border border-[rgba(226,232,240,0.16)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"><p class="text-xs text-white">10 câu hỏi tổng hợp tốc độ cao (15 giây/câu). Thưởng <strong>+${FUEL_RULES.ARENA_PER_CORRECT} L / câu đúng</strong> (Vào cửa miễn phí 0 L, có quyền trợ giúp 50:50 và +15 giây).</p><button type="button" onclick="window.startArenaBlitz()" class="text-xs px-5 py-2.5 bg-emeraldLock font-bold rounded-xl shrink-0">Vào Đấu Trường (0 L)</button></div>`;
}

window.startArenaBlitz = function () {
  if (arenaSession?.timerId) clearInterval(arenaSession.timerId);
  arenaSession = { active: true, questions: buildArenaDeck(), index: 0, score: 0, streak: 0, maxStreak: 0, secLeft: 15, maxSec: 15, locked: false, timerId: null };
  startArenaTimer();
  renderArenaQuestion();
};

function startArenaTimer() {
  if (arenaSession.timerId) clearInterval(arenaSession.timerId);
  arenaSession.secLeft = 15;
  arenaSession.maxSec = 15;
  arenaSession.locked = false;
  arenaSession.timerId = setInterval(() => {
    if (!arenaSession?.active) return;
    arenaSession.secLeft -= 1;
    const bar = document.getElementById('arena-time-bar');
    const txt = document.getElementById('arena-time-txt');
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, (arenaSession.secLeft / arenaSession.maxSec) * 100))}%`;
    if (txt) txt.textContent = `${arenaSession.secLeft}s`;
    if (arenaSession.secLeft <= 0) window.handleArenaAnswer(-1);
  }, 1000);
}

window.useArena5050 = function () {
  if (!arenaSession?.active || arenaSession.locked) return;
  const qObj = arenaSession.questions[arenaSession.index];
  if (!qObj || qObj.used5050) return;

  if (!spendFuel(FUEL_RULES.LIFELINE_5050_COST, 'Trợ giúp 50:50 trong Đấu trường')) return;

  const wrongIndices = qObj.options.map((_, i) => i).filter((i) => i !== qObj.answer);
  qObj.eliminatedOptions = Validator.shuffleArray(wrongIndices).slice(0, 2);
  qObj.used5050 = true;
  renderArenaQuestion();
};

window.useArenaExtraTime = function () {
  if (!arenaSession?.active || arenaSession.locked) return;
  const qObj = arenaSession.questions[arenaSession.index];
  if (!qObj || qObj.usedExtraTime) return;

  if (!spendFuel(FUEL_RULES.LIFELINE_TIME_COST, 'Mua +15 giây trong Đấu trường')) return;

  qObj.usedExtraTime = true;
  arenaSession.secLeft += 15;
  arenaSession.maxSec = Math.max(arenaSession.maxSec, arenaSession.secLeft);
  renderArenaQuestion();
};

function renderArenaQuestion() {
  const ws = document.getElementById('arena-workspace');
  const qObj = arenaSession.questions[arenaSession.index];
  const can5050 = !qObj.used5050 && state.fuel >= FUEL_RULES.LIFELINE_5050_COST;
  const canTime = !qObj.usedExtraTime && state.fuel >= FUEL_RULES.LIFELINE_TIME_COST;

  ws.innerHTML = `
    <div class="p-4 bg-void border border-[rgba(226,232,240,0.18)] rounded-2xl space-y-3.5">
      <div class="flex flex-wrap items-center justify-between gap-2 font-mono-num text-xs">
        <span class="text-cyanRadar font-bold">CÂU ${arenaSession.index + 1}/10 • ${qObj.subject}</span>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" onclick="window.useArena5050()" ${!can5050 ? 'disabled' : ''} class="px-2.5 py-1 rounded-lg border text-[11px] font-bold ${qObj.used5050 ? 'border-emeraldLock/40 text-emeraldLock opacity-60' : can5050 ? 'border-amberSolar/60 text-amberSolar bg-amberSolar/10' : 'border-slate-700 text-slateMuted opacity-40 cursor-not-allowed'}">
            ${qObj.used5050 ? 'Đã dùng 50:50' : `50:50 (-${FUEL_RULES.LIFELINE_5050_COST} L)`}
          </button>
          <button type="button" onclick="window.useArenaExtraTime()" ${!canTime ? 'disabled' : ''} class="px-2.5 py-1 rounded-lg border text-[11px] font-bold ${qObj.usedExtraTime ? 'border-emeraldLock/40 text-emeraldLock opacity-60' : canTime ? 'border-cyanRadar/60 text-cyanRadar bg-cyanRadar/10' : 'border-slate-700 text-slateMuted opacity-40 cursor-not-allowed'}">
            ${qObj.usedExtraTime ? 'Đã +15s' : `+15 giây (-${FUEL_RULES.LIFELINE_TIME_COST} L)`}
          </button>
          <span class="text-amberSolar font-bold ml-1">Chuỗi: ${arenaSession.streak}</span>
          <span id="arena-time-txt" class="text-white font-bold">${arenaSession.secLeft}s</span>
        </div>
      </div>
      <div class="w-full h-1.5 bg-surface overflow-hidden rounded-full"><div id="arena-time-bar" class="h-full bg-cyanRadar transition-all duration-300" style="width:${Math.min(100, (arenaSession.secLeft / arenaSession.maxSec) * 100)}%"></div></div>
      <p class="text-sm font-semibold text-white pt-1">${qObj.q}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        ${qObj.options.map((opt, idx) => {
          const isElim = Array.isArray(qObj.eliminatedOptions) && qObj.eliminatedOptions.includes(idx);
          return `<button type="button" ${isElim ? 'disabled' : ''} onclick="window.handleArenaAnswer(${idx})" class="text-left text-xs px-3.5 py-2.5 border ${isElim ? 'border-slate-800 bg-void/40 text-slateMuted line-through opacity-35 cursor-not-allowed' : 'bg-surface border-[rgba(226,232,240,0.18)] hover:border-cyanRadar text-white'} rounded-xl"><span class="font-mono-num text-slateMuted mr-1.5">[${String.fromCharCode(65 + idx)}]</span>${opt}</button>`;
        }).join('')}
      </div>
    </div>
  `;
}

window.handleArenaAnswer = function (pickedIdx) {
  if (!arenaSession?.active || arenaSession.locked) return;
  arenaSession.locked = true;
  clearInterval(arenaSession.timerId);
  const qObj = arenaSession.questions[arenaSession.index];
  if (pickedIdx === qObj.answer) {
    arenaSession.score += 1;
    arenaSession.streak += 1;
    arenaSession.maxStreak = Math.max(arenaSession.maxStreak, arenaSession.streak);
    removeWeakTopic(qObj.topic);
  } else {
    arenaSession.streak = 0;
    addWeakTopic(qObj.topic);
  }
  arenaSession.index += 1;
  if (arenaSession.index >= arenaSession.questions.length) {
    const { score, maxStreak } = arenaSession;
    arenaSession.active = false;
    const xpEarned = score * 15 + (maxStreak >= 3 ? maxStreak * 5 : 0);
    // Chỉ thưởng nhiên liệu theo đúng số câu trả lời đúng (+2 L / câu đúng)
    const fuelEarned = score * FUEL_RULES.ARENA_PER_CORRECT;
    if (score > state.arenaBestScore) state.arenaBestScore = score;
    awardRewards(xpEarned, fuelEarned);
    document.getElementById('arena-best-score').textContent = `${state.arenaBestScore}/10`;
    document.getElementById('arena-workspace').innerHTML = `<div class="p-4 bg-void border border-cyanRadar/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><div class="text-xs text-cyanRadar font-bold">HOÀN THÀNH ĐẤU TRƯỜNG</div><p class="text-sm text-white mt-0.5">Điểm: <strong>${score}/10</strong> | Chuỗi cực đại: <strong>${maxStreak}</strong> | Thưởng: <strong class="text-amberSolar">+${xpEarned} XP</strong> & <strong class="text-cyanRadar">+${fuelEarned} L</strong>.</p></div><button type="button" onclick="window.startArenaBlitz()" class="text-xs px-5 py-2.5 bg-cyanRadar font-bold rounded-xl">Thi đấu trận mới</button></div>`;
  } else {
    startArenaTimer();
    renderArenaQuestion();
  }
};

// =========================================================================
// 10. PHÒNG LAB STEM 3 CHẾ ĐỘ & DỰ ÁN STEM ĐỒNG BỘ THẬT
// =========================================================================
const simState = {
  mode: 'projectile',
  angleDeg: 45, velocity: 42, gravity: 9.81, envName: 'Trái Đất',
  t: 0, running: true, ghostTrajectory: null, lastFrameTime: null,
  pendLen: 1.6, pendAmp: 24, pendTime: 0, pendWave: [],
  titVol: 15.0,
};

function computeProjectileMetrics(angleDeg, v0, g) {
  const rad = (angleDeg * Math.PI) / 180;
  const vx = v0 * Math.cos(rad);
  const vy0 = v0 * Math.sin(rad);
  const tFlight = (2 * vy0) / g;
  const hMax = (vy0 * vy0) / (2 * g);
  const range = vx * tFlight;
  return { rad, vx, vy0, tFlight, hMax, range };
}

function syncPhysicsInputs(source) {
  const angleNum = document.getElementById('sim-angle-num');
  const angleRange = document.getElementById('sim-angle-range');
  const velNum = document.getElementById('sim-vel-num');
  const velRange = document.getElementById('sim-vel-range');
  const gravNum = document.getElementById('sim-grav-num');

  simState.angleDeg = Validator.clampNumber(source === 'range' ? angleRange.value : angleNum.value, 5, 85, 45);
  simState.velocity = Validator.clampNumber(source === 'range' ? velRange.value : velNum.value, 5, 100, 42);
  simState.gravity = Validator.clampNumber(gravNum.value, 1.62, 24.79, 9.81);

  angleNum.value = simState.angleDeg; angleRange.value = simState.angleDeg;
  velNum.value = simState.velocity; velRange.value = simState.velocity;
  gravNum.value = simState.gravity;

  if (simState.mode === 'projectile') {
    const m = computeProjectileMetrics(simState.angleDeg, simState.velocity, simState.gravity);
    document.getElementById('sim-lbl-1').textContent = 'ĐỘ CAO H_max';
    document.getElementById('sim-lbl-2').textContent = 'TẦM XA R';
    document.getElementById('sim-lbl-3').textContent = 'THỜI GIAN BAY';
    document.getElementById('sim-out-hmax').textContent = `${m.hMax.toFixed(2)} m`;
    document.getElementById('sim-out-range').textContent = `${m.range.toFixed(2)} m`;
    document.getElementById('sim-out-time').textContent = `${m.tFlight.toFixed(2)} s`;
    document.getElementById('sim-env-label').textContent = `${simState.envName} (g = ${simState.gravity.toFixed(2)} m/s²)`;
  }
}

function resizePhysicsCanvas() {
  const wrapper = document.getElementById('sim-canvas-wrapper');
  const canvas = document.getElementById('physics-canvas');
  if (!wrapper || !canvas) return;
  const rect = wrapper.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawActiveLabScene() {
  if (simState.mode === 'projectile') drawProjectileScene();
  else if (simState.mode === 'pendulum') drawPendulumScene();
  else drawTitrationScene();
}

function drawProjectileScene() {
  const canvas = document.getElementById('physics-canvas');
  const wrapper = document.getElementById('sim-canvas-wrapper');
  if (!canvas || !wrapper) return;
  const { width: W, height: H } = wrapper.getBoundingClientRect();
  if (W <= 0 || H <= 0) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const padL = 48, padB = 36, padT = 46, padR = 30;
  const m = computeProjectileMetrics(simState.angleDeg, simState.velocity, simState.gravity);
  let maxX = Math.max(50, m.range * 1.15), maxY = Math.max(25, m.hMax * 1.25);
  if (simState.ghostTrajectory) {
    maxX = Math.max(maxX, simState.ghostTrajectory.range * 1.15);
    maxY = Math.max(maxY, simState.ghostTrajectory.hMax * 1.25);
  }
  const scale = Math.min((W - padL - padR) / maxX, (H - padT - padB) / maxY);
  const toX = (wx) => padL + wx * scale;
  const toY = (wy) => H - padB - wy * scale;

  ctx.strokeStyle = 'rgba(226, 232, 240, 0.08)';
  ctx.font = '11px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#B4C6E7';
  const stepG = maxX > 500 ? 100 : maxX > 200 ? 50 : 20;
  for (let gx = 0; gx <= maxX; gx += stepG) {
    const cx = toX(gx); if (cx > W - padR) break;
    ctx.beginPath(); ctx.moveTo(cx, padT); ctx.lineTo(cx, H - padB); ctx.stroke();
    ctx.fillText(`${gx}m`, cx - 10, H - padB + 16);
  }
  for (let gy = stepG; gy <= maxY; gy += stepG) {
    const cy = toY(gy); if (cy < padT) break;
    ctx.beginPath(); ctx.moveTo(padL, cy); ctx.lineTo(W - padR, cy); ctx.stroke();
    ctx.fillText(`${gy}m`, 8, cy + 4);
  }

  ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
  ctx.beginPath(); ctx.moveTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();

  if (simState.ghostTrajectory) {
    const g = simState.ghostTrajectory;
    ctx.save(); ctx.strokeStyle = '#FBBF24'; ctx.lineWidth = 1.8; ctx.setLineDash([5, 4]); ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const tt = (g.tFlight * i) / 60;
      const gx = g.vx * tt, gy = Math.max(0, g.vy0 * tt - 0.5 * g.gravity * tt * tt);
      if (i === 0) ctx.moveTo(toX(gx), toY(gy)); else ctx.lineTo(toX(gx), toY(gy));
    }
    ctx.stroke(); ctx.restore();
  }

  const activeT = Math.min(simState.t, m.tFlight);
  ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 2.5; ctx.beginPath();
  for (let i = 0; i <= 45; i++) {
    const tt = (activeT * i) / 45;
    const px = m.vx * tt, py = Math.max(0, m.vy0 * tt - 0.5 * simState.gravity * tt * tt);
    if (i === 0) ctx.moveTo(toX(px), toY(py)); else ctx.lineTo(toX(px), toY(py));
  }
  ctx.stroke();

  const curX = m.vx * activeT, curY = Math.max(0, m.vy0 * activeT - 0.5 * simState.gravity * activeT * activeT);
  const curVx = m.vx, curVy = m.vy0 - simState.gravity * activeT;
  const bx = toX(curX), by = toY(curY);

  ctx.strokeStyle = '#34D399'; ctx.lineWidth = 1.8; ctx.beginPath();
  ctx.moveTo(bx, by); ctx.lineTo(bx + curVx * 0.55, by - curVy * 0.55); ctx.stroke();

  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(bx, by, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  document.getElementById('sim-live-coords').textContent = `t = ${activeT.toFixed(2)}s | x = ${curX.toFixed(1)}m | y = ${curY.toFixed(1)}m`;
}

function drawPendulumScene() {
  const canvas = document.getElementById('physics-canvas');
  const wrapper = document.getElementById('sim-canvas-wrapper');
  if (!canvas || !wrapper) return;
  const { width: W, height: H } = wrapper.getBoundingClientRect();
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const l = simState.pendLen;
  const a0 = (simState.pendAmp * Math.PI) / 180;
  const g = 9.81;
  const omega = Math.sqrt(g / l);
  const period = (2 * Math.PI) / omega;
  const theta = a0 * Math.cos(omega * simState.pendTime);

  const ox = W * 0.25, oy = 50;
  const pixL = Math.min(H - 85, 65 + l * 46);
  const bx = ox + pixL * Math.sin(theta), by = oy + pixL * Math.cos(theta);

  ctx.strokeStyle = 'rgba(226,232,240,0.2)'; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, H - 30); ctx.stroke(); ctx.setLineDash([]);

  ctx.strokeStyle = '#B4C6E7'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(bx, by); ctx.stroke();

  ctx.fillStyle = '#38BDF8';
  ctx.beginPath(); ctx.arc(bx, by, 12, 0, Math.PI * 2); ctx.fill();

  simState.pendWave.unshift(theta);
  if (simState.pendWave.length > 220) simState.pendWave.pop();

  const gx0 = W * 0.48, gy0 = H * 0.52;
  ctx.strokeStyle = 'rgba(226,232,240,0.15)';
  ctx.beginPath(); ctx.moveTo(gx0, gy0); ctx.lineTo(W - 24, gy0); ctx.stroke();

  ctx.strokeStyle = '#34D399'; ctx.lineWidth = 2.2; ctx.beginPath();
  simState.pendWave.forEach((ang, i) => {
    const px = gx0 + i * 1.4, py = gy0 - ang * 115;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.stroke();

  document.getElementById('sim-lbl-1').textContent = 'CHU KỲ T';
  document.getElementById('sim-lbl-2').textContent = 'TẦN SỐ GÓC ω';
  document.getElementById('sim-lbl-3').textContent = 'GÓC LỆCH α(t)';
  document.getElementById('sim-out-hmax').textContent = `${period.toFixed(2)} s`;
  document.getElementById('sim-out-range').textContent = `${omega.toFixed(2)} rad/s`;
  document.getElementById('sim-out-time').textContent = `${((theta * 180) / Math.PI).toFixed(1)}°`;
  document.getElementById('sim-env-label').textContent = `Con lắc đơn (l = ${l.toFixed(1)}m, g = 9.81m/s²)`;
  document.getElementById('sim-live-coords').textContent = `t = ${simState.pendTime.toFixed(1)}s | α = ${((theta * 180) / Math.PI).toFixed(1)}°`;
}

function calcTitrationPH(vb) {
  const va = 25.0, c = 0.1;
  const molH = va * c, molOH = vb * c, total = va + vb;
  if (Math.abs(molH - molOH) < 1e-5) return 7.0;
  if (molH > molOH) return Math.max(0, -Math.log10((molH - molOH) / total));
  return Math.min(14, 14 + Math.log10((molOH - molH) / total));
}

function drawTitrationScene() {
  const canvas = document.getElementById('physics-canvas');
  const wrapper = document.getElementById('sim-canvas-wrapper');
  if (!canvas || !wrapper) return;
  const { width: W, height: H } = wrapper.getBoundingClientRect();
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const vb = simState.titVol;
  const ph = calcTitrationPH(vb);

  let liquidColor = 'rgba(56, 189, 248, 0.22)';
  if (ph >= 8.2 && ph < 10) liquidColor = 'rgba(244, 114, 182, 0.55)';
  else if (ph >= 10) liquidColor = 'rgba(236, 72, 153, 0.85)';

  ctx.fillStyle = liquidColor;
  ctx.strokeStyle = '#E2E8F0'; ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(85, 85); ctx.lineTo(45, H - 40); ctx.lineTo(155, H - 40); ctx.lineTo(115, 85);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  const gx = 205, gy = H - 36, gw = W - 235, gh = H - 80;
  ctx.strokeStyle = 'rgba(226,232,240,0.22)'; ctx.strokeRect(gx, 44, gw, gh);

  const eqX = gx + (25 / 50) * gw;
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)'; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(eqX, 44); ctx.lineTo(eqX, gy); ctx.stroke(); ctx.setLineDash([]);

  ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 2.5; ctx.beginPath();
  for (let v = 0; v <= vb; v += 0.25) {
    const p = calcTitrationPH(v);
    const px = gx + (v / 50) * gw, py = gy - (p / 14) * gh;
    if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();

  const curPx = gx + (vb / 50) * gw, curPy = gy - (ph / 14) * gh;
  ctx.fillStyle = '#FBBF24'; ctx.beginPath(); ctx.arc(curPx, curPy, 5.5, 0, Math.PI * 2); ctx.fill();

  document.getElementById('sim-lbl-1').textContent = 'GIÁ TRỊ pH';
  document.getElementById('sim-lbl-2').textContent = 'V(NaOH) ĐÃ NHỎ';
  document.getElementById('sim-lbl-3').textContent = 'CHỈ THỊ MÀU';
  document.getElementById('sim-out-hmax').textContent = ph.toFixed(2);
  document.getElementById('sim-out-range').textContent = `${vb.toFixed(1)} ml`;
  document.getElementById('sim-out-time').textContent = ph >= 8.2 ? 'Hóa hồng' : 'Không màu';
  document.getElementById('sim-env-label').textContent = ph < 6.95 ? 'Môi trường Axit' : ph <= 7.05 ? 'Điểm tương đương (pH = 7.00)' : 'Dư Bazơ (Kiềm)';
  document.getElementById('sim-live-coords').textContent = `V(NaOH) = ${vb.toFixed(1)}ml | pH = ${ph.toFixed(2)}`;
}

function labAnimationLoop(timestamp) {
  if (simState.lastFrameTime === null) simState.lastFrameTime = timestamp;
  const dt = Math.min(0.05, (timestamp - simState.lastFrameTime) / 1000);
  simState.lastFrameTime = timestamp;

  if (state.activeModule === 'lab') {
    if (simState.mode === 'projectile' && simState.running) {
      const m = computeProjectileMetrics(simState.angleDeg, simState.velocity, simState.gravity);
      if (simState.t < m.tFlight) {
        simState.t = Math.min(m.tFlight, simState.t + dt * 1.4);
        drawProjectileScene();
      }
    } else if (simState.mode === 'pendulum') {
      simState.pendTime += dt;
      drawPendulumScene();
    }
  }
  requestAnimationFrame(labAnimationLoop);
}

function initPhysicsLab() {
  document.querySelectorAll('.sim-mode-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      simState.mode = btn.dataset.simMode;
      document.querySelectorAll('.sim-mode-tab').forEach((b) => {
        b.className = 'sim-mode-tab font-mono-num text-xs px-4 py-2 border border-[rgba(226,232,240,0.18)] bg-void text-slateMuted hover:text-offwhite rounded';
      });
      btn.className = 'sim-mode-tab font-mono-num text-xs px-4 py-2 border border-cyanRadar bg-cyanRadar/15 text-cyanRadar font-semibold rounded';

      document.getElementById('sim-controls-projectile').classList.toggle('hidden', simState.mode !== 'projectile');
      document.getElementById('sim-controls-pendulum').classList.toggle('hidden', simState.mode !== 'pendulum');
      document.getElementById('sim-controls-titration').classList.toggle('hidden', simState.mode !== 'titration');

      const titles = {
        projectile: 'Mô Phỏng 1: Chuyển Động Ném Xiên Đa Hành Tinh',
        pendulum: 'Mô Phỏng 2: Dao Động Điều Hòa Con Lắc Đơn',
        titration: 'Mô Phỏng 3: Chuẩn Độ Axit – Bazơ & Đường Cong pH',
      };
      document.getElementById('lab-sim-heading').textContent = titles[simState.mode];
      syncPhysicsInputs('num');
      drawActiveLabScene();
    });
  });

  ['sim-angle-range', 'sim-vel-range'].forEach((id) => {
    document.getElementById(id).addEventListener('input', () => { syncPhysicsInputs('range'); simState.t = 0; drawProjectileScene(); });
  });
  ['sim-angle-num', 'sim-vel-num', 'sim-grav-num'].forEach((id) => {
    document.getElementById(id).addEventListener('change', () => { syncPhysicsInputs('num'); simState.t = 0; drawProjectileScene(); });
  });

  document.querySelectorAll('.gravity-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gravity-preset-btn').forEach((b) => {
        b.className = 'gravity-preset-btn font-mono-num text-[11px] px-2.5 py-1.5 border border-[rgba(226,232,240,0.18)] bg-surface text-slateMuted rounded';
      });
      btn.className = 'gravity-preset-btn font-mono-num text-[11px] px-2.5 py-1.5 border border-cyanRadar bg-cyanRadar/15 text-cyanRadar rounded';
      document.getElementById('sim-grav-num').value = btn.dataset.gravity;
      simState.envName = btn.dataset.planetName;
      syncPhysicsInputs('num');
      simState.t = 0; simState.running = true;
      drawProjectileScene();
    });
  });

  document.getElementById('sim-launch-btn').addEventListener('click', () => { syncPhysicsInputs('num'); simState.t = 0; simState.running = true; drawProjectileScene(); });
  document.getElementById('sim-pause-btn').addEventListener('click', (e) => { simState.running = !simState.running; e.target.textContent = simState.running ? 'Tạm dừng' : 'Tiếp tục'; });
  document.getElementById('sim-ghost-btn').addEventListener('click', () => {
    const m = computeProjectileMetrics(simState.angleDeg, simState.velocity, simState.gravity);
    simState.ghostTrajectory = { ...m, gravity: simState.gravity };
    drawProjectileScene();
    showToast('ĐÃ LƯU QUỸ ĐẠO GHOST', `Góc ${simState.angleDeg}°, v₀ = ${simState.velocity} m/s, g = ${simState.gravity} m/s².`, 'amber');
  });

  document.getElementById('pend-len-range').addEventListener('input', (e) => {
    simState.pendLen = Validator.clampNumber(e.target.value, 0.4, 4.0, 1.6);
    document.getElementById('pend-len-label').textContent = `${simState.pendLen.toFixed(1)} m`;
  });
  document.getElementById('pend-amp-range').addEventListener('input', (e) => {
    simState.pendAmp = Validator.clampNumber(e.target.value, 5, 45, 24);
    document.getElementById('pend-amp-label').textContent = `${simState.pendAmp}°`;
  });

  const updateTitrationVol = (v) => {
    simState.titVol = Validator.clampNumber(v, 0, 50, 0);
    document.getElementById('tit-vol-range').value = simState.titVol;
    document.getElementById('tit-vol-label').textContent = `${simState.titVol.toFixed(1)} ml`;
    drawTitrationScene();
  };
  document.getElementById('tit-vol-range').addEventListener('input', (e) => updateTitrationVol(e.target.value));
  document.getElementById('tit-add-drop').addEventListener('click', () => updateTitrationVol(simState.titVol + 0.5));
  document.getElementById('tit-reset-btn').addEventListener('click', () => updateTitrationVol(0));

  window.addEventListener('resize', () => { if (state.activeModule === 'lab') { resizePhysicsCanvas(); drawActiveLabScene(); } });
  syncPhysicsInputs('num');
  requestAnimationFrame(labAnimationLoop);
}

// --- Kiểm tra, Đăng tải, Bình chọn & Xóa Dự án STEM thật ---
function setFieldError(inputId, errorId, errorMsg) {
  const inputEl = document.getElementById(inputId);
  const errEl = document.getElementById(errorId);
  if (!inputEl || !errEl) return;
  if (errorMsg) {
    errEl.textContent = errorMsg; errEl.classList.remove('hidden');
    inputEl.classList.remove('border-[rgba(226,232,240,0.2)]', 'border-emeraldLock');
    inputEl.classList.add('border-crimsonSignal');
  } else {
    errEl.textContent = ''; errEl.classList.add('hidden');
    inputEl.classList.remove('border-crimsonSignal');
    inputEl.classList.add('border-emeraldLock');
  }
}

function initStemBoard() {
  const dateInput = document.getElementById('proj-date');
  const todayISO = Validator.getTodayLocalISO();
  dateInput.setAttribute('min', todayISO);
  dateInput.value = todayISO;

  document.getElementById('proj-members').addEventListener('keydown', (e) => {
    if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) e.preventDefault();
  });
  document.getElementById('proj-budget').addEventListener('keydown', (e) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
  });

  const form = document.getElementById('stem-project-form');
  const readRawForm = () => ({
    title: document.getElementById('proj-title').value,
    category: document.getElementById('proj-category').value,
    memberCount: document.getElementById('proj-members').value,
    budget: document.getElementById('proj-budget').value,
    eventDate: document.getElementById('proj-date').value,
    description: document.getElementById('proj-desc').value,
  });

  const fieldBindings = [
    { inputId: 'proj-title', errorId: 'err-proj-title', key: 'title' },
    { inputId: 'proj-members', errorId: 'err-proj-members', key: 'memberCount' },
    { inputId: 'proj-budget', errorId: 'err-proj-budget', key: 'budget' },
    { inputId: 'proj-date', errorId: 'err-proj-date', key: 'eventDate' },
    { inputId: 'proj-desc', errorId: 'err-proj-desc', key: 'description' },
  ];

  fieldBindings.forEach(({ inputId, errorId, key }) => {
    const el = document.getElementById(inputId);
    const handler = () => {
      const check = Validator.validateStemProject(readRawForm(), state.stemProjects);
      setFieldError(inputId, errorId, check.errors[key]);
    };
    el.addEventListener('input', handler);
    el.addEventListener('blur', handler);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const check = Validator.validateStemProject(readRawForm(), state.stemProjects);
    fieldBindings.forEach(({ inputId, errorId, key }) => setFieldError(inputId, errorId, check.errors[key]));
    if (!check.isValid) {
      showToast('DỮ LIỆU CHƯA HỢP LỆ', 'Vui lòng sửa các trường báo đỏ trước khi gửi.', 'error');
      return;
    }

    const projId = 'stem_' + Date.now();
    const newProject = {
      id: projId,
      ...check.cleaned,
      author: state.userName,
      authorId: state.userId,
      voters: [state.userId],
      votes: 1,
      createdAt: new Date().toISOString()
    };

    state.stemProjects.unshift(newProject);
    awardRewards(40, FUEL_RULES.STEM_PROJECT_REWARD);
    renderStemProjects();

    form.reset();
    document.getElementById('proj-members').value = '3';
    document.getElementById('proj-budget').value = '150000';
    document.getElementById('proj-date').value = Validator.getTodayLocalISO();
    fieldBindings.forEach(({ inputId }) => {
      document.getElementById(inputId).classList.remove('border-emeraldLock', 'border-crimsonSignal');
    });
    showToast('ĐĂNG TẢI THÀNH CÔNG', `Dự án "${newProject.title}" đã được lưu (+40 XP, +${FUEL_RULES.STEM_PROJECT_REWARD} L).`, 'success');

    if (db && currentUser && fbSdk) {
      try {
        await fbSdk.setDoc(fbSdk.doc(db, 'eduniverse_projects', projId), newProject);
      } catch (err) {}
    }
  });

  document.getElementById('filter-stem-category').addEventListener('change', renderStemProjects);
  renderStemProjects();
}

function renderStemProjects() {
  const filterCat = document.getElementById('filter-stem-category').value;
  const listEl = document.getElementById('stem-projects-list');
  const filtered = filterCat === 'ALL' ? state.stemProjects : state.stemProjects.filter((p) => p.category === filterCat);
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="p-5 bg-void border border-[rgba(226,232,240,0.14)] rounded-2xl text-xs text-slateMuted">Chưa có dự án nào được đăng. Hãy là người đầu tiên đăng ký dự án STEM ở khung bên trái (+40 XP, +${FUEL_RULES.STEM_PROJECT_REWARD} L)!</div>`;
    return;
  }
  listEl.innerHTML = filtered.map((p) => {
    const votersList = Array.isArray(p.voters) ? p.voters : [];
    const votedByMe = votersList.includes(state.userId);
    const voteCount = votersList.length || Number(p.votes) || 0;
    const isMyProject = p.authorId === state.userId || p.author === state.userName;

    return `
      <div class="p-4 bg-void border border-[rgba(226,232,240,0.16)] rounded-2xl space-y-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-mono-num text-[10px] font-bold px-2.5 py-0.5 bg-cyanRadar/15 border border-cyanRadar/40 text-cyanRadar rounded-full">${Validator.sanitizeText(p.category)}</span>
          <div class="flex items-center gap-3">
            <span class="font-mono-num text-[11px] text-slateMuted">Ngày báo cáo: ${Validator.sanitizeText(p.eventDate)}</span>
            ${isMyProject ? `<button type="button" onclick="window.deleteStemProject('${p.id}')" class="text-[11px] text-crimsonSignal font-semibold hover:underline">Xóa (-40 XP, -${FUEL_RULES.STEM_PROJECT_REWARD} L)</button>` : ''}
          </div>
        </div>
        <h4 class="text-sm font-bold text-white">${Validator.sanitizeText(p.title)}</h4>
        <p class="text-xs text-slateMuted leading-relaxed">${Validator.sanitizeText(p.description)}</p>
        <div class="pt-2.5 border-t border-[rgba(226,232,240,0.1)] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-num">
          <div class="flex items-center gap-3 text-slateMuted">
            <span>Nhóm: <strong class="text-white">${p.memberCount} TV</strong></span>
            <span>Kinh phí: <strong class="text-white">${Number(p.budget).toLocaleString('vi-VN')}đ</strong></span>
            <span>Tác giả: <strong class="text-sky-300">${Validator.sanitizeText(p.author)}</strong></span>
          </div>
          <button type="button" onclick="window.toggleVoteStemProject('${p.id}')" class="px-3 py-1.5 border ${votedByMe ? 'border-amberSolar bg-amberSolar/20 text-amberSolar font-bold' : 'border-[rgba(226,232,240,0.25)] text-white'} rounded-xl">
            ⭐ Đề xuất [${voteCount}]
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.toggleVoteStemProject = async function (projectId) {
  const proj = state.stemProjects.find((p) => p.id === projectId);
  if (!proj) return;
  if (!Array.isArray(proj.voters)) proj.voters = [];

  const idx = proj.voters.indexOf(state.userId);
  if (idx >= 0) {
    proj.voters.splice(idx, 1);
  } else {
    proj.voters.push(state.userId);
  }
  proj.votes = proj.voters.length;
  saveToLocalStorage();
  renderStemProjects();

  if (db && currentUser && fbSdk) {
    try {
      await fbSdk.setDoc(fbSdk.doc(db, 'eduniverse_projects', projectId), {
        voters: proj.voters,
        votes: proj.votes
      }, { merge: true });
    } catch (_) {}
  }
};

window.deleteStemProject = async function (projectId) {
  const target = state.stemProjects.find((p) => p.id === projectId);
  if (!target) return;
  state.stemProjects = state.stemProjects.filter((p) => p.id !== projectId);
  // Thu hồi XP và nhiên liệu khi xóa dự án của chính mình để chống spam tạo-xóa
  if (target.authorId === state.userId || target.author === state.userName) {
    awardRewards(-40, -FUEL_RULES.STEM_PROJECT_REWARD);
  }
  saveToLocalStorage();
  renderStemProjects();
  if (db && currentUser && fbSdk) {
    try {
      const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
      await deleteDoc(doc(db, 'eduniverse_projects', projectId));
    } catch (_) {}
  }
  showToast('ĐÃ XÓA DỰ ÁN', 'Đã gỡ dự án và thu hồi phần thưởng đăng bài.', 'info');
};

// =========================================================================
// 11. GIA SƯ AI SOCRATIC & BẢNG XẾP HẠNG NGƯỜI DÙNG THẬT 100%
// =========================================================================
async function callSocraticGemini(userMessage) {
  const apiKey = (cloudCfg.geminiKey || '').trim();
  const weakSummary = state.weakTopics.length > 0
    ? `Học sinh hiện có các chủ đề cần củng cố: ${state.weakTopics.join(', ')}.`
    : 'Học sinh hiện chưa có lỗ hổng kiến thức nào.';

  if (apiKey.length > 10) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: `Bạn là Gia sư STEM trên hệ thống EDUNIVERSE theo phương pháp Socratic. Không bao giờ giải hộ đáp án cuối cùng. Hãy nêu công thức/nguyên lý cốt lõi và đặt 1 câu hỏi gợi mở để học sinh tự suy luận bước tiếp theo. Ngữ cảnh: ${weakSummary}` }],
          },
          contents: [{ parts: [{ text: userMessage }] }],
        }),
      });
      const data = await response.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) return Validator.sanitizeText(reply);
    } catch (err) {}
  }

  const lower = userMessage.toLowerCase();
  if (state.weakTopics.length > 0 && (lower.includes('lỗ hổng') || lower.includes('chẩn đoán'))) {
    const t = state.weakTopics[0];
    return `Hồ sơ ghi nhận bạn từng nhầm ở chủ đề "${t}". ${TOPIC_REPAIR_GUIDES[t] || ''} Dựa trên nguyên tắc này, bạn hãy xác định bước biến đổi đầu tiên cần làm là gì?`;
  }
  if (lower.includes('bậc hai') || lower.includes('cực trị')) {
    return 'Để tìm cực trị của hàm số bậc hai y = ax² + bx + c, trước hết bạn cần xét dấu của hệ số a để biết bề lõm parabol hướng lên hay xuống. Với a và b đã cho, công thức tính hoành độ đỉnh x = -b/(2a) cho ra giá trị bao nhiêu?';
  }
  if (lower.includes('cơ năng')) {
    return 'Theo định luật bảo toàn cơ năng khi bỏ qua sức cản: ½mv₁² + mgh₁ = ½mv₂² + mgh₂. Tại vị trí vật đạt độ cao cực đại, vận tốc tức thời của vật bằng bao nhiêu?';
  }
  return 'Gợi ý Socratic: Hãy tách bài toán này thành 2 bước: (1) Liệt kê các đại lượng đề bài đã cho và đổi về đơn vị chuẩn SI; (2) Xác định công thức liên hệ trực tiếp với đại lượng cần tìm. Bạn đang phân vân ở bước 1 hay bước 2?';
}

function renderChatStream() {
  const stream = document.getElementById('ai-chat-stream');
  stream.innerHTML = state.chatHistory.map((msg) => {
    const isAi = msg.role === 'ai';
    return `<div class="p-3.5 rounded-2xl border ${isAi ? 'bg-void border-cyanRadar/30 text-white' : 'bg-surfaceAlt border-[rgba(226,232,240,0.2)] text-white ml-6'}"><div class="font-mono-num text-[10px] font-bold mb-1 ${isAi ? 'text-cyanRadar' : 'text-amberSolar'}">${isAi ? 'GIA SƯ AI SOCRATIC' : state.userName.toUpperCase()}</div><div class="text-xs leading-relaxed whitespace-pre-line">${Validator.sanitizeText(msg.text)}</div></div>`;
  }).join('');
  stream.scrollTop = stream.scrollHeight;
}

function initAiAdvisor() {
  renderChatStream();
  const form = document.getElementById('ai-chat-form');
  const input = document.getElementById('ai-chat-input');
  const sendBtn = document.getElementById('ai-send-btn');

  const sendPrompt = async (rawText) => {
    const cleaned = Validator.sanitizeText(rawText);
    if (!cleaned) return;
    state.chatHistory.push({ role: 'user', text: cleaned });
    input.value = ''; sendBtn.disabled = true; sendBtn.textContent = 'Đang suy nghĩ...';
    renderChatStream();
    const aiReply = await callSocraticGemini(cleaned);
    state.chatHistory.push({ role: 'ai', text: aiReply });
    sendBtn.disabled = false; sendBtn.textContent = 'Gửi câu hỏi';
    renderChatStream();
  };

  form.addEventListener('submit', (e) => { e.preventDefault(); sendPrompt(input.value); });
  document.querySelectorAll('.ai-chip').forEach((chip) => chip.addEventListener('click', () => sendPrompt(chip.dataset.aiPrompt)));
}

function renderDiagnosticsAndLeaderboard() {
  document.getElementById('mastery-bars-container').innerHTML = PLANETS_DATA.map((p) => {
    const done = Math.max(0, (state.planetProgress[p.id] || 1) - 1);
    const pct = Math.round((done / 3) * 100);
    return `<div class="space-y-1.5"><div class="flex justify-between text-xs"><span class="text-white font-semibold">${p.name} <span class="text-slateMuted">(${p.subject})</span></span><span class="font-mono-num text-[11px] font-bold" style="color:${p.color}">${done}/3 (${pct}%)</span></div><div class="w-full h-2 bg-void border border-[rgba(226,232,240,0.12)] overflow-hidden rounded-full"><div class="h-full transition-all duration-300" style="width:${pct}%; background-color:${p.color}"></div></div></div>`;
  }).join('');

  document.getElementById('weak-topics-count').textContent = `${state.weakTopics.length} mục`;
  document.getElementById('weak-topics-list').innerHTML = state.weakTopics.length === 0
    ? `<span class="text-xs text-slateMuted">Chưa ghi nhận lỗ hổng kiến thức.</span>`
    : state.weakTopics.map((t) => `<span class="text-[11px] px-2.5 py-1 bg-crimsonSignal/15 border border-crimsonSignal/40 text-crimsonSignal rounded-full font-semibold">${Validator.sanitizeText(t)}</span>`).join('');

  document.getElementById('badges-grid').innerHTML = BADGES_DEF.map((b) => {
    const unlocked = state.badges.includes(b.id);
    return `<div title="${b.desc}" class="p-2.5 border ${unlocked ? 'border-emeraldLock/50 bg-emeraldLock/15' : 'border-[rgba(226,232,240,0.1)] bg-void/50 opacity-50'} rounded-2xl"><div class="font-mono-num text-[10px] font-bold ${unlocked ? 'text-emeraldLock' : 'text-slateMuted'}">${b.code}</div><div class="text-[11px] font-bold text-white mt-0.5 leading-tight">${b.title}</div></div>`;
  }).join('');

  const totalRings = Object.values(state.planetProgress).reduce((acc, v) => acc + Math.max(0, v - 1), 0);
  const mapById = new Map();

  state.leaderboardUsers.forEach((u) => {
    mapById.set(u.id, { ...u, isMe: u.id === state.userId || u.name.toLowerCase() === state.userName.toLowerCase() });
  });

  mapById.set(state.userId, {
    id: state.userId,
    name: state.userName,
    xp: state.xp,
    fuel: state.fuel,
    rings: totalRings,
    isMe: true
  });

  const sortedRealUsers = Array.from(mapById.values()).sort((a, b) => (b.xp - a.xp) || (b.rings - a.rings) || (b.fuel - a.fuel));

  document.getElementById('leaderboard-list').innerHTML = sortedRealUsers.map((row, idx) => `
    <div class="px-4 py-2.5 border ${row.isMe ? 'border-cyanRadar bg-cyanRadar/15 shadow-md' : 'border-[rgba(226,232,240,0.12)] bg-void'} rounded-2xl flex items-center justify-between text-xs">
      <div class="flex items-center gap-3 min-w-0">
        <span class="font-mono-num font-extrabold w-6 ${idx === 0 ? 'text-amberSolar' : 'text-slateMuted'}">#${idx + 1}</span>
        <div class="truncate">
          <div class="font-bold text-white truncate">${Validator.sanitizeText(row.name)} ${row.isMe ? '<span class="text-cyanRadar">(Bạn)</span>' : ''}</div>
          <div class="text-[11px] text-slateMuted">${getAstronautRank(row.xp)} • ${row.rings}/15 vòng • ${row.fuel ?? 0} L</div>
        </div>
      </div>
      <span class="font-mono-num font-extrabold text-amberSolar shrink-0 ml-2">${row.xp} XP</span>
    </div>
  `).join('');
}

// =========================================================================
// 12. CỬA SỔ CẤU HÌNH HỒ SƠ, ĐỔI TÀI KHOẢN & KHỞI TẠO
// =========================================================================
function initCloudSettingsModal() {
  const modal = document.getElementById('cloud-modal');
  const openModal = () => {
    document.getElementById('cfg-name').value = state.userName;
    document.getElementById('cfg-gemini').value = cloudCfg.geminiKey || '';
    document.getElementById('cfg-firebase').value = cloudCfg.firebaseJson || '';
    modal.classList.remove('hidden');
  };
  document.getElementById('btn-open-cloud')?.addEventListener('click', openModal);
  document.getElementById('btn-open-cloud-mobile')?.addEventListener('click', openModal);
  document.getElementById('close-cloud-modal').addEventListener('click', () => modal.classList.add('hidden'));

  document.getElementById('btn-save-cloud').addEventListener('click', async () => {
    const newName = Validator.sanitizeText(document.getElementById('cfg-name').value);
    cloudCfg.geminiKey = document.getElementById('cfg-gemini').value.trim();
    cloudCfg.firebaseJson = document.getElementById('cfg-firebase').value.trim();

    if (cloudCfg.firebaseJson && !Validator.parseFirebaseConfig(cloudCfg.firebaseJson)) {
      showToast('FIREBASE CONFIG CHƯA ĐÚNG', 'Vui lòng dán đúng đoạn mã firebaseConfig có chứa apiKey và projectId.', 'error');
      return;
    }

    localStorage.setItem(LOCAL_CFG_KEY, JSON.stringify(cloudCfg));
    if (newName.length >= 2) {
      switchOrCreateLocalAccount(newName, false);
    } else {
      saveToLocalStorage();
    }

    modal.classList.add('hidden');
    await initFirebaseConnection();
    await persistUserProfile();
    refreshAllUI();
    showToast('ĐÃ CẬP NHẬT HỆ THỐNG', `Hồ sơ "${state.userName}" (${state.xp} XP | ${state.fuel} L).`, 'success');
  });

  document.getElementById('btn-google-login').addEventListener('click', async () => {
    const rawFb = document.getElementById('cfg-firebase').value.trim();
    if (rawFb) {
      cloudCfg.firebaseJson = rawFb;
      localStorage.setItem(LOCAL_CFG_KEY, JSON.stringify(cloudCfg));
      await initFirebaseConnection();
    }
    if (!auth || !fbSdk) {
      showToast('CHƯA CÓ FIREBASE CONFIG', 'Vui lòng dán Firebase Config vào ô bên trên trước khi đăng nhập Google.', 'error');
      return;
    }
    try {
      const provider = new fbSdk.GoogleAuthProvider();
      const result = await fbSdk.signInWithPopup(auth, provider);
      if (result.user?.displayName) {
        state.userName = result.user.displayName;
        localStorage.setItem(LOCAL_ACTIVE_USER_KEY, state.userName);
      }
      await persistUserProfile();
      refreshAllUI();
      modal.classList.add('hidden');
      showToast('ĐĂNG NHẬP GOOGLE THÀNH CÔNG', `Xin chào ${state.userName}!`, 'success');
    } catch (err) {
      showToast('LỖI ĐĂNG NHẬP GOOGLE', 'Hãy chắc chắn bạn đã bật Google Sign-In và thêm tên miền GitHub vào Authorized Domains trên Firebase.', 'error');
    }
  });

  document.getElementById('btn-reset-data').addEventListener('click', () => {
    localStorage.removeItem(LOCAL_ACCOUNTS_KEY);
    localStorage.removeItem(LOCAL_ACTIVE_USER_KEY);
    localStorage.removeItem(LOCAL_SHARED_PROJECTS_KEY);
    localStorage.removeItem(LOCAL_SHARED_DOCS_KEY);
    location.reload();
  });
}

function refreshAllUI() {
  evaluateBadges();
  updateTopTelemetry();
  updatePlanetPositions();
  renderPlanetQuickCards();
  renderPlanetInspector();
  renderMysteryBox();
  renderDailyChallenge();
  renderArenaHome();
  renderStemProjects();
  renderDiagnosticsAndLeaderboard();
}

window.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  document.querySelectorAll('.nav-tab').forEach((btn) => btn.addEventListener('click', () => window.switchModule(btn.dataset.tab)));
  document.querySelectorAll('.inspector-subtab').forEach((btn) => {
    btn.addEventListener('click', () => { state.inspectorSubtab = btn.dataset.subtab; renderPlanetInspector(); });
  });
  document.getElementById('close-quiz-modal').addEventListener('click', () => {
    document.getElementById('quiz-modal').classList.add('hidden');
    activeTierQuiz = null;
  });

  initSolarMap();
  initPhysicsLab();
  initStemBoard();
  initAiAdvisor();
  initCloudSettingsModal();
  refreshAllUI();
  initFirebaseConnection();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('quiz-modal').classList.add('hidden');
    document.getElementById('cloud-modal').classList.add('hidden');
    activeTierQuiz = null;
  }
});
