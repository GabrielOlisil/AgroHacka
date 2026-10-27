# Android release assinado

O workflow `.github/workflows/build-release.yml` compila o APK arm64 em release,
sem `--debug`. Depois alinha, assina e verifica o pacote antes de disponibilizar
`agrohacka-arm64-release.apk`. Não publica APK debug nem APK sem assinatura.

## Configuração única no GitHub

Em **Settings → Secrets and variables → Actions**, cadastrar os quatro secrets:

| Secret | Conteúdo |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Arquivo de keystore release codificado em base64 |
| `ANDROID_KEY_ALIAS` | Alias da chave dentro do keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Senha do keystore |
| `ANDROID_KEY_PASSWORD` | Senha da chave; pode ser igual à do keystore |

Usar uma chave release persistente da equipe, com backup privado. Reutilizar a
mesma chave nas atualizações futuras. Não versionar keystore ou senhas nem
inseri-los em `.env`; o workflow recebe os secrets somente nos passos pertinentes.
Se faltar um secret, o job Android para antes da compilação.

Se ainda não existir chave release, gerar uma vez com Java `keytool` em uma pasta
privada fora do repositório. Exemplo no PowerShell, com senhas solicitadas de forma
interativa:

```powershell
keytool -genkeypair -v -keystore "$env:USERPROFILE/agrohacka-release.jks" -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 -alias agrohacka-release
```

Para obter o base64 sem imprimir a chave no terminal, copiar o conteúdo para a
área de transferência e colar apenas no secret `ANDROID_KEYSTORE_BASE64`:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE/agrohacka-release.jks")) | Set-Clipboard
```

O alias do exemplo é `agrohacka-release`; usar as senhas definidas na geração.
Limpar a área de transferência depois de salvar o secret. Esta documentação não
significa que a chave ou os secrets já foram criados/configurados.

## Publicação e verificação

Após integrar a alteração, executar o workflow manualmente para conferir os
artefatos ou publicar uma **nova tag** pelo fluxo da equipe. A release pública
continua restrita a tags `v*`; não substituir tags já avaliadas.

O script `src/scripts/assinar-android-release.ts` exige um único APK release sem
assinatura, identifica o pacote `com.agrohack.desktop`, recusa depuração e
certificado debug e usa `zipalign` → `apksigner sign` → `apksigner verify`.
Confere a impressão digital do certificado e só então copia o APK para o upload.
O keystore temporário é removido no encerramento do passo.

Os testes locais usam certificados públicos e arquivos fictícios, sem chaves
privadas de distribuição. Eles não substituem a execução do CI com os secrets
da equipe nem a instalação do APK resultante no aparelho.

O teste real opcional de `tests/android-release-signing.spec.ts` gera uma chave
descartável e um APK mínimo, assina e confere o resultado com as ferramentas do
Android. Para executá-lo, colocar Java no `PATH`, apontar
`ANDROID_SIGNING_TEST_BUILD_TOOLS` para a pasta do SDK que contém `aapt2`,
`zipalign` e `apksigner`, e `ANDROID_SIGNING_TEST_PLATFORM_JAR` para o `android.jar`
de uma plataforma instalada. Essas são opções temporárias do processo de teste,
não alterações em arquivos `.env`. Sem elas, somente esse teste fica ignorado.

## Instalação anterior em debug

A configuração existente usa o identificador `com.agrohack.desktop.debug` no
debug; o release usa `com.agrohack.desktop`. Por isso, os dois podem coexistir,
com armazenamentos SQLite independentes. **O release não herda automaticamente
o SQLite, a sessão ou os backups do debug.**

Antes da transição, sincronizar as pendências do debug, conferir os registros no
gestor e manter essa instalação até validar o release. Instalar o release,
entrar/parear e sincronizar novamente. Se houver registros para revisão,
resolvê-los com o gestor antes de retirar a instalação anterior. Não desinstalar
nem limpar dados para contornar falha de assinatura ou tentar migrar o SQLite.
Uma transferência automática entre esses identificadores não faz parte desta alteração.

Referências: [assinatura Android no Tauri](https://v2.tauri.app/distribute/sign/android/),
[apksigner do Android SDK](https://developer.android.com/tools/apksigner) e
[identificador debug no Tauri](https://v2.tauri.app/reference/config/#androidconfig).
