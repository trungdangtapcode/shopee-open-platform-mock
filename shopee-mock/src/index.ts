import { ShopeeMockServer } from "./server";

export * from "./version";
export * from "./errors";
export * from "./schemas";
export * from "./storage";
export * from "./utils";
export * from "./managers";
export * from "./server";

if (require.main === module) {
  const server = new ShopeeMockServer();
  server.start();
}
