import type { InvoiceInput, ProductInput, StoreInput } from "@/lib/data";
import type { MovementType } from "@/lib/types";
import {
  calendarDate,
  commissionRate,
  moneyAmount,
  monthPeriod,
  nonNegativeInt,
  optionalText,
  positiveId,
  requiredText,
  wholeQuantity,
} from "@/lib/validate";
import { HttpError } from "@/lib/errors";

export function parseStore(body: Record<string, unknown>): StoreInput {
  return {
    name: requiredText(body, "name", "Store name", 120),
    address: requiredText(body, "address", "Address", 400),
    phone: requiredText(body, "phone", "Phone", 40),
    contactName: requiredText(body, "contactName", "Contact name", 120),
    rentAmount: moneyAmount(body.rentAmount, "Rent", false),
    commissionRate: commissionRate(body.commissionRate),
  };
}

export function parseProduct(body: Record<string, unknown>): ProductInput {
  const retailPrice = moneyAmount(body.retailPrice, "Retail price", true);
  return {
    productGroup: requiredText(body, "productGroup", "Product group", 80),
    name: requiredText(body, "name", "Product name", 160),
    description: requiredText(body, "description", "Description", 2000),
    retailPrice: retailPrice ?? 0,
  };
}

export function parseInvoice(body: Record<string, unknown>): InvoiceInput {
  return {
    storeId: positiveId(body.storeId, "Store"),
    period: monthPeriod(body.period),
    invoiceDate: calendarDate(body.invoiceDate, "Invoice date"),
    rentPaid: moneyAmount(body.rentPaid, "Rent paid", true) ?? 0,
    commissionPaid: moneyAmount(body.commissionPaid, "Commission paid", true) ?? 0,
    notes: optionalText(body, "notes", "Notes", 2000),
  };
}

export function parseMovement(body: Record<string, unknown>) {
  const type = body.type;
  if (type !== "transfer_in" && type !== "transfer_out" && type !== "sale") {
    throw new HttpError("Choose a transfer in, a transfer out, or a sale.", 400);
  }
  return {
    type: type as MovementType,
    storeId: positiveId(body.storeId, "Store"),
    productId: positiveId(body.productId, "Product"),
    quantity: wholeQuantity(body.quantity),
    occurredOn: calendarDate(body.occurredOn, "Date"),
    unitPrice: type === "sale" ? moneyAmount(body.unitPrice, "Price sold", true) : null,
    notes: optionalText(body, "notes", "Notes", 500),
  };
}

export function parsePlacement(body: Record<string, unknown>) {
  const quantity = nonNegativeInt(body.quantity, "Starting quantity");
  return {
    storeId: positiveId(body.storeId, "Store"),
    productId: positiveId(body.productId, "Product"),
    consigneeCode: optionalText(body, "consigneeCode", "Consignee code", 80) ?? "",
    quantity,
    occurredOn: quantity > 0 ? calendarDate(body.occurredOn, "Date") : null,
    notes: optionalText(body, "notes", "Notes", 500),
  };
}
