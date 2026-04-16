import { createServer } from "node:http";
import { createApp } from "./app";
import { readEnv } from "./config/env";

const env = readEnv();
const app = createApp();
const server = createServer(app);

server.listen(env.PORT, "127.0.0.1", () => {
  console.log(
    `Clairio API foundation listening on http://127.0.0.1:${env.PORT} (${env.NODE_ENV})`,
  );
});
