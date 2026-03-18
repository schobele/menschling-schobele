import { z } from "zod";

export const channelSchema = z.enum(["slack", "telegram", "email", "whatsapp"]);
export type Channel = z.infer<typeof channelSchema>;

export const vaultCategorySchema = z.enum(["inbox", "projects", "people", "resources", "log"]);
export type VaultCategory = z.infer<typeof vaultCategorySchema>;
