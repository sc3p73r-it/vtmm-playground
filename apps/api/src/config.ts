import dotenv from "dotenv";

dotenv.config();

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "8080", 10),
  databaseUrl: must("DATABASE_URL"),
  jwtSecret: must("JWT_SECRET"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000,http://127.0.0.1:3000",
  sessionTtlMinutes: parseInt(process.env.SESSION_TTL_MINUTES ?? "30", 10),
  playground: {
    image: process.env.PLAYGROUND_IMAGE ?? "ubuntu:22.04",
    memoryMb: parseInt(process.env.PLAYGROUND_MEMORY_MB ?? "256", 10),
    nanoCpus: parseInt(process.env.PLAYGROUND_NANO_CPUS ?? "500000000", 10)
  }
};
