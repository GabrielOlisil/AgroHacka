import { execFileSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import {
  constants,
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SECRET_NAMES = [
  "ANDROID_KEYSTORE_BASE64",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_PASSWORD",
] as const;
type SigningSecrets = Partial<Record<(typeof SECRET_NAMES)[number], string>>;

export interface SigningCommand {
  program: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}

interface SigningOptions {
  apkDirectory: string;
  outputFile: string;
  buildToolsDirectory: string;
  tempDirectory: string;
  secrets: SigningSecrets;
  run?: (command: SigningCommand) => string;
}

export function validateSigningSecrets(secrets: SigningSecrets): void {
  for (const name of SECRET_NAMES) {
    if (typeof secrets[name] !== "string" || !secrets[name]!.trim()) {
      throw new Error(`Secret obrigatório ausente ou inválido: ${name}.`);
    }
  }
  if (secrets.ANDROID_KEY_ALIAS!.trim().toLowerCase() === "androiddebugkey") {
    throw new Error("Chave debug não pode assinar um release.");
  }
  const encoded = secrets.ANDROID_KEYSTORE_BASE64!.replace(/\s/g, "");
  if (
    !encoded ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) ||
    Buffer.from(encoded, "base64").toString("base64") !== encoded
  ) {
    throw new Error(
      "ANDROID_KEYSTORE_BASE64 deve conter um keystore em base64 válido.",
    );
  }
}

export function nativeSigningCommand(
  command: SigningCommand,
  platform: NodeJS.Platform = process.platform,
): SigningCommand {
  // execFile não inicia .bat no Windows. Usar o JAR evita shell e sua interpolação.
  if (platform === "win32" && basename(command.program) === "apksigner") {
    return {
      program: "java",
      args: [
        "-jar",
        join(dirname(command.program), "lib", "apksigner.jar"),
        ...command.args,
      ],
      env: command.env,
    };
  }
  return command;
}

function execute(command: SigningCommand): string {
  const { program, args, env: signingEnv } = nativeSigningCommand(command);
  const env = { ...process.env };
  // Os subprocessos recebem só as credenciais necessárias, nunca o keystore base64.
  for (const name of SECRET_NAMES) delete env[name];
  return execFileSync(program, args, {
    env: { ...env, ...signingEnv },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function releaseApks(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return releaseApks(path);
    // Não segue symlinks, nem aceita APKs debug ou já assinados.
    return entry.isFile() &&
      /[\\/]release[\\/][^\\/]+-release-unsigned\.apk$/.test(path)
      ? [path]
      : [];
  });
}

export function signAndroidRelease(options: SigningOptions): void {
  const { secrets, outputFile, tempDirectory, buildToolsDirectory } = options;
  validateSigningSecrets(secrets);
  if (existsSync(outputFile))
    throw new Error("O APK de saída já existe; assinatura cancelada.");
  const apks = existsSync(options.apkDirectory)
    ? releaseApks(options.apkDirectory)
    : [];
  if (apks.length !== 1)
    throw new Error("É necessário exatamente um APK release sem assinatura.");
  const input = apks[0]!;
  const run = options.run ?? execute;
  const invoke = (
    stage: string,
    program: string,
    args: string[],
    env?: NodeJS.ProcessEnv,
  ) => {
    try {
      return run({ program, args, env });
    } catch {
      // Não propaga stdout/stderr: ferramentas podem repetir alias, senhas ou conteúdo do keystore.
      throw new Error(
        `Falha ao ${stage}. Confira keystore, credenciais e ferramentas Android.`,
      );
    }
  };
  const tool = (name: string) => join(buildToolsDirectory, name);
  const workspace = mkdtempSync(
    join(resolve(tempDirectory), "agrohacka-signing-"),
  );
  try {
    chmodSync(workspace, 0o700);
    const keystore = join(workspace, "release.jks");
    const aligned = join(workspace, "aligned.apk");
    const signed = join(workspace, "signed.apk");
    writeFileSync(
      keystore,
      Buffer.from(
        secrets.ANDROID_KEYSTORE_BASE64!.replace(/\s/g, ""),
        "base64",
      ),
      { mode: 0o600, flag: "wx" },
    );
    const pem = invoke(
      "ler certificado",
      "keytool",
      [
        "-exportcert",
        "-rfc",
        "-keystore",
        keystore,
        "-alias",
        secrets.ANDROID_KEY_ALIAS!,
        "-storepass:env",
        "ANDROID_KEYSTORE_PASSWORD",
      ],
      {
        ANDROID_KEYSTORE_PASSWORD: secrets.ANDROID_KEYSTORE_PASSWORD,
      },
    );
    let certificate: X509Certificate;
    try {
      certificate = new X509Certificate(pem);
    } catch {
      throw new Error("Certificado de assinatura inválido.");
    }
    if (/(?:^|\n)CN=Android Debug(?:\n|$)/i.test(certificate.subject)) {
      throw new Error("Certificado debug não pode assinar um release.");
    }
    const manifest = invoke("inspecionar pacote", tool("aapt2"), [
      "dump",
      "badging",
      input,
    ]);
    if (
      !/^package: name='com\.agrohack\.desktop'/m.test(manifest) ||
      /\bapplication-debuggable\b/.test(manifest)
    ) {
      throw new Error(
        "Pacote inválido: esperado com.agrohack.desktop release sem depuração.",
      );
    }
    // Ordem oficial Android: alinhamento -> assinatura -> verificação, sem alterar o APK assinado.
    invoke("alinhar APK", tool("zipalign"), ["-P", "16", "4", input, aligned]);
    invoke(
      "assinar APK",
      tool("apksigner"),
      [
        "sign",
        "--ks",
        keystore,
        "--ks-key-alias",
        secrets.ANDROID_KEY_ALIAS!,
        "--ks-pass",
        "env:ANDROID_KEYSTORE_PASSWORD",
        "--key-pass",
        "env:ANDROID_KEY_PASSWORD",
        "--v4-signing-enabled",
        "false",
        "--out",
        signed,
        aligned,
      ],
      {
        ANDROID_KEYSTORE_PASSWORD: secrets.ANDROID_KEYSTORE_PASSWORD,
        ANDROID_KEY_PASSWORD: secrets.ANDROID_KEY_PASSWORD,
      },
    );
    const report = invoke("verificar assinatura", tool("apksigner"), [
      "verify",
      "--verbose",
      "--print-certs",
      signed,
    ]);
    const fingerprints = [
      ...report.matchAll(
        /^Signer #\d+ certificate SHA-256 digest: ([a-f\d]{64})\s*$/gim,
      ),
    ];
    const expected = certificate.fingerprint256
      .replaceAll(":", "")
      .toLowerCase();
    if (
      fingerprints.length !== 1 ||
      fingerprints[0]![1]!.toLowerCase() !== expected
    ) {
      throw new Error(
        "Assinatura não corresponde ao certificado release esperado.",
      );
    }
    invoke("verificar alinhamento", tool("zipalign"), [
      "-c",
      "-P",
      "16",
      "4",
      signed,
    ]);
    if (!statSync(signed).size) throw new Error("APK assinado vazio.");
    mkdirSync(dirname(outputFile), { recursive: true });
    copyFileSync(signed, outputFile, constants.COPYFILE_EXCL);
  } finally {
    // Apenas o diretório exclusivo criado nesta chamada pode ser removido.
    if (dirname(workspace) !== resolve(tempDirectory))
      throw new Error("Diretório temporário de assinatura inesperado.");
    rmSync(workspace, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv[2] === "--validate-secrets" && process.argv.length === 3) {
      validateSigningSecrets(process.env);
      console.log("Secrets de assinatura Android validados.");
    } else if (process.argv[2] === "--sign" && process.argv.length === 6) {
      if (!process.env.RUNNER_TEMP)
        throw new Error("RUNNER_TEMP é obrigatório para assinatura no CI.");
      signAndroidRelease({
        apkDirectory: process.argv[3]!,
        outputFile: process.argv[4]!,
        buildToolsDirectory: process.argv[5]!,
        tempDirectory: process.env.RUNNER_TEMP,
        secrets: process.env,
      });
      console.log("APK release assinado e verificado.");
    } else {
      throw new Error(
        "Uso: assinar-android-release.ts --validate-secrets | --sign <apks> <saída.apk> <build-tools>",
      );
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Falha na assinatura Android.",
    );
    process.exitCode = 1;
  }
}
