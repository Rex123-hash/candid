import { z } from "zod";

export const MAX_QTY_PER_LINE = 50;

export type Grower = {
  id: string;
  name: string;
  /** Sandbox PayPal email that receives this grower's share. */
  paypalEmail: string;
};

export type Item = {
  id: string;
  name: string;
  priceCents: number;
  /** "jar", "dozen", "bunch", ... shown after the price. */
  unit: string;
  growerId: string | null;
  /** What the item looks like, used to help the vision model tell items apart. */
  lookFor: string;
  paypalProductId?: string;
};

export type Stand = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  location: string;
  currency: "USD";
  items: Item[];
  growers: Grower[];
  isDemo: boolean;
  /** SHA-256 of the owner key. The raw key only ever lives in the owner's cookie. */
  ownerKeyHash: string;
  createdAt: string;
};

export type SaleLine = { itemId: string; name: string; qty: number; unitCents: number };

export type SaleStatus = "CREATED" | "CAPTURED" | "ATTENTION";

export type Sale = {
  id: string;
  standId: string;
  lines: SaleLine[];
  totalCents: number;
  method: "paypal" | "venmo";
  status: SaleStatus;
  paypalOrderId: string;
  /** Reused on every capture attempt so PayPal treats retries as one capture. */
  captureRequestId: string;
  captureId?: string;
  attentionReason?: string;
  createdAt: string;
  capturedAt?: string;
};

export type ShelfCount = {
  id: string;
  standId: string;
  kind: "open" | "close";
  counts: Record<string, number>;
  notes: string;
  createdAt: string;
};

/**
 * Why stock changed other than a customer taking it. Restocks add to the shelf;
 * spoiled and given-away items leave it without being sold; cash is a sale the
 * owner reports but PayPal can't confirm.
 */
export const STOCK_REASONS = ["restock", "spoiled", "gift", "cash"] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

export type StockMove = {
  id: string;
  standId: string;
  itemId: string;
  qty: number;
  reason: StockReason;
  createdAt: string;
};

/** PayPal's per-recipient payout states. Anything else is kept as UNKNOWN. */
export const PAYOUT_ITEM_STATUSES = [
  "PENDING",
  "SUCCESS",
  "UNCLAIMED",
  "ONHOLD",
  "FAILED",
  "RETURNED",
  "BLOCKED",
  "REFUNDED",
  "REVERSED",
  "DENIED",
  "UNKNOWN",
] as const;
export type PayoutItemStatus = (typeof PAYOUT_ITEM_STATUSES)[number];

export type PayoutLine = {
  growerId: string;
  name: string;
  email: string;
  cents: number;
  /** Our id for this line inside the batch, used to match PayPal's per-item status. */
  senderItemId?: string;
  payoutItemId?: string;
  /** Missing on records made before per-recipient tracking: treated as still in flight. */
  status?: PayoutItemStatus;
  error?: string;
};

export type PayoutRecord = {
  id: string;
  standId: string;
  batchId: string;
  status: string;
  lines: PayoutLine[];
  /** Legacy: sales covered by the batch. Settlement now works from amounts. */
  saleIds?: string[];
  createdAt: string;
  checkedAt?: string;
};

/** What kind of gap the closing check found on one item. */
export const EXCEPTION_KINDS = ["unexplained", "over", "surplus"] as const;
export type ExceptionKind = (typeof EXCEPTION_KINDS)[number];

/** The owner's answer "I don't know" to one closing question: noted, not explained away. */
export type Acknowledgement = {
  closeId: string;
  itemId: string;
  kind: ExceptionKind;
  createdAt: string;
};

export type StandRecord = {
  stand: Stand;
  sales: Sale[];
  shelfCounts: ShelfCount[];
  payouts: PayoutRecord[];
  /** Missing on records saved before stock logging existed. */
  stockMoves?: StockMove[];
  /** Missing on records saved before closing questions existed. */
  acknowledged?: Acknowledgement[];
};

// Request schemas: everything that crosses the network boundary is validated here.

export const CartLineSchema = z.object({
  itemId: z.string().min(1).max(64),
  qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
});

export const CreateOrderSchema = z.object({
  lines: z.array(CartLineSchema).min(1).max(30),
  method: z.enum(["paypal", "venmo"]),
});

export const ImageSchema = z.object({
  /** Base64 without the data: prefix. */
  data: z.string().min(100).max(8_000_000),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export const DraftItemSchema = z.object({
  name: z.string().trim().min(1).max(60),
  priceCents: z.number().int().min(1).max(100_000),
  unit: z.string().trim().max(20),
  lookFor: z.string().trim().max(160),
  growerId: z.string().max(64).nullable(),
});

export const GrowerDraftSchema = z.object({
  id: z.string().regex(/^g-[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1).max(60),
  paypalEmail: z.email().max(254),
});

export const CreateStandSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    location: z.string().trim().max(80),
    items: z.array(DraftItemSchema).min(1).max(30),
    growers: z.array(GrowerDraftSchema).max(10),
  })
  .refine((s) => new Set(s.growers.map((g) => g.id)).size === s.growers.length, {
    message: "Each grower needs their own id.",
    path: ["growers"],
  })
  .refine((s) => new Set(s.growers.map((g) => g.paypalEmail.toLowerCase())).size === s.growers.length, {
    message: "Two growers can't share one PayPal email.",
    path: ["growers"],
  });

export const ShelfCountSchema = z.object({
  kind: z.enum(["open", "close"]),
  counts: z.record(z.string().max(64), z.number().int().min(0).max(10_000)),
});

export const AcknowledgeSchema = z.object({
  closeId: z.string().min(1).max(64),
  itemId: z.string().min(1).max(64),
  kind: z.enum(EXCEPTION_KINDS),
});

export const StockMoveSchema = z.object({
  itemId: z.string().min(1).max(64),
  qty: z.number().int().min(1).max(1_000),
  reason: z.enum(STOCK_REASONS),
});
