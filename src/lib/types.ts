export type MovementType = "transfer_in" | "transfer_out" | "sale";

export type Store = {
  id: number;
  name: string;
  address: string;
  phone: string;
  contactName: string;
  rentAmount: number | null;
  commissionRate: number | null;
  units: number;
  retailValue: number;
};

export type Product = {
  id: number;
  productGroup: string;
  name: string;
  description: string;
  retailPrice: number;
  units: number;
  storeCount: number;
};

export type StockLine = {
  id: number;
  storeId: number;
  productId: number;
  consigneeCode: string;
  quantity: number;
  productName: string;
  productGroup: string;
  description: string;
  retailPrice: number;
  storeName?: string;
};

export type Movement = {
  id: number;
  storeId: number;
  storeName: string;
  productId: number;
  productName: string;
  productGroup: string;
  type: MovementType;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  occurredOn: string;
  notes: string | null;
};

export type Invoice = {
  id: number;
  storeId: number;
  storeName: string;
  period: string;
  invoiceDate: string;
  rentPaid: number;
  commissionPaid: number;
  notes: string | null;
};

export type ReportRecord = {
  id: number;
  storeId: number;
  storeName: string;
  period: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  notes: string | null;
  createdAt: string;
};

export type Dashboard = {
  storeCount: number;
  productCount: number;
  unitsOnHand: number;
  retailValue: number;
  salesThisMonth: { count: number; units: number; total: number; period: string };
  stores: Store[];
  recentMovements: Movement[];
};

export type NetworkInfo = {
  port: number;
  addresses: string[];
  bonjour: string | null;
  externalData: boolean;
};

export type SalesResponse = {
  sales: Movement[];
  total: number;
  units: number;
};

export type StoreDetail = {
  store: Store;
  stock: StockLine[];
  movements: Movement[];
  invoices: Invoice[];
  reports: ReportRecord[];
};

export type ProductDetail = {
  product: Product;
  stock: StockLine[];
  movements: Movement[];
};
