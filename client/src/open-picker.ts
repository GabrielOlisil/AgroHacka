// Alguns navegadores e WebViews só abrem o calendário pelo ícone pequeno (ou nem
// isso). Um toque em qualquer parte do campo de data abre o calendário.
export function openPicker(event: Event) {
  try {
    (event.currentTarget as HTMLInputElement).showPicker?.();
  } catch {
    // Sem suporte ou sem gesto do usuário: o campo continua funcionando normalmente.
  }
}
