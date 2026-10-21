@echo off
:: ============================================================================
:: AgroHacka - Script de Liberacao de Porta no Firewall do Windows (Tarefa 5.1)
:: Abre a porta TCP 3333 para o servidor local (LAN) no perfil privado.
:: Deve ser executado como Administrador.
:: ============================================================================

echo [AgroHacka] Configurando regra de Firewall do Windows...
netsh advfirewall firewall add rule name="AgroHack Local Server" dir=in action=allow protocol=TCP localport=3333 profile=private

if %ERRORLEVEL% EQU 0 (
    echo [AgroHacka] Regra de Firewall criada com sucesso! Porta 3333 liberada para comunicacao local.
) else (
    echo [AgroHacka] ATENCAO: Nao foi possivel adicionar a regra. Execute este arquivo como Administrador.
)
pause
