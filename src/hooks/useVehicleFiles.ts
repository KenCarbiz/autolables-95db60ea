import { useState, useEffect, useCallback } from "react";
import type {
  VehicleFile,
  StickerRecord,
  SigningRecord,
  AftermarketInstall,
  StickerType,
  DealStatus,
} from "@/types/vehicleFile";

const STORAGE_KEY = "vehicle_files";

/**
 * Generate a unique tracking code (UPC) for each sticker.
 * Format: AC-{STORE_PREFIX}-{VIN_LAST6}-{TYPE_CODE}-{TIMESTAMP_HEX}
 *
 * This code is printed on the sticker and can be scanned or typed
 * to retrieve the full vehicle file and its legal addendum.
 */
function generateTrackingCode(vin: string, type: StickerType, storeId: string): string {
  const storePrefix = storeId.slice(0, 4).toUpperCase();
  const vinSuffix = vin.slice(-6).toUpperCase();
  const typeCode: Record<StickerType, string> = {
    new_car_addendum: "NA",
    used_car_sticker: "US",
    used_car_addendum: "UA",
    buyers_guide: "BG",
    trade_up: "TU",
    stock_label: "SL",
  };
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  return `AC-${storePrefix}-${vinSuffix}-${typeCode[type]}-${ts}`;
}

/**
 * Generate a simple content hash for immutability verification.
 * In production, use SubtleCrypto.digest("SHA-256", ...) for a real hash.
 */
function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export const useVehicleFiles = (storeId: string) => {
  const [files, setFiles] = useState<VehicleFile[]>([]);

  useEffect(() => {
    load();
  }, [storeId]);

  const load = () => {
    try {
      const all: VehicleFile[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      setFiles(all.filter(f => f.store_id === storeId));
    } catch { /* ignore */ }
  };

  const getAll = (): VehicleFile[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  };

  const persist = (all: VehicleFile[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    setFiles(all.filter(f => f.store_id === storeId));
  };

  // Get or create a vehicle file by VIN
  const getOrCreateFile = useCallback((data: {
    vin: string;
    year: string;
    make: string;
    model: string;
    trim: string;
    stock_number: string;
    condition: "new" | "used" | "cpo";
    mileage: number;
    msrp?: number;
    market_value?: number;
    factory_equipment?: string[];
    created_by: string;
  }): VehicleFile => {
    const all = getAll();
    const existing = all.find(f => f.vin === data.vin && f.store_id === storeId);
    if (existing) {
      // Update mutable fields
      const updated = {
        ...existing,
        stock_number: data.stock_number || existing.stock_number,
        mileage: data.mileage || existing.mileage,
        msrp: data.msrp || existing.msrp,
        market_value: data.market_value || existing.market_value,
        factory_equipment: data.factory_equipment?.length
          ? data.factory_equipment
          : existing.factory_equipment,
        updated_at: new Date().toISOString(),
      };
      persist(all.map(f => f.id === existing.id ? updated : f));
      return updated;
    }

    const file: VehicleFile = {
      id: crypto.randomUUID(),
      store_id: storeId,
      vin: data.vin,
      year: data.year,
      make: data.make,
      model: data.model,
      trim: data.trim,
      stock_number: data.stock_number,
      condition: data.condition,
      mileage: data.mileage,
      msrp: data.msrp || 0,
      market_value: data.market_value || 0,
      factory_equipment: data.factory_equipment || [],
      aftermarket_installs: [],
      stickers: [],
      signings: [],
      deal_status: "stickered",
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: data.created_by,
    };

    persist([...all, file]);
    return file;
  }, [storeId]);

  // Register a printed sticker against a vehicle file
  const registerSticker = useCallback((
    fileId: string,
    type: StickerType,
    data: {
      paper_size: string;
      products_snapshot: any[];
      base_price: number;
      accessories_total: number;
      doc_fee: number;
      printed_by: string;
    }
  ): StickerRecord => {
    const all = getAll();
    const file = all.find(f => f.id === fileId);
    if (!file) throw new Error("Vehicle file not found");

    const token = crypto.randomUUID();
    const signingUrl = `${window.location.origin}/sign/${token}`;

    const sticker: StickerRecord = {
      id: crypto.randomUUID(),
      type,
      tracking_code: generateTrackingCode(file.vin, type, storeId),
      signing_url: signingUrl,
      signing_token: token,
      printed_at: new Date().toISOString(),
      printed_by: data.printed_by,
      paper_size: data.paper_size,
      content_hash: simpleHash(JSON.stringify({
        vin: file.vin,
        type,
        products: data.products_snapshot,
        prices: { base: data.base_price, acc: data.accessories_total, doc: data.doc_fee },
        ts: new Date().toISOString(),
      })),
      products_snapshot: data.products_snapshot,
      totals: {
        base_price: data.base_price,
        accessories_total: data.accessories_total,
        doc_fee: data.doc_fee,
        final_price: data.base_price + data.accessories_total + data.doc_fee,
      },
      status: "printed",
    };

    file.stickers.push(sticker);
    file.updated_at = new Date().toISOString();
    persist(all);
    return sticker;
  }, [storeId]);

  // Record a signing event
  const recordSigning = useCallback((
    fileId: string,
    stickerId: string,
    data: Omit<SigningRecord, "id" | "sticker_id" | "signed_at">
  ): SigningRecord => {
    const all = getAll();
    const file = all.find(f => f.id === fileId);
    if (!file) throw new Error("Vehicle file not found");

    const signing: SigningRecord = {
      ...data,
      id: crypto.randomUUID(),
      sticker_id: stickerId,
      signed_at: new Date().toISOString(),
    };

    file.signings.push(signing);
    file.deal_status = "signed";
    file.customer_name = data.customer_name;

    // Mark the sticker as signed
    const sticker = file.stickers.find(s => s.id === stickerId);
    if (sticker) sticker.status = "signed";

    file.updated_at = new Date().toISOString();
    persist(all);
    return signing;
  }, [storeId]);

  // Update deal status
  const updateDealStatus = useCallback((fileId: string, status: DealStatus) => {
    const all = getAll();
    const file = all.find(f => f.id === fileId);
    if (!file) return;
    file.deal_status = status;
    file.updated_at = new Date().toISOString();
    persist(all);
  }, [storeId]);

  // Update customer info
  const updateCustomer = useCallback((fileId: string, data: {
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
  }) => {
    const all = getAll();
    const file = all.find(f => f.id === fileId);
    if (!file) return;
    if (data.customer_name !== undefined) file.customer_name = data.customer_name;
    if (data.customer_phone !== undefined) file.customer_phone = data.customer_phone;
    if (data.customer_email !== undefined) file.customer_email = data.customer_email;
    file.updated_at = new Date().toISOString();
    persist(all);
  }, [storeId]);

  // Void a sticker
  const voidSticker = useCallback((fileId: string, stickerId: string, reason: string) => {
    const all = getAll();
    const file = all.find(f => f.id === fileId);
    if (!file) return;
    const sticker = file.stickers.find(s => s.id === stickerId);
    if (!sticker) return;
    sticker.status = "voided";
    sticker.voided_at = new Date().toISOString();
    sticker.voided_reason = reason;
    file.updated_at = new Date().toISOString();
    persist(all);
  }, [storeId]);

  // Record an aftermarket install on a vehicle
  const addAftermarketInstall = useCallback((fileId: string, data: Omit<AftermarketInstall, "id" | "created_at">): AftermarketInstall | null => {
    const all = getAll();
    const file = all.find(f => f.id === fileId);
    if (!file) return null;

    const install: AftermarketInstall = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    if (!file.aftermarket_installs) file.aftermarket_installs = [];
    file.aftermarket_installs.push(install);
    file.updated_at = new Date().toISOString();
    persist(all);
    return install;
  }, [storeId]);

  // Look up a vehicle file by tracking code
  const findByTrackingCode = useCallback((code: string): {
    file: VehicleFile;
    sticker: StickerRecord;
  } | null => {
    const all = getAll();
    for (const file of all) {
      for (const sticker of file.stickers) {
        if (sticker.tracking_code === code) {
          return { file, sticker };
        }
      }
    }
    return null;
  }, []);

  // Look up by VIN
  const findByVin = useCallback((vin: string): VehicleFile | null => {
    return files.find(f => f.vin === vin) || null;
  }, [files]);

  // Look up by signing token
  const findBySigningToken = useCallback((token: string): {
    file: VehicleFile;
    sticker: StickerRecord;
  } | null => {
    const all = getAll();
    for (const file of all) {
      for (const sticker of file.stickers) {
        if (sticker.signing_token === token) {
          return { file, sticker };
        }
      }
    }
    return null;
  }, []);

  // Stats
  const stats = {
    totalFiles: files.length,
    totalStickers: files.reduce((sum, f) => sum + f.stickers.length, 0),
    pendingSign: files.filter(f => f.deal_status === "pending_sign").length,
    signed: files.filter(f => f.deal_status === "signed").length,
    delivered: files.filter(f => f.deal_status === "delivered").length,
  };

  return {
    files,
    stats,
    getOrCreateFile,
    registerSticker,
    recordSigning,
    updateDealStatus,
    updateCustomer,
    voidSticker,
    addAftermarketInstall,
    findByTrackingCode,
    findByVin,
    findBySigningToken,
  };
};
