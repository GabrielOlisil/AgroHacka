// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import OperatorsPanel from "../src/components/OperatorsPanel.vue";

const paired = {
  id: "ana",
  farmId: "f",
  nomeOperador: "Ana",
  ativo: true,
  pairingCode: "AGRO-1234",
  createdAt: "2026-10-01T12:00:00Z",
};
function setup(operators = [paired]) {
  const props = {
    operators,
    loading: false,
    error: "",
    refresh: vi.fn(),
    connect: vi.fn(),
  };
  return { props, wrapper: mount(OperatorsPanel, { props }) };
}
describe("paired operators and code recovery", () => {
  it("mantém a orientação de compartilhamento junto ao código, sem explicar a API", async () => {
    const { wrapper } = setup();
    expect(wrapper.text()).not.toContain("conexão com a API");
    expect(wrapper.text()).not.toContain("São os mesmos registros criados");
    await wrapper.get('[data-testid="reveal-ana"]').trigger("click");
    expect(wrapper.text()).toMatch(/compartilhe.*Ana/i);
    wrapper.unmount();
  });
  it("reveals and hides the original pairing code without creating another operator", async () => {
    const { wrapper, props } = setup();
    expect(wrapper.text()).toContain("Ana");
    expect(wrapper.text()).not.toContain("AGRO-1234");
    await wrapper.get('[data-testid="reveal-ana"]').trigger("click");
    expect(wrapper.text()).toContain("AGRO-1234");
    expect(wrapper.text()).toMatch(/mesmo código/i);
    await wrapper.get('[data-testid="reveal-ana"]').trigger("click");
    expect(wrapper.text()).not.toContain("AGRO-1234");
    expect(props.connect).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it("offers connection for an empty list and refresh without a second local registration form", async () => {
    const { wrapper, props } = setup([]);
    expect(wrapper.text()).toContain("Nenhum operador pareado");
    expect(wrapper.find("form").exists()).toBe(false);
    await wrapper.get('[data-testid="connect-existing-flow"]').trigger("click");
    expect(props.connect).toHaveBeenCalledOnce();
    await wrapper.get('[data-testid="refresh-operators"]').trigger("click");
    expect(props.refresh).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
  it("filters existing pairings by name and status and does not expose inactive codes", async () => {
    const { wrapper } = setup([
      paired,
      {
        ...paired,
        id: "bruno",
        nomeOperador: "Bruno",
        ativo: false,
        pairingCode: null,
      } as never,
    ]);
    expect(wrapper.find('[data-testid="reveal-bruno"]').exists()).toBe(false);
    await wrapper.get('[aria-label="Buscar operadores"]').setValue("bruno");
    expect(wrapper.find('[data-testid="operator-ana"]').exists()).toBe(false);
    await wrapper.get('[aria-label="Filtrar situação"]').setValue("active");
    expect(wrapper.text()).toContain("Nenhum operador corresponde aos filtros");
    wrapper.unmount();
  });
  it("shows network errors instead of an empty success and disables refresh while loading", async () => {
    const { wrapper } = setup([]);
    await wrapper.setProps({ error: "Sem conexão com a API" });
    expect(wrapper.get('[role="alert"]').text()).toContain("Sem conexão");
    expect(wrapper.text()).not.toContain("Nenhum operador pareado");
    await wrapper.setProps({ error: "", loading: true });
    expect(
      wrapper.get('[data-testid="refresh-operators"]').attributes("disabled"),
    ).toBeDefined();
    expect(wrapper.text()).toContain("Consultando operadores");
    wrapper.unmount();
  });
  it("hides a revealed code when the list refreshes or access changes", async () => {
    const { wrapper } = setup();
    await wrapper.get('[data-testid="reveal-ana"]').trigger("click");
    await wrapper.setProps({ operators: [{ ...paired }] });
    expect(wrapper.text()).not.toContain("AGRO-1234");
    wrapper.unmount();
  });
});
