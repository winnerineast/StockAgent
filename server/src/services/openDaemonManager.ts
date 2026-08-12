import net from "net";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

export class OpenDaemonManager {
  private host = process.env.OPEND_HOST || "127.0.0.1";
  private port = Number(process.env.OPEND_PORT) || 11111;

  /**
   * 检查 OpenD 端口 (11111) 是否可以建立 TCP 连接
   */
  public async checkOpenDAlive(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1500);

      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });

      socket.on("error", () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(this.port, this.host);
    });
  }

  /**
   * 自动检查 OpenD，若处于离线状态，尝试通过本地程序路径/PowerShell唤起进程
   */
  public async ensureOpenDRunning(): Promise<{ success: boolean; message: string }> {
    const alive = await this.checkOpenDAlive();
    if (alive) {
      return { success: true, message: `MooMoo OpenD 已在 ${this.host}:${this.port} 正常运行` };
    }

    console.log("[OpenDaemonManager] OpenD 端口 11111 未响应，尝试在后台唤起守护进程...");

    const possiblePaths = [
      "C:\\Program Files\\MooMoo OpenD\\moomoo_OpenD.exe",
      "C:\\MooMoo_OpenD\\moomoo_OpenD.exe",
      path.join(process.cwd(), "OpenD/moomoo_OpenD.exe"),
    ];

    let exePath = "";
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        exePath = p;
        break;
      }
    }

    if (exePath) {
      try {
        exec(`start "" "${exePath}"`);
      } catch (e) {}
    }

    // 等待 3 秒进行轮询连通测试
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const reCheck = await this.checkOpenDAlive();
      if (reCheck) {
        return { success: true, message: `已成功在后台连通 MooMoo OpenD 网关` };
      }
    }

    return {
      success: false,
      message: `OpenD 未响应 (127.0.0.1:11111)。请启动 MooMoo OpenD 软件或在前端手动解锁导入`,
    };
  }
}

export const openDaemonManager = new OpenDaemonManager();
