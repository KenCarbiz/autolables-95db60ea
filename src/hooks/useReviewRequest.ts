import { useState } from "react";

export interface ReviewRequest {
  id: string;
  vin: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  salespersonName: string;
  dealerName: string;
  googlePlaceId?: string;
  dealerRaterUrl?: string;
  sentAt: string;
  sentVia: "email" | "sms" | "both";
  status: "queued" | "sent" | "clicked" | "reviewed";
}

const STORAGE_KEY = "review_requests";

export const useReviewRequest = () => {
  const [sending, setSending] = useState(false);

  const getAll = (): ReviewRequest[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  };

  const queueReviewRequest = (data: Omit<ReviewRequest, "id" | "sentAt" | "status">): ReviewRequest => {
    const req: ReviewRequest = { ...data, id: crypto.randomUUID(), sentAt: new Date().toISOString(), status: "queued" };
    const all = [...getAll(), req];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return req;
  };

  const sendReviewRequest = async (requestId: string): Promise<boolean> => {
    setSending(true);
    // In production: await supabase.functions.invoke("send-review-request", { body: { requestId } });
    const all = getAll().map(r => r.id === requestId ? { ...r, status: "sent" as const } : r);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    setSending(false);
    return true;
  };

  return { queueReviewRequest, sendReviewRequest, sending, getAll };
};
