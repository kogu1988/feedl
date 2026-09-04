import { z } from "zod";

// Sprint 42 (PM raporu §8.5) — özel alan tanımları ve değerleri için ortak
// doğrulama. Sprint 21 taksonomi kararı korunur: postType = kategori,
// tags = serbest etiket; custom fields bunlardan bağımsızdır.

export const customFieldTypeValues = [
  "text",
  "select",
  "number",
  "date",
] as const;

export type CustomFieldType = (typeof customFieldTypeValues)[number];

export const customFieldTypeEnum = z.enum(customFieldTypeValues);

const optionSchema = z
  .string()
  .trim()
  .min(1)
  .max(100);

export const createCustomFieldSchema = z
  .object({
    name: z.string().trim().min(1, "Alan adı gerekli.").max(100),
    fieldType: customFieldTypeEnum.default("text"),
    options: z.array(optionSchema).max(50).optional(),
    required: z.boolean().default(false),
    showOnPortal: z.boolean().default(false),
    displayOrder: z.number().int().min(0).max(9999).default(0),
  })
  .refine(
    (data) =>
      data.fieldType !== "select" ||
      (data.options !== undefined && data.options.length > 0),
    {
      message: "Seçim listesi (select) için en az bir seçenek gerekir.",
      path: ["options"],
    },
  );

export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>;

export const updateCustomFieldSchema = z
  .object({
    name: z.string().trim().min(1, "Alan adı gerekli.").max(100).optional(),
    fieldType: customFieldTypeEnum.optional(),
    options: z.array(optionSchema).max(50).optional(),
    required: z.boolean().optional(),
    showOnPortal: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(9999).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Güncellenecek en az bir alan gerekir.",
  });

export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldSchema>;

// Alan adı workspace içinde tekil olduğu için POST'ta pre-check + 23505
// yarış yedeği kullanılır; PATCH'te ad değişmişse aynı kontrol çalışır.
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Alan bilgileri geçersiz.";
}
