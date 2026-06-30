import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error("Usage: pnpm auth:hash -- \"your password\"");
  process.exit(1);
}

console.log(await bcrypt.hash(password, 12));
