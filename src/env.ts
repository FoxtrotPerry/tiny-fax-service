import z, { ZodError } from "zod";

const zEnv = z.object({
  TF_API_URL: z.string().url(),
  TF_WS_URL: z.string().url(),
  TF_PRINTER_IP: z.string().min(1).optional(),
  TF_PRINTER_PORT: z
    .string()
    .min(1)
    .optional()
    .transform((val) => {
      if (val === undefined) {
        return undefined;
      }
      const parsed = Number.parseInt(val);
      if (Number.isNaN(parsed)) {
        throw new Error("TF_PRINTER_PORT must be a number");
      }
      return parsed;
    }),
  TF_PRINTER_PX_WIDTH: z
    .string()
    .min(1)
    .optional()
    .transform((val) => {
      if (val === undefined) {
        return undefined;
      }
      const parsed = Number.parseInt(val);
      if (Number.isNaN(parsed) && val !== undefined) {
        throw new Error("TF_PRINTER_PX_WIDTH must be a number");
      }
      return parsed;
    }),
});

const getEnv = () => {
  const parseResult = zEnv.safeParse(process.env);
  if (parseResult.error) {
    const error = new ZodError([
      {
        message:
          "Problem parsing process.env. Are you missing any expected values in your .env? Check the path property of this error for clues.",
        fatal: true,
        code: "custom",
        path: parseResult.error.errors.map((err) => err.path).flat(),
      },
    ]);
    console.error(error);
    throw error;
  }
  return parseResult.data;
};

export const env = getEnv();
