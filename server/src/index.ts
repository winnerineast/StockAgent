import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { stockRouter } from "./routes/stockRoutes";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/stock", stockRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "StockAgent Server", timestamp: new Date().toISOString() });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 [StockAgent Server] Running on http://127.0.0.1:${PORT}`);
});
