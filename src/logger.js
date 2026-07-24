export function createLogger(stream = process.stdout) {
  return {
    info(fields) {
      stream.write(`${JSON.stringify({ level: "info", time: new Date().toISOString(), ...fields })}\n`);
    },
    error(fields) {
      stream.write(`${JSON.stringify({ level: "error", time: new Date().toISOString(), ...fields })}\n`);
    }
  };
}
