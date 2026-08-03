import { randomBytes } from "node:crypto";
import { createPasswordHash } from "../lib/auth.js";

async function readInput(label, hidden = false) {
  if (!process.stdin.isTTY) throw new Error("Lệnh này cần chạy trong Terminal tương tác");
  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error); else resolve(value);
    };
    const onData = chunk => {
      for (const character of chunk) {
        if (character === "\u0003") return finish(new Error("Đã hủy"));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b") {
          if (value) { value = value.slice(0, -1); process.stdout.write("\b \b"); }
          continue;
        }
        if (character < " ") continue;
        value += character;
        process.stdout.write(hidden ? "*" : character);
      }
    };
    process.stdin.on("data", onData);
  });
}

try {
  const username = (await readInput("Tên đăng nhập: ")).trim();
  if (!/^[A-Za-z0-9_.-]{3,50}$/.test(username)) throw new Error("Tên đăng nhập cần 3-50 ký tự: chữ, số, dấu chấm, gạch ngang hoặc gạch dưới");
  const password = await readInput("Mật khẩu (tối thiểu 12 ký tự): ", true);
  const confirmation = await readInput("Nhập lại mật khẩu: ", true);
  if (password !== confirmation) throw new Error("Hai mật khẩu không giống nhau");
  const passwordHash = await createPasswordHash(password);
  const sessionSecret = randomBytes(48).toString("base64url");
  process.stdout.write(`\nSao chép các dòng sau vào .env:\n\nAUTH_USERNAME=${username}\nAUTH_PASSWORD_HASH=${passwordHash}\nAUTH_SESSION_SECRET=${sessionSecret}\nAUTH_SESSION_HOURS=12\n`);
} catch (error) {
  process.stderr.write(`Lỗi: ${error.message}\n`);
  process.exitCode = 1;
}
