// Alguns navegadores e WebViews só abrem o calendário pelo ícone pequeno (ou nem
// isso). Um toque em qualquer parte do campo de data abre o calendário.
// Em cima do ícone nativo (últimos 40 px), o próprio navegador abre o seletor;
// chamar showPicker() ali também fazia o seletor fechar (visto no Firefox).
const NATIVE_ICON_WIDTH = 40;

export function openPicker(event: MouseEvent) {
  const input = event.currentTarget as HTMLInputElement;
  if (input.clientWidth && event.offsetX > input.clientWidth - NATIVE_ICON_WIDTH)
    return;
  try {
    input.showPicker?.();
  } catch {
    // Sem suporte ou sem gesto do usuário: o campo continua funcionando normalmente.
  }
}
