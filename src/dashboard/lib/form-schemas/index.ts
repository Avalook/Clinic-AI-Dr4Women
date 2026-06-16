// Registry form chuyên khoa: service_code → schema. Engine + route đọc từ đây.
// Thêm form mới = thêm 1 config + 1 dòng đăng ký (KHÔNG sửa engine/route).
// Vòng này CHỈ pilot Phụ khoa (PK); 4 form còn lại đăng ký sau.

import type { FormSchema } from "./types";
import { pkSchema } from "./pk";

const REGISTRY: Record<string, FormSchema> = {
  PK: pkSchema,
};

/** Schema theo service_code, hoặc null nếu chưa có config. */
export function getFormSchema(serviceCode: string | null | undefined): FormSchema | null {
  if (!serviceCode) return null;
  return REGISTRY[serviceCode.toUpperCase()] ?? null;
}

/** Đoán service_code từ TÊN dịch vụ (pilot: chưa truyền service_type.code).
 *  Phụ khoa → "PK". Trả null nếu không khớp form nào đã cấu hình. */
export function resolveServiceCode(serviceName: string | null | undefined): string | null {
  const n = (serviceName ?? "").toLowerCase();
  if (n.includes("phụ khoa") || n.includes("phu khoa")) return "PK";
  return null;
}
