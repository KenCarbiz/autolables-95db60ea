// ──────────────────────────────────────────────────────────────
// Vehicle File — The Compliance Record Per VIN
//
// Every vehicle that gets a sticker gets a permanent file.
// The file tracks:
// - Every sticker printed (with type, timestamp, content hash)
// - The signing link for the legal addendum
// - Customer signatures, initials, timestamps
// - Deal status
//
// Each sticker has a unique UPC/tracking code that links back
// to this vehicle file and its legal addendum.
// ──────────────────────────────────────────────────────────────

export type StickerType =
  | "new_car_addendum"     // MSRP + accessories + updated retail
  | "used_car_sticker"     // Full equipment showcase (informational)
  | "used_car_addendum"    // Market value + accessories + final price
  | "buyers_guide"         // FTC mandated As-Is / Implied / Warranty
  | "trade_up"             // Promotional "What's My Car Worth" sticker
  | "stock_label";         // Zebra barcode stock # windshield label

export type DealStatus =
  | "stickered"      // Stickers printed, on the lot
  | "presented"      // Customer has been shown the addendum
  | "pending_sign"   // Sent for signing, awaiting customer
  | "signed"         // Customer signed the legal addendum
  | "delivered"      // Vehicle delivered to customer
  | "unwound";       // Deal unwound / cancelled

export interface StickerRecord {
  id: string;
  type: StickerType;
  tracking_code: string;      // UPC — unique per sticker, links to this file
  signing_url: string;        // URL to the legal addendum signing page
  signing_token: string;      // Token for the signing page
  printed_at: string;
  printed_by: string;         // user ID
  paper_size: string;
  content_hash: string;       // SHA-256 of the sticker content at print time
  products_snapshot: any[];   // What products were on this sticker
  totals: {
    base_price: number;       // MSRP or Market Value
    accessories_total: number;
    doc_fee: number;
    final_price: number;      // base + accessories + doc fee
  };
  status: "printed" | "signed" | "voided";
  voided_at?: string;
  voided_reason?: string;
}

export interface SigningRecord {
  id: string;
  sticker_id: string;         // Links to the StickerRecord
  customer_name: string;
  customer_initials: Record<string, string>;  // product_id -> initials
  customer_selections: Record<string, "accept" | "decline">;
  customer_signature_data: string;
  customer_signature_type: "draw" | "type";
  cobuyer_name?: string;
  cobuyer_signature_data?: string;
  employee_name: string;
  employee_signature_data: string;
  signed_at: string;
  customer_ip: string;
  device_info: string;
}

export interface AftermarketInstall {
  id: string;
  product_id: string;
  product_name: string;
  installed_date: string;       // Date the product was physically installed
  installed_by: string;         // Technician name
  ro_number: string;            // Repair order number
  po_number?: string;           // Purchase order number
  vendor: string;               // Vendor/supplier name
  cost: number;                 // Dealer cost (internal)
  retail_price: number;         // Customer-facing price
  warranty_registration?: string; // Warranty registration number
  notes: string;
  photos?: string[];            // Before/after install photos
  created_at: string;
}

export type AttachedDocType =
  | "k208"              // CT K-208 used car inspection form
  | "ftc_buyers_guide"  // FTC Used Car Buyers Guide
  | "window_sticker"    // Window sticker snapshot
  | "carfax"
  | "cpo_checklist"
  | "financing"
  | "contract"
  | "other";

export interface AttachedDocument {
  id: string;
  type: AttachedDocType;
  label: string;
  data: any;              // Form data (K208FormData, BuyersGuide config, etc.)
  created_at: string;
  created_by: string;
}

export interface VehicleFile {
  id: string;
  store_id: string;
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  stock_number: string;
  condition: "new" | "used" | "cpo";
  mileage: number;

  // Pricing
  msrp: number;              // Factory MSRP (new) or 0
  market_value: number;      // Market value (used) or 0

  // Equipment pulled from NHTSA
  factory_equipment: string[];

  // Aftermarket install log — dealer can attach detailed install records
  aftermarket_installs: AftermarketInstall[];

  // All stickers ever printed for this vehicle
  stickers: StickerRecord[];

  // All signing events
  signings: SigningRecord[];

  // Attached compliance documents (K-208, FTC Buyers Guide, etc.)
  attached_documents: AttachedDocument[];

  // QR code token — scanning this opens the deal signing page
  deal_qr_token: string;

  // Deal tracking
  deal_status: DealStatus;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  cobuyer_name: string;
  cobuyer_phone: string;
  cobuyer_email: string;

  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
}
