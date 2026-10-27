// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import OperatorsPanel from "../src/components/OperatorsPanel.vue";

const operator = {
  id: "a",
  farmId: "f",
  nomeOperador: "Ana",
  ativo: true,
  pairingCode: "AGRO-TEST",
  createdAt: "2026-10-27T12:00:00Z",
};
function setup() {
  const props = {
    operators: [operator],
    loading: false,
    error: "",
    refresh: vi.fn(),
    connect: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  return { props, wrapper: mount(OperatorsPanel, { props }) };
}
describe("manager operator actions", () => {
  it("edits the operator name without replacing pairing codes or movements", async () => {
    const { wrapper, props } = setup();
    await wrapper.get('[data-testid="edit-a"]').trigger("click");
    await wrapper.get('[aria-label="Nome do operador"]').setValue("  Maria  ");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(props.update).toHaveBeenCalledWith("a", { nomeOperador: "Maria" });
    expect(props.remove).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it.each([true, false])("toggles access from active=%s", async (active) => {
    const { wrapper, props } = setup();
    await wrapper.setProps({
      operators: [
        {
          ...operator,
          ativo: active,
          pairingCode: active ? "AGRO-TEST" : null,
        },
      ] as never,
    });
    await wrapper.get('[data-testid="toggle-a"]').trigger("click");
    await flushPromises();
    expect(props.update).toHaveBeenCalledWith("a", { ativo: !active });
    wrapper.unmount();
  });
  it("requires explicit confirmation, keeps pending/offline implications visible and supports cancellation", async () => {
    const { wrapper, props } = setup();
    await wrapper.get('[data-testid="delete-a"]').trigger("click");
    expect(props.remove).not.toHaveBeenCalled();
    const dialog = wrapper.get('[role="alertdialog"]');
    expect(dialog.text()).toContain("Ana");
    expect(dialog.text()).toMatch(/sincroniz.*pend[êe]ncias/i);
    expect(dialog.text()).toMatch(/movimenta[çc][õo]es.*mantid/i);
    await dialog.get('[data-testid="cancel-delete-operator"]').trigger("click");
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false);
    expect(props.remove).not.toHaveBeenCalled();
    await wrapper.get('[data-testid="delete-a"]').trigger("click");
    await wrapper
      .get('[data-testid="confirm-delete-operator"]')
      .trigger("click");
    await flushPromises();
    expect(props.remove).toHaveBeenCalledExactlyOnceWith("a");
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it("keeps the confirmation on failure and prevents double deletion", async () => {
    const { wrapper, props } = setup();
    let fail!: (cause: Error) => void;
    props.remove.mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    await wrapper.get('[data-testid="delete-a"]').trigger("click");
    await wrapper
      .get('[data-testid="confirm-delete-operator"]')
      .trigger("click");
    await wrapper
      .get('[data-testid="confirm-delete-operator"]')
      .trigger("click");
    expect(props.remove).toHaveBeenCalledOnce();
    fail(new Error("Sem conexão"));
    await flushPromises();
    expect(wrapper.get('[role="alertdialog"]').text()).toContain("Sem conexão");
    expect(wrapper.text()).toContain("Ana");
    wrapper.unmount();
  });
  it("does not send blank names and keeps the typed name on failure", async () => {
    const { wrapper, props } = setup();
    await wrapper.get('[data-testid="edit-a"]').trigger("click");
    await wrapper.get('[aria-label="Nome do operador"]').setValue(" ");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(props.update).not.toHaveBeenCalled();
    props.update.mockRejectedValue(new Error("Sem conexão"));
    await wrapper.get('[aria-label="Nome do operador"]').setValue("Maria");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("Sem conexão");
    expect(
      (
        wrapper.get('[aria-label="Nome do operador"]')
          .element as HTMLInputElement
      ).value,
    ).toBe("Maria");
    wrapper.unmount();
  });
});
