describe("TypeScript migration", () => {
  const modulePath = require.resolve("../src/config");
  const originalEnv = {
    PORT: process.env.PORT,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
  };

  afterEach(() => {
    if (originalEnv.PORT === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalEnv.PORT;
    }

    if (originalEnv.GOOGLE_PRIVATE_KEY === undefined) {
      delete process.env.GOOGLE_PRIVATE_KEY;
    } else {
      process.env.GOOGLE_PRIVATE_KEY = originalEnv.GOOGLE_PRIVATE_KEY;
    }

    delete require.cache[modulePath];
  });

  it("loads the server config from the TypeScript module", () => {
    expect(modulePath.endsWith("config.ts")).toBe(true);
  });

  it("preserves config parsing behavior", () => {
    process.env.PORT = "not-a-number";
    process.env.GOOGLE_PRIVATE_KEY = "line1\\nline2";

    delete require.cache[modulePath];
    const config = require("../src/config");

    expect(config.port).toBe(3000);
    expect(config.googlePrivateKey).toBe("line1\nline2");
  });
});
