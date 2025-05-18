import z, { ZodError } from "zod";

const zEnv = z.object({
  TF_API_URL: z.string().url(),
  TF_WS_URL: z.string().url(),
  TF_PRINTER_IP: z.string().min(1).optional(),
  TF_PRINTER_PORT: z.string().min(1).optional(),
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
