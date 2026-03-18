import pino from "pino";

const nodeEnv = process.env.NODE_ENV ?? "development";

export const logger = pino(
  {
    level: nodeEnv === "production" ? "info" : "debug",
    transport:
      nodeEnv === "development"
        ? { target: "pino-pretty", options: { destination: 2 } }
        : undefined,
  },
  pino.destination(2),
);
