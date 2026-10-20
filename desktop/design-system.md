# Design System Visual — Terra Forte Desktop

Design system visual para um aplicativo desktop em Vue.js + Tauri.

A linguagem deve transmitir robustez, precisão e sobriedade, com influência agroindustrial. O visual deve ser funcional, limpo e técnico.

---

## 1. Princípios visuais

- Sem gradientes.
- Sem bordas arredondadas.
- Sem glassmorphism.
- Poucas sombras.
- Contraste forte e controlado.
- Componentes compactos.
- Aparência sólida e operacional.
- Amarelo usado como destaque, não como cor dominante.
- Verde usado como base de identidade.
- Superfícies claras para conteúdo e leitura.
- Todos os ícones da aplicação devem usar exclusivamente **Lucide Icons**.

---

## 2. Cores

```css
:root {
  --color-primary: #233B2B;
  --color-accent: #E3B71A;
  --color-secondary: #4A5B2E;
  --color-support: #6B4A2B;

  --color-text: #14181A;
  --color-background: #F2EFE6;
  --color-surface: #FFFFFF;
}
```

### Função das cores

| Token | Hex | Uso |
|---|---|---|
| `primary` | `#233B2B` | Base da identidade, elementos fortes e navegação |
| `accent` | `#E3B71A` | Ações principais, seleção e foco |
| `secondary` | `#4A5B2E` | Estados positivos e elementos secundários |
| `support` | `#6B4A2B` | Informações auxiliares e categorias |
| `text` | `#14181A` | Texto e ícones principais |
| `background` | `#F2EFE6` | Fundo geral |
| `surface` | `#FFFFFF` | Cards, campos, tabelas e painéis |

---

## 3. Texto

```css
:root {
  --text-primary: #14181A;
  --text-secondary: rgba(20, 24, 26, 0.68);
  --text-muted: rgba(20, 24, 26, 0.48);
  --text-disabled: rgba(20, 24, 26, 0.32);
  --text-on-dark: #F2EFE6;
}
```

Regras:

- Texto principal sempre em `--text-primary`.
- Descrições e metadados em `--text-secondary`.
- Placeholder e informações pouco relevantes em `--text-muted`.
- Evitar preto puro `#000000`.

---

## 4. Tipografia

Fonte principal:

```css
--font-family: "Inter", "Segoe UI", sans-serif;
```

Fallback:

```css
font-family:
  "Inter",
  "Segoe UI",
  system-ui,
  -apple-system,
  sans-serif;
```

### Escala

```css
--font-size-xs: 11px;
--font-size-sm: 12px;
--font-size-md: 14px;
--font-size-lg: 16px;
--font-size-xl: 20px;
--font-size-2xl: 26px;
```

### Pesos

```css
--font-regular: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Uso

```text
Texto auxiliar       11–12px
Texto comum          13–14px
Botões               13–14px
Labels               12–13px
Subtítulos           16px
Títulos              20–26px
Valores importantes  22–28px
```

Evitar pesos acima de `700`.

---

## 5. Line-height

```css
--line-height-tight: 1.2;
--line-height-normal: 1.4;
--line-height-relaxed: 1.6;
```

Uso recomendado:

```text
Títulos        1.2
Controles      1.2
Texto comum    1.4
Descrições     1.5–1.6
```

---

## 6. Espaçamento

Escala baseada em múltiplos de 4px.

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  --space-9: 48px;
}
```

### Uso recomendado

```text
Ícone + texto               8px
Label + campo               6–8px
Entre campos relacionados   12px
Entre componentes           16px
Padding interno padrão      12–16px
Padding de painéis          16–20px
Entre grupos                24px
Entre seções                32px
```

Evitar espaçamentos arbitrários como `13px`, `17px`, `27px`.

---

## 7. Bordas

Todos os cantos são retos.

```css
--radius: 0;
```

Espessuras:

```css
--border-width: 1px;
--border-width-strong: 2px;
```

Cores:

```css
--border-subtle: rgba(20, 24, 26, 0.10);
--border-default: rgba(20, 24, 26, 0.18);
--border-strong: rgba(20, 24, 26, 0.30);
```

Regra geral:

```css
border: 1px solid var(--border-default);
border-radius: 0;
```

---

## 8. Sombras

Sombras devem ser discretas e pouco utilizadas.

```css
--shadow-xs: 0 1px 2px rgba(20, 24, 26, 0.06);
--shadow-sm: 0 2px 6px rgba(20, 24, 26, 0.10);
--shadow-md: 0 6px 18px rgba(20, 24, 26, 0.14);
```

Uso:

- `shadow-xs`: pequenas superfícies sobrepostas.
- `shadow-sm`: dropdowns e popovers.
- `shadow-md`: modais e overlays importantes.

Evitar sombras coloridas, decorativas ou em todos os cards.

---

## 9. Botões

Alturas:

```css
--button-height-sm: 28px;
--button-height-md: 34px;
--button-height-lg: 40px;
```

Padding horizontal:

```css
--button-padding-sm: 10px;
--button-padding-md: 14px;
--button-padding-lg: 18px;
```

Tipografia:

```css
font-size: 13px;
font-weight: 600;
```

Todos os botões:

```css
border-radius: 0;
cursor: pointer;

transition:
  background-color 120ms ease,
  border-color 120ms ease,
  color 120ms ease;
```

### Primary

```css
.button-primary {
  background: #E3B71A;
  color: #14181A;
  border: 1px solid #E3B71A;
}
```

### Secondary

```css
.button-secondary {
  background: #FFFFFF;
  color: #233B2B;
  border: 1px solid #233B2B;
}
```

### Ghost

```css
.button-ghost {
  background: transparent;
  color: #14181A;
  border: 1px solid transparent;
}
```

---

## 10. Inputs

```css
.input {
  height: 34px;
  padding: 0 10px;

  background: #FFFFFF;
  color: #14181A;

  border: 1px solid rgba(20, 24, 26, 0.18);
  border-radius: 0;

  font-size: 13px;
}
```

Focus:

```css
.input:focus {
  border-color: #233B2B;
}
```

Disabled:

```css
.input:disabled {
  background: rgba(20, 24, 26, 0.04);
  color: rgba(20, 24, 26, 0.40);
}
```

---

## 11. Focus

Todo elemento interativo deve ter foco visível.

```css
:focus-visible {
  outline: 2px solid #E3B71A;
  outline-offset: 1px;
}
```

---

## 12. Cards e superfícies

```css
.card {
  background: #FFFFFF;
  border: 1px solid rgba(20, 24, 26, 0.08);
  border-radius: 0;
  padding: 16px;
  box-shadow: none;
}
```

Separação visual deve vir de:

```text
background
border
spacing
```

---

## 13. Badges

```css
.badge {
  min-height: 22px;
  padding: 0 8px;

  font-size: 11px;
  font-weight: 600;

  border-radius: 0;
}
```

### Positive

```css
background: #4A5B2E;
color: #FFFFFF;
```

### Highlight

```css
background: #E3B71A;
color: #14181A;
```

### Support

```css
background: #6B4A2B;
color: #FFFFFF;
```

### Neutral

```css
background: #14181A;
color: #FFFFFF;
```

---

## 14. Ícones

A aplicação deve usar **exclusivamente a biblioteca Lucide Icons**.

Não utilizar:

- Font Awesome;
- Material Icons;
- Heroicons;
- Tabler Icons;
- Phosphor;
- SVGs customizados para ícones comuns;
- emojis como substituição de ícones.

### Biblioteca

Para Vue:

```bash
npm install lucide-vue-next
```

Exemplo:

```vue
<script setup>
import {
  Search,
  Plus,
  Save,
  Settings,
  Trash2
} from 'lucide-vue-next'
</script>
```

Uso:

```vue
<Search :size="16" :stroke-width="1.75" />
```

### Tamanhos

```css
--icon-xs: 14px;
--icon-sm: 16px;
--icon-md: 18px;
--icon-lg: 20px;
--icon-xl: 24px;
```

Uso recomendado:

```text
Botões pequenos      14px
Botões comuns        16px
Inputs               16px
Menus                18px
Destaques            20px
Estados vazios       24px
```

### Stroke

Espessura padrão:

```text
1.75
```

Para contextos pequenos ou densos:

```text
1.5
```

Para ícones de maior destaque:

```text
2
```

Evitar misturar espessuras arbitrariamente.

### Cor

Ícones devem herdar a cor do componente:

```css
.lucide {
  color: currentColor;
}
```

### Regras de uso

- Não misturar estilos filled e outline.
- Usar sempre a variante padrão outline do Lucide.
- Manter tamanho consistente dentro do mesmo contexto.
- Ícones dentro de botões devem estar alinhados ao texto.
- Distância padrão entre ícone e texto: `8px`.
- Ícones sem texto devem ter tooltip quando a ação não for óbvia.
- Não modificar manualmente o desenho interno dos ícones.
- Não usar ícones puramente decorativos sem função.

### Exemplos semânticos

```text
Search          Busca
Plus            Criar / adicionar
Save            Salvar
Trash2          Excluir
Pencil          Editar
Settings        Configurações
Download        Exportar
Upload          Importar
RefreshCw       Atualizar
Filter          Filtrar
ChevronDown     Expandir
ChevronRight    Navegação
X               Fechar
Check           Confirmar
CircleAlert     Alerta
CircleCheck     Sucesso
Info            Informação
Eye             Visualizar
EyeOff          Ocultar
MoreVertical    Mais ações
```

---

## 15. Botões com ícone

```css
.button-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
```

Exemplo:

```vue
<button class="button-primary button-with-icon">
  <Save :size="16" :stroke-width="1.75" />
  Salvar
</button>
```

---

## 16. Botões somente com ícone

```css
.icon-button {
  width: 32px;
  height: 32px;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  padding: 0;

  background: transparent;
  color: #14181A;

  border: 1px solid transparent;
  border-radius: 0;
}
```

Exemplo:

```vue
<button class="icon-button" aria-label="Editar">
  <Pencil :size="16" :stroke-width="1.75" />
</button>
```

---

## 17. Divisores

```css
.divider {
  height: 1px;
  background: rgba(20, 24, 26, 0.10);
}
```

---

## 18. Transições

```css
--transition-fast: 100ms ease;
--transition-default: 140ms ease;
--transition-slow: 180ms ease;
```

Usar apenas em:

- hover;
- focus;
- abertura e fechamento;
- cor;
- borda;
- opacidade.

---

## 19. Tokens consolidados

```css
:root {
  /* Colors */
  --color-primary: #233B2B;
  --color-accent: #E3B71A;
  --color-secondary: #4A5B2E;
  --color-support: #6B4A2B;

  --color-text: #14181A;
  --color-background: #F2EFE6;
  --color-surface: #FFFFFF;

  /* Text */
  --text-primary: #14181A;
  --text-secondary: rgba(20, 24, 26, 0.68);
  --text-muted: rgba(20, 24, 26, 0.48);
  --text-disabled: rgba(20, 24, 26, 0.32);
  --text-on-dark: #F2EFE6;

  /* Borders */
  --border-subtle: rgba(20, 24, 26, 0.10);
  --border-default: rgba(20, 24, 26, 0.18);
  --border-strong: rgba(20, 24, 26, 0.30);

  /* Typography */
  --font-family: "Inter", "Segoe UI", system-ui, sans-serif;

  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;
  --font-size-2xl: 26px;

  --font-regular: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  --space-9: 48px;

  /* Radius */
  --radius: 0;

  /* Controls */
  --control-sm: 28px;
  --control-md: 34px;
  --control-lg: 40px;

  /* Icons - Lucide */
  --icon-xs: 14px;
  --icon-sm: 16px;
  --icon-md: 18px;
  --icon-lg: 20px;
  --icon-xl: 24px;

  /* Shadows */
  --shadow-xs: 0 1px 2px rgba(20, 24, 26, 0.06);
  --shadow-sm: 0 2px 6px rgba(20, 24, 26, 0.10);
  --shadow-md: 0 6px 18px rgba(20, 24, 26, 0.14);

  /* States */
  --hover-background: rgba(20, 24, 26, 0.05);
  --selection-background: rgba(227, 183, 26, 0.16);

  /* Animation */
  --transition-fast: 100ms ease;
  --transition-default: 140ms ease;
}
```

---

## 20. Resumo da linguagem visual

```text
Cantos
0px

Botões
Retangulares, compactos, 34px de altura

Ícones
Lucide Icons exclusivamente

Stroke padrão dos ícones
1.75

Tamanho padrão dos ícones
16px

Accent
#E3B71A

Base de marca
#233B2B

Texto
#14181A

Fundo
#F2EFE6

Superfície
#FFFFFF

Fonte
Inter / Segoe UI

Texto padrão
14px

Bordas
1px sólidas

Sombras
Discretas e apenas em overlays

Spacing base
4px

Padding comum
12–16px

Animações
100–140ms

Gradientes
Não usar
```