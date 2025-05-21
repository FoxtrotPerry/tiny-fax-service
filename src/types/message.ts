import z from "zod";

export const zMessageBody = z.object({
  message: z.string(),
  action: z.enum(["ping", "say", "whisper", "join", "leave", "rooms"]),
  userId: z.string().optional(),
});

export type MessageBody = z.infer<typeof zMessageBody>;
