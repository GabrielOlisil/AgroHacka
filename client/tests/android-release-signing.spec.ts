import { randomBytes, X509Certificate } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  nativeSigningCommand,
  signAndroidRelease,
  validateSigningSecrets,
  type SigningCommand,
} from "../src/scripts/assinar-android-release";

// Apenas certificados públicos descartáveis. Nenhuma chave privada é fixture.
const CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDJTCCAg2gAwIBAgIUI1NgAPCP7FZlVs+Agt0ucIMQZv4wDQYJKoZIhvcNAQEL
BQAwITEfMB0GA1UEAwwWQWdyb0hhY2thIFNpZ25pbmcgVGVzdDAgFw0yNjEwMjcx
NDM4MDFaGA8yMTI2MTAwMzE0MzgwMVowITEfMB0GA1UEAwwWQWdyb0hhY2thIFNp
Z25pbmcgVGVzdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMZ9m960
8FbVQ2LTniPL7mYOnbCbNR7MJFy5KMFywVk2zwYo72NWSPnv9g4D1eYyfK0Ofa+2
cxCjK6rMc3Gy7O3sywz2BmEmG+dz5ahWWWUzfa/tyEKDFsERv+Um0VWqNfMBF1pF
t6z/Lm0G+OyNZpp21/ucafjZcJqFh+kdxyVtf2O1UsvHEkzAm3PB0deWGFnp7uaw
uR61PdZVcSCg0pCt16H2KXdSqZRt47FRMuiwTUjJUO4sR9B+U5a2AVFgh0iZHnuR
6fv8DQfZpq8R5bZ+x/F4pvHbWvRMbcm7e0TDaywXHNQWxWRgCCT7ntQhwHe1VmqY
n3a94PCNfzpHbksCAwEAAaNTMFEwHQYDVR0OBBYEFJocpyZEAapr/Rnj25NSjWcN
XGIGMB8GA1UdIwQYMBaAFJocpyZEAapr/Rnj25NSjWcNXGIGMA8GA1UdEwEB/wQF
MAMBAf8wDQYJKoZIhvcNAQELBQADggEBAEkPHUaT28+d/DPomHXinFqPfCKd1roa
ypOUmbwn9BlKH6R8qEgkTWFYBJljxXCKtxSp+a8Osf7aPJkvTntIrh5mRIDI3lVQ
9MdnODaESV/fyFqs8HcQXfqrANQXhDLWpCAMQHbz3NN1GKZlKLwUIx3YBVtL8Ndr
DODrjtYKivklL/vJ3jCsSX0XGQ4hpfYi4m/DxL6NO2gvEvof2k6N0mFLB61claOS
8YQqC3jqDpkxv06kobjbCB9p2FqhsxKgfMjNMP/XkLRYRrIQ/a2oIGf+nyXzFEPc
cie5y5Ma5DgVLi0fPC8Nyb+lP9OwH1ginciFBaQEMLYUSqap7A+Y9x4=
-----END CERTIFICATE-----`;
const DEBUG_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDUTCCAjmgAwIBAgIUb997OOhwnhM9qTMe7HmX33NXOpswDQYJKoZIhvcNAQEL
BQAwNzEWMBQGA1UEAwwNQW5kcm9pZCBEZWJ1ZzEQMA4GA1UECgwHQW5kcm9pZDEL
MAkGA1UEBhMCVVMwIBcNMjYxMDI3MTQzODAxWhgPMjEyNjEwMDMxNDM4MDFaMDcx
FjAUBgNVBAMMDUFuZHJvaWQgRGVidWcxEDAOBgNVBAoMB0FuZHJvaWQxCzAJBgNV
BAYTAlVTMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA6d3JKLO5ca5M
EAUBI6Or4V0e6iy2x+VzHpwBZPPNDOkPMEeSseau6DuixjbDWD8pjVy37k0rsbYD
e1rwxaoZ+2Wj3UzmCmwnmi+WKVdPP9CIQBOmymPNvlG7qhGaNtfjWR4YGoPKU1no
DQVDx1hUM5EMyTtEXjNA2PTLTESYn9S5rkFlCmroT8xKGFrLSFi8g7MCbtFy8Fac
eXAyGspHgJVyrQHulrDppNI/TBQA9uAerJNS0wIu6iDU6M4oQdgQgVtEyl5cNK2i
Bl2RuN3BKWhDMDWPf5lMiOEY0ApQDhfQELDLNTTxujBjxbHG4yP8w7Uy2/pX/Ywk
MYJ2dHWuXQIDAQABo1MwUTAdBgNVHQ4EFgQU5qWgoRwBs66SqhLPQQQ0+aUFcvMw
HwYDVR0jBBgwFoAU5qWgoRwBs66SqhLPQQQ0+aUFcvMwDwYDVR0TAQH/BAUwAwEB
/zANBgkqhkiG9w0BAQsFAAOCAQEAefOnQOKPB2joVCUXhubx6uNWZoV41og1t0q/
UnVEbdzLGx8S9dyysRrp/VCK59J74r+sYaOWtZX56+IOW8pSeqdzPMqGbOctVnCE
3oWJBXv3kki94mUv0p7ja40khReN1ocDC/4Rhz3zntDEqOarimBNGonr+lweuzar
hXlnhD35FUDFNgbHejNA3lrgYyMkK6v2qFANxWT9t3IT+KEm5iZdZSzuRVfcoqWp
3xCoH3mX4woOrSmI/FVZ0XtS3KhHeU5PnNEk2HUnKd1J0HO6D4y9s54z24QM9sM0
dFjb+sHiwSaihE4Y+7LkvHB9s3fMRxXnXRDO0s7qykuoMGjyUQ==
-----END CERTIFICATE-----`;
const SECRETS = {
  ANDROID_KEYSTORE_BASE64: Buffer.from(
    "keystore-artificial-sem-chave",
  ).toString("base64"),
  ANDROID_KEY_ALIAS: "release-test",
  ANDROID_KEYSTORE_PASSWORD: "artificial-store-$`'\\\"",
  ANDROID_KEY_PASSWORD: "artificial-key-$`'\\\"",
};
const fingerprint = new X509Certificate(CERTIFICATE).fingerprint256
  .replaceAll(":", "")
  .toLowerCase();
const verification = `Signer #1 certificate DN: CN=AgroHacka Signing Test\nSigner #1 certificate SHA-256 digest: ${fingerprint}\n`;
const badging =
  "package: name='com.agrohack.desktop' versionCode='10000' versionName='0.1.0'\nnative-code: 'arm64-v8a'\n";

describe("assinatura do release Android (5.2)", () => {
  let dir: string;
  let apkDirectory: string;
  let input: string;
  let outputFile: string;
  let tempDirectory: string;
  let run: ReturnType<typeof vi.fn<(command: SigningCommand) => string>>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agro-signing-test-"));
    apkDirectory = join(dir, "outputs", "apk");
    input = join(
      apkDirectory,
      "universal",
      "release",
      "app-universal-release-unsigned.apk",
    );
    outputFile = join(dir, "published", "agrohacka-arm64-release.apk");
    tempDirectory = join(dir, "temp");
    mkdirSync(dirname(input), { recursive: true });
    mkdirSync(tempDirectory);
    writeFileSync(input, "apk-artificial");
    run = vi.fn(({ program, args }: SigningCommand) => {
      const tool = basename(program);
      if (tool === "keytool") return CERTIFICATE;
      if (tool === "aapt2") return badging;
      if (tool === "zipalign") {
        if (args[0] !== "-c") copyFileSync(args.at(-2)!, args.at(-1)!);
        return "";
      }
      if (tool === "apksigner" && args[0] === "sign") {
        copyFileSync(args.at(-1)!, args[args.indexOf("--out") + 1]!);
        return "";
      }
      if (tool === "apksigner" && args[0] === "verify") return verification;
      throw new Error("Comando inesperado");
    });
  });

  afterEach(() => {
    const expectedParent = resolve(tmpdir());
    if (
      dirname(resolve(dir)) !== expectedParent ||
      !basename(dir).startsWith("agro-signing-test-")
    )
      throw new Error("Diretório de teste inesperado");
    rmSync(dir, { recursive: true, force: true });
  });

  const sign = () =>
    signAndroidRelease({
      apkDirectory,
      outputFile,
      tempDirectory,
      buildToolsDirectory: join(dir, "sdk", "35.0.0"),
      secrets: SECRETS,
      run,
    });

  // Opt-in local: caminhos das ferramentas, nunca credenciais reais ou fixtures privadas.
  it.skipIf(
    !process.env.ANDROID_SIGNING_TEST_BUILD_TOOLS ||
      !process.env.ANDROID_SIGNING_TEST_PLATFORM_JAR,
  )(
    "assina e verifica APK real, rejeita senha errada e certificado debug com chave descartável",
    () => {
      const buildToolsDirectory = process.env.ANDROID_SIGNING_TEST_BUILD_TOOLS!;
      const platformJar = process.env.ANDROID_SIGNING_TEST_PLATFORM_JAR!;
      const executable = (name: string) =>
        join(
          buildToolsDirectory,
          name + (process.platform === "win32" ? ".exe" : ""),
        );
      const secrets = {
        ...SECRETS,
        ANDROID_KEYSTORE_PASSWORD: randomBytes(24).toString("hex"),
        ANDROID_KEY_PASSWORD: randomBytes(24).toString("hex"),
      };
      const manifest = join(dir, "AndroidManifest.xml");
      writeFileSync(
        manifest,
        '<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.agrohack.desktop" android:versionCode="1" android:versionName="0.1.0"><uses-sdk android:minSdkVersion="24" android:targetSdkVersion="35"/><application android:label="Signing Test" android:hasCode="false" android:debuggable="false"/></manifest>',
      );
      execFileSync(
        executable("aapt2"),
        ["link", "-I", platformJar, "--manifest", manifest, "-o", input],
        { stdio: "pipe" },
      );
      const key = join(dir, "temporary-release.jks");
      const createKey = (path: string, subject: string) =>
        execFileSync(
          "keytool",
          [
            "-genkeypair",
            "-noprompt",
            "-storetype",
            "JKS",
            "-keystore",
            path,
            "-alias",
            secrets.ANDROID_KEY_ALIAS,
            "-storepass:env",
            "ANDROID_KEYSTORE_PASSWORD",
            "-keypass:env",
            "ANDROID_KEY_PASSWORD",
            "-keyalg",
            "RSA",
            "-keysize",
            "2048",
            "-validity",
            "2",
            "-dname",
            subject,
          ],
          { env: { ...process.env, ...secrets }, stdio: "pipe" },
        );
      createKey(key, "CN=AgroHacka Temporary Test");
      secrets.ANDROID_KEYSTORE_BASE64 = readFileSync(key).toString("base64");
      const options = {
        apkDirectory,
        outputFile,
        tempDirectory,
        buildToolsDirectory,
        secrets,
      };
      signAndroidRelease(options);
      expect(statSync(outputFile).size).toBeGreaterThan(0);
      const command = nativeSigningCommand({
        program: join(buildToolsDirectory, "apksigner"),
        args: ["verify", "--verbose", "--print-certs", outputFile],
      });
      const report = execFileSync(command.program, command.args, {
        encoding: "utf8",
        stdio: "pipe",
      });
      expect(report).toContain(
        "Verified using v2 scheme (APK Signature Scheme v2): true",
      );
      expect(report).toContain(
        "Verified using v3 scheme (APK Signature Scheme v3): true",
      );
      execFileSync(
        executable("zipalign"),
        ["-c", "-P", "16", "4", outputFile],
        { stdio: "pipe" },
      );
      const invalidOutput = join(dir, "invalid-password.apk");
      expect(() =>
        signAndroidRelease({
          ...options,
          outputFile: invalidOutput,
          secrets: {
            ...secrets,
            ANDROID_KEY_PASSWORD: randomBytes(24).toString("hex"),
          },
        }),
      ).toThrow(/Falha ao assinar APK/);
      expect(existsSync(invalidOutput)).toBe(false);
      const debugKey = join(dir, "renamed-debug.jks");
      createKey(debugKey, "CN=Android Debug,O=Android,C=US");
      const debugOutput = join(dir, "invalid-debug.apk");
      expect(() =>
        signAndroidRelease({
          ...options,
          outputFile: debugOutput,
          secrets: {
            ...secrets,
            ANDROID_KEYSTORE_BASE64: readFileSync(debugKey).toString("base64"),
          },
        }),
      ).toThrow(/Certificado debug/);
      expect(existsSync(debugOutput)).toBe(false);
      expect(readdirSync(tempDirectory)).toEqual([]);
    },
    30_000,
  );

  it("Windows usa apksigner.jar via Java, sem shell nem arquivo .bat; Linux mantém a CLI oficial", () => {
    const command: SigningCommand = {
      program: join(dir, "sdk", "apksigner"),
      args: ["sign", "--ks-pass", "env:ANDROID_KEYSTORE_PASSWORD"],
      env: { ANDROID_KEYSTORE_PASSWORD: SECRETS.ANDROID_KEYSTORE_PASSWORD },
    };
    expect(nativeSigningCommand(command, "win32")).toEqual({
      program: "java",
      args: ["-jar", join(dir, "sdk", "lib", "apksigner.jar"), ...command.args],
      env: command.env,
    });
    expect(nativeSigningCommand(command, "linux")).toEqual(command);
    const keytool = { program: "keytool", args: ["-exportcert"] };
    expect(nativeSigningCommand(keytool, "win32")).toEqual(keytool);
  });

  it("alinha antes de assinar, verifica assinatura/alinhamento e só então publica; preserva a entrada", () => {
    sign();
    expect(readFileSync(outputFile, "utf8")).toBe("apk-artificial");
    expect(readFileSync(input, "utf8")).toBe("apk-artificial");
    const commands = run.mock.calls.map(([command]) => [
      basename(command.program),
      command.args[0],
    ]);
    expect(commands).toEqual([
      ["keytool", "-exportcert"],
      ["aapt2", "dump"],
      ["zipalign", "-P"],
      ["apksigner", "sign"],
      ["apksigner", "verify"],
      ["zipalign", "-c"],
    ]);
    const align = run.mock.calls.find(
      ([c]) => basename(c.program) === "zipalign",
    )![0];
    expect(align.args.slice(0, 3)).toEqual(["-P", "16", "4"]);
    expect(readdirSync(tempDirectory)).toEqual([]);
    expect(readdirSync(dirname(outputFile))).toEqual([basename(outputFile)]);
  });

  it("não passa senhas/base64 nos argumentos; usa env, sem interpolar dados em shell", () => {
    run.mockImplementationOnce(({ args, env }) => {
      expect(args).toContain("-storepass:env");
      expect(env?.ANDROID_KEYSTORE_PASSWORD).toBe(
        SECRETS.ANDROID_KEYSTORE_PASSWORD,
      );
      const keystore = args[args.indexOf("-keystore") + 1]!;
      expect(readFileSync(keystore, "utf8")).toBe(
        "keystore-artificial-sem-chave",
      );
      if (process.platform !== "win32") {
        expect(statSync(keystore).mode & 0o777).toBe(0o600);
        expect(statSync(dirname(keystore)).mode & 0o777).toBe(0o700);
      }
      expect(existsSync(outputFile)).toBe(false);
      return CERTIFICATE;
    });
    sign();
    for (const [command] of run.mock.calls) {
      expect(command.args.join(" ")).not.toContain(
        SECRETS.ANDROID_KEYSTORE_PASSWORD,
      );
      expect(command.args.join(" ")).not.toContain(
        SECRETS.ANDROID_KEY_PASSWORD,
      );
      expect(command.args.join(" ")).not.toContain(
        SECRETS.ANDROID_KEYSTORE_BASE64,
      );
    }
    const signing = run.mock.calls.find(([c]) => c.args[0] === "sign")![0];
    expect(signing.args).toContain("env:ANDROID_KEYSTORE_PASSWORD");
    expect(signing.args).toContain("env:ANDROID_KEY_PASSWORD");
    expect(signing.args).toContain("--v4-signing-enabled");
    expect(signing.env?.ANDROID_KEY_PASSWORD).toBe(
      SECRETS.ANDROID_KEY_PASSWORD,
    );
  });

  it.each(Object.keys(SECRETS))(
    "rejeita secret ausente/vazio/nulo sem revelar outros valores: %s",
    (key) => {
      for (const value of [undefined, "", "  ", null, 0]) {
        const secrets = { ...SECRETS, [key]: value };
        expect(() => validateSigningSecrets(secrets as never)).toThrow(key);
        try {
          validateSigningSecrets(secrets as never);
        } catch (error) {
          expect(String(error)).not.toContain(SECRETS.ANDROID_KEY_PASSWORD);
        }
      }
    },
  );

  it.each(["@@@", "a", "YWJj=", "YW=Jj", "Zh=="])(
    "rejeita base64 inválido, inclusive decodificação permissiva: %s",
    (value) => {
      expect(() =>
        validateSigningSecrets({ ...SECRETS, ANDROID_KEYSTORE_BASE64: value }),
      ).toThrow(/base64/i);
    },
  );

  it("aceita base64 quebrado em linhas e mantém caracteres especiais nas senhas", () => {
    expect(() =>
      validateSigningSecrets({
        ...SECRETS,
        ANDROID_KEYSTORE_BASE64: SECRETS.ANDROID_KEYSTORE_BASE64.replace(
          /(.{8})/g,
          "$1\r\n",
        ),
      }),
    ).not.toThrow();
  });

  it.each(["androiddebugkey", " AndroidDebugKey "])(
    "recusa alias debug: %s",
    (alias) => {
      expect(() =>
        signAndroidRelease({
          apkDirectory,
          outputFile,
          tempDirectory,
          buildToolsDirectory: dir,
          secrets: { ...SECRETS, ANDROID_KEY_ALIAS: alias },
          run,
        }),
      ).toThrow(/debug/i);
      expect(run).not.toHaveBeenCalled();
      expect(readdirSync(tempDirectory)).toEqual([]);
    },
  );

  it.each([DEBUG_CERTIFICATE, "certificado inválido"])(
    "recusa certificado debug renomeado ou certificado inválido",
    (certificate) => {
      run.mockReturnValueOnce(certificate);
      expect(sign).toThrow(/certificado|debug/i);
      expect(run).toHaveBeenCalledTimes(1);
      expect(existsSync(outputFile)).toBe(false);
      expect(readdirSync(tempDirectory)).toEqual([]);
    },
  );

  it.each([
    "application-debuggable\n" + badging,
    badging.replace("com.agrohack.desktop", "com.agrohack.desktop.debug"),
    "manifest inválido",
  ])("não assina pacote debug ou de outro aplicativo", (manifest) => {
    run
      .mockImplementationOnce(() => CERTIFICATE)
      .mockImplementationOnce(() => manifest);
    expect(sign).toThrow(/pacote|debug/i);
    expect(run.mock.calls.some(([c]) => c.args[0] === "sign")).toBe(false);
    expect(existsSync(outputFile)).toBe(false);
    expect(readdirSync(tempDirectory)).toEqual([]);
  });

  it.each([
    "",
    verification.replace(fingerprint, "ab".repeat(32)),
    verification + `Signer #2 certificate SHA-256 digest: ${fingerprint}\n`,
  ])(
    "não publica assinatura sem certificado esperado ou com múltiplos assinantes",
    (report) => {
      const original = run.getMockImplementation()!;
      run.mockImplementation((command) =>
        command.args[0] === "verify" ? report : original(command),
      );
      expect(sign).toThrow(/assinatura|certificado/i);
      expect(existsSync(outputFile)).toBe(false);
      expect(readdirSync(tempDirectory)).toEqual([]);
    },
  );

  it.each(["keytool", "aapt2", "align", "sign", "verify", "check"])(
    "limpa keystore e não publica se falhar em %s; suprime stderr com secrets",
    (stage) => {
      const original = run.getMockImplementation()!;
      run.mockImplementation((command) => {
        const current =
          basename(command.program) === "zipalign"
            ? command.args[0] === "-c"
              ? "check"
              : "align"
            : basename(command.program) === "apksigner"
              ? command.args[0]
              : basename(command.program);
        if (current === stage)
          throw new Error(
            SECRETS.ANDROID_KEY_PASSWORD + SECRETS.ANDROID_KEYSTORE_BASE64,
          );
        return original(command);
      });
      expect(sign).toThrow(/Falha/);
      try {
        sign();
      } catch (error) {
        expect(String(error)).not.toContain(SECRETS.ANDROID_KEY_PASSWORD);
        expect(String(error)).not.toContain(SECRETS.ANDROID_KEYSTORE_BASE64);
      }
      expect(existsSync(outputFile)).toBe(false);
      expect(readdirSync(tempDirectory)).toEqual([]);
    },
  );

  it("ignora artefatos debug e não inclui o keystore no diretório publicado", () => {
    const debug = join(
      apkDirectory,
      "universal",
      "debug",
      "app-universal-debug.apk",
    );
    mkdirSync(dirname(debug), { recursive: true });
    writeFileSync(debug, "debug");
    sign();
    expect(run.mock.calls.some(([c]) => c.args.includes(debug))).toBe(false);
    expect(readdirSync(dirname(outputFile))).toEqual([basename(outputFile)]);
  });

  it("falha com zero ou múltiplos APKs release, sem escolher arquivo arbitrário", () => {
    rmSync(input);
    expect(sign).toThrow(/exatamente um APK release/);
    writeFileSync(input, "um");
    writeFileSync(join(dirname(input), "outro-release-unsigned.apk"), "dois");
    expect(sign).toThrow(/exatamente um APK release/);
    expect(run).not.toHaveBeenCalled();
  });

  it("preserva saída preexistente e não chama ferramentas", () => {
    mkdirSync(dirname(outputFile));
    writeFileSync(outputFile, "de-outra-execucao");
    expect(sign).toThrow(/já existe/);
    expect(readFileSync(outputFile, "utf8")).toBe("de-outra-execucao");
    expect(run).not.toHaveBeenCalled();
  });

  it("não publica APK vazio e remove o material temporário", () => {
    writeFileSync(input, "");
    expect(sign).toThrow(/APK assinado vazio/);
    expect(existsSync(outputFile)).toBe(false);
    expect(readdirSync(tempDirectory)).toEqual([]);
  });

  it("CLI valida secrets artificiais sem acessar ferramentas ou imprimir valores", () => {
    const script = fileURLToPath(
      new URL("../src/scripts/assinar-android-release.ts", import.meta.url),
    );
    const result = spawnSync(process.execPath, [script, "--validate-secrets"], {
      env: { ...process.env, ...SECRETS },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    for (const value of Object.values(SECRETS))
      expect(result.stdout + result.stderr).not.toContain(value);
  });

  it("CLI de assinatura suprime erros reais de subprocesso e limpa seu keystore", () => {
    const script = fileURLToPath(
      new URL("../src/scripts/assinar-android-release.ts", import.meta.url),
    );
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...SECRETS,
      RUNNER_TEMP: tempDirectory,
    };
    for (const key of Object.keys(env))
      if (key.toLowerCase() === "path") delete env[key];
    const result = spawnSync(
      process.execPath,
      [
        script,
        "--sign",
        apkDirectory,
        outputFile,
        join(dir, "sdk-inexistente"),
      ],
      { env: { ...env, PATH: "" }, encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Falha ao ler certificado");
    for (const value of Object.values(SECRETS))
      expect(result.stdout + result.stderr).not.toContain(value);
    expect(existsSync(outputFile)).toBe(false);
    expect(readdirSync(tempDirectory)).toEqual([]);
  });

  it("CLI falha sem secrets, antes de acessar ferramentas, e não imprime o secret presente", () => {
    const script = fileURLToPath(
      new URL("../src/scripts/assinar-android-release.ts", import.meta.url),
    );
    const env = { ...process.env };
    for (const key of Object.keys(SECRETS)) delete env[key];
    env.ANDROID_KEY_PASSWORD = SECRETS.ANDROID_KEY_PASSWORD;
    const result = spawnSync(process.execPath, [script, "--validate-secrets"], {
      env,
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ANDROID_KEYSTORE_BASE64");
    expect(result.stderr + result.stdout).not.toContain(
      SECRETS.ANDROID_KEY_PASSWORD,
    );
  });
});
