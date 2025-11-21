import z from "zod";

// User schemas
export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string(),
  is_super_user: z.boolean(),
  unit_id: z.number().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const CreateUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(4),
  name: z.string().min(1),
  unit_id: z.number().nullable(),
  is_super_user: z.boolean().optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  unit_id: z.number().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const ChangePasswordSchema = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(4),
});

export const AdminChangePasswordSchema = z.object({
  new_password: z.string().min(4),
});

// Unit schemas
export const UnitSchema = z.object({
  id: z.number(),
  name: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateUnitSchema = z.object({
  name: z.string().min(1),
});

export const UpdateUnitSchema = z.object({
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
});

// Function schemas
export const FunctionSchema = z.object({
  id: z.number(),
  name: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateFunctionSchema = z.object({
  name: z.string().min(1),
});

export const UpdateFunctionSchema = z.object({
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
});

// Accommodation schemas
export const AccommodationSchema = z.object({
  id: z.number(),
  name: z.string(),
  unit_id: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateAccommodationSchema = z.object({
  name: z.string().min(1),
  unit_id: z.number(),
});

export const UpdateAccommodationSchema = z.object({
  name: z.string().min(1).optional(),
  unit_id: z.number().optional(),
  is_active: z.boolean().optional(),
});

// Room schemas
export const RoomSchema = z.object({
  id: z.number(),
  name: z.string().optional().nullable(),
  accommodation_id: z.number(),
  bed_count: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateRoomSchema = z.object({
  name: z.string().min(1),
  accommodation_id: z.number(),
  bed_count: z.number().min(1),
});

export const UpdateRoomSchema = z.object({
  name: z.string().min(1).optional(),
  accommodation_id: z.number().optional(),
  bed_count: z.number().min(1).optional(),
  is_active: z.boolean().optional(),
});

// Employee schemas
export const EmployeeSchema = z.object({
  id: z.number(),
  registration_number: z.string(),
  full_name: z.string(),
  arrival_date: z.string().nullable(),
  departure_date: z.string().nullable(),
  observation: z.string().nullable(),
  unit_id: z.number(),
  accommodation_id: z.number().nullable(),
  room_id: z.number().nullable(),
  function_id: z.number().nullable(),
  status: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateEmployeeSchema = z.object({
  registration_number: z.string().min(1),
  full_name: z.string().min(1),
  arrival_date: z.string().nullable(),
  departure_date: z.string().nullable(),
  observation: z.string().nullable(),
  unit_id: z.number(),
  accommodation_id: z.number().nullable(),
  room_id: z.number().nullable(),
  function_id: z.number().nullable(),
  status: z.string().nullable(),
});

export const UpdateEmployeeSchema = z.object({
  registration_number: z.string().min(1).optional(),
  full_name: z.string().min(1).optional(),
  arrival_date: z.string().nullable().optional(),
  departure_date: z.string().nullable().optional(),
  observation: z.string().nullable().optional(),
  unit_id: z.number().optional(),
  accommodation_id: z.number().nullable().optional(),
  room_id: z.number().nullable().optional(),
  function_id: z.number().nullable().optional(),
  status: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

// Dashboard stats
export const DashboardStatsSchema = z.object({
  total_employees: z.number(),
  active_employees: z.number(),
  total_beds: z.number(),
  occupied_beds: z.number(),
  available_beds: z.number(),
  total_accommodations: z.number(),
  employees_by_function: z.array(z.object({
    function_name: z.string(),
    count: z.number(),
  })),
});

export type User = z.infer<typeof UserSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export type Unit = z.infer<typeof UnitSchema>;
export type CreateUnitInput = z.infer<typeof CreateUnitSchema>;
export type UpdateUnitInput = z.infer<typeof UpdateUnitSchema>;

export type Function = z.infer<typeof FunctionSchema>;
export type CreateFunctionInput = z.infer<typeof CreateFunctionSchema>;
export type UpdateFunctionInput = z.infer<typeof UpdateFunctionSchema>;

export type Accommodation = z.infer<typeof AccommodationSchema>;
export type CreateAccommodationInput = z.infer<typeof CreateAccommodationSchema>;
export type UpdateAccommodationInput = z.infer<typeof UpdateAccommodationSchema>;

export type Room = z.infer<typeof RoomSchema>;
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;

export type Employee = z.infer<typeof EmployeeSchema>;
export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;

// Product schemas
export const ProductSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  quantity: z.number(),
  unit_value: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateProductSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number(),
  unit_value: z.number(),
});

// Invoice schemas
export const InvoiceSchema = z.object({
  id: z.number(),
  number: z.string(),
  series: z.string().nullable(),
  issuer_name: z.string(),
  issuer_tax_id: z.string(),
  issue_date: z.string().nullable(),
  access_key: z.string().nullable(),
  xml_content: z.string().nullable(),
  code: z.string().nullable(),
  total_value: z.number().default(0),
  created_at: z.string(),
});

export const CreateInvoiceSchema = z.object({
  number: z.string().min(1),
  series: z.string().nullable(),
  issuer_name: z.string().min(1),
  issuer_tax_id: z.string().min(1),
  issue_date: z.string().nullable(),
  access_key: z.string().nullable(),
  xml_content: z.string().nullable(),
  code: z.string().nullable(),
  total_value: z.number().default(0),
});

// Invoice Item schemas
export const InvoiceItemSchema = z.object({
  id: z.number(),
  invoice_id: z.number(),
  product_id: z.number().nullable(),
  product_code: z.string(),
  product_name: z.string(),
  quantity: z.number(),
  unit_value: z.number(),
  total_value: z.number(),
  created_at: z.string(),
});

export const CreateInvoiceItemSchema = z.object({
  invoice_id: z.number(),
  product_id: z.number().nullable(),
  product_code: z.string(),
  product_name: z.string(),
  quantity: z.number(),
  unit_value: z.number(),
  total_value: z.number(),
});

export type Product = z.infer<typeof ProductSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export type Invoice = z.infer<typeof InvoiceSchema>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;

export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;
export type CreateInvoiceItemInput = z.infer<typeof CreateInvoiceItemSchema>;
