import z from "zod";

export const zMessageBody = z.object({
  message: z.string(),
  action: z.enum(["listen", "say", "whisper", "join", "leave"]),
  userId: z.string().optional(),
});

export const zMessageQuery = z.object({
  roomId: z.string(),
});

export type MessageBody = z.infer<typeof zMessageBody>;

export type MessageQuery = z.infer<typeof zMessageQuery>;
