// ──────────────────────────────────────────────────────────────
// Addendum Multi-Language Translations
//
// Per California CARS Act (SB 766), if the negotiation is
// conducted primarily in Spanish, Chinese, Tagalog, Vietnamese,
// or Korean, the disclosure must also be provided in that language.
//
// This file provides UI labels + disclosure translations for
// the full addendum — not just the Buyers Guide.
// ──────────────────────────────────────────────────────────────

export type AddendumLanguage = "en" | "es" | "zh" | "tl" | "vi" | "ko";

export interface AddendumLabels {
  // Page
  dealerAddendum: string;
  supplementalLabel: string;
  // Vehicle strip
  yearMakeModel: string;
  stockNumber: string;
  vinNumber: string;
  date: string;
  // Products
  productsHeading: string;
  preInstalled: string;
  optional: string;
  preInstalledBadge: string;
  optionalBadge: string;
  dealerRetailPrice: string;
  // Totals
  installedTotal: string;
  optionalTotal: string;
  totalPrice: string;
  msrp: string;
  marketValue: string;
  totalSuggestedRetail: string;
  // Customer
  buyerInfo: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  coBuyer: string;
  // Selection
  consumerAck: string;
  initials: string;
  fillAll: string;
  accept: string;
  decline: string;
  optionalNotice: string;
  // Signatures
  customerSignature: string;
  coBuyerSignature: string;
  dealerRepSignature: string;
  signHere: string;
  draw: string;
  type: string;
  clear: string;
  // Disclosures
  disclosuresHeading: string;
  stickerAckHeading: string;
  // Actions
  save: string;
  print: string;
  downloadPdf: string;
  sendToCustomer: string;
}

export const TRANSLATIONS: Record<AddendumLanguage, AddendumLabels> = {
  en: {
    dealerAddendum: "Dealer Addendum",
    supplementalLabel: "Supplemental Window Label · Dealer-Installed Products & Accessories",
    yearMakeModel: "Year / Make / Model",
    stockNumber: "Stock #",
    vinNumber: "VIN",
    date: "Date",
    productsHeading: "Dealer-Installed Products & Pricing",
    preInstalled: "Pre-Installed · Non-Removable",
    optional: "Optional",
    preInstalledBadge: "Pre-Installed · Non-Removable",
    optionalBadge: "Optional — Consumer May Accept or Decline",
    dealerRetailPrice: "Dealer Retail Price",
    installedTotal: "Installed Total",
    optionalTotal: "Optional Total",
    totalPrice: "Total Price",
    msrp: "Manufacturer's Suggested Retail Price (MSRP)",
    marketValue: "Market Value",
    totalSuggestedRetail: "Total Suggested Retail Price",
    buyerInfo: "Buyer Information",
    firstName: "First Name",
    lastName: "Last Name",
    phone: "Phone",
    email: "Email",
    coBuyer: "Co-Buyer Information",
    consumerAck: "Consumer Acknowledgment & Selection Record",
    initials: "Initials",
    fillAll: "Fill All",
    accept: "Accept",
    decline: "Decline",
    optionalNotice: "You are not required to purchase this product. Declining will not affect your purchase, financing, or delivery.",
    customerSignature: "Customer Signature",
    coBuyerSignature: "Co-Buyer Signature (if applicable)",
    dealerRepSignature: "Dealer Representative",
    signHere: "Sign here",
    draw: "Draw",
    type: "Type",
    clear: "Clear",
    disclosuresHeading: "Required Disclosures & Consumer Rights",
    stickerAckHeading: "Addendum & Window Sticker Acknowledgment",
    save: "Save Addendum",
    print: "Print",
    downloadPdf: "Download PDF",
    sendToCustomer: "Send to Customer",
  },
  es: {
    dealerAddendum: "Adenda del Concesionario",
    supplementalLabel: "Etiqueta Suplementaria · Productos y Accesorios Instalados por el Concesionario",
    yearMakeModel: "Año / Marca / Modelo",
    stockNumber: "No. de Stock",
    vinNumber: "VIN",
    date: "Fecha",
    productsHeading: "Productos y Precios Instalados por el Concesionario",
    preInstalled: "Pre-Instalado · No Removible",
    optional: "Opcional",
    preInstalledBadge: "Pre-Instalado · No Removible",
    optionalBadge: "Opcional — El Consumidor Puede Aceptar o Rechazar",
    dealerRetailPrice: "Precio de Venta del Concesionario",
    installedTotal: "Total Instalado",
    optionalTotal: "Total Opcional",
    totalPrice: "Precio Total",
    msrp: "Precio de Venta Sugerido por el Fabricante (MSRP)",
    marketValue: "Valor de Mercado",
    totalSuggestedRetail: "Precio Total Sugerido de Venta",
    buyerInfo: "Información del Comprador",
    firstName: "Nombre",
    lastName: "Apellido",
    phone: "Teléfono",
    email: "Correo Electrónico",
    coBuyer: "Información del Co-Comprador",
    consumerAck: "Registro de Reconocimiento y Selección del Consumidor",
    initials: "Iniciales",
    fillAll: "Llenar Todos",
    accept: "Aceptar",
    decline: "Rechazar",
    optionalNotice: "No está obligado a comprar este producto. Rechazarlo no afectará su compra, financiamiento o entrega.",
    customerSignature: "Firma del Cliente",
    coBuyerSignature: "Firma del Co-Comprador (si aplica)",
    dealerRepSignature: "Representante del Concesionario",
    signHere: "Firme aquí",
    draw: "Dibujar",
    type: "Escribir",
    clear: "Borrar",
    disclosuresHeading: "Divulgaciones Requeridas y Derechos del Consumidor",
    stickerAckHeading: "Reconocimiento de la Adenda y la Etiqueta de Ventana",
    save: "Guardar Adenda",
    print: "Imprimir",
    downloadPdf: "Descargar PDF",
    sendToCustomer: "Enviar al Cliente",
  },
  zh: {
    dealerAddendum: "经销商附录",
    supplementalLabel: "补充窗口标签 · 经销商安装的产品和配件",
    yearMakeModel: "年份 / 品牌 / 型号",
    stockNumber: "库存编号",
    vinNumber: "车辆识别号",
    date: "日期",
    productsHeading: "经销商安装的产品和定价",
    preInstalled: "预装 · 不可拆卸",
    optional: "可选",
    preInstalledBadge: "预装 · 不可拆卸",
    optionalBadge: "可选 — 消费者可以接受或拒绝",
    dealerRetailPrice: "经销商零售价",
    installedTotal: "已安装总计",
    optionalTotal: "可选总计",
    totalPrice: "总价",
    msrp: "制造商建议零售价 (MSRP)",
    marketValue: "市场价值",
    totalSuggestedRetail: "建议零售总价",
    buyerInfo: "买方信息",
    firstName: "名",
    lastName: "姓",
    phone: "电话",
    email: "电子邮件",
    coBuyer: "共同买方信息",
    consumerAck: "消费者确认和选择记录",
    initials: "首字母",
    fillAll: "全部填写",
    accept: "接受",
    decline: "拒绝",
    optionalNotice: "您不需要购买此产品。拒绝不会影响您的购买、融资或交付。",
    customerSignature: "客户签名",
    coBuyerSignature: "共同买方签名（如适用）",
    dealerRepSignature: "经销商代表",
    signHere: "在此签名",
    draw: "手写",
    type: "输入",
    clear: "清除",
    disclosuresHeading: "必要披露和消费者权利",
    stickerAckHeading: "附录和窗口贴纸确认",
    save: "保存附录",
    print: "打印",
    downloadPdf: "下载PDF",
    sendToCustomer: "发送给客户",
  },
  tl: {
    dealerAddendum: "Addendum ng Dealer",
    supplementalLabel: "Karagdagang Label sa Bintana · Mga Produkto at Accessories na Ini-install ng Dealer",
    yearMakeModel: "Taon / Gawa / Modelo",
    stockNumber: "Stock #",
    vinNumber: "VIN",
    date: "Petsa",
    productsHeading: "Mga Produkto at Presyo na Ini-install ng Dealer",
    preInstalled: "Pre-Installed · Hindi Maaaring Tanggalin",
    optional: "Opsyonal",
    preInstalledBadge: "Pre-Installed · Hindi Maaaring Tanggalin",
    optionalBadge: "Opsyonal — Maaaring Tanggapin o Tanggihan ng Mamimili",
    dealerRetailPrice: "Presyo ng Dealer",
    installedTotal: "Kabuuang Na-install",
    optionalTotal: "Kabuuang Opsyonal",
    totalPrice: "Kabuuang Presyo",
    msrp: "Iminungkahing Presyo ng Tagagawa (MSRP)",
    marketValue: "Halaga sa Merkado",
    totalSuggestedRetail: "Kabuuang Iminungkahing Presyo",
    buyerInfo: "Impormasyon ng Mamimili",
    firstName: "Pangalan",
    lastName: "Apelyido",
    phone: "Telepono",
    email: "Email",
    coBuyer: "Impormasyon ng Kasama sa Pagbili",
    consumerAck: "Pagkilala at Talaan ng Pagpili ng Mamimili",
    initials: "Mga Inisyal",
    fillAll: "Punan Lahat",
    accept: "Tanggapin",
    decline: "Tanggihan",
    optionalNotice: "Hindi mo kailangang bilhin ang produktong ito. Ang pagtanggi ay hindi makakaapekto sa iyong pagbili, financing, o delivery.",
    customerSignature: "Lagda ng Customer",
    coBuyerSignature: "Lagda ng Co-Buyer (kung naaangkop)",
    dealerRepSignature: "Kinatawan ng Dealer",
    signHere: "Lagdaan dito",
    draw: "Guhit",
    type: "I-type",
    clear: "Burahin",
    disclosuresHeading: "Mga Kinakailangang Pagsisiwalat at Karapatan ng Mamimili",
    stickerAckHeading: "Pagkilala sa Addendum at Window Sticker",
    save: "I-save ang Addendum",
    print: "I-print",
    downloadPdf: "I-download ang PDF",
    sendToCustomer: "Ipadala sa Customer",
  },
  vi: {
    dealerAddendum: "Phụ Lục Đại Lý",
    supplementalLabel: "Nhãn Cửa Sổ Bổ Sung · Sản Phẩm và Phụ Kiện Do Đại Lý Lắp Đặt",
    yearMakeModel: "Năm / Hãng / Mẫu",
    stockNumber: "Số Kho",
    vinNumber: "VIN",
    date: "Ngày",
    productsHeading: "Sản Phẩm và Giá Cả Do Đại Lý Lắp Đặt",
    preInstalled: "Đã Lắp Sẵn · Không Thể Tháo",
    optional: "Tùy Chọn",
    preInstalledBadge: "Đã Lắp Sẵn · Không Thể Tháo",
    optionalBadge: "Tùy Chọn — Người Tiêu Dùng Có Thể Chấp Nhận hoặc Từ Chối",
    dealerRetailPrice: "Giá Bán Lẻ Đại Lý",
    installedTotal: "Tổng Đã Lắp",
    optionalTotal: "Tổng Tùy Chọn",
    totalPrice: "Tổng Giá",
    msrp: "Giá Bán Lẻ Đề Nghị Của Nhà Sản Xuất (MSRP)",
    marketValue: "Giá Trị Thị Trường",
    totalSuggestedRetail: "Tổng Giá Bán Lẻ Đề Nghị",
    buyerInfo: "Thông Tin Người Mua",
    firstName: "Tên",
    lastName: "Họ",
    phone: "Điện Thoại",
    email: "Email",
    coBuyer: "Thông Tin Người Đồng Mua",
    consumerAck: "Xác Nhận và Hồ Sơ Lựa Chọn Của Người Tiêu Dùng",
    initials: "Chữ Viết Tắt",
    fillAll: "Điền Tất Cả",
    accept: "Chấp Nhận",
    decline: "Từ Chối",
    optionalNotice: "Bạn không bắt buộc phải mua sản phẩm này. Từ chối sẽ không ảnh hưởng đến việc mua, tài chính hoặc giao hàng của bạn.",
    customerSignature: "Chữ Ký Khách Hàng",
    coBuyerSignature: "Chữ Ký Người Đồng Mua (nếu có)",
    dealerRepSignature: "Đại Diện Đại Lý",
    signHere: "Ký tại đây",
    draw: "Vẽ",
    type: "Gõ",
    clear: "Xóa",
    disclosuresHeading: "Tiết Lộ Bắt Buộc và Quyền Người Tiêu Dùng",
    stickerAckHeading: "Xác Nhận Phụ Lục và Nhãn Cửa Sổ",
    save: "Lưu Phụ Lục",
    print: "In",
    downloadPdf: "Tải PDF",
    sendToCustomer: "Gửi Cho Khách",
  },
  ko: {
    dealerAddendum: "딜러 부록",
    supplementalLabel: "보충 윈도우 라벨 · 딜러 설치 제품 및 액세서리",
    yearMakeModel: "연식 / 제조사 / 모델",
    stockNumber: "재고 번호",
    vinNumber: "차대번호",
    date: "날짜",
    productsHeading: "딜러 설치 제품 및 가격",
    preInstalled: "사전 설치 · 제거 불가",
    optional: "선택 사항",
    preInstalledBadge: "사전 설치 · 제거 불가",
    optionalBadge: "선택 사항 — 소비자가 수락 또는 거부 가능",
    dealerRetailPrice: "딜러 소매가",
    installedTotal: "설치 합계",
    optionalTotal: "선택 합계",
    totalPrice: "총 가격",
    msrp: "제조업체 권장 소매가 (MSRP)",
    marketValue: "시장 가치",
    totalSuggestedRetail: "총 권장 소매가",
    buyerInfo: "구매자 정보",
    firstName: "이름",
    lastName: "성",
    phone: "전화",
    email: "이메일",
    coBuyer: "공동 구매자 정보",
    consumerAck: "소비자 확인 및 선택 기록",
    initials: "이니셜",
    fillAll: "모두 채우기",
    accept: "수락",
    decline: "거부",
    optionalNotice: "이 제품을 구매할 필요가 없습니다. 거부해도 구매, 금융 또는 배송에 영향을 미치지 않습니다.",
    customerSignature: "고객 서명",
    coBuyerSignature: "공동 구매자 서명 (해당 시)",
    dealerRepSignature: "딜러 대리인",
    signHere: "여기에 서명",
    draw: "그리기",
    type: "입력",
    clear: "지우기",
    disclosuresHeading: "필수 공개 및 소비자 권리",
    stickerAckHeading: "부록 및 윈도우 스티커 확인",
    save: "부록 저장",
    print: "인쇄",
    downloadPdf: "PDF 다운로드",
    sendToCustomer: "고객에게 전송",
  },
};

export const LANGUAGE_NAMES: Record<AddendumLanguage, string> = {
  en: "English",
  es: "Español",
  zh: "中文",
  tl: "Tagalog",
  vi: "Tiếng Việt",
  ko: "한국어",
};

export const getLabels = (lang: AddendumLanguage): AddendumLabels => TRANSLATIONS[lang] || TRANSLATIONS.en;
